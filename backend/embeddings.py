import asyncio
import os
import pandas as pd
import numpy as np
import logging
import difflib
from google import genai
from google.genai import types
from dotenv import load_dotenv
from sqlalchemy import text

from models import Dish
from database import SessionLocal
from db_models import DBDish, DBSyncState
from sync_logic import get_file_hash
from image_resolver import _local_image_exists

logger = logging.getLogger("CaterNow-Search")

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

_client: genai.Client | None = None

def _get_client() -> genai.Client:
    global _client
    if _client is None:
        _client = genai.Client(
            api_key=os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
        )
    return _client

DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "CaterNow_Data_master.xlsx")
EMBEDDING_MODEL = "models/gemini-embedding-001"

def build_rich_description(dish_data):
    """
    Builds a descriptive string for Gemini embedding.
    dish_data can be a pandas row or a DBDish object.
    """
    def get_val(key):
        # Prefer dictionary-style access for pandas Series/Rows to avoid .name index collision
        if isinstance(dish_data, (pd.Series, dict)):
            return dish_data.get(key)
        # Use getattr for SQLAlchemy objects
        return getattr(dish_data, key, None)

    name = get_val("productTitle") or get_val("name")
    kat = get_val("dishType") or get_val("kategorie")
    desc = get_val("productDescription") or get_val("description")
    diet = get_val("diet")
    kitchen = get_val("kitchen")
    feedback = get_val("manual_feedback")
    
    # Normalize category
    kat_norm = str(kat).lower() if kat else "hauptgericht"
    if "vorspeise" in kat_norm: kat_norm = "vorspeise"
    elif "dessert" in kat_norm or "nachtisch" in kat_norm: kat_norm = "dessert"
    else: kat_norm = "hauptgericht"

    parts = [f"Gericht: {name}", f"Kategorie: {kat_norm}"]
    
    if pd.notna(desc) and str(desc).strip() and str(desc).lower() != "nan":
        parts.append(f"Beschreibung: {str(desc).strip()}")
    
    if pd.notna(diet) and str(diet).strip() and str(diet).lower() != "nan":
        parts.append(f"Diät: {str(diet).strip()}")
        
    if pd.notna(kitchen) and str(kitchen).strip() and str(kitchen).lower() != "nan":
        parts.append(f"Küche: {str(kitchen).strip()}")

    # Scores
    scores = []
    for s_col in ["fancy_score", "heavy_score", "filling_score", "traditional_score", "spicy_score"]:
        val = get_val(s_col)
        if pd.notna(val):
            scores.append(f"{s_col.replace('_score', '')}: {val}")
    if scores:
        parts.append(f"Scores: {', '.join(scores)}")

    if pd.notna(feedback) and str(feedback).strip() and str(feedback).lower() != "nan":
        parts.append(f"Kundenfeedback/Notizen: {str(feedback).strip()}")

    return ". ".join(parts) + "."

async def load_and_embed_dishes(force_refresh=False):
    db = SessionLocal()
    try:
        if not os.path.exists(DATA_PATH):
            logger.error(f"Data file not found at {DATA_PATH}")
            return
            
        df = pd.read_excel(DATA_PATH)
        
        if force_refresh:
            db.query(DBDish).delete()
            db.commit()

        existing_ids = {r[0] for r in db.query(DBDish.csv_id).all()}
        processed_cid_in_run = set()
        
        dishes_to_process = []
        for _, row in df.iterrows():
            try:
                cid = int(row.get("ID", 0))
                if cid != 0 and cid not in processed_cid_in_run:
                    if force_refresh or cid not in existing_ids:
                        dishes_to_process.append(row)
                        processed_cid_in_run.add(cid)
            except:
                continue

        if dishes_to_process:
            for i in range(0, len(dishes_to_process), 10):
                batch = dishes_to_process[i:i + 10]
                rich_texts_to_embed = []
                objects_to_add = []
                
                for row in batch:
                    name = str(row.get("productTitle", "")).strip()
                    if not name or name.lower() == "nan": continue
                    
                    cid = int(row.get("ID", 0))
                    rich_description = build_rich_description(row)
                    rich_texts_to_embed.append(rich_description)
                    
                    kat = "hauptgericht"
                    raw_kat = str(row.get("dishType", "")).lower()
                    if "vorspeise" in raw_kat: kat = "vorspeise"
                    elif "dessert" in raw_kat or "nachtisch" in raw_kat: kat = "dessert"

                    def to_float(val, default=0.5):
                        try:
                            return float(val) if pd.notna(val) else default
                        except: return default

                    def to_bool(val, default=False):
                        if pd.isna(val): return default
                        s = str(val).lower().strip()
                        return s in ["1", "1.0", "true", "ja", "yes"]

                    objects_to_add.append(DBDish(
                        csv_id=cid, 
                        name=name, 
                        description=str(row.get("productDescription")).strip() if pd.notna(row.get("productDescription")) else None,
                        kategorie=kat, 
                        dish_type=str(row.get("dishType")).strip() if pd.notna(row.get("dishType")) else None,
                        diet=str(row.get("diet")).strip() if pd.notna(row.get("diet")) else None,
                        preis=to_float(row.get("priceNet"), 15.0), 
                        allergenes=str(row.get("allergenes")).strip() if pd.notna(row.get("allergenes")) else None,
                        additives=str(row.get("additives")).strip() if pd.notna(row.get("additives")) else None,
                        kitchen=str(row.get("kitchen")).strip() if pd.notna(row.get("kitchen")) else None,
                        fancy_score=to_float(row.get("fancy_score")),
                        heavy_score=to_float(row.get("heavy_score")),
                        filling_score=to_float(row.get("filling_score")),
                        traditional_score=to_float(row.get("traditional_score")),
                        spicy_score=to_float(row.get("spicy_score"), 0.0),
                        is_fingerfood=to_bool(row.get("eignung_fingerfood"), False),
                        is_buffet=to_bool(row.get("eignung_buffet"), True),
                        popularity=to_float(row.get("beliebheit")),
                        image_url=_local_image_exists(cid),  # None if no local file → resolver picks up
                        feedback_context=rich_description, 
                        tenant_id="default"
                    ))

                if rich_texts_to_embed and objects_to_add:
                    await process_embedding_batch(db, objects_to_add, rich_texts_to_embed, i)

        # PART 2: Fix existing zero vectors
        await fix_zero_vectors(db)

    except Exception as e:
        logger.error(f"Sync Global Error: {e}")
        db.rollback()
    finally:
        db.close()

