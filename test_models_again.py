import os
import google.generativeai as genai
from dotenv import load_dotenv
load_dotenv(".env")
genai.configure(api_key=os.environ["GEMINI_API_KEY"])

models_to_test = ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-1.5-flash-8b"]
for m in models_to_test:
    try:
        model = genai.GenerativeModel(m)
        resp = model.generate_content("Hi")
        print(f"OK: {m}")
    except Exception as e:
        print(f"FAILED {m}: {e}")
