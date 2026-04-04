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
        
    content = f"""# Lead Memory: {lead_id}

## Hard Facts
- **Firma:** {hard_facts.get('companyName', 'Privat/Unbekannt')} ({hard_facts.get('companyDomain', '')})
- **Datum:** {hard_facts.get('date', 'Unbekannt')}
- **Personen:** {hard_facts.get('persons', 'Unbekannt')}
- **Budget:** {hard_facts.get('budget', 'Unbekannt')}
- **Farben:** {', '.join(hard_facts.get('company_colors', []))}
- **Slogan:** {hard_facts.get('slogan', '')}

## Soft Facts
- **Stimmung:** Neutral
- **Vorlieben/Abneigungen:** Bisher keine bekannt.
- **Fancy-Score:** {hard_facts.get('fancy_score', 50)}/100

## Chat Historie (Zusammenfassung)
- Initialer Kontakt hergestellt.
"""
    path.write_text(content, encoding="utf-8")


def update_memory_async(lead_id: str, user_message: str, bot_message: str, hard_facts: dict):
    """
    Diese Funktion liest die aktuelle Memory, füttert den neuen Chat-Austausch
    an Gemini und lässt das Memory-Dokument live umschreiben/updaten.
    """
    path = _get_memory_path(lead_id)
    
    if not path.exists():
        init_memory(lead_id, hard_facts)
        
    current_memory = path.read_text(encoding="utf-8")
    
    model = genai.GenerativeModel("gemini-2.5-flash")
    
    prompt = f"""
    Du bist das Hintergrund-Gedächtnis (Memory) eines erstklassigen Sales-Bots.
    Hier ist das aktuelle Gedächtnis-Dokument (Markdown):
    
    ```markdown
    {current_memory}
    ```
    
    Ein neuer Nachrichtenaustausch hat gerade stattgefunden:
    KUNDE: "{user_message}"
    BOT: "{bot_message}"
    
    Deine Aufgabe:
    Aktualisiere das Markdown-Dokument. Passe die "Soft Facts" an, füge neue Vorlieben/Abneigungen hinzu (z.B. "Mag kein Fleisch", "Will ein lockeres Event"), aktualisiere die Stimmung, und füge 1-2 knappe Sätze zur Chat Historie (Zusammenfassung) hinzu.
    Lass die Hard Facts wie sie sind, es sei denn, der Kunde hat sie im Chat korrigiert.
    
    Gib NUR das aktualisierte Markdown-Dokument zurück, ohne weitere Kommentare.
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

