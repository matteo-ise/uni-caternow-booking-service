"""
Hybrid RAG search: 3072-dim Gemini embeddings with fuzzy string fallback.

Uses pgvector's cosine distance for semantic matching against a 177-dish catalog.
When vector search fails (quota exhaustion, zero vectors), falls back to
SequenceMatcher fuzzy matching so the chat never gets stuck without dishes.

Embedding dimension choice: 3072-dim (gemini-embedding-001) over 768-dim gives
noticeably better semantic separation for short German dish descriptions, at the
cost of ~4x storage. Worth it for a catalog this small.
"""
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
    Flatten all dish attributes into a single descriptive string for embedding.

    We embed one combined string rather than separate fields because Gemini's
    embedding model captures cross-field relationships better this way
    (e.g. "Italian" + "dessert" → tiramisu-like vectors).
    """
    def get_val(key):
        # pandas Series has a .name attribute that collides with our 'name' column
        if isinstance(dish_data, (pd.Series, dict)):
            return dish_data.get(key)
        return getattr(dish_data, key, None)

    name = get_val("productTitle") or get_val("name")
    kat = get_val("dishType") or get_val("kategorie")
    desc = get_val("productDescription") or get_val("description")
    diet = get_val("diet")
    kitchen = get_val("kitchen")
    feedback = get_val("manual_feedback")

    # Normalize to our three categories
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

    # Convert numeric scores to natural language — embedding models understand
    # words, not numbers. "filling: 0.8" has no semantic direction in the vector,
    # but "Sehr sättigend und reichhaltig" clearly does. Low scores (<0.4) are
    # omitted entirely because "nicht scharf" paradoxically creates proximity
    # to "scharf" in the embedding space.
    score_labels = {
        "fancy_score":       {0.7: "Sehr gehobenes, elegantes Gericht",       0.4: "Gehobenes Gericht"},
        "heavy_score":       {0.7: "Sehr deftig und kräftig",                 0.4: "Eher deftig"},
        "filling_score":     {0.7: "Sehr sättigend und reichhaltig",          0.4: "Gut sättigend"},
        "traditional_score": {0.7: "Sehr traditionell und klassisch",         0.4: "Traditionell angehaucht"},
        "spicy_score":       {0.7: "Deutlich scharf gewürzt",                 0.4: "Leicht scharf"},
    }
    char_parts = []
    for s_col, thresholds in score_labels.items():
        val = get_val(s_col)
        if val is not None and pd.notna(val):
            fval = float(val)
            if fval >= 0.7:
                char_parts.append(thresholds[0.7])
            elif fval >= 0.4:
                char_parts.append(thresholds[0.4])
    if char_parts:
        parts.append(f"Charakter: {', '.join(char_parts)}")

    # Feedback is capped to the last 5 entries in orders.py to prevent it from
    # overwhelming the dish's core identity in the embedding vector.
    if pd.notna(feedback) and str(feedback).strip() and str(feedback).lower() != "nan":
        parts.append(f"Kundenfeedback: {str(feedback).strip()}")

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
            except (ValueError, TypeError):
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
                        except (ValueError, TypeError): return default

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

        # Self-healing: fix any dishes that got zero vectors from previous quota failures
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
            logger.info(f"Embedded batch ({batch_idx//10 + 1}): {len(objects_to_add)} dishes.")
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
                # Zero vector fallback: lets the dish exist in DB so fuzzy search
                # still works. fix_zero_vectors will heal these on next startup.
                fake = [0.0] * 3072
                for o in objects_to_add:
                    o.embedding = fake
                db.add_all(objects_to_add)
                db.commit()
                break

async def fix_zero_vectors(db):
    """
    Self-healing: finds dishes with zero-vector embeddings (from quota exhaustion)
    and re-embeds them. Uses small batches of 5 with delays to stay within
    free-tier rate limits.
    """
    zero_dishes = db.query(DBDish).all()
    to_fix = []
    for d in zero_dishes:
        if d.embedding is not None:
            # Check first 10 elements as a quick proxy — all-zero is our sentinel
            if all(v == 0.0 for v in d.embedding[:10]):
                 to_fix.append(d)

    if not to_fix:
        return

    logger.info(f"Found {len(to_fix)} dishes with zero vectors. Fixing...")

    # Small batches + delay: Gemini free tier is strict about burst requests
    for i in range(0, len(to_fix), 5):
        batch = to_fix[i:i+5]
        rich_texts = [build_rich_description(d) for d in batch]

        try:
            res = _get_client().models.embed_content(model=EMBEDDING_MODEL, contents=rich_texts)
            for idx, emb in enumerate(res.embeddings):
                batch[idx].embedding = emb.values
            db.commit()
            logger.info(f"Fixed {len(batch)} zero vectors.")
            await asyncio.sleep(5.0)
        except Exception as e:
            db.rollback()
            logger.warning(f"Stop fixing zero vectors for now: {e}")
            break

def find_similar_dishes(query: str, kategorie: str | None = None, top_k: int = 3) -> list[Dish]:
    """
    Two-phase search: cosine similarity on embeddings, then fuzzy fallback.
    Uses cosine distance (not L2) because we care about directional similarity
    between dish descriptions, not vector magnitude.
    """
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
            # 0.25 threshold: empirically tuned against our 177-dish catalog.
            # Lower catches too many irrelevant matches, higher misses valid ones.
            if sim_score >= 0.25 and np.sum(np.abs(np.array(d.embedding))) > 0:
                results.append(Dish(name=d.name, kategorie=d.kategorie, preis=d.preis, image_url=d.image_url, similarity_score=sim_score))
    except Exception as e:
        db.rollback()
        logger.error(f"Vector search failed, falling back to fuzzy: {e}")

    # Fuzzy fallback: covers quota exhaustion, zero vectors, cold starts
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
            if sc < 0.25:
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
            db.commit()
            logger.info(f"Re-embedded dish '{dish.name}' (id={dish_id})")
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
    except Exception:
        asyncio.run(re_embed_dish_async(dish_id))
