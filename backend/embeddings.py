import os
import pandas as pd
import numpy as np
import google.generativeai as genai
from dotenv import load_dotenv
from sqlalchemy import text

from models import Dish
from database import SessionLocal
from db_models import DBDish

# Lade .env aus dem Hauptverzeichnis
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
genai.configure(api_key=os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY"))

DATA_PATH = "../data/Gerichte_Cater_Now_02_26.csv"
EMBEDDING_MODEL = "models/gemini-embedding-001"

# ── CSV-Spalten ────────────────────────────────────────────────────────
COL_NAME      = "name"
COL_PREIS     = "Preis1"
COL_VORSPEISE = "vorspeise"
COL_HAUPT     = "hauptgericht"
COL_DESSERT   = "dessert"
# ───────────────────────────────────────────────────────────────────────

async def load_and_embed_dishes():
    """Liest die CSV, generiert Embeddings (falls die DB leer ist) und speichert sie in PostgreSQL."""
    db = SessionLocal()
    try:
        # Prüfen, ob die Tabelle bereits Daten enthält
        count = db.query(DBDish).count()
        if count > 0:
            print(f"[Embeddings] Datenbank enthält bereits {count} Gerichte. Skippe API-Calls.")
            return

        print("[Embeddings] Datenbank ist leer. Starte Vektorisierung der CSV...")
        df = pd.read_csv(DATA_PATH, sep=";", encoding="utf-8", encoding_errors="replace")
        
        gerichte_to_insert = []
        names_to_embed = []
        
        for _, row in df.iterrows():
            kategorie = _get_kategorie(row)
            if kategorie is None:
                continue

            preis = None
            if COL_PREIS in row and pd.notna(row[COL_PREIS]):
                try:
                    preis = float(row[COL_PREIS])
                except (ValueError, TypeError):
                    pass

            name = str(row.get(COL_NAME, "")).strip()
            names_to_embed.append(name)
            
            gerichte_to_insert.append(
                DBDish(
                    name=name,
                    kategorie=kategorie,
                    preis=preis
                )
            )

        # Batch embedding is much faster and saves rate limit
        # The free tier API handles lists of content
        result = genai.embed_content(model=EMBEDDING_MODEL, content=names_to_embed)
        vectors = result["embedding"] # list of lists

        for i, vector in enumerate(vectors):
            gerichte_to_insert[i].embedding = vector

        db.bulk_save_objects(gerichte_to_insert)
        db.commit()
        print(f"[Embeddings] {len(gerichte_to_insert)} Gerichte erfolgreich in die Neon DB geschrieben!")
    except Exception as e:
        print(f"[Embeddings Error] {e}")
        db.rollback()
    finally:
        db.close()


def find_similar_dishes(query: str, kategorie: str | None = None, top_k: int = 3) -> list[Dish]:
    """Sucht über Neon DB pgvector nach semantisch ähnlichen Gerichten (Cosine Similarity)."""
    try:
        # 1. Query an Gemini schicken für den Such-Vektor
        result = genai.embed_content(model=EMBEDDING_MODEL, content=query)
        query_vector = result["embedding"]

        db = SessionLocal()
        try:
            # 2. Vector-Search in Postgres (<=> Operator für Cosine Distance in pgvector)
            # Wenn kategorie angegeben ist, filtern wir erst danach.
            sql = db.query(DBDish)
            if kategorie:
                sql = sql.filter(DBDish.kategorie == kategorie)
                
            # ORDER BY embedding <=> query_vector 
            similar_dishes = sql.order_by(DBDish.embedding.cosine_distance(query_vector)).limit(top_k).all()

            # 3. Mappe das DB-Modell auf das Pydantic Response-Modell zurück
            return [
                Dish(name=d.name, kategorie=d.kategorie, preis=d.preis)
                for d in similar_dishes
            ]
        finally:
            db.close()
    except Exception as e:
        print(f"[Vector Search Error] {e}")
        return []


def _get_kategorie(row) -> str | None:
    try:
        if int(row.get(COL_VORSPEISE, 0)) == 1: return "vorspeise"
        if int(row.get(COL_HAUPT, 0)) == 1:     return "hauptgericht"
        if int(row.get(COL_DESSERT, 0)) == 1:   return "dessert"
    except (ValueError, TypeError):
        pass
    return None
