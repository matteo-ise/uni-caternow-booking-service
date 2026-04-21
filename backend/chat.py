"""
Streaming chat endpoint bridging Gemini's sync SDK to FastAPI's async responses.

Uses a thread+queue pattern: a background thread runs the synchronous Gemini
streaming call and pushes tokens into a queue, while the async generator polls
it with 20ms sleeps to avoid blocking the event loop. On 503s we retry the same
model twice, then downgrade to flash-lite as a last resort.

After streaming, a "snap-back" verification layer cross-checks AI-suggested dish
names against the actual DB — because LLMs will confidently hallucinate dish names
that don't exist in our catalog.
"""
import os
import json
import asyncio
import logging
import threading
import queue
import re
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from google import genai
from google.genai import types
from dotenv import load_dotenv

from database import SessionLocal, get_db
from db_models import DBDish, DBUser, DBUserMemory
from auth import get_optional_user
from models import Message, WizardData, ChatRequest
from research import run_company_research, find_hq_address, patch_memory_with_research
from memory import get_memory, update_memory_async, save_research_sidecar
from embeddings import find_similar_dishes

logger = logging.getLogger(__name__)

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

router = APIRouter()

# Flash for speed — thinking disabled because we need sub-second first-token latency
GEMINI_MODEL = "gemini-2.5-flash"
GEMINI_FALLBACK_MODEL = "gemini-2.5-flash-lite"

# Module-level caches: these survive across requests within the same process.
# Trade-off: no cross-instance sync (fine for single-dyno Render), but avoids
# the complexity and latency of Redis for what's essentially ephemeral lead data.
_lead_research_cache: dict = {}
_lead_prefetch_in_progress: set = set()

# Lazy-init: avoids SDK setup during import, shaves ~200ms off cold starts on Render
_client: genai.Client | None = None

def _get_client() -> genai.Client:
    global _client
    if _client is None:
        _client = genai.Client(
            api_key=os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
        )
    return _client

# German system prompt is intentional — CaterNow targets the DACH market (DE/AT/CH),
# and keeping the prompt in German produces noticeably better German output from Gemini.
BASE_SYSTEM_PROMPT = """Du bist Catersmart Chat, der charmanteste Menü-Verkäufer der Welt.

STRIKTE REGELN:
- KEINE erfundenen Gerichte. Nutze NUR Namen aus der Liste.
- TEXT-STIL: Extrem kurz, knackig, emoji-reich.
- KEINE GEDANKENSTRICHE: Nutze niemals "—" oder "–". Verwende nur einfache Bindestriche "-" oder Kommas.
- STALKER-FEELING: Nutze die recherchierten Firmen-Infos (Werte, Slogan, Farben, Standort) rigeros in deinen Sätzen. Zeige dem Kunden, dass wir ihn "verstehen".
- NIEMALS FRAGEN: Frage den Kunden NIEMALS nach Firmenwerten, Slogan, Farben, Branche oder anderen Firmeninfos. Diese werden automatisch recherchiert und stehen dir bereits zur Verfügung.
- KEINE PLATZHALTER IM OUTPUT: Zeige dem Nutzer NIEMALS interne Platzhalter, Template-Text oder fehlende Daten. Begriffe wie "Unbekannt", "Kein Slogan", "None", "Firmenname", "Analyse-Modus", "[Firma]", "Recherche-Timeout", "Privat/Unbekannt" dürfen NIEMALS im Chat-Text erscheinen. Wenn Research-Daten fehlen oder Platzhalter enthalten, ignoriere sie komplett und arbeite einfach ohne Firmen-Bezug weiter. Mache nie auf fehlende Daten aufmerksam.
- STORYTELLING: Baue ein Narrativ um das Event. Nutze Firmen-Infos NUR wenn echte Daten vorhanden sind (nicht "Unbekannt"). Ohne Firmen-Infos fokussiere auf das Event, die Gäste und das Essen.
- MULTI-MESSAGES: Nutze "|||", um Nachrichten für eine bessere Dynamik zu trennen.
- UPSELLING: Sobald HP1 steht, biete HP2 an.
- 3-GÄNGE SOFORT: Schlage beim ersten Vorschlag IMMER direkt Vorspeise, Hauptgericht 1 und Dessert gleichzeitig vor. Präsentiere alle drei Gänge in einer Nachricht mit kurzem Pitch pro Gang. Hauptgericht 2 kommt erst später als Upsell.
- BESTAETIGTE GERICHTE: Wenn der Kunde einen Gang bereits bestätigt hat, schlage KEINEN Ersatz dafür vor. Ändere nur unbestätigte Gänge.

MISSION:
1. Schlage direkt 3 Gänge vor: Vorspeise + Hauptgericht 1 + Dessert (sie erscheinen rechts im Canvas).
2. Im JSON-Block: Ersetze JEDEN name-Wert mit dem EXAKTEN Gerichtnamen aus der VERFÜGBARE GERICHTE Liste. Schreibe NIEMALS Platzhalter-Text in die name-Felder.
3. Beende IMMER mit diesem JSON Block:
[MENU_JSON]
{
  "vorspeise": {"name": "EXAKTER_GERICHTNAME_AUS_LISTE"},
  "hauptgericht1": {"name": "EXAKTER_GERICHTNAME_AUS_LISTE"},
  "hauptgericht2": {"name": "EXAKTER_GERICHTNAME_AUS_LISTE"},
  "dessert": {"name": "EXAKTER_GERICHTNAME_AUS_LISTE"}
}
[/MENU_JSON]
"""

