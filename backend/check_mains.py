import pandas as pd
df = pd.read_csv("data/Gerichte_Cater_Now_02_26.csv", sep=";", encoding="latin-1")
for name in df['name'].dropna():
    if "rind" in name.lower() or "braten" in name.lower() or "kürbis" in name.lower() or "lasagne" in name.lower():
        print(name)
