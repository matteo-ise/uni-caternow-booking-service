import asyncio
import sys
sys.path.append('backend')
from embeddings import load_and_embed_dishes

if __name__ == "__main__":
    asyncio.run(load_and_embed_dishes())
