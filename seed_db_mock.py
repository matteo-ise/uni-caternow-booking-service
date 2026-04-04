import os
import sys
sys.path.append('backend')
from database import SessionLocal
from db_models import DBDish
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv(".env")
genai.configure(api_key=os.environ["GEMINI_API_KEY"])

def seed():
    db = SessionLocal()
    # Nur 2 Gerichte pro Kategorie, um Quota zu sparen
    mock_data = [
        ("Bruschetta Classica", "vorspeise", 8.50),
        ("Kürbiscremesuppe", "vorspeise", 7.00),
        ("Rinderbraten mit Spätzle", "hauptgericht", 24.50),
        ("Vegetarische Lasagne", "hauptgericht", 18.00),
        ("Tiramisu Hausgemacht", "dessert", 6.50),
        ("Mousse au Chocolat", "dessert", 7.50),
    ]
    
    names = [d[0] for d in mock_data]
    print(f"Erzeuge Vektoren für {len(names)} Test-Gerichte...")
    res = genai.embed_content(model="models/gemini-embedding-001", content=names)
    vectors = res["embedding"]
    
    for i, data in enumerate(mock_data):
        dish = DBDish(name=data[0], kategorie=data[1], preis=data[2], embedding=vectors[i])
        db.add(dish)
    
    db.commit()
    db.close()
    print("Test-Daten erfolgreich in DB geladen.")

if __name__ == "__main__":
    seed()
