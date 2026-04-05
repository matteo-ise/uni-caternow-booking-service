import React, { useState } from 'react';

/**
 * DishImage Component with 3-level fallback strategy:
 * 1. Local GitHub/Render Image (/images/dishes/{id}.jpeg)
 * 2. Unsplash Image (search by dish name)
 * 3. Clean SVG Mockup
 */
const DishImage = ({ src, alt, category, style }) => {
  const [errorLevel, setErrorLevel] = useState(0); // 0: Local, 1: Unsplash, 2: Mockup

  // Unsplash mapping for fallback
  const unsplashSearch = encodeURIComponent(`${alt} catering food`);
  const unsplashUrl = `https://source.unsplash.com/featured/400x300?${unsplashSearch}`;

  const handleError = () => {
    setErrorLevel(prev => prev + 1);
  };

  // Level 0: Primary Local Source
  if (errorLevel === 0) {
    return (
      <img 
        src={src} 
        alt={alt} 
        style={{ ...style, objectFit: 'cover' }} 
        onError={handleError}
      />
    );
  }

  // Level 1: Unsplash Fallback
  if (errorLevel === 1) {
    return (
      <img 
        src={unsplashUrl} 
        alt={alt} 
        style={{ ...style, objectFit: 'cover' }} 
        onError={handleError}
      />
    );
  }

  // Level 2: Emoji Fallback (Clean & Minimal)
  return (
    <div style={{ 
      ...style, 
      background: '#f8fafc', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      fontSize: '2.5rem',
      color: '#94a3b8'
    }}>
      🍴
    </div>
  );
};

export default DishImage;
