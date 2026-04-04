import pandas as pd
df = pd.read_csv("data/Gerichte_Cater_Now_02_26.csv", sep=";", encoding="latin-1")
for name in df['name'].dropna():
    if "tira" in name.lower() or "mousse" in name.lower() or "beere" in name.lower():
        print(name)