def _get_official_dish(suggested_name: str, db: Session) -> Optional[DBDish]:
    """Look up official dish by case-insensitive exact match against the DB."""
    return db.query(DBDish).filter(DBDish.name.ilike(suggested_name.strip())).first()


# ── Prefetch endpoint ──────────────────────────────────────────────────────────

class PrefetchRequest(BaseModel):
    leadId: str
    companyName: str

@router.post("/research/prefetch")
async def prefetch_research(req: PrefetchRequest):
    """Fires a background research thread. Returns immediately so the user can start chatting."""
    lead_id = req.leadId
    company_name = req.companyName

    if not company_name:
        return {"status": "skipped", "reason": "no_company_name"}

    if lead_id in _lead_research_cache:
        return {"status": "already_cached"}

    if lead_id in _lead_prefetch_in_progress:
        return {"status": "already_in_progress"}

    _lead_prefetch_in_progress.add(lead_id)

    def _background_research():
        try:
            logger.info(f"[Prefetch] Starting background research for {company_name} (lead={lead_id})")
            research = run_company_research(company_name)
            # Grey colors = Gemini returned a fallback/error result, don't cache it
            is_real_result = research.company_colors != ["Grau"]
            if not is_real_result:
                logger.info(f"[Prefetch] Research returned fallback for {company_name} (likely 503), not caching so next request retries")
                return

            # If main research didn't find HQ address, run dedicated address mini-agent
            if not research.hq_address:
                logger.info(f"[Prefetch] HQ address missing, running address mini-agent for {research.company_name}")
                addr = find_hq_address(research.company_name or company_name)
                if addr:
                    research = research.model_copy(update={"hq_address": addr})
                    _research_cache[research.company_name or company_name] = research

            _lead_research_cache[lead_id] = research
            save_research_sidecar(lead_id, {
                "hq_address": research.hq_address,
                "logo_url": research.logo_url,
                "company_name": research.company_name,
                "fancy_score": research.fancy_score,
                "company_colors": research.company_colors,
            })
            # Patch the memory dossier with real data (replaces "Unbekannt" / "None" placeholders)
            patch_memory_with_research(lead_id, research)
            logger.info(f"[Prefetch] Completed for {company_name} (lead={lead_id}) — hq={research.hq_address}")
        except Exception as e:
            logger.error(f"[Prefetch Error] {company_name} (lead={lead_id}): {e}")
        finally:
            _lead_prefetch_in_progress.discard(lead_id)

    threading.Thread(target=_background_research, daemon=True).start()
    return {"status": "prefetch_started"}


# ── Chat endpoint ──────────────────────────────────────────────────────────────

