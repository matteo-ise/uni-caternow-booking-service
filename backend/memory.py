import os
import json
from pathlib import Path
from pydantic import BaseModel
import google.generativeai as genai

MEMORY_DIR = Path(os.path.join(os.path.dirname(__file__), "..", "data", "memory"))

# Stelle sicher, dass der Ordner existiert
MEMORY_DIR.mkdir(parents=True, exist_ok=True)

class UpdateMemoryRequest(BaseModel):
    lead_id: str
    user_message: str
    bot_message: str
    hard_facts: dict
    
def _get_memory_path(lead_id: str) -> Path:
    # Basic sanitize
    safe_id = "".join(c for c in lead_id if c.isalnum() or c in ('-', '_')).strip()
    if not safe_id:
        safe_id = "anonymous"
    return MEMORY_DIR / f"{safe_id}.md"

def init_memory(lead_id: str, hard_facts: dict):
    path = _get_memory_path(lead_id)
    if path.exists():
        return

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
    path.write_text(content, encoding="utf-8")


def get_memory(lead_id: str) -> str | None:
    """Liest das vorhandene Gedächtnis eines Leads aus."""
    path = _get_memory_path(lead_id)
    if path.exists():
        return path.read_text(encoding="utf-8")
    return None

def update_memory_async(lead_id: str, user_message: str, bot_message: str, hard_facts: dict):
    """
    Diese Funktion liest die aktuelle Memory, füttert den neuen Chat-Austausch
    an Gemini und lässt das Memory-Dokument live umschreiben/updaten.
    """
    path = _get_memory_path(lead_id)
    
    if not path.exists():
        init_memory(lead_id, hard_facts)
        
    current_memory = path.read_text(encoding="utf-8")
    
    # Nutze das stärkere Modell für die psychologische Analyse
    model = genai.GenerativeModel("models/gemini-2.5-flash")
    
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
        response = model.generate_content(prompt)
        new_memory = response.text.strip()
        
        # Remove markdown ticks if present
        if new_memory.startswith("```markdown"):
            new_memory = new_memory[11:]
        elif new_memory.startswith("```"):
            new_memory = new_memory[3:]
            
        if new_memory.endswith("```"):
            new_memory = new_memory[:-3]
            
        path.write_text(new_memory.strip(), encoding="utf-8")
    except Exception as e:
        print(f"[Memory] Fehler beim Updaten des Memory für {lead_id}: {e}")

