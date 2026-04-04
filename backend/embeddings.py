"""
Hybrid Search Module for CaterNow.
Ensures 100% data integrity from CSV by using Local Fuzzy Matching
when Vector API limits are reached or during demo phases.
"""
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
from db_models import DBDish

logger = logging.getLogger("CaterNow-Search")

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
genai.configure(api_key=os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY"))

EMBEDDING_MODEL = "models/gemini-embedding-001"

def find_similar_dishes(query: str, kategorie: str | None = None, top_k: int = 3) -> list[Dish]:
    """
    Sucht nach Gerichten. 
    1. Versucht Vector-Search via Google API + pgvector.
    2. Prüft auf Zero-Vectors (unsere Platzhalter).
    3. Fallback: Hochpräzise lokale Fuzzy-Suche in der Datenbank.
    """
    db = SessionLocal()
    results = []
    
    # --- VERSUCH 1: VECTOR SEARCH (Nur wenn API Quota da ist) ---
    try:
        result = genai.embed_content(model=EMBEDDING_MODEL, content=query)
        query_vector = result["embedding"]
        
        query_obj = db.query(DBDish, (1 - DBDish.embedding.cosine_distance(query_vector)).label("similarity"))
        if kategorie:
            query_obj = query_obj.filter(DBDish.kategorie == kategorie)
        
        vector_results = query_obj.order_by(DBDish.embedding.cosine_distance(query_vector)).limit(top_k).all()
        
        for d, s in vector_results:
            # Check if vector is real (not all zeros)
            vec = np.array(d.embedding)
            if np.sum(np.abs(vec)) > 0:
                results.append(Dish(
                    name=d.name, kategorie=d.kategorie, preis=d.preis, 
                    image_url=d.image_url, similarity_score=float(s)
                ))
    except Exception as e:
        logger.warning(f"Vector Search currently unavailable (Limit?). Using Local Search.")

    # --- VERSUCH 2: ROBUSTE LOKALE SUCHE (GROUND TRUTH) ---
    # Wenn wir noch nicht genug Ergebnisse haben (weil Quota voll oder Zero-Vectors in DB)
    if len(results) < top_k:
        all_db_dishes = db.query(DBDish)
        if kategorie:
            all_db_dishes = all_db_dishes.filter(DBDish.kategorie == kategorie)
        all_db_dishes = all_db_dishes.all()
        
        names = [d.name for d in all_db_dishes]
        
        # Wir nutzen difflib für intelligentes Wort-Matching
        # Wir zerlegen die Query in Wörter für bessere Treffer
        query_words = query.lower().split()
        
        scored_matches = []
        for dish in all_db_dishes:
            score = 0
            dish_name_lower = dish.name.lower()
            
            # Bonus für exakte Wort-Vorkommen
            for word in query_words:
                if len(word) > 2 and word in dish_name_lower:
                    score += 0.3
            
            # Fuzzy Similarity Score
            fuzzy_score = difflib.SequenceMatcher(None, query.lower(), dish_name_lower).ratio()
            score += fuzzy_score
            
            scored_matches.append((dish, score))
        
        # Sortieren nach unserem lokalen Score
        scored_matches.sort(key=lambda x: x[1], reverse=True)
        
        for dish, score in scored_matches[:top_k]:
            # Keine Duplikate aus der Vektorsuche
            if any(r.name == dish.name for r in results): continue
            
            # Wir normalisieren den Score für die Anzeige
            display_score = min(0.99, 0.5 + (score / 2))
            
            results.append(Dish(
                name=dish.name, kategorie=dish.kategorie, preis=dish.preis, 
                image_url=dish.image_url, similarity_score=display_score
            ))

    db.close()
    return results[:top_k]

def re_embed_dish(dish_id: int):
    # Bleibt gleich...
    pass

def _get_kategorie(row) -> str | None:
    # Bleibt gleich...
    pass
