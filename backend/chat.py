"""
Chat Module for CaterNow Backend API.
Optimized for Vector Excellence and Mathematical Transparency.
"""
import os
import threading
import json
import re
import google.generativeai as genai
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv

from models import ChatRequest, ChatResponse, MenuSuggestion, Dish
from embeddings import find_similar_dishes
from research import run_company_research
from memory import update_memory_async, get_memory
from data_assets import get_historical_context

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
genai.configure(api_key=os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY"))

router = APIRouter()
GEMINI_MODEL = "models/gemini-flash-lite-latest"

BASE_SYSTEM_PROMPT = """Du bist Catersmart Chatty, der wohl charmanteste Menü-Verkäufer der Welt. 

PERSONA:
- Charmant, witzig, extrem kurze Antworten (max 2 Sätze).
- Nutze rigeros Firmen-Research (Werte, Slogan, Farben).
- UPSELLING-PROFI: Dein Ziel ist es, den Umsatz und die Kundenzufriedenheit zu maximieren.

EINSTIEG / ANLASS-AUSWAHL:
Wenn der Kunde dir zu Beginn seinen Anlass nennt (z.B. "Firmenevent / Jubiläum", "Hochzeit", "Business Lunch / Meeting"), reagiere charmant darauf, z.B.:
- Bei Business: "Hervorragende Wahl. Ein Firmenevent also. Sollen wir eher die produktive Atmosphäre eines Workshops unterstützen oder den Erfolg des Quartals gebührend feiern?"
- Bei Privat: "Ein wunderbarer Anlass! Sollen wir es eher klassisch-elegant oder modern und locker angehen?"

MISSION:
1. Nutze RAG für echte Menü-Vorschläge. Halluzinationsverbot!
2. UPSELLING-REGEL: Sobald eine Hauptspeise (HP1) gefunden wurde, frage den Kunden SOFORT, ob eine zweite, komplementäre Hauptspeise (HP2) Sinn macht (z.B. eine vegetarische Option zu Fleisch), um alle Gäste glücklich zu machen.
3. Die Gerichte erscheinen rechts im Canvas. Verweise darauf.
4. Sobald du ein Menü vorschlägst, hänge am Ende ZWINGEND diesen JSON Block an (nutze exakt die Daten aus dem Kontext):
[MENU_JSON]
{{
  "vorspeise": {{"name": "...", "kategorie": "vorspeise", "preis": 0.0, "similarity_score": 0.95, "alternativen": [...]}},
  "hauptgericht1": {{"name": "...", "kategorie": "hauptgericht", "preis": 0.0, "similarity_score": 0.88, "alternativen": [...]}},
  "hauptgericht2": {{"name": "...", "kategorie": "hauptgericht", "preis": 0.0, "similarity_score": 0.85, "alternativen": [...]}},
  "dessert": {{"name": "...", "kategorie": "dessert", "preis": 0.0, "similarity_score": 0.92, "alternativen": [...]}}
}}
[/MENU_JSON]
"""

def _build_context_from_dishes(user_message: str) -> str:
    """Extrahiert Gerichte via Vector-Search und fügt Similarity-Scores in den Kontext ein."""
    lines = ["VECTOR SEARCH RESULTS (TOP MATCHES FROM NEON DB):"]
    for kategorie in ["vorspeise", "hauptgericht", "dessert"]:
        try:
            dishes = find_similar_dishes(user_message, kategorie=kategorie, top_k=5)
            if dishes:
                lines.append(f"\nKATEGORIE {kategorie.upper()}:")
                for d in dishes:
                    # Wir liefern der KI die Scores mit, damit sie diese 'versteht'
                    lines.append(f"  - {d.name} (Preis: {d.preis:.2f}€, Similarity: {d.similarity_score:.4f})")
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
        research = run_company_research(wizard_data.companyName, wizard_data.companyDomain)
        hard_facts.update(research.model_dump())
        system_prompt += f"\n**RESEARCH DATA:** {research.company_name}, Score: {research.fancy_score}/100"

    async def stream_generator():
        full_reply = ""
        try:
            model = genai.GenerativeModel(model_name=GEMINI_MODEL, system_instruction=system_prompt + "\n\n" + dishes_context)
            history = [{"role": m.role, "parts": [m.content]} for m in conversation[:-1]]
            chat_session = model.start_chat(history=history)
            response = chat_session.send_message(last_user_msg, stream=True)
            for chunk in response:
                token = chunk.text
                full_reply += token
                yield token
        except Exception as e:
            if "429" in str(e): yield "Meine Leitung glüht gerade vor Begeisterung! 🔥 Kurz abkühlen..."
            else: yield "Ups, da hat die Verbindung kurz gewackelt. 😉"

        # Update memory in background
        clean_reply = re.sub(r"\[MENU_JSON\].*?\[/MENU_JSON\]", "", full_reply, flags=re.DOTALL).strip()
        if clean_reply:
            threading.Thread(target=update_memory_async, args=(lead_id, last_user_msg, clean_reply, hard_facts)).start()

    return StreamingResponse(stream_generator(), media_type="text/plain")
