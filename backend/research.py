import os
import google.generativeai as genai
from pydantic import BaseModel
import re

class ResearchResult(BaseModel):
    is_business: bool
    company_name: str | None = None
    core_values: list[str] = []
    fancy_score: int = 50
    summary: str = ""
    company_colors: list[str] = []
    slogan: str | None = None
    hq_address: str | None = None
    logo_url: str | None = None

from database import SessionLocal
from db_models import DBUsageStats
from sqlalchemy.sql import func
from datetime import datetime, timezone

# In-memory cache for research to save quota
_research_cache = {}

def check_and_inc_usage(feature: str, limit: int = 500) -> bool:
    """Prüft das Tageslimit und erhöht den Zähler. Gibt True zurück wenn unter Limit."""
    db = SessionLocal()
    try:
        stats = db.query(DBUsageStats).filter(DBUsageStats.feature == feature).first()
        now = datetime.now(timezone.utc)
        
        if not stats:
            stats = DBUsageStats(feature=feature, count=1, last_reset=now)
            db.add(stats)
            db.commit()
            return True
        
        # Reset wenn neuer Tag
        if stats.last_reset.date() < now.date():
            stats.count = 1
            stats.last_reset = now
            db.commit()
            return True
        
        if stats.count >= limit:
            return False
            
        stats.count += 1
        db.commit()
        return True
    except Exception as e:
        print(f"[Usage Check Error] {e}")
        return True # Im Zweifel erlauben
    finally:
        db.close()

def run_company_research(company_name_or_domain: str) -> ResearchResult:
    """Führt Recherche durch mit Google Search Grounding (Limit: 500/Tag)."""
    if not company_name_or_domain:
        return ResearchResult(is_business=False)

    search_target = company_name_or_domain.strip()
    
    # Check cache first
    if search_target in _research_cache:
        return _research_cache[search_target]

    # Check daily limit
    can_search = check_and_inc_usage("google_search", limit=500)

    # Nutze das stärkere Modell mit Search Grounding (nur wenn Limit nicht erreicht)
    tools = [{"google_search_retrieval": {}}] if can_search else []
    
    model = genai.GenerativeModel(
        "gemini-2.0-flash", 
        tools=tools 
    )
    
    prompt = f"""Analysiere die Firma "{search_target}". Antworte NUR mit JSON, keine Markdown Blöcke. Formatiere strikt als:
{{
  "company_name": "Gefundener echter Name",
  "domain": "gefundene-domain.de",
  "core_values": ["Wert1", "Wert2"], 
  "fancy_score": 50, 
  "summary": "...", 
  "company_colors": ["Farbe"], 
  "slogan": "...",
  "hq_address": "Reale Hauptsitz Adresse (Straße, PLZ, Ort) falls findbar, sonst null"
}}"""

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
        
        domain = data.get("domain", "")
        logo_url = None
        if domain:
            # Versuche saubere Domain für Logo API zu extrahieren
            clean_domain = re.sub(r'^https?://', '', domain).split('/')[0]
            logo_url = f"https://logo.clearbit.com/{clean_domain}"
        
        res = ResearchResult(
            is_business=True,
            company_name=data.get("company_name", search_target),
            core_values=data.get("core_values", ["Qualität"]),
            fancy_score=data.get("fancy_score", 50),
            summary=data.get("summary", "Ein spannendes Unternehmen."),
            company_colors=data.get("company_colors", ["Blau"]),
            slogan=data.get("slogan"),
            hq_address=data.get("hq_address"),
            logo_url=logo_url
        )
        _research_cache[search_target] = res
        return res
    except Exception as e:
        print(f"[Research Error] {e}")
        # Return a neutral result but don't stop the flow
        return ResearchResult(
            is_business=True,
            company_name=search_target,
            core_values=["Innovation"],
            fancy_score=50,
            summary="Unternehmen im Analyse-Modus.",
            company_colors=["Grau"],
            slogan=None
        )