@router.post("/chat")
async def chat(req: ChatRequest, current_user: Optional[dict] = Depends(get_optional_user)):
    conversation = req.conversation
    wizardData = req.wizardData
    leadId = req.leadId or "unknown"
    context_services = req.context_services or []

    # RAG: pull semantically similar dishes for the latest user message
    last_user_msg = conversation[-1].content
    similar_dishes = find_similar_dishes(last_user_msg, top_k=8)
    dishes_context = "VERFÜGBARE ECHTE GERICHTE (NUR DIESE NUTZEN):\n" + "\n".join(
        [f"- {d.name} ({d.kategorie})" for d in similar_dishes]
    )

    # Memory & Research
    memory_context = get_memory(leadId) or ""
    system_prompt = BASE_SYSTEM_PROMPT + "\n\n**LEAD MEMORY:**\n" + memory_context

    # Inject persistent user profile if authenticated
    if current_user:
        uid = current_user.get("uid")
        if uid:
            db = SessionLocal()
            try:
                user_mem = db.query(DBUserMemory).filter(DBUserMemory.firebase_uid == uid).first()
                if user_mem and user_mem.content:
                    system_prompt += "\n\n**USER PROFILE (persistent):**\n" + user_mem.content
            finally:
                db.close()

    hard_facts = wizardData.model_dump() if wizardData else {}

    if wizardData and wizardData.customerType == "business":
        if leadId in _lead_research_cache:
            # Prefetch already completed — use cached result immediately
            research = _lead_research_cache[leadId]
            hard_facts.update(research.model_dump())
            system_prompt += (
                f"\n**RESEARCH DATA:** {research.company_name}, "
                f"Score: {research.fancy_score}/100, "
                f"HQ Adresse: {research.hq_address}, "
                f"Logo: {research.logo_url}"
            )
            save_research_sidecar(leadId, {
                "hq_address": research.hq_address,
                "logo_url": research.logo_url,
                "company_name": research.company_name,
                "fancy_score": research.fancy_score,
                "company_colors": research.company_colors,
            })
        elif leadId not in _lead_prefetch_in_progress:
            # No prefetch running — run synchronously as fallback
            research = run_company_research(wizardData.companyName)
            _lead_research_cache[leadId] = research
            hard_facts.update(research.model_dump())
            system_prompt += (
                f"\n**RESEARCH DATA:** {research.company_name}, "
                f"Score: {research.fancy_score}/100, "
                f"HQ Adresse: {research.hq_address}, "
                f"Logo: {research.logo_url}"
            )
            save_research_sidecar(leadId, {
                "hq_address": research.hq_address,
                "logo_url": research.logo_url,
                "company_name": research.company_name,
                "fancy_score": research.fancy_score,
                "company_colors": research.company_colors,
            })
        else:
            # Prefetch still running — proceed without research for this message
            logger.info(f"[Chat] Prefetch in progress for {leadId}, skipping research for this message")

    async def stream_generator():
        full_reply = ""
        history = [
            types.Content(role=m.role, parts=[types.Part(text=m.content)])
            for m in conversation[:-1]
        ]
        chat_config = types.GenerateContentConfig(
            system_instruction=system_prompt + "\n\n" + dishes_context,
            thinking_config=types.ThinkingConfig(thinking_budget=0),
        )

        # Retry cascade: same model 2x on 503, then downgrade to lite.
        # Thread+queue bridges sync Gemini SDK into our async generator —
        # 20ms polling keeps latency low without busy-waiting the event loop.
        MAX_STREAM_RETRIES = 2
        stream_success = False
        models_to_try = [GEMINI_MODEL, GEMINI_FALLBACK_MODEL]

        _SENTINEL = object()

        def _sync_stream(model_name, q):
            """Run synchronous Gemini stream in a thread, push tokens to queue."""
            try:
                session = _get_client().chats.create(
                    model=model_name,
                    config=chat_config,
                    history=history,
                )
                for chunk in session.send_message_stream(last_user_msg):
                    q.put(chunk.text)
                q.put(_SENTINEL)
            except Exception as exc:
                q.put(exc)

        for model in models_to_try:
            if stream_success:
                break
            for attempt in range(MAX_STREAM_RETRIES + 1):
                q = queue.Queue()
                t = threading.Thread(target=_sync_stream, args=(model, q), daemon=True)
                t.start()
                try:
                    while True:
                        # Poll queue without blocking — 20ms is a good balance between
                        # responsiveness and not hammering the CPU
                        while q.empty():
                            await asyncio.sleep(0.02)
                        item = q.get_nowait()
                        if item is _SENTINEL:
                            break
                        if isinstance(item, Exception):
                            raise item
                        full_reply += item
                        yield item
                    stream_success = True
                    if model != GEMINI_MODEL:
                        logger.info(f"[Chat] Succeeded with fallback model {model}")
                    break
                except Exception as e:
                    if "503" in str(e) and attempt < MAX_STREAM_RETRIES:
                        wait = 4 * (attempt + 1)
                        logger.warning(f"[Chat] 503 on {model} attempt {attempt + 1}, retrying in {wait}s...")
                        await asyncio.sleep(wait)
                    elif "503" in str(e) and model != GEMINI_FALLBACK_MODEL:
                        logger.warning(f"[Chat] {model} exhausted retries, falling back to {GEMINI_FALLBACK_MODEL}")
                        break
                    else:
                        logger.error(f"[Chat Critical] {e}")
                        if "429" in str(e):
                            yield "Meine Leitung glüht gerade vor Begeisterung! 🔥 (Quota Limit erreicht, bitte kurz warten)"
                        else:
                            yield "Ups, da hat die Verbindung kurz gewackelt. 😉"
                        stream_success = True
                        break

        # ── Snap-back verification ──
        # The AI might suggest dish names that are close but not exact matches
        # (e.g. "Pasta Primavera" vs "Pasta alla Primavera"). We do a case-insensitive
        # DB lookup to snap each suggestion back to an official dish entry.
        match = re.search(r"\[MENU_JSON\](.*?)\[/MENU_JSON\]", full_reply, re.DOTALL)
        if match:
            try:
                suggested_json = json.loads(match.group(1).strip())
                db = SessionLocal()
                verified_menu = {}

                # AI uses German course names, frontend expects different keys
                mapping = {
                    "vorspeise": "vorspeise",
                    "hauptgericht1": "hauptspeise1",
                    "hauptgericht2": "hauptspeise2",
                    "dessert": "nachspeise",
                }

                for ai_key, frontend_key in mapping.items():
                    dish_name = suggested_json.get(ai_key, {}).get("name")
                    if dish_name:
                        official_dish = _get_official_dish(dish_name, db)
                        if official_dish:
                            # Default 0.95 for dishes not in the top-k RAG results —
                            # they matched by name but weren't in the embedding search
                            sim_score = 0.95
                            for d in similar_dishes:
                                if d.name == official_dish.name:
                                    sim_score = d.similarity_score
                                    break
                            verified_menu[frontend_key] = {
                                "id": official_dish.csv_id,
                                "name": official_dish.name,
                                "preis": official_dish.preis,
                                "image_url": official_dish.image_url,
                                "similarity_score": sim_score,
                            }
                db.close()

                if verified_menu:
                    yield f"\n[VERIFIED_JSON]\n{json.dumps(verified_menu)}\n[/VERIFIED_JSON]"
            except Exception as e:
                logger.error(f"[Verification Error] {e}")

        # Fire-and-forget: memory update runs in a background thread so we don't
        # hold the response open while Gemini rewrites the dossier
        clean_reply = re.sub(r"\[MENU_JSON\].*?\[/MENU_JSON\]", "", full_reply, flags=re.DOTALL).strip()
        if clean_reply:
            threading.Thread(
                target=update_memory_async,
                args=(leadId, last_user_msg, clean_reply, hard_facts),
            ).start()

    return StreamingResponse(
        stream_generator(),
        media_type="text/plain",
        headers={
            "X-Accel-Buffering": "no",          # Disable nginx/Render proxy buffering
            "Cache-Control": "no-cache, no-transform",
            "Transfer-Encoding": "chunked",
        },
    )
