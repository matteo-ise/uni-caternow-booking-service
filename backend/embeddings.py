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

# Dynamischer Pfad zur CSV, damit es von /root und /backend aus funktioniert
DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "Gerichte_Cater_Now_02_26.csv")
EMBEDDING_MODEL = "models/gemini-embedding-001"

async def load_and_embed_dishes():
    """Liest die CSV, generiert Embeddings (falls die DB leer ist) und speichert sie in PostgreSQL."""
    db = SessionLocal()
    try:
        count = db.query(DBDish).count()
        if count > 0:
            print(f"[Embeddings] {count} Gerichte bereits vorhanden.")
            return

        print("[Embeddings] Starte Batch-Vektorisierung...")
        df = pd.read_csv(DATA_PATH, sep=";", encoding="utf-8", encoding_errors="replace")
        
        gerichte_to_insert = []
        names_to_embed = []
        
        for _, row in df.iterrows():
            kategorie = _get_kategorie(row)
            if kategorie is None: continue
            
            name = str(row.get("name", "")).strip()
            preis = None
            try: preis = float(row.get("Preis1"))
            except: pass

            names_to_embed.append(name)
            gerichte_to_insert.append(DBDish(name=name, kategorie=kategorie, preis=preis))

        # Google Gemini Batch Embedding (Massiv schneller und spart Quota)
        result = genai.embed_content(model=EMBEDDING_MODEL, content=names_to_embed)
        vectors = result["embedding"]

        for i, vector in enumerate(vectors):
            gerichte_to_insert[i].embedding = vector

        db.bulk_save_objects(gerichte_to_insert)
        db.commit()
        print(f"[Embeddings] SUCCESS: {len(gerichte_to_insert)} Vektoren gespeichert.")
    except Exception as e:
        print(f"[Embeddings Error] {e}")
        db.rollback()
    finally:
        db.close()


def find_similar_dishes(query: str, kategorie: str | None = None, top_k: int = 3) -> list[Dish]:
    """
    Sucht über Neon DB pgvector nach semantisch ähnlichen Gerichten.
    Nutzt Cosine Similarity (1 - Cosine Distance).
    """
    try:
        # 1. Query-Vektor erzeugen
        result = genai.embed_content(model=EMBEDDING_MODEL, content=query)
        query_vector = result["embedding"]

        db = SessionLocal()
        try:
            # 2. Vector-Search in Postgres
            # Der Operator <=> gibt die Cosine Distance zurück.
            # Similarity = 1 - Distance
            query_obj = db.query(DBDish, (1 - DBDish.embedding.cosine_distance(query_vector)).label("similarity"))
            
            if kategorie:
                query_obj = query_obj.filter(DBDish.kategorie == kategorie)
                
            results = query_obj.order_by(DBDish.embedding.cosine_distance(query_vector)).limit(top_k).all()

            # 3. Mappen auf Pydantic Modell inkl. mathematischem Score
            mapped_dishes = []
            for row in results:
                db_dish, score = row
                mapped_dishes.append(Dish(
                    name=db_dish.name,
                    kategorie=db_dish.kategorie,
                    preis=db_dish.preis,
                    similarity_score=float(score)
                ))
            
            # Log für Demonstrationszwecke
            if mapped_dishes:
                top = mapped_dishes[0]
                print(f"[Vector Search] Query: '{query}' -> Top Match: '{top.name}' (Score: {top.similarity_score:.4f})")
            
            return mapped_dishes
        finally:
            db.close()
    except Exception as e:
        print(f"[Vector Search Error] {e}")
        return []


def _get_kategorie(row) -> str | None:
    try:
        if int(row.get("vorspeise", 0)) == 1: return "vorspeise"
        if int(row.get("hauptgericht", 0)) == 1: return "hauptgericht"
        if int(row.get("dessert", 0)) == 1: return "dessert"
    except: pass
    return None
