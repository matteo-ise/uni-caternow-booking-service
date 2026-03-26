import logo from '../assets/caternow-logo.svg'

export default function Navbar() {
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
        <button className="icon-btn" title="Profil" aria-label="Profil">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
          </svg>
        </button>
        <a href="#" className="link-muted">Login</a>
      </div>
    </nav>
  )
}
