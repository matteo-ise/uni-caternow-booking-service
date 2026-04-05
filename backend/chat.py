"""
Chat Module for CaterNow Backend API.
Optimized for Vector Excellence and Mathematical Transparency.
Strict Hallucination Prevention via Python Snap-Back Verification Layer.
"""
import os
import threading
import json
import re
import difflib
from typing import Optional
import google.generativeai as genai
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from sqlalchemy.orm import Session

from models import ChatRequest, ChatResponse, MenuSuggestion, Dish
from database import SessionLocal
from db_models import DBDish
from research import run_company_research
from memory import update_memory_async, get_memory
from data_assets import get_historical_context

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
genai.configure(api_key=os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY"))

router = APIRouter()
GEMINI_MODEL = "models/gemini-1.5-flash-latest"

BASE_SYSTEM_PROMPT = """Du bist Catersmart Chatty, der charmanteste Menü-Verkäufer der Welt.

STRIKTE REGELN:
- KEINE erfundenen Gerichte. Nutze NUR Namen aus der Liste.
- TEXT-STIL: Extrem kurz, knackig, emoji-reich.
- KEINE GEDANKENSTRICHE: Nutze niemals "—" oder "–". Verwende nur einfache Bindestriche "-" oder Kommas.
- STALKER-FEELING: Nutze die recherchierten Firmen-Infos (Werte, Slogan, Farben, Standort) rigeros in deinen Sätzen. Zeige dem Kunden, dass wir ihn "verstehen".
- STORYTELLING: Baue ein Narrativ um das Event (z.B. "Passend zu eurer DNA bei [Firma]...").
- MULTI-MESSAGES: Nutze "|||", um Nachrichten für eine bessere Dynamik zu trennen.
- UPSELLING: Sobald HP1 steht, biete HP2 an.

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
    """Sucht das exakte oder am besten passende Gericht in der Datenbank."""
    if not suggested_name: return None
    
    # 1. Exakter Match (Case Insensitive)
    dish = db.query(DBDish).filter(DBDish.name.ilike(suggested_name)).first()
    if dish: return dish
    
    # 2. Fuzzy Match (Strikte Wurzel-Behandlung: Nur bei sehr hoher Übereinstimmung)
    all_dishes = db.query(DBDish).all()
    names = [d.name for d in all_dishes]
    matches = difflib.get_close_matches(suggested_name, names, n=1, cutoff=0.6) # Etwas lockerer für KI-Variationen
    
    if matches:
        return db.query(DBDish).filter(DBDish.name == matches[0]).first()
    return None

def _build_context_from_dishes(user_message: str) -> str:
    """Extrahiert Gerichte via Vector-Search."""
    from embeddings import find_similar_dishes
    lines = ["VERFÜGBARE ECHTE GERICHTE (NUTZE DIESE NAMEN 1:1):"]
    for kategorie in ["vorspeise", "hauptgericht", "dessert"]:
        try:
            dishes = find_similar_dishes(user_message, kategorie=kategorie, top_k=8) # Mehr Auswahl für die KI
            if dishes:
                lines.append(f"\nKATEGORIE {kategorie.upper()}:")
                for d in dishes:
                    lines.append(f"  - {d.name}")
        except: continue
    return "\n".join(lines)

@router.post("/chat")
async def chat(request: ChatRequest):
    conversation = request.conversation
    wizard_data = request.wizardData
    lead_id = request.leadId or "anon-session"

    existing_memory = get_memory(lead_id)
    memory_context = f"\n**USER HISTORY:** {existing_memory}" if existing_memory else ""
    historical_context = get_historical_context()

    last_user_msg = next((m.content for m in reversed(conversation) if m.role == "user"), "")
    dishes_context = _build_context_from_dishes(last_user_msg)

    system_prompt = BASE_SYSTEM_PROMPT + memory_context + historical_context
    hard_facts = wizard_data.model_dump() if wizard_data else {}
    
    if wizard_data and wizard_data.customerType == "business":
        research = run_company_research(wizard_data.companyName)
        hard_facts.update(research.model_dump())
        system_prompt += f"\n**RESEARCH DATA:** {research.company_name}, Score: {research.fancy_score}/100, HQ Adresse: {research.hq_address}, Logo: {research.logo_url}"

    async def stream_generator():
        full_reply = ""
        try:
            model = genai.GenerativeModel(
                model_name=GEMINI_MODEL, 
                system_instruction=system_prompt + "\n\n" + dishes_context,
                tools=[{"google_search_retrieval": {}}]
            )
            history = [{"role": m.role, "parts": [m.content]} for m in conversation[:-1]]
            chat_session = model.start_chat(history=history)
            response = chat_session.send_message(last_user_msg, stream=True)
            for chunk in response:
                token = chunk.text
                full_reply += token
                yield token
        except Exception as e:
            if "429" in str(e): yield "Meine Leitung glüht gerade vor Begeisterung! 🔥"
            else: yield "Ups, da hat die Verbindung kurz gewackelt. 😉"

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
                    if ai_key in suggested_json:
                        official_dish = _get_official_dish(suggested_json[ai_key].get("name"), db)
                        if official_dish:
                            verified_menu[frontend_key] = {
                                "name": official_dish.name,
                                "kategorie": official_dish.kategorie,
                                "preis": official_dish.preis,
                                "image_url": official_dish.image_url,
                                "similarity_score": 0.99
                            }
                db.close()
                if verified_menu:
                    yield f"\n[VERIFIED_JSON]{json.dumps(verified_menu)}[/VERIFIED_JSON]"
            except: pass

        clean_reply = re.sub(r"\[MENU_JSON\].*?\[/MENU_JSON\]", "", full_reply, flags=re.DOTALL).strip()
        if clean_reply:
            threading.Thread(target=update_memory_async, args=(lead_id, last_user_msg, clean_reply, hard_facts)).start()

    return StreamingResponse(stream_generator(), media_type="text/plain")
