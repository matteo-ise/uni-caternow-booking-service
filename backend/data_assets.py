# Historical data on popular catering combinations (social proof for the AI chat)

BESTSELLERS = {
    "combinations": [
        "Bruschetta wird extrem oft mit der Vegetarischen Lasagne kombiniert.",
        "Bei Firmenevents mit hohem Fancy-Score ist die Kürbiscremesuppe der absolute Favorit.",
        "Das Tiramisu ist unser meistverkauftes Dessert über alle Kundengruppen hinweg.",
        "Kunden, die Rinderbraten wählen, nehmen zu 80% das Schokomousse als Nachspeise."
    ],
    "expert_tips": [
        "Empfiehl bei großen Gruppen (>100 Personen) eher einfache, gut skalierbare Gerichte.",
        "Für Startups sind vegane Optionen ein Muss-Verkaufsargument."
    ]
}

def get_historical_context() -> str:
    context = "\n**HISTORISCHE BESTSELLER & EXPERTEN-WISSEN:**\n"
    for combo in BESTSELLERS["combinations"]:
        context += f"- {combo}\n"
    return context
