import logo from '../assets/caternow-logo.svg'
import { useAuth } from '../context/AuthContext'

export default function Navbar() {
  const { currentUser, loginWithGoogle, logout } = useAuth()

  return (
    <nav className="nav">
      <div className="nav-left">
        <a href="#" className="brand">
          <img src={logo} alt="CaterNow Logo" className="brand-logo" />
          <div className="brand-text">
            <div className="brand-title">CaterNow</div>
            <div className="brand-tag">Catering. Simplified.</div>
          </div>
        </a>

        <ul className="nav-links">
          <li><a href="#wie-es-funktioniert">So funktioniert's</a></li>
          <li><a href="#leistungen">Leistungen</a></li>
          <li><a href="#faq">FAQ</a></li>
          <li><a href="#kontakt">Kontakt</a></li>
        </ul>
      </div>

      <div className="nav-right">
        <button className="pill-btn">DE ▾</button>
        {currentUser ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {currentUser.photoURL ? (
              <img 
                src={currentUser.photoURL} 
                alt="Profile" 
                style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} 
                title={currentUser.displayName}
                referrerPolicy="no-referrer"
              />
            ) : (
              <span style={{ fontWeight: 'bold' }}>{currentUser.displayName || currentUser.email}</span>
            )}
            <button onClick={logout} className="link-muted" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
              Logout
            </button>
          </div>
        ) : (
          <button onClick={loginWithGoogle} className="link-muted" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem' }}>
            Login
          </button>
        )}
      </div>
    </nav>
  )
}
