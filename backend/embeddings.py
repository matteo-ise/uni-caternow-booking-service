import asyncio
import os
import pandas as pd
import numpy as np
import google.generativeai as genai
import logging
import difflib
from dotenv import load_dotenv
from sqlalchemy import text

from models import Dish
from database import SessionLocal
from db_models import DBDish, DBSyncState
from sync_logic import get_file_hash

logger = logging.getLogger("CaterNow-Search")

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
genai.configure(api_key=os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY"))

DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "CaterNow_Data_master.xlsx")
EMBEDDING_MODEL = "models/gemini-embedding-001"

async def load_and_embed_dishes(force_refresh=False):
    db = SessionLocal()
    try:
        if not os.path.exists(DATA_PATH):
            logger.error(f"Data file not found at {DATA_PATH}")
            return
            
        # Read from Excel instead of CSV
        df = pd.read_excel(DATA_PATH)
        
        if force_refresh:
            db.query(DBDish).delete()
            db.commit()

        existing_ids = {r[0] for r in db.query(DBDish.csv_id).all()}
        dishes_to_process = []
        for _, row in df.iterrows():
            try:
                cid = int(row.get("ID", 0))
                if cid != 0 and (force_refresh or cid not in existing_ids):
                    dishes_to_process.append(row)
            except:
                continue

        if not dishes_to_process:
            logger.info("No new dishes to process.")
            return

        # Batch Processing (10 dishes per request)
        for i in range(0, len(dishes_to_process), 10):
            batch = dishes_to_process[i:i + 10]
            rich_texts_to_embed = []
            objects_to_add = []
            
            for row in batch:
                name = str(row.get("productTitle", "")).strip()
                if not name or name == "nan": continue
                
                cid = int(row.get("ID", 0))
                kat = str(row.get("dishType", "Hauptgericht")).lower()
                # Normalize category to match existing logic (vorspeise, hauptgericht, dessert)
                if "vorspeise" in kat: kat = "vorspeise"
                elif "dessert" in kat or "nachtisch" in kat: kat = "dessert"
                else: kat = "hauptgericht"

                # --- NEW RICH CONTEXT GENERATION ---
                desc = str(row.get("productDescription", ""))
                diet = str(row.get("diet", ""))
                kitchen = str(row.get("kitchen", ""))
                allergenes = str(row.get("allergenes", ""))
                
                # Build descriptive context string for Gemini
                parts = [f"Gericht: {name}", f"Kategorie: {kat}"]
                if desc and desc != "nan": parts.append(f"Beschreibung: {desc}")
                if diet and diet != "nan": parts.append(f"Diät: {diet}")
                if kitchen and kitchen != "nan": parts.append(f"Küche: {kitchen}")
                
                # Add scores
                scores = []
                for s_col in ["fancy_score", "heavy_score", "filling_score", "traditional_score", "spicy_score"]:
                    val = row.get(s_col)
                    if pd.notna(val):
                        scores.append(f"{s_col.replace('_score', '')}: {val}")
                if scores:
                    parts.append(f"Scores: {', '.join(scores)}")
                
                rich_description = ". ".join(parts) + "."
                rich_texts_to_embed.append(rich_description)
                # -------------------------------
                
                preis = 15.0
                try:
                    p = row.get("priceNet")
                    if pd.notna(p): preis = float(p)
                except: pass

                # Map Suitability
                is_ff = False
                eff = row.get("eignung_fingerfood")
                if pd.notna(eff) and (str(eff).lower() == "1" or str(eff).lower() == "ja"):
                    is_ff = True
                
                is_bf = True
                ebf = row.get("eignung_buffet")
                if pd.notna(ebf) and (str(ebf).lower() == "0" or str(ebf).lower() == "nein"):
                    is_bf = False

                objects_to_add.append(DBDish(
                    csv_id=cid, 
                    name=name, 
                    description=desc if pd.notna(desc) else None,
                    kategorie=kat, 
                    dish_type=str(row.get("dishType", "")),
                    diet=diet if pd.notna(diet) else None,
                    preis=preis, 
                    allergenes=allergenes if pd.notna(allergenes) else None,
                    additives=str(row.get("additives", "")) if pd.notna(row.get("additives")) else None,
                    kitchen=kitchen if pd.notna(kitchen) else None,
                    fancy_score=float(row.get("fancy_score", 0.5)) if pd.notna(row.get("fancy_score")) else 0.5,
                    heavy_score=float(row.get("heavy_score", 0.5)) if pd.notna(row.get("heavy_score")) else 0.5,
                    filling_score=float(row.get("filling_score", 0.5)) if pd.notna(row.get("filling_score")) else 0.5,
                    traditional_score=float(row.get("traditional_score", 0.5)) if pd.notna(row.get("traditional_score")) else 0.5,
                    spicy_score=float(row.get("spicy_score", 0.0)) if pd.notna(row.get("spicy_score")) else 0.0,
                    is_fingerfood=is_ff,
                    is_buffet=is_bf,
                    popularity=float(row.get("beliebheit", 0.5)) if pd.notna(row.get("beliebheit")) else 0.5,
                    image_url=f"/images/dishes/{cid}.jpg", 
                    feedback_context=rich_description, 
                    tenant_id="default"
                ))

            if rich_texts_to_embed:
                for attempt in range(3): # Retry up to 3 times
                    try:
                        res = genai.embed_content(model=EMBEDDING_MODEL, content=rich_texts_to_embed)
                        for idx, vec in enumerate(res["embedding"]):
                            objects_to_add[idx].embedding = vec
                        db.add_all(objects_to_add)
                        db.commit()
                        logger.info(f"Vektorisierte Batch ({i//10 + 1}): {len(objects_to_add)} Gerichte.")
                        # Small delay to respect free tier RPM (100 RPM)
                        await asyncio.sleep(1.2) 
                        break
                    except Exception as e:
                        if "429" in str(e) and attempt < 2:
                            wait_time = 30 * (attempt + 1)
                            logger.warning(f"Quota exceeded. Waiting {wait_time}s... (Attempt {attempt+1})")
                            await asyncio.sleep(wait_time)
                        else:
                            logger.error(f"Embedding API Error: {e}")
                            fake = [0.0] * 3072
                            for o in objects_to_add:
                                o.embedding = fake
                            db.add_all(objects_to_add)
                            db.commit()
                            break
    except Exception as e:
        logger.error(f"Sync Error: {e}")
        db.rollback()
    finally:
        db.close()

