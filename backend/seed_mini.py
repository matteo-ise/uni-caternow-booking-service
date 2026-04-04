import os
import sys
sys.path.append('backend')
from database import SessionLocal, engine
from db_models import DBDish
import google.generativeai as genai
from dotenv import load_dotenv
from sqlalchemy import text

load_dotenv(".env")
genai.configure(api_key=os.environ["GEMINI_API_KEY"])

def seed():
    db = SessionLocal()
    # ECHTE NAMEN 1:1 AUS DEINER CSV
    real_csv_dishes = [
        (1, "Toskanisches Geflügel mit Oreganokartoffeln", "hauptgericht", 18.50),
        (2, "Auberginenmoussaka", "hauptgericht", 16.00),
        (4, "Gemüsefrikadelle mit Wildreis", "hauptgericht", 17.50),
        (16, "Griechischer Salat", "vorspeise", 9.50),
        (65, "Mini-Caprese-Spieße", "vorspeise", 8.50),
        (144, "Schokoladenmousse im Schokoladenblumentopf", "dessert", 7.00),
        (161, "Tiramisu", "dessert", 6.00)
    ]
    
    names = [d[1] for d in real_csv_dishes]
    res = genai.embed_content(model="models/gemini-embedding-001", content=names)
    vectors = res["embedding"]
    
    for i, data in enumerate(real_csv_dishes):
        dish = DBDish(csv_id=data[0], name=data[1], kategorie=data[2], preis=data[3], embedding=vectors[i], feedback_context="", tenant_id="default")
        db.add(dish)
    
    db.commit()
    db.close()
    print("Mini-Seed successful.")

if __name__ == "__main__":
    seed()
