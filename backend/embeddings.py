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

DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "Gerichte_Cater_Now_02_26.csv")
EMBEDDING_MODEL = "models/gemini-embedding-001"

async def load_and_embed_dishes(force_refresh=False):
    db = SessionLocal()
    try:
        if not os.path.exists(DATA_PATH):
            return
        try:
            df = pd.read_csv(DATA_PATH, sep=";", encoding="latin-1")
        except:
            df = pd.read_csv(DATA_PATH, sep=";", encoding="utf-8", errors="replace")
        
        if force_refresh:
            db.query(DBDish).delete()
            db.commit()

        existing_ids = {r[0] for r in db.query(DBDish.csv_id).all()}
        dishes_to_process = []
        for _, row in df.iterrows():
            try:
                cid = int(row.get("id", 0))
                if cid != 0 and cid not in existing_ids:
                    dishes_to_process.append(row)
            except:
                continue

        if not dishes_to_process:
            return

        for i in range(0, len(dishes_to_process), 10):
            batch = dishes_to_process[i:i + 10]
            names_to_embed = []
            objects_to_add = []
            for row in batch:
                kat = None
                if float(row.get("vorspeise", 0)) == 1.0:
                    kat = "vorspeise"
                elif float(row.get("hauptgericht", 0)) == 1.0:
                    kat = "hauptgericht"
                elif float(row.get("dessert", 0)) == 1.0:
                    kat = "dessert"
                
                if not kat:
                    continue
                
                name = str(row.get("name", "")).strip()
                if not name or name == "nan":
                    continue
                cid = int(row.get("id", 0))
                names_to_embed.append(f"{name} ({kat})")
                
                preis = 15.0
                try:
                    p = row.get("Preis")
                    if pd.notna(p):
                        preis = float(str(p).replace(",", "."))
                except:
                    pass

                objects_to_add.append(DBDish(
                    csv_id=cid, name=name, kategorie=kat, preis=preis, 
                    image_url=f"/images/dishes/{cid}.jpg", feedback_context="", tenant_id="default"
                ))

            if names_to_embed:
                try:
                    res = genai.embed_content(model=EMBEDDING_MODEL, content=names_to_embed)
                    for idx, vec in enumerate(res["embedding"]):
                        objects_to_add[idx].embedding = vec
                    db.add_all(objects_to_add)
                    db.commit()
                except:
                    fake = [0.0] * 3072
                    for o in objects_to_add:
                        o.embedding = fake
                    db.add_all(objects_to_add)
                    db.commit()
    except Exception as e:
        logger.error(f"Sync Error: {e}")
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