def find_similar_dishes(query: str, kategorie: str | None = None, top_k: int = 3) -> list[Dish]:
    db = SessionLocal()
    results = []
    try:
        res = genai.embed_content(model=EMBEDDING_MODEL, content=query)
        qvec = res["embedding"]
        qobj = db.query(DBDish, (1 - DBDish.embedding.cosine_distance(qvec)).label("sim"))
        if kategorie:
            qobj = qobj.filter(DBDish.kategorie == kategorie)
        vres = qobj.order_by(DBDish.embedding.cosine_distance(qvec)).limit(top_k).all()
        for d, s in vres:
            if np.sum(np.abs(np.array(d.embedding))) > 0:
                results.append(Dish(name=d.name, kategorie=d.kategorie, preis=d.preis, image_url=d.image_url, similarity_score=float(s)))
    except:
        pass

    if len(results) < top_k:
        all_d = db.query(DBDish)
        if kategorie:
            all_d = all_d.filter(DBDish.kategorie == kategorie)
        all_d = all_d.all()
        scored = []
        for d in all_d:
            sc = difflib.SequenceMatcher(None, query.lower(), d.name.lower()).ratio()
            scored.append((d, sc))
        scored.sort(key=lambda x: x[1], reverse=True)
        for d, sc in scored:
            if any(r.name == d.name for r in results):
                continue
            results.append(Dish(name=d.name, kategorie=d.kategorie, preis=d.preis, image_url=d.image_url, similarity_score=min(0.99, 0.4 + (sc/2))))
            if len(results) >= top_k:
                break
    db.close()
    return results[:top_k]

def re_embed_dish(dish_id: int):
    db = SessionLocal()
    try:
        dish = db.query(DBDish).filter(DBDish.id == dish_id).first()
        if dish:
            res = genai.embed_content(model=EMBEDDING_MODEL, content=f"{dish.name}")
            dish.embedding = res["embedding"]
            db.commit()
    except:
        pass
    finally:
        db.close()
