import os
import google.generativeai as genai
from pydantic import BaseModel

class ResearchResult(BaseModel):
    is_business: bool
    company_name: str | None = None
    core_values: list[str] = []
    fancy_score: int = 50
    summary: str = ""
    company_colors: list[str] = []
    slogan: str | None = None

# In-memory cache for research to save quota
_research_cache = {}

def run_company_research(company_name: str, domain: str) -> ResearchResult:
    """Führt Recherche durch mit dem leichtesten Modell (Lite), um Quota zu sparen."""
    if not company_name and not domain:
        return ResearchResult(is_business=False)

    search_target = company_name if company_name else domain
    
    # Check cache first
    if search_target in _research_cache:
        return _research_cache[search_target]

    # Nutze das "billigste"/leichteste Modell für maximale Quota
    model = genai.GenerativeModel("models/gemini-flash-lite-latest")
    
    prompt = f"""Analysiere die Firma "{search_target}". Antworte NUR mit JSON: {{ "core_values": ["Wert1"], "fancy_score": 50, "summary": "...", "company_colors": ["Farbe"], "slogan": "..." }}"""

    try:
        response = model.generate_content(prompt)
        text_resp = response.text.strip()
        # Basic cleaning of markdown if AI ignores instruction
        if "```json" in text_resp:
            text_resp = text_resp.split("```json")[1].split("```")[0]
        elif "```" in text_resp:
            text_resp = text_resp.split("```")[1].split("```")[0]
            
        import json
        data = json.loads(text_resp.strip())
        
        res = ResearchResult(
            is_business=True,
            company_name=company_name,
            core_values=data.get("core_values", ["Qualität"]),
            fancy_score=data.get("fancy_score", 50),
            summary=data.get("summary", "Ein spannendes Unternehmen."),
            company_colors=data.get("company_colors", ["Blau"]),
            slogan=data.get("slogan")
        )
        _research_cache[search_target] = res
        return res
    except Exception as e:
        print(f"[Research Error] {e}")
        # Return a neutral result but don't stop the flow
        return ResearchResult(
            is_business=True,
            company_name=company_name,
            core_values=["Innovation"],
            fancy_score=50,
            summary="Unternehmen im Analyse-Modus.",
            company_colors=["Grau"],
            slogan=None
        )
