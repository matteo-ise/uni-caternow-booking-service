import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv
load_dotenv(".env")
engine = create_engine(os.environ["DATABASE_URL"])
with engine.connect() as conn:
    res = conn.execute(text("SELECT count(*) FROM dishes")).fetchone()
    print(f"Gerichte in DB: {res[0]}")
