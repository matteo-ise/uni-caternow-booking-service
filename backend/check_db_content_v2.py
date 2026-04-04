import os
import sys
sys.path.append('backend')
from database import SessionLocal
from db_models import DBDish
import numpy as np

db = SessionLocal()
try:
    first = db.query(DBDish).first()
    if first and first.embedding is not None:
        vec = np.array(first.embedding)
        print(f"Name: {first.name}")
        print(f"Sum: {np.sum(vec)}")
    else:
        print("No embedding.")
except Exception as e:
    print(f"Error: {e}")
db.close()
