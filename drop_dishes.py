import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv(".env")
DATABASE_URL = os.environ.get("DATABASE_URL")
engine = create_engine(DATABASE_URL)

with engine.begin() as conn:
    conn.execute(text("DROP TABLE IF EXISTS dishes CASCADE;"))
    print("Dropped table 'dishes'")
