import os
import google.generativeai as genai
from pydantic import BaseModel

class ResearchResult(BaseModel):
    is_business: bool
    company_name: str | None = None
    core_values: list[str] = []
    fancy_score: int = 50  # 1 (Traditional/Conservative) to 100 (Hipster/Startup)
    summary: str = ""
    company_colors: list[str] = []
    slogan: str | None = None

def run_company_research(company_name: str, domain: str) -> ResearchResult:
    """
    Führt einen (simulierten oder echten) Recherche-Lauf über eine Firma durch
    und extrahiert per Gemini deren Kernwerte, Fancy-Score, Firmenfarben und Slogan.
    """
    if not company_name and not domain:
        return ResearchResult(is_business=False)

    search_target = company_name if company_name else domain
    
    model = genai.GenerativeModel("gemini-2.5-flash")
    
    prompt = f"""
    Du bist ein B2B-Analyst. Analysiere die Firma "{search_target}".
    Falls die Firma völlig unbekannt ist, rate basierend auf dem Namen/der Domain oder gib realistische Annahmen für ein modernes Unternehmen dieser Branche zurück. Versuche auch die typischen Markenfarben und einen potenziellen Slogan zu halluzinieren, wenn sie nicht explizit bekannt sind.
    
    Antworte EXAKT im folgenden JSON Format, ohne Markdown-Formatierungen:
    {{
        "core_values": ["Wert1", "Wert2", "Wert3"],
        "fancy_score": 75,
        "summary": "Ein kurzer, einprägsamer Satz, wofür die Firma steht.",
        "company_colors": ["Blau", "Weiß"],
        "slogan": "Innovation für morgen"
    }}
    
    - 'fancy_score' ist eine Zahl von 1 bis 100. 
      (1 = Sehr konservativ/traditionell, 100 = Extrem hip/experimentell).
    """

    try:
        response = model.generate_content(prompt)
        text_resp = response.text.strip()
        
        # Entferne ggf. Markdown-Code-Blöcke
        if text_resp.startswith("```json"):
            text_resp = text_resp[7:]
        if text_resp.endswith("```"):
            text_resp = text_resp[:-3]
            
        import json
        data = json.loads(text_resp.strip())
        
        return ResearchResult(
            is_business=True,
            company_name=company_name,
            core_values=data.get("core_values", []),
            fancy_score=data.get("fancy_score", 50),
            summary=data.get("summary", ""),
            company_colors=data.get("company_colors", []),
            slogan=data.get("slogan")
        )
    except Exception as e:
        print(f"[Research] Fehler bei der Analyse von {search_target}: {e}")
        # Graceful Fallback
        return ResearchResult(
            is_business=True,
            company_name=company_name,
            core_values=["Qualität", "Kunde im Fokus"],
            fancy_score=50,
            summary="Ein solides Unternehmen.",
            company_colors=["Blau"],
            slogan=None
        )
