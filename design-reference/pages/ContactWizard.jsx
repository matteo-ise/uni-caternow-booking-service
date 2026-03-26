import { useState } from "react";
import Navbar from "../components/Navbar.jsx";
import FormWizard from "../components/FormWizard.jsx";
import Stepper from "../components/Stepper.jsx";
import "./../styles/global.css";

export default function ContactWizard() {
  // Step hier oben halten, damit Stepper live mitschwingt
  const [step, setStep] = useState(1);

  return (
    <>
      <Navbar />

      <main className="container contact-grid">
        {/* Linke Spalte: Wizard-Card */}
        <section className="wizard-col">
          <div className="card-elevated hoverable">
            <header className="card-head" style={{ display: "block" }}>
              <div className="brand-line" style={{ marginBottom: 10, display: "flex", alignItems: "baseline", gap: 10 }}>
                <h1 className="title">CaterNow – Anfrage</h1>
                <span className="tag">3 Schritte</span>
              </div>

              {/* 👉 schicker Stepper */}
              <Stepper
                step={step}
                steps={[
                  "Eventdetails",
                  "Wünsche ",
                  "Kontakt & Adresse",
                ]}
              />
            </header>

            {/* 👉 Step & setStep werden übergeben */}
            <FormWizard step={step} setStep={setStep} />
          </div>
        </section>

        {/* Rechte Spalte: Hero-Bild / Mood */}
        <aside className="hero-col">
          <img
            className="hero-img lift"
            alt="Catering Auswahl"
            src="https://images.unsplash.com/photo-1523905330026-b8bd1f5f320e?q=80&w=1600&auto=format&fit=crop"
            loading="eager"
          />
        </aside>
      </main>
    </>
  );
}
