import os
import re
import json
import time
from google import genai
from google.genai import types
from pydantic import BaseModel
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

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
from db_models import DBUsageStats, DBMemory
from datetime import datetime, timezone

# Lazy-initialized client
_client: genai.Client | None = None

def _get_client() -> genai.Client:
    global _client
    if _client is None:
        _client = genai.Client(
            api_key=os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
        )
    return _client

# In-memory cache for research to save quota
_research_cache: dict = {}

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
        return True  # Im Zweifel erlauben
    finally:
        db.close()

def run_company_research(company_name_or_domain: str) -> ResearchResult:
    """Führt Recherche durch mit Google Search Grounding (Limit: 500/Tag)."""
    if not company_name_or_domain:
        return ResearchResult(is_business=False)

    search_target = company_name_or_domain.strip()

    if search_target in _research_cache:
        return _research_cache[search_target]

    can_search = check_and_inc_usage("google_search", limit=500)

    config_kwargs: dict = {}
    if can_search:
        config_kwargs["tools"] = [types.Tool(google_search=types.GoogleSearch())]
        print(f"[Research] Using google_search tool (google-genai SDK)")
    else:
        print(f"[Research] Daily limit reached, proceeding without search grounding")

    config = types.GenerateContentConfig(**config_kwargs) if config_kwargs else None

    prompt = f"""Recherchiere jetzt aktiv die Firma "{search_target}" über Google Search.

DEINE MISSION: Extrahiere präzise Geschäftsdaten für ein personalisiertes Catering-Angebot.

KRITISCHE AUFGABE – hq_address:
1. Suche nach der OFFIZIELLEN LADUNGSFÄHIGEN ANSCHRIFT (Headquarters).
2. Priorität 1: IMPRESSUM der offiziellen Website (z.B. firma.de/impressum, firma.de/legal).
3. Priorität 2: Offizielles Handelsregister oder "Contact Us" Seite.
4. Format: "Straße Hausnummer, PLZ Stadt".
5. VERIFIZIERUNG: Falls keine ECHTE Adresse gefunden wird, setze hq_address zwingend auf null.

WICHTIG: Antworte AUSSCHLIESSLICH mit einem validen JSON-Objekt, ohne jeglichen Markdown-Text, ohne ```json Blöcke und ohne zusätzliche Erklärungen.

Muster für deine Antwort:
{{
  "company_name": "Exakter Firmenname laut Impressum",
  "domain": "offizielle-domain.de",
  "core_values": ["Wert1", "Wert2"],
  "fancy_score": 1-100 (Zahl, wie modern/digital ist der Auftritt?),
  "summary": "1 Satz Beschreibung",
  "company_colors": ["Dominante Branding-Farbe als Wort, z.B. Dunkelblau"],
  "slogan": "Offizieller Slogan oder null",
  "hq_address": "Straße Hausnr, PLZ Ort (NUR WENN VERIFIZIERT!) oder null"
}}"""

    MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite"]

    # ── Step 1: call Gemini with retry on 503, then fallback model ─────────────
    response = None
    MAX_RETRIES = 3
    for model in MODELS:
        if response is not None:
            break
        def _call_gemini():
            return _get_client().models.generate_content(
                model=model,
                contents=prompt,
                config=config,
            )
        for attempt in range(MAX_RETRIES):
            try:
                with ThreadPoolExecutor(max_workers=1) as executor:
                    future = executor.submit(_call_gemini)
                    response = future.result(timeout=25)
                if model != MODELS[0]:
                    print(f"[Research] Succeeded with fallback model {model}")
                break  # success
            except FuturesTimeoutError:
                print(f"[Research Timeout] {search_target} exceeded 25s")
                res = ResearchResult(
                    is_business=True,
                    company_name=search_target,
                    core_values=["Innovation"],
                    fancy_score=50,
                    summary="Recherche-Timeout.",
                    company_colors=["Grau"],
                    slogan=None,
                )
                _research_cache[search_target] = res
                return res
            except Exception as e:
                if "503" in str(e) and attempt < MAX_RETRIES - 1:
                    wait = 5 * (attempt + 1)
                    print(f"[Research] 503 on {model} attempt {attempt + 1}, retrying in {wait}s...")
                    time.sleep(wait)
                elif "503" in str(e) and model != MODELS[-1]:
                    print(f"[Research] {model} exhausted retries, falling back to {MODELS[-1]}")
                    break  # try next model
                else:
                    print(f"[Research Error Critical] Failed for {search_target}: {e}")
                    return ResearchResult(
                        is_business=True,
                        company_name=search_target,
                        core_values=["Innovation"],
                        fancy_score=50,
                        summary="Unternehmen im Analyse-Modus.",
                        company_colors=["Grau"],
                        slogan=None,
                    )

    if response is None:
        return ResearchResult(is_business=True, company_name=search_target)

    # ── Step 2: parse JSON response ────────────────────────────────────────────
    try:
        text_resp = response.text.strip()
        print(f"[Research Debug] Raw response for {search_target}: {text_resp[:120]}...")

        if "```json" in text_resp:
            text_resp = text_resp.split("```json")[1].split("```")[0]
        elif "```" in text_resp:
            text_resp = text_resp.split("```")[1].split("```")[0]

        data = json.loads(text_resp.strip())
        print(f"[Research Debug] JSON parsed successfully for {search_target}")

        domain = data.get("domain", "")
        logo_url = None
        if domain:
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
            logo_url=logo_url,
        )
        _research_cache[search_target] = res
        return res
    except Exception as e:
        print(f"[Research Parse Error] {search_target}: {e}")
        return ResearchResult(
            is_business=True,
            company_name=search_target,
            core_values=["Innovation"],
            fancy_score=50,
            summary="Unternehmen im Analyse-Modus.",
            company_colors=["Grau"],
            slogan=None,
        )


