import pandas as pd
import os

DATA_PATH = "data/Gerichte_Cater_Now_02_26.csv"
try:
    df = pd.read_csv(DATA_PATH, sep=";", encoding="latin-1")
    desserts = df[df['dessert'] == 1]
    for i, row in desserts.iterrows():
        print(f"ID: {row.get('id')} | Name: {row['name']}")
except Exception as e:
    print(f"Error: {e}")
