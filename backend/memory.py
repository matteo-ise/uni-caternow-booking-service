"""
Persistent lead memory as markdown dossiers with structured sidecar data.

Each lead gets a markdown "intelligence report" that Gemini rewrites entirely
on every chat turn — updating psychographic signals, behavioral findings, and
the interaction log. Sidecar JSON stores structured research data (address,
logo, colors) separately for programmatic access.

Template uses emoji headers so it's human-readable in the admin panel while
still parseable by both regex (in research.py's patch function) and Gemini.
"""
import os
import json
import logging
from google import genai
from google.genai import types
from pydantic import BaseModel
from dotenv import load_dotenv
from database import SessionLocal
from db_models import DBMemory

logger = logging.getLogger(__name__)

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

_client: genai.Client | None = None

def _get_client() -> genai.Client:
    global _client
    if _client is None:
        _client = genai.Client(
            api_key=os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
        )
    return _client

class UpdateMemoryRequest(BaseModel):
    lead_id: str
    user_message: str
    bot_message: str
    hard_facts: dict

def init_memory(lead_id: str, hard_facts: dict) -> str:
    db = SessionLocal()
    try:
        mem = db.query(DBMemory).filter(DBMemory.lead_id == lead_id).first()
        if mem:
            return mem.content

        content = f"""# 🕵️ Lead Intelligence Report: {lead_id}

## 🏢 Corporate Profile (Research Intelligence)
- **Status:** {hard_facts.get('customerType', 'private').upper()}
- **Identity:** {hard_facts.get('companyName', 'Privat/Unbekannt')}
- **Branding:** {', '.join(hard_facts.get('company_colors', [])) if hard_facts.get('company_colors') else 'Unbekannt'} | {hard_facts.get('slogan', 'Kein Slogan')}
- **HQ Location:** {hard_facts.get('hq_address', 'Unbekannt')}
- **Logo:** {hard_facts.get('logo_url', 'None')}

## 📊 Event Parameters (Hard Facts)
- **Target Date:** {hard_facts.get('date', 'Unbekannt')}
- **Attendance:** {hard_facts.get('persons', 'Unbekannt')} pax
- **Budget Tier:** {hard_facts.get('budget', 'Unbekannt')}
- **Current Value:** 0.00€

## 🧠 Psychographic Profile (Soft Facts)
- **Mood / Sentiment:** Neutral
- **Fancy-Score:** {hard_facts.get('fancy_score', 50)}/100
- **Corporate Alignment:** Neutral
- **Intent-to-Buy:** Warm

## 🔍 Behavioral Findings & Extraction (Stalker Engine)
- Initial contact established. Branding research successful.

## 📝 Strategic Interaction Log
- [System] Intelligence file initialized.
"""
        new_mem = DBMemory(lead_id=lead_id, content=content, sidecar_data=json.dumps({}))
        db.add(new_mem)
        db.commit()
        return content
    finally:
        db.close()

def get_memory(lead_id: str) -> str | None:
    db = SessionLocal()
    try:
        mem = db.query(DBMemory).filter(DBMemory.lead_id == lead_id).first()
        if mem:
            return mem.content
        return None
    finally:
        db.close()

def save_research_sidecar(lead_id: str, data: dict):
    db = SessionLocal()
    try:
        mem = db.query(DBMemory).filter(DBMemory.lead_id == lead_id).first()
        if mem:
            mem.sidecar_data = json.dumps(data, ensure_ascii=False)
            db.commit()
        else:
            new_mem = DBMemory(lead_id=lead_id, content="", sidecar_data=json.dumps(data, ensure_ascii=False))
            db.add(new_mem)
            db.commit()
    finally:
        db.close()

def get_research_sidecar(lead_id: str) -> dict | None:
    db = SessionLocal()
    try:
        mem = db.query(DBMemory).filter(DBMemory.lead_id == lead_id).first()
        if mem and mem.sidecar_data:
            try:
                return json.loads(mem.sidecar_data)
            except Exception:
                return None
        return None
    finally:
        db.close()

def update_memory_async(lead_id: str, user_message: str, bot_message: str, hard_facts: dict):
    """
    Reads the current memory dossier from DB, feeds the latest chat exchange to
    Gemini, and lets it rewrite the entire document with updated findings.
    Runs in a background thread (fire-and-forget from chat.py).
    """
    db = SessionLocal()
    try:
        mem = db.query(DBMemory).filter(DBMemory.lead_id == lead_id).first()
        if not mem or not mem.content:
            current_memory = init_memory(lead_id, hard_facts)
            mem = db.query(DBMemory).filter(DBMemory.lead_id == lead_id).first()
        else:
            current_memory = mem.content

        # German prompt: intentional for DACH market output quality
        prompt = f"""
        Du bist die "Lead Intelligence Unit" von CaterNow - ein psychologisch geschulter Sales-Analyst.
        Deine Aufgabe ist es, aus dem Chat-Verlauf eines Kunden (Lead) extrem präzise Erkenntnisse (Findings) zu extrahieren.

        Aktuelles Dossier:
        ```markdown
        {current_memory}
        ```

        Neueste Interaktion:
        KUNDE: "{user_message}"
        BOT: "{bot_message}"

        DEINE MISSION:
        1. **Psychogramm schärfen:** Wie ist die Stimmung? (Professionell, sarkastisch, gestresst?). Wie hoch ist die Kaufabsicht (Cold/Warm/Hot)? Wie gut passen wir zur Firmenkultur (Alignment)?
        2. **Findings extrahieren:** Was wissen wir jetzt NEUES über den Kunden? (z.B. "Legt Wert auf Regionalität", "Reagiert empfindlich auf Preise", "Will die Chefin beeindrucken").
        3. **Log kürzen:** Füge EINEN extrem kurzen Satz hinzu, was in diesem Schritt passiert ist (z.B. "Vorspeisen-Match bestätigt"). KEINE Wiederholung von Inhalten.
        4. **Hard Facts:** Nur aktualisieren, wenn der Kunde im Chat eine Korrektur vorgenommen hat (z.B. "Doch nur 20 Personen").

        Gib NUR das aktualisierte Markdown-Dokument zurück. Sei präzise, analytisch und fast schon gruselig gut in deiner Beobachtung.
        """

        try:
            memory_models = ["gemini-2.5-flash", "gemini-2.5-flash-lite"]
            response = None
            for mem_model in memory_models:
                try:
                    response = _get_client().models.generate_content(
                        model=mem_model,
                        contents=prompt,
                        config=types.GenerateContentConfig(
                            thinking_config=types.ThinkingConfig(thinking_budget=0),
                        ),
                    )
                    if mem_model != memory_models[0]:
                        logger.info(f"[Memory] Succeeded with fallback model {mem_model}")
                    break
                except Exception as e:
                    if "503" in str(e) and mem_model != memory_models[-1]:
                        logger.warning(f"[Memory] 503 on {mem_model}, trying fallback")
                        continue
                    raise
            new_memory = response.text.strip()

            # Strip markdown fences if Gemini wrapped the output
            if new_memory.startswith("```markdown"):
                new_memory = new_memory[11:]
            elif new_memory.startswith("```"):
                new_memory = new_memory[3:]

            if new_memory.endswith("```"):
                new_memory = new_memory[:-3]

            mem.content = new_memory.strip()
            db.commit()
        except Exception as e:
            logger.error(f"[Memory] Failed to update memory for {lead_id}: {e}")
    finally:
        db.close()
