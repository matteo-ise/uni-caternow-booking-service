import os
import google.generativeai as genai
from dotenv import load_dotenv
load_dotenv(".env")
genai.configure(api_key=os.environ["GEMINI_API_KEY"])

for m in genai.list_models():
    if "generateContent" in m.supported_generation_methods:
        print(f"Name: {m.name}, Display: {m.display_name}")
