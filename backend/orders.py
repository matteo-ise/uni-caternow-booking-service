import json
import threading
import re
import google.generativeai as genai
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional, Dict, Any

from database import get_db
from db_models import DBOrder, DBFeedback, DBDish, DBUser
from auth import get_current_user, get_optional_user
from embeddings import re_embed_dish
from memory import get_memory

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

@router.post("/checkout/story")
async def get_checkout_story(req: StoryRequest):
    """Generiert ein persönliches Storytelling für den Checkout basierend auf dem Memory."""
    memory = get_memory(req.lead_id)
    if not memory:
        return {"story": "Schön, dass du dich für ein Catering von uns entschieden hast! Wir freuen uns darauf, dein Event kulinarisch zu begleiten."}
    
    model = genai.GenerativeModel("models/gemini-flash-lite-latest")
    prompt = f"""
    Basierend auf diesem Lead-Gedächtnis:
    {memory}
    
    Schreibe einen extrem charmanten, kurzen Verkaufs-Gruß (max 3 Sätze) für die Checkout-Seite.
    - Sprich den Kunden persönlich an (Du/Sie je nach Score).
    - Nutze Storytelling: Erwähne den Anlass, die Firma oder eine Vorliebe (z.B. 'Passend zu eurem Firmenevent bei [Firma]...').
    - Beende mit einem herzlichen Gruß in die Stadt des Kunden (falls bekannt, sonst allgemein).
    - Der Text soll Hunger auf das Menü machen.
    """
    try:
        response = model.generate_content(prompt)
        return {"story": response.text.strip()}
    except:
        return {"story": "Dein perfektes Menü ist nur noch einen Klick entfernt. Wir freuen uns auf dein Event!"}

@router.post("/orders", status_code=status.HTTP_201_CREATED)
async def submit_order(order: OrderSubmit, db: Session = Depends(get_db), current_user: Optional[dict] = Depends(get_optional_user)):
    user_id = None
    if current_user:
        uid = current_user.get("uid")
        user = db.query(DBUser).filter(DBUser.firebase_uid == uid).first()
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

    db_fb = DBFeedback(
        user_id=user.id,
        dish_id=feedback.dish_id,
        order_id=feedback.order_id,
        rating=feedback.rating,
        comment=feedback.comment,
        is_general=feedback.is_general
    )
    db.add(db_fb)
    db.commit()

    if not feedback.is_general and feedback.dish_id and feedback.comment:
        dish = db.query(DBDish).filter(DBDish.id == feedback.dish_id).first()
        if dish:
            existing_fb = dish.feedback_context or ""
            new_fb = f"{existing_fb} | {feedback.comment}".strip(" |")
            dish.feedback_context = new_fb
            db.commit()
            threading.Thread(target=re_embed_dish, args=(dish.id,)).start()

    return {"status": "Feedback saved"}
