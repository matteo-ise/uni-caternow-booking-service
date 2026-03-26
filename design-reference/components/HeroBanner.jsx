// src/components/HeroBanner.jsx
import { Link } from "react-router-dom";
import heroPlate from "../assets/hero-plate.png"; // Bild liegt in src/assets

export default function HeroBanner() {
  return (
    <>
      {/* HERO-BEREICH */}
      <section className="hero-figma">
        <div className="hero-inner">
          {/* LINKSE SPALTE – TEXT + BUTTON */}
          <div className="hero-left">
            <h1 className="hero-headline">
              Plane dein perfektes
              <br />
              Catering
            </h1>

            <p className="hero-highlight">schnell &amp; unkompliziert</p>

            <p className="hero-copy">
              Erstelle in wenigen Minuten eine Anfrage, die perfekt zu deinem
              Event passt – inklusive Budget, Gästezahl und Allergenen.
            </p>

            {/* Button direkt unter dem Text */}
            <div className="hero-form-actions">
              <Link to="/contact" className="hero-cta-btn">
                PASSENDEN CATER FINDEN
              </Link>
            </div>
          </div>

          {/* RECHTE SPALTE – TEAL-FLÄCHE + TELLER */}
          <div className="hero-right">
            {/* Teal Shape als Hintergrund */}
            <div className="hero-teal-shape"></div>
            
            {/* Teller AUSSERHALB des Teal Shapes - damit er vollständig sichtbar ist */}
            <div className="hero-plate-wrapper">
              <div className="hero-plate-circle">
                <img src={heroPlate} alt="Catering Teller" />
              </div>
            </div>
          </div>
        </div>
      </section>

    </>
  );
}