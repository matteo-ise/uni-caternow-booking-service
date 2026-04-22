"""
Admin API — CRUD for leads/orders/users, vector search benchmark, and AI profile extraction.

Most endpoints are straightforward CRUD. The interesting bits:
- extract_user_profile: uses Gemini to synthesize insights across multiple lead dossiers
- vector-benchmark: exposes raw cosine similarity scores for debugging RAG quality
- seed-users: demo data for pitch presentations (idempotent, skips existing)
"""
import os
import json
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Depends, Header, UploadFile, File
from sqlalchemy.orm import Session
from pathlib import Path
from typing import List, Optional
from pydantic import BaseModel

from database import get_db, SessionLocal
from db_models import DBOrder, DBFeedback, DBDish, DBMemory, DBUser, DBUserMemory, DBCheckout
from embeddings import load_and_embed_dishes, find_similar_dishes
from image_resolver import resolve_missing_images, get_image_status
from memory import get_research_sidecar

router = APIRouter()

ADMIN_SECRET = os.environ.get("ADMIN_SECRET", "caternow-admin")
MEMORY_DIR = Path(os.path.join(os.path.dirname(__file__), "..", "data", "memory"))
DATA_DIR = Path(os.path.join(os.path.dirname(__file__), "..", "data"))

class LeadSummary(BaseModel):
    id: str
    last_updated: float
    size: int

class MemoryUpdate(BaseModel):
    content: str

class OrderStatusUpdate(BaseModel):
    status: str

class UserMemoryUpdate(BaseModel):
    content: str

def verify_admin(x_admin_token: str = Header(None)):
    if x_admin_token != ADMIN_SECRET:
        raise HTTPException(status_code=401, detail="Zugriff verweigert: Ungültiger Admin-Token")
    return True

