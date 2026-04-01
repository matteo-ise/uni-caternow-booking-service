import { Link } from "react-router-dom";
import logo from "../assets/caternow-logo.svg"; // Pfad ggf. anpassen (z. B. ../assets/logo.svg)

export default function Navbar() {
  return (
    <nav className="nav">
      <div className="nav-left">
        {/* LOGO / BRAND */}
        <Link to="/" className="brand">
          <img
            src={logo}
            alt="CaterNow Logo"
            className="brand-logo"
          />
          <div className="brand-text">
            <div className="brand-title">CaterNow</div>
            <div className="brand-tag">Catering. Simplified.</div>
          </div>
        </Link>

        {/* MAIN LINKS */}
        <ul className="nav-links">
          <li><Link to="/marketplace">Marketplace</Link></li>
          <li><Link to="/orders">Meine Bestellungen</Link></li>
          <li><Link to="/about">About Us</Link></li>
          <li><Link to="/faq">FAQ</Link></li>
        </ul>
      </div>

      {/* RIGHT SECTION */}
      <div className="nav-right">
        {/* Language Switcher */}
        <button className="pill-btn" title="Sprache">DE ▾</button>

        {/* Profile Icon */}
        <button className="icon-btn" title="Profil">
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
            <circle cx="12" cy="8" r="4" fill="currentColor" />
            <path d="M4 20c0-4 4-6 8-6s8 2 8 6" fill="currentColor" />
          </svg>
        </button>

        {/* Logout */}
        <Link to="/logout" className="link-muted">Logout</Link>
      </div>
    </nav>
  );
}
