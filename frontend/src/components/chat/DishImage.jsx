import React, { useState } from 'react';

/**
 * DishImage Component with 2-level fallback:
 * 1. Primary image (src from DB — local path or Unsplash CDN URL)
 * 2. Curated category fallback (stable Unsplash CDN URLs)
 */

const CATEGORY_FALLBACKS = {
  vorspeise: 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&fit=crop',
  hauptgericht: 'https://images.pexels.com/photos/1279330/pexels-photo-1279330.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&fit=crop',
  dessert: 'https://images.pexels.com/photos/376464/pexels-photo-376464.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&fit=crop',
};

const DEFAULT_FALLBACK = CATEGORY_FALLBACKS.hauptgericht;

const DishImage = ({ src, alt, category, style }) => {
  const [useFallback, setUseFallback] = useState(false);

  const fallbackUrl = CATEGORY_FALLBACKS[category?.toLowerCase()] || DEFAULT_FALLBACK;

  const handleError = () => {
    if (!useFallback) {
      setUseFallback(true);
    }
  };

  const imgSrc = useFallback ? fallbackUrl : src;

  return (
    <img
      src={imgSrc || fallbackUrl}
      alt={alt}
      style={{ ...style, objectFit: 'cover' }}
      onError={handleError}
    />
  );
};

export default DishImage;
