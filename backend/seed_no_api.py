import os
import sys
sys.path.append('backend')
from database import SessionLocal, engine
from db_models import DBDish
from sqlalchemy import text

def seed():
    db = SessionLocal()
    # ECHTE NAMEN 1:1 AUS DEINER CSV
    # Wir nutzen hier eine Liste von Nullen als Vektor (Länge 3072)
    fake_vector = [0.0] * 3072
    
    real_csv_dishes = [
        (1, "Toskanisches Geflügel mit Oreganokartoffeln", "hauptgericht", 18.50),
        (2, "Auberginenmoussaka", "hauptgericht", 16.00),
        (4, "Gemüsefrikadelle mit Wildreis", "hauptgericht", 17.50),
        (16, "Griechischer Salat", "vorspeise", 9.50),
        (65, "Mini-Caprese-Spieße", "vorspeise", 8.50),
        (144, "Schokoladenmousse im Schokoladenblumentopf", "dessert", 7.00),
        (161, "Tiramisu", "dessert", 6.00),
        (22, "Hähnchenschnitzel mit Spätzle", "hauptgericht", 17.50),
        (12, "Serviettenknödel mit Pilzrahm", "hauptgericht", 15.50),
        (48, "Kürbiscremesuppe mit gerösteten Kürbiskernen", "vorspeise", 7.50),
        (156, "Schokobrownie mit Vanillesauce", "dessert", 6.50)
    ]
    
    for data in real_csv_dishes:
        dish = DBDish(
            csv_id=data[0], 
            name=data[1], 
            kategorie=data[2], 
            preis=data[3], 
            embedding=fake_vector, 
            feedback_context="", 
            tenant_id="default",
            image_url=f"/images/dishes/{data[0]}.jpg"
        )
        db.add(dish)
    
    db.commit()
    db.close()
    print("Zero-API Seed successful. Database is now filled with real names and prices.")

if __name__ == "__main__":
    seed()
