import asyncio
import os
import json
import threading
import re
from google import genai
from google.genai import types
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional, Dict, Any

from database import get_db
from db_models import DBOrder, DBFeedback, DBDish, DBUser
from auth import get_current_user, get_optional_user
from embeddings import re_embed_dish
from memory import get_memory, get_research_sidecar

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

_client: genai.Client | None = None

def _get_client() -> genai.Client:
    global _client
    if _client is None:
        _client = genai.Client(
            api_key=os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
        )
    return _client

router = APIRouter()

class OrderSubmit(BaseModel):
    lead_id: str
    order_data: Dict[str, Any]
    total_price: Optional[float] = 0.0

class FeedbackSubmit(BaseModel):
    order_id: int
    dish_id: Optional[int] = None
    rating: int
    comment: Optional[str] = None
    is_general: bool = False

class StoryRequest(BaseModel):
    lead_id: str
    dishes: Optional[List[str]] = []

@router.post("/checkout/story")
async def get_checkout_story(req: StoryRequest):
    """Generiert ein persönliches Storytelling für den Checkout basierend auf dem Memory."""
    memory = get_memory(req.lead_id)
    chosen_dishes = ", ".join(req.dishes) if req.dishes else "unserer Auswahl"
    
    # Default values
    hq_address = ""
    logo_url = ""
    story = "Schön, dass du dich für ein Catering von uns entschieden hast! Wir freuen uns darauf, dein Event kulinarisch zu begleiten."

    # Read research sidecar first (reliable source), fall back to memory regex
    sidecar = get_research_sidecar(req.lead_id)
    if sidecar:
        raw_addr = sidecar.get("hq_address") or ""
        if str(raw_addr).lower() not in ("unbekannt", "null", "none", "", "-"):
            hq_address = str(raw_addr).strip()
        raw_logo = sidecar.get("logo_url") or ""
        val_logo = str(raw_logo).strip()
        if val_logo.lower() not in ("none", "null", "-", "") and val_logo.startswith("https://"):
            logo_url = val_logo

    # 2. Fallback: parse from memory markdown only when sidecar is incomplete
    if memory and (not hq_address or not logo_url):
        addr_match = re.search(r"\*\*HQ[^:*]*:\*\*\s*(.*)", memory, re.IGNORECASE)
        if addr_match and not hq_address:
            val = addr_match.group(1).strip()
            if val.lower() not in ("unbekannt", "null", "none", "", "-"):
                hq_address = val

        logo_match = re.search(r"\*\*Logo[^:*]*:\*\*\s*(.*)", memory, re.IGNORECASE)
        if logo_match and not logo_url:
            val = logo_match.group(1).strip()
            if val.lower() not in ("none", "null", "-", "") and val.startswith("https://"):
                logo_url = val

    # 3. Always generate AI story when memory is available (runs regardless of sidecar state)
    if memory:
        # Extract company color — prefer sidecar, fallback to memory regex
        company_color = ""
        if sidecar and sidecar.get("company_colors"):
            company_color = ", ".join(sidecar["company_colors"]).lower()
        if not company_color:
            color_match = re.search(r"\*\*Branding:\*\*\s*(.*?)(?:\s*\||\n)", memory, re.IGNORECASE)
            company_color = color_match.group(1).strip().lower() if color_match else ""

        color_to_heart = {
            "rot": "❤️", "red": "❤️",
            "blau": "💙", "blue": "💙",
            "grün": "💚", "gruen": "💚", "green": "💚", "türkis": "💚", "teal": "💚",
            "lila": "💜", "violett": "💜", "purple": "💜",
            "orange": "🧡",
            "gelb": "💛", "yellow": "💛",
            "schwarz": "🖤", "black": "🖤",
            "gold": "💛", "silber": "🩶", "silver": "🩶",
            "pink": "💗", "rosa": "💗",
        }
        heart = next((h for k, h in color_to_heart.items() if k in company_color), "🤍")

        prompt = f"""Du bist ein kulinarischer Storyteller für CaterNow, ein Premium-Catering-Service.

Basierend auf diesem Lead-Profil:
{memory}

AKTUELLES GEWÄHLTES MENÜ (NUTZE NUR DIESE GERICHTE!):
{chosen_dishes}

Schreibe eine persönliche, kulinarische Menü-Story für die Checkout-Seite.

STRUKTUR & STIL:
- MAXIMAL 3 SÄTZE. Sei extrem präzise und emotional.
- NUTZE ABSÄTZE: Füge nach dem ersten oder zweiten Satz einen Doppel-Umbruch (\\n\\n) ein.
- BRANDING-FOKUS: Nutze die recherchierten Firmenfarben ({company_color if company_color else 'unsere Premium-Farben'}) oder den Slogan rigeros in der Tonalität oder erwähne sie elegant (z.B. "In euren Vereinsfarben...", "Passend zu eurem Look...").
- KULINARIK: Beschreibe kurz eine Textur oder einen Geschmack eines gewählten Gerichts (NUTZE NUR EIN GERICHT AUS DER LISTE OBEN!).

REGELN:
- Sprich die Person persönlich an (Du wenn Fancy-Score >70, Sie wenn <70)
- Erwähne mindestens ein konkretes Gericht oder eine Zutat aus der Liste OBEN.
- Erfinde KEINE Gerichte (z.B. keinen Lachs, wenn er nicht oben steht!).
- Ausgabe: NUR den Story-Text, kein JSON, keine Formatierung, keine umschließenden Anführungszeichen
- Letzter Satz endet mit genau diesen Emojis: {heart}{heart}{heart}
"""
        MAX_RETRIES = 2
        for attempt in range(MAX_RETRIES + 1):
            try:
                response = _get_client().models.generate_content(
                    model="gemini-2.5-flash",
                    contents=prompt,
                )
                story = response.text.strip().strip('"')
                break
            except Exception as e:
                if "503" in str(e) and attempt < MAX_RETRIES:
                    await asyncio.sleep(3 * (attempt + 1))
                else:
                    print(f"[Story Error] {e}")
                    break

    return {"story": story, "hq_address": hq_address, "logo_url": logo_url}

