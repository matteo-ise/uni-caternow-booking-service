import heroPlate from '../assets/hero-plate.png'

export default function HeroSection({ onOpenChat, disabled }) {
  return (
    <>
      {/* ── Hero Split ──────────────────────────────────────────── */}
      <section className="hero-figma">
        <div className="hero-inner">
          {/* Linke Spalte – Text + CTA */}
          <div className="hero-left">
            <h1 className="hero-headline">
              Plane dein perfektes
              <br />
              Catering
            </h1>
            <p className="hero-highlight">schnell &amp; unkompliziert</p>
            <p className="hero-copy">
              Unser KI-Berater stellt dir in Sekunden ein maßgeschneidertes
              3-Gang-Menü zusammen – abgestimmt auf deinen Anlass,
              dein Budget und deine Wünsche.
            </p>
            <button className="hero-cta-btn" onClick={onOpenChat} disabled={disabled} style={{ opacity: disabled ? 0.6 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}>
              MENÜ ZUSAMMENSTELLEN
            </button>

            {/* Sponsor Trust Badge */}
            <div className="hero-sponsor-badge">
              <span className="hero-sponsor-label">Powered by</span>
              <a href="https://main-catering.com/" target="_blank" rel="noopener noreferrer" className="hero-sponsor-box">
                <img src="/maincatering_logo.png" alt="MainCatering Logo" className="hero-sponsor-logo" />
              </a>
            </div>
          </div>

          {/* Rechte Spalte – Teal + Teller */}
          <div className="hero-right">
            <div className="hero-plate-wrapper">
              <div className="hero-plate-circle">
                <img src={heroPlate} alt="Catering Teller" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Bento Grid ──────────────────────────────────────────── */}
      <section className="bento-section" id="leistungen">
        <h2 className="bento-title">Warum CaterNow?</h2>
        <p className="bento-sub">Alles, was du für ein perfektes Event brauchst – an einem Ort.</p>
        <div className="bento-grid" id="wie-es-funktioniert">
          <div className="bento-card bento-card--wide">
            <span className="bento-kpi">⏱️ 2–3 Min.</span>
            <h3>Schnell anfragen</h3>
            <p>Einfach Wünsche im Chat beschreiben – unser Berater stellt sofort ein passendes 3-Gang-Menü zusammen.</p>
          </div>

          <div className="bento-card bento-card--tall">
            <span className="bento-kpi">🧪 Sicher</span>
            <h3>Allergene smart gefiltert</h3>
            <p>Unverträglichkeiten und Allergien werden automatisch berücksichtigt. Für jeden Gast das richtige Gericht.</p>
          </div>

          <div className="bento-card">
            <span className="bento-kpi">€ Budget</span>
            <h3>Budget-Guard</h3>
            <p>Transparente Preise, passende Vorschläge im Rahmen deines Budgets.</p>
          </div>

          <div className="bento-card">
            <span className="bento-kpi">🎯 Matching</span>
            <h3>Event-Typen</h3>
            <p>Business-Lunch, Hochzeit, Sommerfest & mehr – immer das passende Menü.</p>
          </div>

          <div className="bento-card bento-card--wide">
            <span className="bento-kpi">🧳 Add-ons</span>
            <h3>Logistik & Extras</h3>
            <p>Aufbau, Geschirr, Personal – alles flexibel zubuchbar direkt über den Berater.</p>
          </div>
        </div>
      </section>
    </>
  )
}
