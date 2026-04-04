"""
Chat Module for CaterNow Backend API.
Handles the RAG (Retrieval-Augmented Generation) logic, injecting similar dishes
into the prompt and querying the Gemini API for conversational responses.
"""
import os
import threading
import google.generativeai as genai
from fastapi import APIRouter
from dotenv import load_dotenv

from models import ChatRequest, ChatResponse, MenuSuggestion
from embeddings import find_similar_dishes
from research import run_company_research
from memory import update_memory_async

# Lade .env aus dem Hauptverzeichnis
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
genai.configure(api_key=os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY"))

router = APIRouter()

GEMINI_MODEL = "gemini-2.5-flash"

BASE_SYSTEM_PROMPT = """Du bist Catersmart Chatty, der wohl charmanteste, witzigste und fähigste Menü-Verkäufer der Welt. 
Dein Ziel: Den Kunden absolut zu begeistern und ihm das perfekte 3-Gang-Catering von CaterNow zu verkaufen.

DEINE PERSÖNLICHKEIT:
- Du bist extrem charmant, etwas humorvoll und hast immer einen lockeren Spruch auf Lager.
- Du verkaufst nicht nur Essen, du verkaufst ein Erlebnis.
- Du bist ein Profi: Du nutzt ALLES, was du über den Kunden weißt (Firmenname, Werte, Farben, Slogan), um eine Verbindung aufzubauen.
- Dein Tonfall ist empathisch: Du spürst, ob der Kunde eher locker (Du) oder seriös (Sie) behandelt werden will.

DEINE MISSION:
1. Nutze die "Research Intelligence" (Werte, Slogan, Farben) der Firma rigeros in deiner Argumentation.
2. Schlage ein 3-Gang-Menü aus den "Verfügbaren Gerichten" vor, das perfekt zum "Fancy-Score" der Firma passt.
3. Sei interaktiv: Frage nach Vorlieben, geh auf Wünsche ein und schlage Anpassungen vor.
4. Sobald das Menü steht, präsentiere es wie ein Sterne-Kellner.

Regeln:
- Antworte immer auf Deutsch.
- Nutze Emojis passend zu deinem Charme.
- Erfinde KEINE Gerichte. Nutze nur die Liste, die dir bereitgestellt wird.
- Wenn du eine Firma stalkst und z.B. weißt, dass ihre Farbe "Grün" ist, erwähne das ("Passend zu eurem Marken-Grün haben wir...").
"""

def _build_context_from_dishes(user_message: str) -> str:
    """Erstellt einen Kontext-Block mit ähnlichen Gerichten für alle drei Gänge."""
    lines = ["Verfügbare Gerichte aus der Speisekarte (passend zur Anfrage):"]
    for kategorie in ["vorspeise", "hauptgericht", "dessert"]:
        dishes = find_similar_dishes(user_message, kategorie=kategorie, top_k=3)
        if dishes:
            lines.append(f"\n{kategorie.capitalize()}:")
            for d in dishes:
                preis_str = f" ({d.preis:.2f} €)" if d.preis else ""
                lines.append(f"  - {d.name}{preis_str}")
    return "\n".join(lines)


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    conversation = request.conversation
    wizard_data = request.wizardData
    lead_id = request.leadId or "anon-session"

    # 1. Letzte Usenachricht für Dish-Suche
    last_user_msg = next(
        (m.content for m in reversed(conversation) if m.role == "user"), ""
    )
    dishes_context = _build_context_from_dishes(last_user_msg)

    # 2. Dynamischen Prompt bauen (Personalisierung & Stalking)
    system_prompt = BASE_SYSTEM_PROMPT
    hard_facts_for_memory = {}
    
    if wizard_data:
        hard_facts_for_memory = wizard_data.model_dump()
        system_prompt += f"\n\n**Lead-Details:**\n"
        system_prompt += f"- Datum: {wizard_data.date or 'Unbekannt'}\n"
        system_prompt += f"- Personen: {wizard_data.persons or 'Unbekannt'}\n"
        system_prompt += f"- Budget: {wizard_data.budget or 'Unbekannt'}\n"

        # 3. The "Stalking" Engine (Research)
        if wizard_data.customerType == "business" and (wizard_data.companyName or wizard_data.companyDomain):
            research = run_company_research(wizard_data.companyName, wizard_data.companyDomain)
            if research.is_business:
                hard_facts_for_memory.update(research.model_dump())
                system_prompt += f"\n**RESEARCH INTELLIGENCE (NUTZE DIESE INFOS CHARMANT):**\n"
                system_prompt += f"Firma: {research.company_name}\n"
                system_prompt += f"Slogan: {research.slogan or 'Keiner bekannt'}\n"
                system_prompt += f"Farben: {', '.join(research.company_colors)}\n"
                system_prompt += f"Kernwerte: {', '.join(research.core_values)}\n"
                system_prompt += f"Fancy-Score: {research.fancy_score}/100\n"
                system_prompt += f"Zusammenfassung: {research.summary}\n"
                
                # Strategie-Vorgabe
                if research.fancy_score > 70:
                    system_prompt += "STRATEGIE: Startup-Vibe. Duzen. Sei kreativ, hip und mutig.\n"
                elif research.fancy_score < 40:
                    system_prompt += "STRATEGIE: Traditions-Vibe. Siezen. Sei exzellent, förmlich und wertkonservativ.\n"
                else:
                    system_prompt += "STRATEGIE: Modernes KMU. Freundliches 'Du' oder 'Sie' je nach Gefühl. Professionell aber nahbar.\n"

    # 4. Gemini-Konversation aufbauen
    model = genai.GenerativeModel(
        model_name=GEMINI_MODEL,
        system_instruction=system_prompt + "\n\n" + dishes_context,
    )

    history = [
        {"role": m.role, "parts": [m.content]}
        for m in conversation[:-1]
    ]
    chat_session = model.start_chat(history=history)

    # 5. Nachricht senden
    try:
        response = chat_session.send_message(last_user_msg)
        reply_text = response.text
    except Exception as e:
        print(f"[Chat Error] {e}")
        reply_text = "Ohje, da hat mir wohl jemand das Mikrofon ausgestöpselt. Kannst du das nochmal kurz wiederholen? 😉"

    # 6. Live-Memory Update im Hintergrund (Parallel für Performance)
    threading.Thread(
        target=update_memory_async, 
        args=(lead_id, last_user_msg, reply_text, hard_facts_for_memory)
    ).start()

    return ChatResponse(message=reply_text, menu=None)