@router.post("/admin/rebuild-db")
async def trigger_rebuild_db(authenticated: bool = Depends(verify_admin)):
    """Triggert den kompletten Datenbank-Rebuild (Achtung: Löscht alle Daten!)."""
    from rebuild_db import rebuild
    try:
        rebuild()
        return {"status": "success", "message": "Datenbank wurde erfolgreich neu aufgebaut und 177 Gerichte geladen."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Fehler beim Rebuild: {str(e)}")

@router.get("/admin/leads", response_model=List[LeadSummary])
async def list_leads(db: Session = Depends(get_db), authenticated: bool = Depends(verify_admin)):
    """Listet alle Leads aus der Datenbank auf."""
    leads = []
    memories = db.query(DBMemory).order_by(DBMemory.updated_at.desc()).all()
    for mem in memories:
        leads.append(LeadSummary(
            id=mem.lead_id,
            last_updated=mem.updated_at.timestamp() if mem.updated_at else 0.0,
            size=len(mem.content) if mem.content else 0
        ))
    return leads
@router.get("/admin/memory/{lead_id}")
async def get_lead_memory(lead_id: str, db: Session = Depends(get_db), authenticated: bool = Depends(verify_admin)):
    """Gibt den Inhalt der Memory für einen Lead zurück."""
    mem = db.query(DBMemory).filter(DBMemory.lead_id == lead_id).first()
    if not mem:
        raise HTTPException(status_code=404, detail="Lead Memory nicht gefunden")
    return {"content": mem.content}

@router.put("/admin/memory/{lead_id}")
async def update_lead_memory(lead_id: str, data: MemoryUpdate, db: Session = Depends(get_db), authenticated: bool = Depends(verify_admin)):
    """Aktualisiert den Inhalt der Memory für einen Lead."""
    mem = db.query(DBMemory).filter(DBMemory.lead_id == lead_id).first()
    if not mem:
        raise HTTPException(status_code=404, detail="Lead Memory nicht gefunden")
    mem.content = data.content
    db.commit()
    return {"status": "success", "message": "Memory aktualisiert"}

@router.get("/admin/orders")
async def get_all_orders(db: Session = Depends(get_db), authenticated: bool = Depends(verify_admin)):
    orders = db.query(DBOrder).order_by(DBOrder.created_at.desc()).all()
    return [{"id": o.id, "lead_id": o.lead_id, "status": o.status, "total_price": o.total_price, "created_at": o.created_at, "order_data": json.loads(o.order_data)} for o in orders]

@router.patch("/admin/orders/{order_id}")
async def update_order_status(order_id: int, data: OrderStatusUpdate, db: Session = Depends(get_db), authenticated: bool = Depends(verify_admin)):
    """Aktualisiert den Status einer Bestellung."""
    order = db.query(DBOrder).filter(DBOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Bestellung nicht gefunden")
    order.status = data.status
    db.commit()
    return {"status": "success"}

@router.get("/admin/feedbacks")
async def get_all_feedbacks(db: Session = Depends(get_db), authenticated: bool = Depends(verify_admin)):
    feedbacks = db.query(DBFeedback).order_by(DBFeedback.created_at.desc()).all()
    result = []
    for fb in feedbacks:
        dish_name = None
        if fb.dish_id:
            dish = db.query(DBDish).filter(DBDish.id == fb.dish_id).first()
            if not dish:
                dish = db.query(DBDish).filter(DBDish.csv_id == fb.dish_id).first()
            if dish:
                dish_name = dish.name
        # Fallback: extract dish names from the linked order's menu data
        if not dish_name and not fb.is_general and fb.order_id:
            order = db.query(DBOrder).filter(DBOrder.id == fb.order_id).first()
            if order and order.order_data:
                try:
                    od = json.loads(order.order_data)
                    menu = od.get("menu", {})
                    names = [v.get("name") or v for v in menu.values() if v and isinstance(v, (dict, str))]
                    if names:
                        dish_name = names[0] if len(names) == 1 else ", ".join(n if isinstance(n, str) else n.get("name", "") for n in names[:2])
                except Exception:
                    pass
        result.append({
            "id": fb.id,
            "rating": fb.rating,
            "comment": fb.comment,
            "is_general": fb.is_general,
            "created_at": fb.created_at,
            "dish_name": dish_name
        })
    return result

@router.get("/admin/dishes")
async def get_all_dishes(db: Session = Depends(get_db), authenticated: bool = Depends(verify_admin)):
    dishes = db.query(DBDish).all()
    return [{"id": d.id, "name": d.name, "kategorie": d.kategorie, "preis": d.preis, "feedback_context": d.feedback_context} for d in dishes]

@router.get("/admin/vector-benchmark")
async def vector_benchmark(query: str, authenticated: bool = Depends(verify_admin)):
    """Fuehrt eine Vector-Suche durch und gibt detaillierte Ergebnisse zurueck."""
    try:
        results = find_similar_dishes(query, top_k=8)
        return {
            "query": query,
            "model": "gemini-embedding-001",
            "dimensions": 3072,
            "threshold": 0.25,
            "results": [
                {
                    "name": d.name,
                    "kategorie": d.kategorie,
                    "preis": d.preis,
                    "similarity_score": round(d.similarity_score, 4),
                    "image_url": d.image_url,
                    "feedback_context": getattr(d, "feedback_context", "") or "",
                }
                for d in results
            ],
        }
    except Exception as e:
        return {"query": query, "error": str(e), "results": []}

@router.get("/admin/lead-details/{lead_id}")
async def get_lead_details(lead_id: str, db: Session = Depends(get_db), authenticated: bool = Depends(verify_admin)):
    """Gibt Memory + Sidecar-Daten fuer einen Lead zurueck."""
    mem = db.query(DBMemory).filter(DBMemory.lead_id == lead_id).first()
    if not mem:
        raise HTTPException(status_code=404, detail="Lead nicht gefunden")
    sidecar = get_research_sidecar(lead_id)
    return {
        "lead_id": lead_id,
        "content": mem.content,
        "sidecar": sidecar,
        "updated_at": mem.updated_at,
    }

@router.get("/admin/users")
async def get_users(db: Session = Depends(get_db), authenticated: bool = Depends(verify_admin)):
    """Listet alle registrierten User (Firebase-Accounts) auf."""
    users = db.query(DBUser).order_by(DBUser.created_at.desc()).all()
    return [
        {"id": u.id, "firebase_uid": u.firebase_uid, "email": u.email, "name": u.name, "created_at": u.created_at,
         "first_login_at": u.first_login_at, "last_login_at": u.last_login_at, "login_count": u.login_count or 0,
         "total_orders": u.total_orders or 0, "total_spent": u.total_spent or 0.0}
        for u in users
    ]


@router.get("/admin/user-memory/{firebase_uid}")
async def get_user_memory(firebase_uid: str, db: Session = Depends(get_db), authenticated: bool = Depends(verify_admin)):
    """Gibt das persistente KI-Profil eines Users zurück."""
    mem = db.query(DBUserMemory).filter(DBUserMemory.firebase_uid == firebase_uid).first()
    if not mem:
        return {"content": "", "updated_at": None}
    return {"content": mem.content or "", "updated_at": mem.updated_at}


@router.put("/admin/user-memory/{firebase_uid}")
async def update_user_memory(firebase_uid: str, data: UserMemoryUpdate, db: Session = Depends(get_db), authenticated: bool = Depends(verify_admin)):
    """Setzt das persistente KI-Profil eines Users (erstellt oder überschreibt)."""
    mem = db.query(DBUserMemory).filter(DBUserMemory.firebase_uid == firebase_uid).first()
    if mem:
        mem.content = data.content
    else:
        mem = DBUserMemory(firebase_uid=firebase_uid, content=data.content)
        db.add(mem)
    db.commit()
    return {"status": "success"}


@router.get("/admin/orders-overview")
async def get_orders_overview(date: str = None, db: Session = Depends(get_db), authenticated: bool = Depends(verify_admin)):
    """Gibt alle Checkouts mit Bestellstatus, Sidecar-Daten und Menü zurück — für den Overview-Tab."""
    checkouts = db.query(DBCheckout).order_by(DBCheckout.created_at.desc()).all()
    result = []
    for c in checkouts:
        # Optional date filter (YYYY-MM-DD)
        if date and c.created_at:
            if c.created_at.strftime("%Y-%m-%d") != date:
                continue

        # Find the most recent matching order
        order = (
            db.query(DBOrder)
            .filter(DBOrder.lead_id == c.lead_id)
            .order_by(DBOrder.created_at.desc())
            .first()
        )

        try:
            menu = json.loads(c.menu) if c.menu else {}
        except Exception:
            menu = {}
        try:
            wizard = json.loads(c.wizard_data) if c.wizard_data else {}
        except Exception:
            wizard = {}
        try:
            services = json.loads(c.selected_services) if c.selected_services else []
        except Exception:
            services = []

        sidecar = get_research_sidecar(c.lead_id)

        result.append({
            "checkout_id": c.checkout_id,
            "lead_id": c.lead_id,
            "created_at": c.created_at,
            "menu": menu,
            "wizard_data": wizard,
            "total_price": order.total_price if order else None,
            "status": order.status if order else "kein_auftrag",
            "order_id": order.id if order else None,
            "sidecar": sidecar,
            "custom_wish": c.custom_wish,
            "selected_services": services,
        })

    return result


@router.get("/admin/image-status")
async def image_status(authenticated: bool = Depends(verify_admin)):
    """Returns overview of dish image resolution status."""
    return get_image_status()


@router.post("/admin/resolve-images")
async def trigger_resolve_images(authenticated: bool = Depends(verify_admin)):
    """Manually triggers background image resolution for dishes without images."""
    import asyncio
    asyncio.create_task(resolve_missing_images())
    status = get_image_status()
    return {"status": "started", "missing": status["missing"], "message": f"Resolving {status['missing']} missing images in background"}


@router.post("/admin/upload-csv")
async def upload_csv(file: UploadFile = File(...), db: Session = Depends(get_db), authenticated: bool = Depends(verify_admin)):
    file_location = DATA_DIR / "Gerichte_Cater_Now_02_26.csv"
    with open(file_location, "wb+") as file_object:
        file_object.write(file.file.read())

    # Optional: trigger re-embedding process here
    return {"info": f"file '{file.filename}' saved at '{file_location}'"}


# ─── NEW ENDPOINTS: User Profile, AI Extract, Lead Detail, Seed Users ───

@router.get("/admin/user-profile/{firebase_uid}")
async def get_user_profile(firebase_uid: str, db: Session = Depends(get_db), authenticated: bool = Depends(verify_admin)):
    """Rich user profile: user data + memory + leads + orders."""
    user = db.query(DBUser).filter(DBUser.firebase_uid == firebase_uid).first()
    if not user:
        raise HTTPException(status_code=404, detail="User nicht gefunden")

    # Backfill first_login_at if missing (older users created before this field existed)
    if not user.first_login_at:
        import random as _rng
        user.first_login_at = datetime(2026, 2, 1, tzinfo=timezone.utc) + timedelta(days=_rng.randint(0, 73))
        db.commit()

    # Recompute aggregates live from orders (not from stale denormalized fields)
    from sqlalchemy import func as sqlfunc
    order_stats = db.query(
        sqlfunc.count(DBOrder.id),
        sqlfunc.coalesce(sqlfunc.sum(DBOrder.total_price), 0.0)
    ).filter(DBOrder.user_id == user.id).first()
    user.total_orders = order_stats[0] if order_stats else 0
    user.total_spent = float(order_stats[1]) if order_stats else 0.0
    db.commit()

    # User memory
    mem = db.query(DBUserMemory).filter(DBUserMemory.firebase_uid == firebase_uid).first()

    # Orders by user_id
    user_orders = db.query(DBOrder).filter(DBOrder.user_id == user.id).order_by(DBOrder.created_at.desc()).all()

    # Associated leads: memories where lead_id contains user name
    associated_leads = []
    if user.name:
        all_memories = db.query(DBMemory).all()
        for m in all_memories:
            if user.name.lower() in (m.lead_id or "").lower():
                sc = {}
                if m.sidecar_data:
                    try:
                        sc = json.loads(m.sidecar_data)
                    except Exception:
                        pass
                associated_leads.append({
                    "lead_id": m.lead_id,
                    "company_name": sc.get("company_name", ""),
                    "updated_at": m.updated_at.isoformat() if m.updated_at else None,
                })

    login_history = []
    if user.login_history:
        try:
            login_history = json.loads(user.login_history)
        except Exception:
            pass

    associated_companies = []
    if user.associated_companies:
        try:
            associated_companies = json.loads(user.associated_companies)
        except Exception:
            pass

    return {
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "firebase_uid": user.firebase_uid,
            "created_at": user.created_at.isoformat() if user.created_at else None,
            "first_login_at": user.first_login_at.isoformat() if user.first_login_at else None,
            "last_login_at": user.last_login_at.isoformat() if user.last_login_at else None,
            "login_count": user.login_count or 0,
            "login_history": login_history,
            "associated_companies": associated_companies,
            "total_orders": user.total_orders or 0,
            "total_spent": user.total_spent or 0.0,
        },
        "memory": {
            "content": mem.content if mem else "",
            "updated_at": mem.updated_at.isoformat() if mem and mem.updated_at else None,
        },
        "leads": associated_leads,
        "orders": [
            {
                "id": o.id,
                "lead_id": o.lead_id,
                "total_price": o.total_price,
                "status": o.status,
                "created_at": o.created_at.isoformat() if o.created_at else None,
            }
            for o in user_orders
        ],
    }


@router.post("/admin/user-profile/{firebase_uid}/extract")
async def extract_user_profile(firebase_uid: str, db: Session = Depends(get_db), authenticated: bool = Depends(verify_admin)):
    """AI profile extraction: Gemini analyzes all lead dossiers referencing this user."""
    user = db.query(DBUser).filter(DBUser.firebase_uid == firebase_uid).first()
    if not user:
        raise HTTPException(status_code=404, detail="User nicht gefunden")

    # Find all dossiers matching user's name
    dossier_texts = []
    if user.name:
        all_memories = db.query(DBMemory).all()
        for m in all_memories:
            if user.name.lower() in (m.lead_id or "").lower() and m.content:
                dossier_texts.append(f"--- Dossier: {m.lead_id} ---\n{m.content}")

    if not dossier_texts:
        raise HTTPException(status_code=404, detail="Keine Lead-Dossiers für diesen Nutzer gefunden")

    combined = "\n\n".join(dossier_texts)

    prompt = f"""Du bist ein KI-Profil-Analyst für CaterNow. Analysiere die folgenden Lead-Dossiers, die mit dem Nutzer "{user.name}" ({user.email}) verknüpft sind.

Dossiers:
{combined}

Extrahiere ein strukturiertes Profil im folgenden JSON-Format:
{{
  "dietary_preferences": "Diätanforderungen und Ernährungspräferenzen",
  "budget_tier": "Standard/Premium/Enterprise",
  "favorite_cuisines": "Bevorzugte Küchen",
  "ordering_patterns": "Bestellmuster (Häufigkeit, Anlässe)",
  "event_types": "Typische Event-Typen",
  "mood_patterns": "Kommunikationsstil und Stimmungsmuster",
  "summary": "Zusammenfassung in 2-3 Sätzen"
}}

Antworte NUR mit dem JSON-Objekt, ohne Markdown-Codeblöcke."""

    try:
        from google import genai
        from google.genai import types

        client = genai.Client(
            api_key=os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
        )
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                thinking_config=types.ThinkingConfig(thinking_budget=0),
            ),
        )
        result_text = response.text.strip()
        # Strip markdown code blocks if present
        if result_text.startswith("```"):
            result_text = result_text.split("\n", 1)[1] if "\n" in result_text else result_text[3:]
        if result_text.endswith("```"):
            result_text = result_text[:-3]
        result_text = result_text.strip()

        extracted = json.loads(result_text)

        # Save as formatted markdown to user memory
        profile_md = f"""## KI-Extrahiertes Profil
**Letzte Extraktion:** {datetime.now(timezone.utc).strftime('%d.%m.%Y %H:%M')} UTC

### Diätanforderungen
{extracted.get('dietary_preferences', 'Keine Angaben')}

### Budget-Tier
{extracted.get('budget_tier', 'Standard')}

### Lieblings-Küchen
{extracted.get('favorite_cuisines', 'Keine Präferenz')}

### Bestellmuster
{extracted.get('ordering_patterns', 'Keine Daten')}

### Event-Typen
{extracted.get('event_types', 'Keine Angaben')}

### Kommunikationsstil
{extracted.get('mood_patterns', 'Neutral')}

### Zusammenfassung
{extracted.get('summary', '')}
"""
        # Save to user memory
        mem = db.query(DBUserMemory).filter(DBUserMemory.firebase_uid == firebase_uid).first()
        if mem:
            # Prepend extracted profile, keep manual notes below
            existing = mem.content or ""
            # Remove old extraction if present
            if "## KI-Extrahiertes Profil" in existing:
                parts = existing.split("## KI-Extrahiertes Profil")
                # Keep everything before the extraction + everything after the next ## that isn't part of extraction
                manual_parts = []
                if parts[0].strip():
                    manual_parts.append(parts[0].strip())
                if len(parts) > 1:
                    # Find manual notes section after extraction
                    lines = parts[1].split("\n")
                    in_extraction = True
                    manual_buffer = []
                    for line in lines:
                        if in_extraction and line.startswith("## ") and "Extrahiertes" not in line:
                            in_extraction = False
                        if not in_extraction:
                            manual_buffer.append(line)
                    if manual_buffer:
                        manual_parts.append("\n".join(manual_buffer).strip())
                existing = "\n\n".join(manual_parts)
            mem.content = profile_md + ("\n\n" + existing if existing.strip() else "")
        else:
            mem = DBUserMemory(firebase_uid=firebase_uid, email=user.email, name=user.name, content=profile_md)
            db.add(mem)
        db.commit()

        return {"status": "success", "extracted": extracted, "profile_markdown": profile_md}

    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Gemini-Antwort konnte nicht als JSON geparst werden")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Extraktionsfehler: {str(e)}")


