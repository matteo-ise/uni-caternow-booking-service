import pandas as pd
import os
import sys
sys.path.append('backend')
from database import SessionLocal, engine
from db_models import DBDish
from sqlalchemy import text

def seed():
    print("🗑️ Reset DB...")
    with engine.begin() as conn:
        conn.execute(text("TRUNCATE TABLE dishes RESTART IDENTITY CASCADE"))
    
    db = SessionLocal()
    df = pd.read_csv("data/Gerichte_Cater_Now_02_26.csv", sep=";", encoding="latin-1")
    
    fake_vector = [0.0] * 3072
    
    count = 0
    for i, row in df.iterrows():
        name = str(row['name']).strip()
        if not name or name == "nan": continue
        
        kat = None
        if float(row.get('vorspeise', 0)) == 1.0: kat = "vorspeise"
        elif float(row.get('hauptgericht', 0)) == 1.0: kat = "hauptgericht"
        elif float(row.get('dessert', 0)) == 1.0: kat = "dessert"
        
        if not kat: continue
        
        try:
            csv_id = int(row['id'])
        except:
            csv_id = count + 500 # Fallback ID
            
        try:
            p_val = row.get('Preis')
            if pd.isna(p_val):
                preis = 15.0
            else:
                p_str = str(p_val).replace(',', '.')
                preis = float(p_str)
        except:
            preis = 15.0
        
        dish = DBDish(
            csv_id=csv_id, name=name, kategorie=kat, preis=preis, 
            embedding=fake_vector, feedback_context="", tenant_id="default",
            image_url=f"/images/dishes/{csv_id}.jpeg"
        )
        db.add(dish)
        count += 1
        
    db.commit()
    db.close()
    print(f"✅ Successfully loaded ALL {count} dishes from CSV into Neon DB.")

if __name__ == "__main__":
    seed()
