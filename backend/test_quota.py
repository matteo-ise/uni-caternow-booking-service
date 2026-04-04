import os
import google.generativeai as genai
from dotenv import load_dotenv
load_dotenv(".env")
genai.configure(api_key=os.environ["GEMINI_API_KEY"])

try:
    res = genai.embed_content(model="models/text-embedding-004", content="Test")
    print("SUCCESS text-embedding-004")
except Exception as e:
    print(f"FAILED text-embedding-004: {e}")

try:
    res = genai.embed_content(model="models/gemini-embedding-001", content="Test")
    print("SUCCESS gemini-embedding-001")
except Exception as e:
    print(f"FAILED gemini-embedding-001: {e}")