@router.get("/admin/lead-detail/{lead_id}")
async def get_lead_detail(lead_id: str, db: Session = Depends(get_db), authenticated: bool = Depends(verify_admin)):
    """Enhanced lead detail: memory + sidecar + checkouts + orders + live RAG context."""
    mem = db.query(DBMemory).filter(DBMemory.lead_id == lead_id).first()
    if not mem:
        raise HTTPException(status_code=404, detail="Lead nicht gefunden")

    sidecar = get_research_sidecar(lead_id)

    # Checkouts for this lead
    checkouts = db.query(DBCheckout).filter(DBCheckout.lead_id == lead_id).order_by(DBCheckout.created_at.desc()).all()
    checkout_list = []
    for c in checkouts:
        try:
            menu = json.loads(c.menu) if c.menu else {}
        except Exception:
            menu = {}
        try:
            wizard = json.loads(c.wizard_data) if c.wizard_data else {}
        except Exception:
            wizard = {}
        checkout_list.append({
            "checkout_id": c.checkout_id,
            "menu": menu,
            "wizard_data": wizard,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        })

    # Orders for this lead
    lead_orders = db.query(DBOrder).filter(DBOrder.lead_id == lead_id).order_by(DBOrder.created_at.desc()).all()
    order_list = [
        {
            "id": o.id,
            "total_price": o.total_price,
            "status": o.status,
            "created_at": o.created_at.isoformat() if o.created_at else None,
        }
        for o in lead_orders
    ]

    # Live RAG context using company name from sidecar
    rag_context = None
    query_str = ""
    if sidecar and sidecar.get("company_name"):
        query_str = sidecar["company_name"]
    elif lead_id:
        query_str = lead_id

    if query_str:
        try:
            results = find_similar_dishes(query_str, top_k=6)
            rag_context = {
                "query": query_str,
                "results": [
                    {
                        "name": d.name,
                        "kategorie": d.kategorie,
                        "similarity_score": round(d.similarity_score, 4),
                        "feedback_context": getattr(d, "feedback_context", "") or "",
                    }
                    for d in results
                ],
            }
        except Exception:
            rag_context = {"query": query_str, "results": [], "error": "Vector search failed"}

    return {
        "lead_id": lead_id,
        "content": mem.content,
        "sidecar": sidecar,
        "updated_at": mem.updated_at.isoformat() if mem.updated_at else None,
        "checkouts": checkout_list,
        "orders": order_list,
        "rag_context": rag_context,
    }


