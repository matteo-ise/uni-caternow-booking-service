import os
import google.generativeai as genai
from dotenv import load_dotenv
load_dotenv(".env")
genai.configure(api_key=os.environ["GEMINI_API_KEY"])

try:
    res = genai.embed_content(model="models/text-embedding-004", content="Hello")
    print("text-embedding-004 DIMS:", len(res["embedding"]))
except Exception as e:
    print("ERR text-embedding-004:", e)

