import os
import json
import threading
import re
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional, Literal
import google.generativeai as genai
from dotenv import load_dotenv

from database import SessionLocal, get_db
from db_models import DBDish, DBUser
from models import Message, WizardData, ChatRequest
from research import run_company_research
from memory import get_memory, update_memory_async, save_research_sidecar
from embeddings import find_similar_dishes

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
genai.configure(api_key=os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY"))

router = APIRouter()
GEMINI_MODEL = "gemini-2.5-flash"

# Lead-level research cache to avoid re-researching on every message
_lead_research_cache = {}

BASE_SYSTEM_PROMPT = """Du bist Catersmart Chatty, der charmanteste Menü-Verkäufer der Welt.

STRIKTE REGELN:
- KEINE erfundenen Gerichte. Nutze NUR Namen aus der Liste.
- TEXT-STIL: Extrem kurz, knackig, emoji-reich.
- KEINE GEDANKENSTRICHE: Nutze niemals "—" oder "–". Verwende nur einfache Bindestriche "-" oder Kommas.
- STALKER-FEELING: Nutze die recherchierten Firmen-Infos (Werte, Slogan, Farben, Standort) rigeros in deinen Sätzen. Zeige dem Kunden, dass wir ihn "verstehen".
- STORYTELLING: Baue ein Narrativ um das Event (z.B. "Passend zu eurer DNA bei [Firma]...").
- MULTI-MESSAGES: Nutze "|||", um Nachrichten für eine bessere Dynamik zu trennen.
- UPSELLING: Sobald HP1 steht, biete HP2 an.
- BESTAETIGTE GERICHTE: Wenn der Kunde einen Gang bereits bestätigt hat, schlage KEINEN Ersatz dafür vor. Ändere nur unbestätigte Gänge.

MISSION:
1. Schlage Gerichte vor (sie erscheinen rechts).
2. Beende IMMER mit diesem JSON Block:
[MENU_JSON]
{
  "vorspeise": {"name": "EXAKTER_NAME"},
  "hauptgericht1": {"name": "EXAKTER_NAME"},
  "hauptgericht2": {"name": "EXAKTER_NAME"},
  "dessert": {"name": "EXAKTER_NAME"}
}
[/MENU_JSON]
"""

def _get_official_dish(suggested_name: str, db: Session) -> Optional[DBDish]:
    """Sucht ein offizielles Gericht in der DB via Case-Insensitive Match."""
    return db.query(DBDish).filter(DBDish.name.ilike(suggested_name.strip())).first()

@router.post("/chat")
async def chat(req: ChatRequest):
    conversation = req.conversation
    wizardData = req.wizardData
    leadId = req.leadId or "unknown"
    context_services = req.context_services or []

    # 1. RAG: Ähnliche Gerichte finden basierend auf letzter Nachricht
    last_user_msg = conversation[-1].content
    similar_dishes = find_similar_dishes(last_user_msg, top_k=8)
    dishes_context = "VERFÜGBARE ECHTE GERICHTE (NUR DIESE NUTZEN):\n" + "\n".join([f"- {d.name} ({d.kategorie})" for d in similar_dishes])

    # 2. Memory & Research
    memory_context = get_memory(leadId) or ""
    system_prompt = BASE_SYSTEM_PROMPT + "\n\n**LEAD MEMORY:**\n" + memory_context

    hard_facts = wizardData.model_dump() if wizardData else {}

    if wizardData and wizardData.customerType == "business":
        if leadId in _lead_research_cache:
            research = _lead_research_cache[leadId]
        else:
            research = run_company_research(wizardData.companyName)
            _lead_research_cache[leadId] = research
        hard_facts.update(research.model_dump())
        system_prompt += f"\n**RESEARCH DATA:** {research.company_name}, Score: {research.fancy_score}/100, HQ Adresse: {research.hq_address}, Logo: {research.logo_url}"
        # Persist research data so the checkout story endpoint can read it reliably
        save_research_sidecar(leadId, {
            "hq_address": research.hq_address,
            "logo_url": research.logo_url,
            "company_name": research.company_name,
            "fancy_score": research.fancy_score,
        })

    async def stream_generator():
        nonlocal system_prompt
        full_reply = ""
        try:
            try:
                # Versuch 1: Ohne Search Grounding (Chat-Modell braucht kein Grounding)
                model = genai.GenerativeModel(
                    model_name=GEMINI_MODEL,
                    system_instruction=system_prompt + "\n\n" + dishes_context,
                )
                history = [{"role": m.role, "parts": [m.content]} for m in conversation[:-1]]
                chat_session = model.start_chat(history=history)
                response = chat_session.send_message(last_user_msg, stream=True)
                for chunk in response:
                    token = chunk.text
                    full_reply += token
                    yield token
            except Exception as e:
                print(f"[Chat Tool Error] Fallback: {e}")
                # Fallback: Ohne Search Grounding
                model = genai.GenerativeModel(
                    model_name=GEMINI_MODEL, 
                    system_instruction=system_prompt + "\n\n" + dishes_context
                )
                history = [{"role": m.role, "parts": [m.content]} for m in conversation[:-1]]
                chat_session = model.start_chat(history=history)
                response = chat_session.send_message(last_user_msg, stream=True)
                for chunk in response:
                    token = chunk.text
                    full_reply += token
                    yield token
        except Exception as e:
            print(f"[Chat Critical] {e}")
            if "429" in str(e):
                yield "Meine Leitung glüht gerade vor Begeisterung! 🔥 (Quota Limit erreicht, bitte kurz warten)"
            else:
                yield "Ups, da hat die Verbindung kurz gewackelt. 😉"

        # ── VERIFICATION LAYER (Snap-Back Logic) ──
        match = re.search(r"\[MENU_JSON\](.*?)\[/MENU_JSON\]", full_reply, re.DOTALL)
        if match:
            try:
                suggested_json = json.loads(match.group(1).strip())
                db = SessionLocal()
                verified_menu = {}
                
                mapping = {
                    "vorspeise": "vorspeise",
                    "hauptgericht1": "hauptspeise1",
                    "hauptgericht2": "hauptspeise2",
                    "dessert": "nachspeise"
                }
                
                for ai_key, frontend_key in mapping.items():
                    dish_name = suggested_json.get(ai_key, {}).get("name")
                    if dish_name:
                        official_dish = _get_official_dish(dish_name, db)
                        if official_dish:
                            # Suche den echten AI Match % in den ursprünglichen RAG Ergebnissen
                            sim_score = 0.95 # Fallback, falls es direkt über Fuzzy gefunden wurde
                            for d in similar_dishes:
                                if d.name == official_dish.name:
                                    sim_score = d.similarity_score
                                    break
                            
                            verified_menu[frontend_key] = {
                                "id": official_dish.csv_id,
                                "name": official_dish.name,
                                "preis": official_dish.preis,
                                "image_url": official_dish.image_url,
                                "similarity_score": sim_score
                            }
                db.close()
                
                if verified_menu:
                    yield f"\n[VERIFIED_JSON]\n{json.dumps(verified_menu)}\n[/VERIFIED_JSON]"
            except Exception as e:
                print(f"[Verification Error] {e}")

        # Update Memory in background
        clean_reply = re.sub(r"\[MENU_JSON\].*?\[/MENU_JSON\]", "", full_reply, flags=re.DOTALL).strip()
        if clean_reply:
            threading.Thread(target=update_memory_async, args=(leadId, last_user_msg, clean_reply, hard_facts)).start()

    return StreamingResponse(stream_generator(), media_type="text/plain")
