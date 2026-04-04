import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv(".env")
genai.configure(api_key=os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY"))

for m in genai.list_models():
    print(m.name, m.supported_generation_methods)
