"""
Vector Embedding Pipeline for CaterNow.
Optimized with Incremental Sync to handle API Quota limits gracefully.
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
    Arbeitet inkrementell: Bereits vorhandene Gerichte werden übersprungen.
    """
    db = SessionLocal()
    try:
        if not os.path.exists(DATA_PATH):
            logger.error(f"CSV-Datei nicht gefunden unter: {DATA_PATH}")
            return

        df = pd.read_csv(DATA_PATH, sep=";", encoding="utf-8", encoding_errors="replace")
        
        if force_refresh:
            logger.info("Force Refresh: Lösche bestehende Vektoren...")
            db.query(DBDish).delete()
            db.commit()

        # Hole Liste aller bereits vorhandenen CSV-IDs aus der DB
        existing_ids = {r[0] for r in db.query(DBDish.csv_id).all()}
        
        dishes_to_process = []
        for _, row in df.iterrows():
            csv_id = int(row.get("id", 0))
            if csv_id != 0 and csv_id not in existing_ids:
                dishes_to_process.append(row)

        if not dishes_to_process:
            count = db.query(DBDish).count()
            logger.info(f"Vektor-Cache aktuell: Alle {count} Gerichte sind bereits in der Neon DB.")
            return

        logger.info(f"🔄 Inkrementeller Sync: {len(dishes_to_process)} neue Gerichte gefunden. Starte Vektorisierung...")

        # Wir verarbeiten in kleinen Batches von 10, um Quotas zu schonen und Zwischenstände zu speichern
        batch_size = 10
        bucket = os.environ.get("VITE_FIREBASE_STORAGE_BUCKET")

        for i in range(0, len(dishes_to_process), batch_size):
            batch = dishes_to_process[i:i + batch_size]
            names_to_embed = []
            objects_to_add = []

            for row in batch:
                kategorie = _get_kategorie(row)
                if not kategorie: continue
                
                name = str(row.get("name", "")).strip()
                csv_id = int(row.get("id", 0))
                
                # Rich Context für bessere Suche
                rich_features = []
                for col in ["vegan", "vegetarisch", "warm", "halal", "business", "deutsch", "italienisch"]:
                    if str(row.get(col, "0")).strip() == "1":
                        rich_features.append(col.title())
                
                context = f"{name} ({kategorie}). Merkmale: {', '.join(rich_features)}"
                names_to_embed.append(context)
                
                img_url = f"https://firebasestorage.googleapis.com/v0/b/{bucket}/o/dishes%2F{csv_id}.jpg?alt=media"
                
                preis = None
                try: preis = float(row.get("Preis1"))
                except: pass

                objects_to_add.append(DBDish(
                    csv_id=csv_id, name=name, kategorie=kategorie, 
                    preis=preis, image_url=img_url, feedback_context=""
                ))

            if names_to_embed:
                try:
                    result = genai.embed_content(model=EMBEDDING_MODEL, content=names_to_embed)
                    for idx, vector in enumerate(result["embedding"]):
                        objects_to_add[idx].embedding = vector
                    
                    db.add_all(objects_to_add)
                    db.commit() # Sofort speichern!
                    logger.info(f"   [Sync] Batch {i//batch_size + 1} erfolgreich gespeichert.")
                except Exception as api_err:
                    logger.error(f"   [Sync] API Limit erreicht oder Fehler in Batch {i//batch_size + 1}: {api_err}")
                    break # Stoppe für diesen Run, aber behalte bisherige Erfolge in der DB

        final_count = db.query(DBDish).count()
        logger.info(f"✅ Synchronisierung beendet. Stand: {final_count} Gerichte in DB.")
        
    except Exception as e:
        logger.error(f"Globaler Sync-Fehler: {e}")
    finally:
        db.close()

def re_embed_dish(dish_id: int):
    db = SessionLocal()
    try:
        dish = db.query(DBDish).filter(DBDish.id == dish_id).first()
        if not dish: return
        content = f"{dish.name} - {dish.kategorie} Feedback: {dish.feedback_context}"
        result = genai.embed_content(model=EMBEDDING_MODEL, content=content)
        dish.embedding = result["embedding"]
        db.commit()
        logger.info(f"Feedback-Update für '{dish.name}' gespeichert.")
    except Exception as e:
        logger.error(f"Re-Embed Fehler: {e}")
    finally:
        db.close()

def find_similar_dishes(query: str, kategorie: str | None = None, top_k: int = 3) -> list[Dish]:
    try:
        result = genai.embed_content(model=EMBEDDING_MODEL, content=query)
        query_vector = result["embedding"]
        db = SessionLocal()
        try:
            query_obj = db.query(DBDish, (1 - DBDish.embedding.cosine_distance(query_vector)).label("similarity"))
            if kategorie:
                query_obj = query_obj.filter(DBDish.kategorie == kategorie)
            results = query_obj.order_by(DBDish.embedding.cosine_distance(query_vector)).limit(top_k).all()
            return [Dish(name=d.name, kategorie=d.kategorie, preis=d.preis, image_url=d.image_url, similarity_score=float(s)) for d, s in results]
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
