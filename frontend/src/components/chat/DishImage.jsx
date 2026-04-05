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

  // Level 2: Clean Mockup (SVG)
  const mockupColors = {
    vorspeise: '#037A8B',
    hauptgericht: '#026373',
    dessert: '#0f172a'
  };
  const color = mockupColors[category] || '#037A8B';

  return (
    <div style={{ 
      ...style, 
      background: '#f8fafc', 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center',
      border: `1px solid ${color}20`,
      color: color
    }}>
      <div style={{ fontSize: '2rem', marginBottom: '8px' }}>
        {category === 'vorspeise' ? '🥗' : category === 'dessert' ? '🍮' : '🍽️'}
      </div>
      <div style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6 }}>
        {alt}
      </div>
    </div>
  );
};

export default DishImage;
