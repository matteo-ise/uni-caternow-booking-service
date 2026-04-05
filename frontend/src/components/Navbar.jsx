import { useState } from 'react'
import logo from '../assets/caternow-logo.svg'
import { useAuth } from '../context/AuthContext'
import { Link } from 'react-router-dom'

export default function Navbar() {
  const { currentUser, loginWithGoogle, logout } = useAuth()
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  return (
    <nav className="nav">
      <div className="nav-left">
        <Link to="/" className="brand">
          <img src={logo} alt="CaterNow Logo" className="brand-logo" />
          <div className="brand-text">
            <div className="brand-title">CaterNow</div>
            <div className="brand-tag">Catering. Simplified.</div>
          </div>
        </Link>

        <ul className={`nav-links ${isMenuOpen ? 'nav-links--open' : ''}`}>
          <li><a href="#wie-es-funktioniert" onClick={() => setIsMenuOpen(false)}>So funktioniert's</a></li>
          <li><a href="#leistungen" onClick={() => setIsMenuOpen(false)}>Leistungen</a></li>
          <li><a href="#faq" onClick={() => setIsMenuOpen(false)}>FAQ</a></li>
          <li><a href="#kontakt" onClick={() => setIsMenuOpen(false)}>Kontakt</a></li>
        </ul>
      </div>

      <div className="nav-right">
        <button className="pill-btn">DE ▾</button>
        {currentUser ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <Link to="/profile" style={{ textDecoration: 'none', color: '#1e293b', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
              {currentUser.photoURL ? (
                <img 
                  src={currentUser.photoURL} 
                  alt="Profile" 
                  style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} 
                  title={currentUser.displayName}
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span>{currentUser.displayName || currentUser.email}</span>
              )}
            </Link>
            <button onClick={logout} className="link-muted" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
              Logout
            </button>
          </div>
        ) : (
          <button onClick={loginWithGoogle} className="link-muted" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem' }}>
            Login
          </button>
        )}
        
        <button 
          className={`nav-mobile-toggle ${isMenuOpen ? 'nav-mobile-toggle--open' : ''}`} 
          onClick={() => setIsMenuOpen(!isMenuOpen)} 
          aria-label="Menü öffnen"
        >
          <span className="hamburger-line"></span>
          <span className="hamburger-line"></span>
          <span className="hamburger-line"></span>
        </button>
      </div>
    </nav>
  )
}

