import pandas as pd
import os

DATA_PATH = "data/Gerichte_Cater_Now_02_26.csv"
try:
    # Try different encodings
    df = pd.read_csv(DATA_PATH, sep=";", encoding="latin-1")
    tira = df[df['name'].str.contains('Tira', case=False, na=False)]
    for i, row in tira.iterrows():
        print(f"ID: {row.get('id')} | Name: {row['name']}")
except Exception as e:
    print(f"Error: {e}")
