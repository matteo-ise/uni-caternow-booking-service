import os
import pandas as pd
import numpy as np
import google.generativeai as genai
from dotenv import load_dotenv

from models import Dish

load_dotenv()
genai.configure(api_key=os.environ["GOOGLE_API_KEY"])

# In-memory store: Liste von Dicts mit Dish + Embedding-Vektor
_dish_store: list[dict] = []

DATA_PATH = "../data/Gerichte_Cater_Now_02_26.csv"
EMBEDDING_MODEL = "models/text-embedding-004"

# ── CSV-Spalten (aus Gerichte_Cater_Now_02_26.csv) ────────────────────────
# TODO: Spaltennamen anpassen sobald finale CSV vom Kollegen vorliegt
COL_NAME      = "name"       # Gerichtsname
COL_PREIS     = "Preis1"     # Preis in €
COL_VORSPEISE = "vorspeise"  # Flag 0/1
COL_HAUPT     = "hauptgericht" # Flag 0/1
COL_DESSERT   = "dessert"    # Flag 0/1
# ─────────────────────────────────────────────────────────────────────────


async def load_and_embed_dishes():
    """Lädt Gerichte aus der CSV und erstellt Embeddings beim App-Start."""
    global _dish_store
    _dish_store = []

    df = pd.read_csv(DATA_PATH, sep=";", encoding="utf-8", encoding_errors="replace")

    for _, row in df.iterrows():
        kategorie = _get_kategorie(row)
        if kategorie is None:
            continue  # Zeilen ohne eindeutige Kategorie überspringen

        preis = None
        if COL_PREIS in row and pd.notna(row[COL_PREIS]):
            try:
                preis = float(row[COL_PREIS])
            except (ValueError, TypeError):
                pass

        dish = Dish(
            name=str(row.get(COL_NAME, "")).strip(),
            kategorie=kategorie,
            preis=preis,
        )

        result = genai.embed_content(model=EMBEDDING_MODEL, content=dish.name)
        vector = np.array(result["embedding"])
        _dish_store.append({"dish": dish, "vector": vector})

    print(f"[Embeddings] {len(_dish_store)} Gerichte geladen und eingebettet.")


def find_similar_dishes(query: str, kategorie: str | None = None, top_k: int = 3) -> list[Dish]:
    """Gibt die top_k semantisch ähnlichsten Gerichte für eine Suchanfrage zurück."""
    result = genai.embed_content(model=EMBEDDING_MODEL, content=query)
    query_vector = np.array(result["embedding"])

    candidates = _dish_store
    if kategorie:
        candidates = [d for d in _dish_store if d["dish"].kategorie == kategorie]

    if not candidates:
        return []

    scores = [
        (entry, float(np.dot(query_vector, entry["vector"]) /
                       (np.linalg.norm(query_vector) * np.linalg.norm(entry["vector"]) + 1e-9)))
        for entry in candidates
    ]
    scores.sort(key=lambda x: x[1], reverse=True)
    return [entry["dish"] for entry, _ in scores[:top_k]]


def _get_kategorie(row) -> str | None:
    """Bestimmt die Kategorie eines Gerichts anhand der binären Flag-Spalten."""
    try:
        if int(row.get(COL_VORSPEISE, 0)) == 1:
            return "vorspeise"
        if int(row.get(COL_HAUPT, 0)) == 1:
            return "hauptgericht"
        if int(row.get(COL_DESSERT, 0)) == 1:
            return "dessert"
    except (ValueError, TypeError):
        pass
    return None
