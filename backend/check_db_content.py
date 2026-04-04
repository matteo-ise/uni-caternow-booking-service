import os
import sys
sys.path.append('backend')
from database import SessionLocal
from db_models import DBDish
import numpy as np

db = SessionLocal()
try:
    count = db.query(DBDish).count()
    print(f"Dishes in DB: {count}")
    if count > 0:
        first = db.query(DBDish).first()
        print(f"First dish: {first.name}")
        if first.embedding:
            print(f"Embedding length: {len(first.embedding)}")
            print(f"Embedding sum: {sum(first.embedding)}")
        else:
            print("No embedding found for first dish!")
except Exception as e:
    print(f"Error: {e}")
db.close()
