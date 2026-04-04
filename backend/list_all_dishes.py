import os
import sys
sys.path.append('backend')
from database import SessionLocal
from db_models import DBDish

db = SessionLocal()
dishes = db.query(DBDish).all()
for d in dishes:
    print(f"ID: {d.csv_id} | Name: {d.name} | Price: {d.preis}")
db.close()