@router.post("/orders", status_code=status.HTTP_201_CREATED)
async def submit_order(order: OrderSubmit, db: Session = Depends(get_db), current_user: Optional[dict] = Depends(get_optional_user)):
    user_id = None
    if current_user:
        uid = current_user.get("uid")
        email = current_user.get("email")
        name = current_user.get("name", "")
        
        # Check by UID
        user = db.query(DBUser).filter(DBUser.firebase_uid == uid).first()
        
        # Check by Email if not found (prevents crash on duplicate email)
        if not user and email:
            user = db.query(DBUser).filter(DBUser.email == email).first()
            if user:
                user.firebase_uid = uid
                db.commit()

        if not user and email:
            user = DBUser(firebase_uid=uid, email=email, name=name)
            db.add(user)
            try:
                db.commit()
                db.refresh(user)
            except:
                db.rollback()
                user = db.query(DBUser).filter(DBUser.email == email).first()
            
            print(f"[Orders] User {email} handled during order.")
        
        if user:
            user_id = user.id

    db_order = DBOrder(
        user_id=user_id,
        lead_id=order.lead_id,
        total_price=order.total_price,
        order_data=json.dumps(order.order_data)
    )
    db.add(db_order)
    db.commit()
    db.refresh(db_order)
    return {"status": "success", "order_id": db_order.id}

@router.get("/users/me/orders")
async def get_my_orders(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    uid = current_user.get("uid")
    user = db.query(DBUser).filter(DBUser.firebase_uid == uid).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    orders = db.query(DBOrder).filter(DBOrder.user_id == user.id).order_by(DBOrder.created_at.desc()).all()
    
    result = []
    for o in orders:
        result.append({
            "id": o.id,
            "status": o.status,
            "total_price": o.total_price,
            "created_at": o.created_at,
            "order_data": json.loads(o.order_data)
        })
    return result

@router.post("/feedback")
async def submit_feedback(feedback: FeedbackSubmit, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    uid = current_user.get("uid")
    user = db.query(DBUser).filter(DBUser.firebase_uid == uid).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    real_dish_id = None
    if feedback.dish_id:
        dish = db.query(DBDish).filter(DBDish.csv_id == feedback.dish_id).first()
        if dish:
            real_dish_id = dish.id

    db_fb = DBFeedback(
        user_id=user.id,
        dish_id=real_dish_id,
        order_id=feedback.order_id,
        rating=feedback.rating,
        comment=feedback.comment,
        is_general=feedback.is_general
    )
    db.add(db_fb)
    db.commit()

    if not feedback.is_general and real_dish_id and feedback.comment:
        dish = db.query(DBDish).filter(DBDish.id == real_dish_id).first()
        if dish:
            existing_fb = dish.feedback_context or ""
            new_fb = f"{existing_fb} | {feedback.comment}".strip(" |")
            dish.feedback_context = new_fb
            db.commit()
            threading.Thread(target=re_embed_dish, args=(dish.id,)).start()

    return {"status": "Feedback saved"}
