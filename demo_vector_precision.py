import os
import google.generativeai as genai
from dotenv import load_dotenv
from tabulate import tabulate # Requires 'pip install tabulate'

# Setup
load_dotenv(".env")
genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))

# Import our backend logic
import sys
sys.path.append('backend')
from embeddings import find_similar_dishes

def test_search(query, kategorie=None):
    print(f"\n🔍 SUCHE NACH: '{query}'" + (f" (Kategorie: {kategorie})" if kategorie else ""))
    print("-" * 60)
    
    results = find_similar_dishes(query, kategorie=kategorie, top_k=5)
    
    table_data = []
    for r in results:
        table_data.append([
            r.name, 
            r.kategorie, 
            f"{r.preis:.2f} €" if r.preis else "–",
            f"{r.similarity_score:.4f}",
            f"{(r.similarity_score * 100):.1f}%"
        ])
    
    print(tabulate(table_data, headers=["Name", "Kategorie", "Preis", "Distance Score", "Match %"]))

if __name__ == "__main__":
    # Test-Cases für die Demo
    queries = [
        ("Etwas leichtes und sommerliches", "vorspeise"),
        ("Ein deftiger Braten für viele Leute", "hauptgericht"),
        ("Ein süßer Abschluss mit Schokolade", "dessert"),
        ("Vegetarische Optionen für ein Startup", None)
    ]
    
    try:
        from tabulate import tabulate
    except ImportError:
        print("Bitte installiere tabulate für eine schöne Anzeige: pip install tabulate")
        sys.exit(1)

    for q, cat in queries:
        test_search(q, cat)