async def process_embedding_batch(db, objects_to_add, rich_texts_to_embed, batch_idx):
    for attempt in range(3):
        try:
            res = _get_client().models.embed_content(model=EMBEDDING_MODEL, contents=rich_texts_to_embed)
            for idx, emb in enumerate(res.embeddings):
                objects_to_add[idx].embedding = emb.values
            db.add_all(objects_to_add)
            db.commit()
            logger.info(f"Vektorisierte Batch ({batch_idx//10 + 1}): {len(objects_to_add)} Gerichte.")
            await asyncio.sleep(2.0)
            break
        except Exception as e:
            db.rollback()
            if "429" in str(e) and attempt < 2:
                wait_time = 60 * (attempt + 1)
                logger.warning(f"Quota exceeded. Waiting {wait_time}s... (Attempt {attempt+1})")
                await asyncio.sleep(wait_time)
            else:
                logger.error(f"Batch Error: {e}")
                fake = [0.0] * 3072
                for o in objects_to_add:
                    o.embedding = fake
                db.add_all(objects_to_add)
                db.commit()
                break

async def fix_zero_vectors(db):
    """Finds dishes with zero vectors and tries to re-embed them."""
    # We check if first element is 0 as a proxy for zero vector (very likely for our fake vector)
    zero_dishes = db.query(DBDish).all()
    to_fix = []
    for d in zero_dishes:
        if d.embedding is not None:
            # Check if it's an all-zero vector
            if all(v == 0.0 for v in d.embedding[:10]): # Check first 10 for speed
                 to_fix.append(d)
    
    if not to_fix:
        return

    logger.info(f"Found {len(to_fix)} dishes with zero vectors. Fixing...")
    
    for i in range(0, len(to_fix), 5): # Small batches of 5
        batch = to_fix[i:i+5]
        rich_texts = [build_rich_description(d) for d in batch]
        
        try:
            res = _get_client().models.embed_content(model=EMBEDDING_MODEL, contents=rich_texts)
            for idx, emb in enumerate(res.embeddings):
                batch[idx].embedding = emb.values
            db.commit()
            logger.info(f"Fixed {len(batch)} zero vectors.")
            await asyncio.sleep(5.0) # Slow and steady
        except Exception as e:
            db.rollback()
            logger.warning(f"Stop fixing zero vectors for now: {e}")
            break

def find_similar_dishes(query: str, kategorie: str | None = None, top_k: int = 3) -> list[Dish]:
    db = SessionLocal()
    results = []
    try:
        res = _get_client().models.embed_content(model=EMBEDDING_MODEL, contents=query)
        qvec = res.embeddings[0].values
        qobj = db.query(DBDish, (1 - DBDish.embedding.cosine_distance(qvec)).label("sim"))
        if kategorie:
            qobj = qobj.filter(DBDish.kategorie == kategorie)
        vres = qobj.order_by(DBDish.embedding.cosine_distance(qvec)).limit(top_k).all()
        for d, s in vres:
            sim_score = float(s)
            if sim_score >= 0.25 and np.sum(np.abs(np.array(d.embedding))) > 0:
                results.append(Dish(name=d.name, kategorie=d.kategorie, preis=d.preis, image_url=d.image_url, similarity_score=sim_score))
    except Exception as e:
        db.rollback()
        logger.error(f"Vector search failed, falling back to fuzzy: {e}")

    # Fallback to fuzzy search only if vector search returned nothing good
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
            if sc < 0.25: # Strict threshold for fuzzy matching too
                continue
            if any(r.name == d.name for r in results):
                continue
            results.append(Dish(name=d.name, kategorie=d.kategorie, preis=d.preis, image_url=d.image_url, similarity_score=min(0.99, 0.4 + (sc/2))))
            if len(results) >= top_k:
                break
    db.close()
    return results[:top_k]

async def re_embed_dish_async(dish_id: int):
    db = SessionLocal()
    try:
        dish = db.query(DBDish).filter(DBDish.id == dish_id).first()
        if dish:
            rich_desc = build_rich_description(dish)
            res = _get_client().models.embed_content(model=EMBEDDING_MODEL, contents=rich_desc)
            dish.embedding = res.embeddings[0].values
            dish.feedback_context = rich_desc
            db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Re-embedding error: {e}")
    finally:
        db.close()

def re_embed_dish(dish_id: int):
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            asyncio.create_task(re_embed_dish_async(dish_id))
        else:
            asyncio.run(re_embed_dish_async(dish_id))
    except:
        asyncio.run(re_embed_dish_async(dish_id))
