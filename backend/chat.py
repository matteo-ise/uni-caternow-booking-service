"""
Chat Module for CaterNow Backend API.
Handles the RAG (Retrieval-Augmented Generation) logic, injecting similar dishes
into the prompt and querying the Gemini API for conversational responses.
"""
import os
import google.generativeai as genai
from fastapi import APIRouter
from dotenv import load_dotenv

from models import ChatRequest, ChatResponse, MenuSuggestion
from embeddings import find_similar_dishes
from research import run_company_research

# Lade .env aus dem Hauptverzeichnis
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
genai.configure(api_key=os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY"))

router = APIRouter()

GEMINI_MODEL = "gemini-2.5-flash"

BASE_SYSTEM_PROMPT = """Du bist Catersmart Chatty, der freundliche und kompetente Menü-Berater von CaterNow.
Deine Aufgabe ist es, dem Kunden basierend auf seinen Wünschen ein personalisiertes 
3-Gang-Menü (Vorspeise, Hauptspeise, Nachspeise) aus unserer Speisekarte zusammenzustellen.

Regeln:
- Antworte immer auf Deutsch.
- Nutze Emojis, aber dosiert.
- Frage nach konkreten Vorlieben oder Allergien (z.B. vegetarisch, glutenfrei), falls noch nicht bekannt.
- Schlage immer konkrete Gerichte aus der Liste der "Verfügbaren Gerichte" vor, anstatt generische Speisen zu erfinden.
- Passe deinen Tonfall (konservativ/Sie vs. locker/Du) an den Kunden und den Anlass an.
- Sobald du merkst, dass der Kunde zufrieden ist oder alle drei Gänge ausgewählt hat, fasse das Menü am Ende klar strukturiert zusammen.
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

    # 1. Letzte Usenachricht für Dish-Suche
    last_user_msg = next(
        (m.content for m in reversed(conversation) if m.role == "user"), ""
    )
    dishes_context = _build_context_from_dishes(last_user_msg)

    # 2. Dynamischen Prompt bauen (Personalisierung)
    system_prompt = BASE_SYSTEM_PROMPT
    
    if wizard_data:
        system_prompt += f"\n\n**Hintergrundinformationen zum Event:**\n"
        system_prompt += f"- Event-Datum: {wizard_data.date or 'Unbekannt'}\n"
        system_prompt += f"- Personenanzahl: {wizard_data.persons or 'Unbekannt'}\n"
        system_prompt += f"- Budget/Person: {wizard_data.budget or 'Unbekannt'}\n"
        system_prompt += f"- Kundentyp: {'B2B (Firmenkunde)' if wizard_data.customerType == 'business' else 'B2C (Privatkunde)'}\n"

        # 3. The "Stalking" Engine (Research) für B2B Kunden
        if wizard_data.customerType == "business" and (wizard_data.companyName or wizard_data.companyDomain):
            research = run_company_research(wizard_data.companyName, wizard_data.companyDomain)
            if research.is_business:
                system_prompt += "\n**Research Intelligence (Firma):**\n"
                system_prompt += f"Die KI hat die Firma '{research.company_name}' analysiert:\n"
                # Handle possible missing values
                core_values_str = ", ".join(research.core_values) if research.core_values else "Keine spezifischen Werte gefunden."
                system_prompt += f"- Kernwerte: {core_values_str}\n"
                system_prompt += f"- Fancy-Score: {research.fancy_score}/100 (1=Sehr konservativ/traditionell, 100=Sehr hip/experimentell/Startup)\n"
                system_prompt += f"- Zusammenfassung: {research.summary or 'Keine Zusammenfassung verfügbar.'}\n"
                
                # Handlungsanweisung für Gemini basierend auf dem Score
                if research.fancy_score > 70:
                    system_prompt += "-> WICHTIG: Die Firma ist sehr modern/hip. Duz-Kultur (Du/Euch) ist Pflicht! Empfiehl experimentelle, hippe oder vegane Gerichte. Sei locker und enthusiastisch im Tonfall.\n"
                elif research.fancy_score < 40:
                    system_prompt += "-> WICHTIG: Die Firma ist eher traditionell/konservativ. Nutze zwingend das 'Sie'! Empfiehl klassische, bewährte Gerichte (z.B. Braten, klassische Suppen). Sei äußerst professionell und zurückhaltend mit Emojis.\n"
                else:
                    system_prompt += "-> WICHTIG: Die Firma ist ein gesundes Mittelmaß. Ein freundliches 'Du' ist okay, bleibe aber professionell. Biete einen Mix aus klassischen und modernen Gerichten an.\n"

    # 4. Gemini-Konversation aufbauen
    model = genai.GenerativeModel(
        model_name=GEMINI_MODEL,
        system_instruction=system_prompt + "\n\n" + dishes_context,
    )

    history = [
        {"role": m.role, "parts": [m.content]}
        for m in conversation[:-1]  # alle außer der letzten Nachricht
    ]
    chat_session = model.start_chat(history=history)

    # 5. Nachricht senden
    try:
        response = chat_session.send_message(last_user_msg)
        reply_text = response.text
    except Exception as e:
        print(f"[Chat Error] {e}")
        reply_text = "Entschuldigung, ich konnte leider nicht auf das Menü zugreifen. Bitte versuche es später noch einmal."

    # TODO für Sprint 4: Hier das strukturierte JSON auslesen für `menu=MenuSuggestion(...)`
    return ChatResponse(message=reply_text, menu=None)

