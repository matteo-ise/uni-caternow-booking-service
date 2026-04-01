import os
import google.generativeai as genai
from fastapi import APIRouter
from dotenv import load_dotenv

from models import ChatRequest, ChatResponse, MenuSuggestion
from embeddings import find_similar_dishes

load_dotenv()
genai.configure(api_key=os.environ["GOOGLE_API_KEY"])

router = APIRouter()

GEMINI_MODEL = "gemini-1.5-flash"

SYSTEM_PROMPT = """Du bist der freundliche Menü-Berater von CaterNow, einem Catering-Unternehmen.
Deine Aufgabe ist es, dem Kunden basierend auf seinen Wünschen und Präferenzen ein
personalisiertes 3-Gang-Menü (Vorspeise, Hauptspeise, Nachspeise) aus unserer Speisekarte
zusammenzustellen.

Regeln:
- Frage zunächst nach Vorlieben, Unverträglichkeiten oder Anlass des Events.
- Schlage dann konkrete Gerichte aus der Speisekarte vor (nur Gerichte die dir genannt werden).
- Antworte immer auf Deutsch, freundlich und professionell.
- Sobald du ein vollständiges Menü vorschlägst, liste es klar strukturiert auf.
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

    # Kontext mit passenden Gerichten nur zur letzten User-Nachricht hinzufügen
    last_user_msg = next(
        (m.content for m in reversed(conversation) if m.role == "user"), ""
    )
    dishes_context = _build_context_from_dishes(last_user_msg)

    # Gemini-Konversation aufbauen
    model = genai.GenerativeModel(
        model_name=GEMINI_MODEL,
        system_instruction=SYSTEM_PROMPT + "\n\n" + dishes_context,
    )

    history = [
        {"role": m.role, "parts": [m.content]}
        for m in conversation[:-1]  # alle außer der letzten Nachricht
    ]
    chat_session = model.start_chat(history=history)

    response = chat_session.send_message(last_user_msg)
    reply_text = response.text

    return ChatResponse(message=reply_text, menu=None)