def find_hq_address(company_name: str) -> str | None:
    """
    Dedicated mini-agent: finds ONLY the official German billing/HQ address.
    Two-step search: 1) Impressum page, 2) Handelsregister fallback.
    Uses a separate 'address_search' quota (200/day) to avoid depleting google_search.
    Timeout: 15s, no retry (keeps prefetch fast).
    """
    if not company_name:
        return None

    can_search = check_and_inc_usage("address_search", limit=200)
    if not can_search:
        print("[Address] Daily address_search limit reached")
        return None

    config = types.GenerateContentConfig(
        tools=[types.Tool(google_search=types.GoogleSearch())]
    )

    prompts = [
        # Step 1: Impressum-focused search
        f"""Suche jetzt aktiv nach dem deutschen Impressum der Firma "{company_name}".

AUFGABE: Finde die OFFIZIELLE LADUNGSFÄHIGE ANSCHRIFT (Rechnungsanschrift/Geschäftssitz).

Priorität:
1. Impressum der offiziellen Website (z.B. firma.de/impressum oder firma.de/legal/imprint)
2. Angaben gemäß § 5 TMG
3. Registered office / Sitz laut Handelsregister

Antworte NUR mit der Adresse im Format "Straße Hausnr, PLZ Stadt" — NICHTS anderes.
Falls keine verifizierbare Adresse gefunden: antworte nur mit dem Wort "null".""",

        # Step 2: Handelsregister fallback
        f"""Suche jetzt aktiv nach der offiziellen Handelsregister-Adresse von "{company_name}" in Deutschland.

Suche nach: "{company_name}" Handelsregister HRB Sitz Adresse

Antworte NUR mit der Adresse im Format "Straße Hausnr, PLZ Stadt" — NICHTS anderes.
Falls keine verifizierbare Adresse gefunden: antworte nur mit dem Wort "null".""",
    ]

    addr_models = ["gemini-2.5-flash", "gemini-2.5-flash-lite"]
    for step, prompt in enumerate(prompts, 1):
        for model in addr_models:
            try:
                def _call():
                    return _get_client().models.generate_content(
                        model=model,
                        contents=prompt,
                        config=config,
                    )

                with ThreadPoolExecutor(max_workers=1) as executor:
                    response = executor.submit(_call).result(timeout=15)

                raw = response.text.strip().strip('"').strip("'")
                print(f"[Address Step {step}] Raw: {raw[:80]}")

                if not raw or raw.lower() in ("null", "none", "-", "unbekannt", "keine adresse gefunden"):
                    break  # try next prompt step, not next model

                if any(c.isdigit() for c in raw) and len(raw) > 8:
                    print(f"[Address] Found via step {step}: {raw}")
                    return raw
                break  # got a response but not useful, try next step

            except Exception as e:
                if "503" in str(e) and model != addr_models[-1]:
                    print(f"[Address Step {step}] 503 on {model}, trying fallback")
                    continue
                print(f"[Address Step {step}] Error: {e}")
                break
        else:
            continue
        continue

    return None


def patch_memory_with_research(lead_id: str, research: "ResearchResult") -> None:
    """
    After a successful prefetch, overwrites stale placeholder values in the
    memory dossier (e.g. 'Unbekannt', 'None') with real research data.
    """
    db = SessionLocal()
    try:
        mem = db.query(DBMemory).filter(DBMemory.lead_id == lead_id).first()
        if not mem or not mem.content:
            return

        content = mem.content
        colors_str = ", ".join(research.company_colors) if research.company_colors else "Unbekannt"
        slogan_str = research.slogan or "Kein Slogan"

        content = re.sub(r"\*\*Identity:\*\*.*", f"**Identity:** {research.company_name}", content)
        content = re.sub(r"\*\*Branding:\*\*.*", f"**Branding:** {colors_str} | {slogan_str}", content)
        content = re.sub(r"\*\*HQ Location:\*\*.*", f"**HQ Location:** {research.hq_address or 'Unbekannt'}", content)
        content = re.sub(r"\*\*Logo:\*\*.*", f"**Logo:** {research.logo_url or 'None'}", content)
        content = re.sub(r"\*\*Fancy-Score:\*\*.*", f"**Fancy-Score:** {research.fancy_score}/100", content)

        mem.content = content
        db.commit()
        print(f"[Memory Patch] Updated dossier for lead={lead_id} with research data")
    except Exception as e:
        print(f"[Memory Patch Error] {e}")
        db.rollback()
    finally:
        db.close()
