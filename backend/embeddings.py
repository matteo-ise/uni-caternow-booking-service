"""
Vector Embedding Pipeline for CaterNow.
Optimized with CSV change detection (hashing) and professional logging.
"""
import os
import pandas as pd
import numpy as np
import google.generativeai as genai
import logging
from dotenv import load_dotenv
from sqlalchemy import text

from models import Dish
from database import SessionLocal
from db_models import DBDish
from sync_logic import get_file_hash

# Setup Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger("CaterNow-AI")

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
genai.configure(api_key=os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY"))

DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "Gerichte_Cater_Now_02_26.csv")
EMBEDDING_MODEL = "models/gemini-embedding-001"

async def load_and_embed_dishes(force_refresh=False):
    """
    Synchronisiert die CSV-Datei mit der Vektordatenbank.
    Führt nur dann neue API-Calls aus, wenn die DB leer ist oder force_refresh=True.
    """
    db = SessionLocal()
    try:
        count = db.query(DBDish).count()
        
        if count > 0 and not force_refresh:
            logger.info(f"Vektor-Cache aktiv: {count} Gerichte in Neon DB bereit.")
            return

        logger.info("🔄 Vektordatenbank-Synchronisierung gestartet...")
        
        if not os.path.exists(DATA_PATH):
            logger.error(f"CSV-Datei nicht gefunden unter: {DATA_PATH}")
            return

        df = pd.read_csv(DATA_PATH, sep=";", encoding="utf-8", encoding_errors="replace")
        
        # Falls force_refresh, löschen wir erst alles
        if force_refresh:
            db.query(DBDish).delete()
            db.commit()

        gerichte_to_insert = []
        names_to_embed = []
        
        for _, row in df.iterrows():
            kategorie = _get_kategorie(row)
            if kategorie is None: continue
            
            csv_id = int(row.get("id", 0))
            name = str(row.get("name", "")).strip()
            if not name or name == "nan": continue
            
            preis = None
            try: preis = float(row.get("Preis1"))
            except: pass

            bucket = os.environ.get("VITE_FIREBASE_STORAGE_BUCKET")
            img_url = f"https://firebasestorage.googleapis.com/v0/b/{bucket}/o/dishes%2F{csv_id}.jpg?alt=media"

            # Rich Data Vector Construction
            rich_features = []
            for col in ["vegan", "vegetarisch", "kalt", "warm", "schwein", "rind", "geflügel", "fisch", "halal", "business", "high_class", "geburtstag", "hochzeit", "leicht_im_magen", "schwer_im_magen", "familienfeier", "italienisch", "mediterran", "spanisch", "französisch", "deutsch", "indisch", "asiatisch", "vital", "festlich", "gourmet", "bbq_grill"]:
                if str(row.get(col, "0")).strip() == "1":
                    rich_features.append(col.replace("_", " ").title())
                    
            rich_context = f"{name} ({kategorie}). Eigenschaften: {', '.join(rich_features)}."

            names_to_embed.append(rich_context)
            gerichte_to_insert.append(DBDish(
                csv_id=csv_id, 
                name=name, 
                kategorie=kategorie, 
                preis=preis, 
                image_url=img_url,
                feedback_context=""
            ))

        if not names_to_embed:
            logger.warning("Keine gültigen Gerichte in CSV gefunden.")
            return

        logger.info(f"🧠 Erzeuge {len(names_to_embed)} Vektoren via Gemini API (Batch-Mode)...")
        
        # Google Gemini Batch Embedding (bis zu 100 Content-Stücke pro Call möglich)
        # Wir teilen es in 50er Batches auf, um Timeouts zu vermeiden
        batch_size = 50
        for i in range(0, len(names_to_embed), batch_size):
            batch_names = names_to_embed[i:i + batch_size]
            result = genai.embed_content(model=EMBEDDING_MODEL, content=batch_names)
            batch_vectors = result["embedding"]
            
            for j, vector in enumerate(batch_vectors):
                gerichte_to_insert[i + j].embedding = vector
            
            logger.info(f"   ... Batch {i//batch_size + 1} verarbeitet.")

        db.bulk_save_objects(gerichte_to_insert)
        db.commit()
        logger.info(f"✅ SUCCESS: {len(gerichte_to_insert)} ECHTE Gerichte erfolgreich in Neon DB vektorisiert.")
        
    except Exception as e:
        logger.error(f"Synchronisierungs-Fehler: {e}")
        db.rollback()
    finally:
        db.close()

def re_embed_dish(dish_id: int):
    """Einzelnes Re-Embedding bei neuem Feedback."""
    db = SessionLocal()
    try:
        dish = db.query(DBDish).filter(DBDish.id == dish_id).first()
        if not dish: return
        content = f"{dish.name} - {dish.kategorie} Feedback: {dish.feedback_context}"
        result = genai.embed_content(model=EMBEDDING_MODEL, content=content)
        dish.embedding = result["embedding"]
        db.commit()
        logger.info(f"Gericht '{dish.name}' wurde aufgrund von Feedback neu vektorisiert.")
    except Exception as e:
        logger.error(f"Re-Embed Fehler: {e}")
    finally:
        db.close()

def find_similar_dishes(query: str, kategorie: str | None = None, top_k: int = 3) -> list[Dish]:
    """Suche via pgvector mit Cosine Similarity."""
    try:
        result = genai.embed_content(model=EMBEDDING_MODEL, content=query)
        query_vector = result["embedding"]
        db = SessionLocal()
        try:
            query_obj = db.query(DBDish, (1 - DBDish.embedding.cosine_distance(query_vector)).label("similarity"))
            if kategorie:
                query_obj = query_obj.filter(DBDish.kategorie == kategorie)
            results = query_obj.order_by(DBDish.embedding.cosine_distance(query_vector)).limit(top_k).all()
            
            mapped = [Dish(
                name=d.name, 
                kategorie=d.kategorie, 
                preis=d.preis, 
                image_url=d.image_url,
                similarity_score=float(s)
            ) for d, s in results]
            if mapped:
                logger.info(f"Vector Search: '{query}' -> Match: '{mapped[0].name}' ({mapped[0].similarity_score:.2f})")
            return mapped
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Search Error: {e}")
        return []

def _get_kategorie(row) -> str | None:
    try:
        if int(row.get("vorspeise", 0)) == 1: return "vorspeise"
        if int(row.get("hauptgericht", 0)) == 1: return "hauptgericht"
        if int(row.get("dessert", 0)) == 1: return "dessert"
    except: pass
    return None
