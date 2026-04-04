import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv(".env")
genai.configure(api_key=os.environ["GEMINI_API_KEY"])

res = genai.embed_content(model="models/gemini-embedding-001", content="Hello")
print("DIMS gemini-embedding-001:", len(res["embedding"]))
