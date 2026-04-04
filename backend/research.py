import os
import google.generativeai as genai
from pydantic import BaseModel

class ResearchResult(BaseModel):
    is_business: bool
    company_name: str | None = None
    core_values: list[str] = []
    fancy_score: int = 50  # 1 (Traditional/Conservative) to 100 (Hipster/Startup)
    summary: str = ""

def run_company_research(company_name: str, domain: str) -> ResearchResult:
    """
    Führt einen (simulierten oder echten) Recherche-Lauf über eine Firma durch
    und extrahiert per Gemini deren Kernwerte und einen Fancy-Score.
    """
    if not company_name and not domain:
        return ResearchResult(is_business=False)

    search_target = company_name if company_name else domain

    # Wir nutzen Gemini 1.5 Flash, um aus dem Firmennamen (und Allgemeinwissen)
    # oder über generische Such-Prompts eine Einschätzung zu generieren.
    # Für ein noch besseres Ergebnis (in Produktion) würde man hier zuerst
    # Requests an eine Search-API (z.B. Serper oder Tavily) schicken und die Website-Texte
    # der Firma an Gemini füttern.
    
    model = genai.GenerativeModel("gemini-2.5-flash")
    
    prompt = f"""
    Du bist ein B2B-Analyst. Analysiere die Firma "{search_target}".
    Falls die Firma völlig unbekannt ist, rate basierend auf dem Namen/der Domain oder gib Standardwerte für ein modernes KMU zurück.
    
    Antworte EXAKT im folgenden JSON Format, ohne Markdown-Formatierungen:
    {{
        "core_values": ["Wert1", "Wert2", "Wert3"],
        "fancy_score": 75,
        "summary": "Ein kurzer, einprägsamer Satz, wofür die Firma steht."
    }}
    
    - 'fancy_score' ist eine Zahl von 1 bis 100. 
      (1 = Sehr konservativ/traditionell wie z.B. eine alteingesessene Bank, 
      100 = Extrem hip/experimentell wie ein veganes Tech-Startup aus Berlin).
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
            summary=data.get("summary", "")
        )
    except Exception as e:
        print(f"[Research] Fehler bei der Analyse von {search_target}: {e}")
        # Graceful Fallback
        return ResearchResult(
            is_business=True,
            company_name=company_name,
            core_values=["Qualität", "Kunde im Fokus"],
            fancy_score=50,
            summary="Ein solides Unternehmen."
        )