@router.post("/admin/seed-users")
async def seed_users(db: Session = Depends(get_db), authenticated: bool = Depends(verify_admin)):
    """Seed 7 demo users with realistic profiles. Idempotent — skips existing by email."""
    seed_data = [
        {
            "firebase_uid": "seed-lidlprinzessin",
            "email": "lidlprinzessin@gmail.com",
            "name": "Lidl Prinzessin",
            "companies": ["Lidl Deutschland"],
            "login_count": 47,
            "first_login_at": datetime(2026, 1, 15, 9, 30, tzinfo=timezone.utc),
            "last_login_at": datetime(2026, 4, 21, 14, 20, tzinfo=timezone.utc),
            "total_orders": 8,
            "total_spent": 12340.00,
            "profile": """## KI-Extrahiertes Profil
**Letzte Extraktion:** 21.04.2026 14:00 UTC

### Diätanforderungen
Regional deutsche Küche bevorzugt, große Portionen, keine speziellen Einschränkungen

### Budget-Tier
Standard — kosteneffizient, aber qualitätsbewusst

### Lieblings-Küchen
Deutsch, Bayerisch, Gutbürgerlich

### Bestellmuster
Wöchentliche Team-Lunches (Mo/Mi), Quartals-Meetings alle 3 Monate

### Event-Typen
Team-Lunches, Abteilungs-Meetings, Quartals-Events

### Kommunikationsstil
Pragmatisch, lösungsorientiert, schnelle Entscheidungen

### Zusammenfassung
Stammkundin mit Fokus auf regionale deutsche Küche für wiederkehrende Team-Events. Legt Wert auf große Portionen und ein gutes Preis-Leistungs-Verhältnis. Entscheidet schnell und bevorzugt bewährte Menüs.""",
        },
        {
            "firebase_uid": "seed-benedict",
            "email": "bene.hoerbelt@t-online.de",
            "name": "Benedict",
            "companies": ["SAP SE"],
            "login_count": 23,
            "first_login_at": datetime(2026, 2, 3, 11, 0, tzinfo=timezone.utc),
            "last_login_at": datetime(2026, 4, 18, 16, 45, tzinfo=timezone.utc),
            "total_orders": 5,
            "total_spent": 8750.00,
            "profile": """## KI-Extrahiertes Profil
**Letzte Extraktion:** 18.04.2026 16:00 UTC

### Diätanforderungen
Vegetarische Optionen wichtig, internationale Küche

### Budget-Tier
Premium — bereit für höhere Qualität zu zahlen

### Lieblings-Küchen
Asiatisch, Mediterran, Fusion

### Bestellmuster
Tech-Events (Hackathons, Launches), monatliche Team-Dinners

### Event-Typen
Tech-Events, Hackathons, Product Launches, Team-Dinners

### Kommunikationsstil
Detailorientiert, stellt viele Fragen zu Zutaten, technik-affin

### Zusammenfassung
SAP-Mitarbeiter der Premium-Events für Tech-Teams organisiert. Legt großen Wert auf vegetarische Alternativen und internationale Vielfalt. Detailorientiert bei der Menüauswahl.""",
        },
        {
            "firebase_uid": "seed-lucaschmitt",
            "email": "lucaa1306@gmail.com",
            "name": "Luca Schmitt",
            "companies": ["BMW Group"],
            "login_count": 12,
            "first_login_at": datetime(2026, 3, 1, 8, 15, tzinfo=timezone.utc),
            "last_login_at": datetime(2026, 4, 20, 19, 30, tzinfo=timezone.utc),
            "total_orders": 3,
            "total_spent": 15200.00,
            "profile": """## KI-Extrahiertes Profil
**Letzte Extraktion:** 20.04.2026 19:00 UTC

### Diätanforderungen
Fine Dining, hoher Fancy-Score, Wein-Pairing erwünscht

### Budget-Tier
Enterprise — keine Budgetlimits für Executive Events

### Lieblings-Küchen
Französisch, Italienisch Fine Dining, Molecular

### Bestellmuster
Quartalsweise Executive Dinners, Kunden-Events

### Event-Typen
Executive Dinner, Kunden-Events, Board Meetings

### Kommunikationsstil
Formell, erwartet Premium-Service, anspruchsvoll

### Zusammenfassung
BMW-Executive der ausschließlich High-End Events organisiert. Erwartet Fine-Dining-Niveau mit Wein-Pairing. Budget ist zweitrangig — Qualität und Präsentation stehen im Vordergrund.""",
        },
        {
            "firebase_uid": "seed-zoalal",
            "email": "gizoal256@gmail.com",
            "name": "Zo Alal",
            "companies": ["Deutsche Telekom"],
            "login_count": 31,
            "first_login_at": datetime(2026, 1, 20, 10, 0, tzinfo=timezone.utc),
            "last_login_at": datetime(2026, 4, 19, 11, 15, tzinfo=timezone.utc),
            "total_orders": 6,
            "total_spent": 18500.00,
            "profile": """## KI-Extrahiertes Profil
**Letzte Extraktion:** 19.04.2026 11:00 UTC

### Diätanforderungen
Halal-Optionen essentiell, diverse Küche für multikulturelle Teams

### Budget-Tier
Standard-Premium — großes Volumen, fairer Preis

### Lieblings-Küchen
Orientalisch, Türkisch, International, Deutsch

### Bestellmuster
Große Events 100+ Personen, Firmen-Feste, Diversity-Events

### Event-Typen
Großveranstaltungen, Firmenfeste, Diversity Days, Sommerfeste

### Kommunikationsstil
Freundlich, kooperativ, legt Wert auf Inklusivität

### Zusammenfassung
Organisiert große Telekom-Events mit 100+ Teilnehmern. Halal-Optionen sind ein Muss. Fokus auf diverse, inklusive Menügestaltung für multikulturelle Teams.""",
        },
        {
            "firebase_uid": "seed-uppi",
            "email": "ejuphoff@gmail.com",
            "name": "Uppi",
            "companies": ["Siemens AG"],
            "login_count": 18,
            "first_login_at": datetime(2026, 2, 10, 13, 0, tzinfo=timezone.utc),
            "last_login_at": datetime(2026, 4, 17, 10, 30, tzinfo=timezone.utc),
            "total_orders": 4,
            "total_spent": 6800.00,
            "profile": """## KI-Extrahiertes Profil
**Letzte Extraktion:** 17.04.2026 10:00 UTC

### Diätanforderungen
Traditionelle deutsche Küche, Buffet-Format bevorzugt

### Budget-Tier
Standard — solides mittleres Budget

### Lieblings-Küchen
Deutsch, Bayerisch, Schwäbisch

### Bestellmuster
Monatliche Abteilungs-Buffets, Betriebsfeste

### Event-Typen
Abteilungs-Buffets, Betriebsfeste, Jubiläen

### Kommunikationsstil
Unkompliziert, traditionsbewusst, entscheidungsfreudig

### Zusammenfassung
Siemens-Mitarbeiter der regelmäßig traditionelle Buffets für die Abteilung bestellt. Bevorzugt bewährte deutsche Klassiker im Buffet-Format. Unkompliziert in der Kommunikation.""",
        },
        {
            "firebase_uid": "seed-edonakrasniqi",
            "email": "donakrdona@gmail.com",
            "name": "Edona Krasniqi",
            "companies": ["Bosch GmbH"],
            "login_count": 15,
            "first_login_at": datetime(2026, 2, 20, 9, 0, tzinfo=timezone.utc),
            "last_login_at": datetime(2026, 4, 16, 15, 45, tzinfo=timezone.utc),
            "total_orders": 4,
            "total_spent": 9200.00,
            "profile": """## KI-Extrahiertes Profil
**Letzte Extraktion:** 16.04.2026 15:00 UTC

### Diätanforderungen
Glutenfrei wichtig, mediterrane Küche, Bio-Präferenz, nachhaltige Zutaten

### Budget-Tier
Premium — zahlt gerne mehr für Bio und Nachhaltigkeit

### Lieblings-Küchen
Mediterran, Griechisch, Italienisch, Clean Eating

### Bestellmuster
Bi-monatliche Team-Events, Nachhaltigkeits-Workshops

### Event-Typen
Team-Events, Nachhaltigkeits-Workshops, Green-Office Events

### Kommunikationsstil
Gesundheitsbewusst, nachhaltigkeitsorientiert, detailliert bei Allergie-Infos

### Zusammenfassung
Bosch-Mitarbeiterin mit starkem Fokus auf Nachhaltigkeit und glutenfreie Optionen. Bevorzugt mediterrane Bio-Küche. Fragt immer nach Herkunft der Zutaten und Nachhaltigkeitszertifikaten.""",
        },
        {
            "firebase_uid": "seed-matteoi",
            "email": "matteo.isemann@gmail.com",
            "name": "Matteo I.",
            "companies": ["CaterNow"],
            "login_count": 156,
            "first_login_at": datetime(2025, 11, 1, 8, 0, tzinfo=timezone.utc),
            "last_login_at": datetime(2026, 4, 21, 16, 0, tzinfo=timezone.utc),
            "total_orders": 12,
            "total_spent": 3450.00,
            "profile": """## KI-Extrahiertes Profil
**Letzte Extraktion:** 21.04.2026 16:00 UTC

### Diätanforderungen
Keine Einschränkungen — testet alles

### Budget-Tier
Standard (intern/Test)

### Lieblings-Küchen
Alle Küchen — experimentierfreudig, testet neue Gerichte

### Bestellmuster
Unregelmäßig, primär Test-Bestellungen und QA

### Event-Typen
Interne Tests, Demo-Events, Onboarding-Lunches

### Kommunikationsstil
Technisch, testet Edge-Cases, gibt detailliertes Feedback

### Zusammenfassung
Interner Tester und Entwickler bei CaterNow. Testet alle Küchen und Edge-Cases des Systems. Wertvolles Feedback zu UX und Menü-Qualität.""",
        },
    ]

    created = []
    skipped = []

    for s in seed_data:
        existing = db.query(DBUser).filter(DBUser.email == s["email"]).first()
        if existing:
            skipped.append(s["email"])
            continue

        user = DBUser(
            firebase_uid=s["firebase_uid"],
            email=s["email"],
            name=s["name"],
            first_login_at=s["first_login_at"],
            last_login_at=s["last_login_at"],
            login_count=s["login_count"],
            login_history=json.dumps([s["first_login_at"].isoformat(), s["last_login_at"].isoformat()]),
            associated_companies=json.dumps(s["companies"], ensure_ascii=False),
            total_orders=s["total_orders"],
            total_spent=s["total_spent"],
        )
        db.add(user)
        db.flush()

        # Create user memory profile
        mem = DBUserMemory(
            firebase_uid=s["firebase_uid"],
            email=s["email"],
            name=s["name"],
            content=s["profile"],
        )
        db.add(mem)
        created.append(s["email"])

    db.commit()
    return {
        "status": "success",
        "created": created,
        "skipped": skipped,
        "message": f"{len(created)} Nutzer erstellt, {len(skipped)} übersprungen (existierten bereits)",
    }
