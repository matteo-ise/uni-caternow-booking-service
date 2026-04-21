"""
Pexels Image Resolver for CaterNow dishes.

Resolves missing dish images via the Pexels API (free, automation-friendly).
- Idempotent: skips dishes that already have a valid image_url
- Rate-limited: 200 req/hour free tier → 18s between requests
- Fallback chain: dish name → category generic → curated category URL
"""

import asyncio
import os
import logging
import httpx
from pathlib import Path

from database import SessionLocal
from db_models import DBDish

logger = logging.getLogger("CaterNow-ImageResolver")

PEXELS_API_KEY = os.environ.get("PEXELS_API_KEY", "")
PEXELS_API_URL = "https://api.pexels.com/v1/search"

IMAGES_DIR = Path(__file__).resolve().parent.parent / "frontend" / "public" / "images" / "dishes"

# Curated fallback URLs per category (stable Pexels CDN links)
CATEGORY_FALLBACKS = {
    "vorspeise": "https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&fit=crop",
    "hauptgericht": "https://images.pexels.com/photos/1279330/pexels-photo-1279330.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&fit=crop",
    "dessert": "https://images.pexels.com/photos/376464/pexels-photo-376464.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&fit=crop",
}


def _local_image_exists(csv_id: int) -> str | None:
    """Check if a local image file exists for the given csv_id. Returns the relative URL or None."""
    for ext in ("jpeg", "jpg", "png"):
        path = IMAGES_DIR / f"{csv_id}.{ext}"
        if path.exists():
            return f"/images/dishes/{csv_id}.{ext}"
    return None


async def _search_pexels(query: str) -> str | None:
    """Search Pexels API and return the first result's CDN URL, or None."""
    if not PEXELS_API_KEY:
        logger.warning("[ImageResolver] PEXELS_API_KEY not set — skipping API call")
        return None

    params = {
        "query": query,
        "per_page": 1,
        "orientation": "landscape",
        "size": "medium",
    }
    headers = {"Authorization": PEXELS_API_KEY}

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(PEXELS_API_URL, params=params, headers=headers)
            resp.raise_for_status()
            data = resp.json()

            photos = data.get("photos", [])
            if photos:
                # Use the "medium" size (~350px wide) for card display
                return photos[0]["src"]["medium"]
    except httpx.HTTPStatusError as e:
        logger.warning(f"[ImageResolver] Pexels API error: {e.response.status_code}")
    except Exception as e:
        logger.warning(f"[ImageResolver] Pexels request failed: {e}")

    return None


def fix_existing_broken_urls():
    """Set image_url=NULL for dishes whose local file doesn't exist."""
    db = SessionLocal()
    try:
        dishes = db.query(DBDish).filter(DBDish.image_url.isnot(None)).all()
        fixed = 0
        for dish in dishes:
            url = dish.image_url
            # Only check local paths, not external URLs
            if url and url.startswith("/images/dishes/"):
                local_path = IMAGES_DIR / url.split("/")[-1]
                if not local_path.exists():
                    dish.image_url = None
                    fixed += 1
        if fixed:
            db.commit()
            logger.info(f"[ImageResolver] Cleared {fixed} broken local image URLs")
    except Exception as e:
        db.rollback()
        logger.error(f"[ImageResolver] fix_existing_broken_urls error: {e}")
    finally:
        db.close()


async def resolve_missing_images():
    """Fill NULL image_url fields with Pexels CDN URLs. Runs in background."""
    # Step 1: Fix broken local URLs first
    fix_existing_broken_urls()

    db = SessionLocal()
    try:
        missing = db.query(DBDish).filter(DBDish.image_url.is_(None)).all()
        if not missing:
            logger.info("[ImageResolver] All dishes have images — nothing to resolve")
            return

        logger.info(f"[ImageResolver] Resolving images for {len(missing)} dishes...")

        resolved = 0
        for dish in missing:
            # Check if a local file exists (may have been added after initial sync)
            local_url = _local_image_exists(dish.csv_id)
            if local_url:
                dish.image_url = local_url
                db.commit()
                resolved += 1
                continue

            # Try Pexels API: dish name + food
            url = await _search_pexels(f"{dish.name} food")

            # Fallback: category generic search
            if not url:
                category_query = {
                    "vorspeise": "appetizer starter food",
                    "hauptgericht": "main course dinner food",
                    "dessert": "dessert sweet food",
                }.get(dish.kategorie, "catering food platter")
                url = await _search_pexels(category_query)

            # Final fallback: curated category URL
            if not url:
                url = CATEGORY_FALLBACKS.get(dish.kategorie, CATEGORY_FALLBACKS["hauptgericht"])

            dish.image_url = url
            db.commit()
            resolved += 1
            logger.info(f"[ImageResolver] {resolved}/{len(missing)} — {dish.name}")

            # Rate limit: 200 req/hour → 18s between requests (conservative)
            await asyncio.sleep(20)

        logger.info(f"[ImageResolver] Done — resolved {resolved} dish images")

    except Exception as e:
        db.rollback()
        logger.error(f"[ImageResolver] resolve_missing_images error: {e}")
    finally:
        db.close()


def get_image_status() -> dict:
    """Return image resolution status overview."""
    db = SessionLocal()
    try:
        total = db.query(DBDish).count()
        with_image = db.query(DBDish).filter(DBDish.image_url.isnot(None)).count()
        return {
            "total": total,
            "with_image": with_image,
            "missing": total - with_image,
        }
    finally:
        db.close()
