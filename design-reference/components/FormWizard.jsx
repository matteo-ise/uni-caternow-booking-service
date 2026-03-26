// src/components/FormWizard.jsx
import { useState, useEffect } from "react";
import Accordion from "./Accordion.jsx";
import Step2Wishes from "./Step2Wishes.jsx";
import Step3Contact from "./Step3Contact.jsx";
import SuccessModal from "./SuccessModal.jsx";

/* Kategorien & Optionen für Schritt 1 (aus deinem PDF) */
const CAT_GROUPS = [
  {
    title: "Business & Office",
    options: [
      "Business Lunch",
      "Meeting-Catering / Konferenzverpflegung",
      "Messecatering",
      "Firmenfeier / Corporate Event",
      "Office-Einweihung",
    ],
  },
  {
    title: "Live & Outdoor",
    options: [
      "Food Truck – ADOBO (Modern Filipino)",
      "Grillcatering",
      "Sommerfest-Catering",
    ],
  },
  {
    title: "Privat & Feierlich",
    options: ["Geburtstag", "Hochzeit", "Jubiläum", "Private Dinner Party"],
  },
  {
    title: "Cateringart",
    options: [
      "Buffet",
      "Modernes Fingerfood",
      "Streetfood / Flying Buffet",
      "Getränkeservice inkl. Barpersonal",
    ],
  },
  {
    title: "Getränke",
    options: [
      "nicht alkoholische Getränke",
      "alkoholische Getränke",
      "keine Getränke",
    ],
  },
];

export default function FormWizard({
  step: externalStep,
  setStep: externalSetStep,
}) {
  const [internalStep, setInternalStep] = useState(1);
  const step = externalStep ?? internalStep;
  const setStep = externalSetStep ?? setInternalStep;

  const totalSteps = 3;

  const [form, setForm] = useState({
    date: "",
    time: "",
    guests: "",
    budget: "",
    budgetType: "brutto",
    allergies: [],
    allergyCounts: {},
    otherAllergiesEnabled: false,
    otherAllergiesText: "",
    otherAllergiesCount: 0,
    cateringInterests: [],

    logistics: [],
    extras: [],
    allergiesNotes: "",
    projectNotes: "",
    deliveryTime: "",
    customerType: "privat",

    contactFirstLast: "",
    contactPhone: "",
    contactEmail: "",
    invoiceName: "",
    invoiceStreet: "",
    invoiceExtra: "",
    invoiceZipCity: "",
    deliveryDifferent: false,
    deliveryAddress: "",
    deliveryNotes: "",
  });

  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false); // steuert das SuccessModal

  const goNext = () => setStep((s) => Math.min(totalSteps, s + 1));
  const goBack = () => setStep((s) => Math.max(1, s - 1));

  const handleSubmit = async () => {
    console.log("CaterNow Anfrage (Frontend):", form);
    
    // Transform frontend form data to backend API format
    const apiPayload = {
      // Contact Information
      name: form.contactFirstLast,
      email: form.contactEmail,
      telefon: form.contactPhone || null,
      
      // Event Details
      event_datum: form.date,
      event_time: form.time || null,
      ort: form.deliveryDifferent ? form.deliveryAddress : form.invoiceZipCity,
      teilnehmer: parseInt(form.guests, 10),
      
      // Budget
      budget_total: parseFloat(form.budget),
      budget_type: form.budgetType,
      
      // Allergies & Dietary
      allergies: form.allergies,
      allergy_counts: form.allergyCounts,
      other_allergies_enabled: form.otherAllergiesEnabled,
      other_allergies_text: form.otherAllergiesText || null,
      other_allergies_count: form.otherAllergiesCount,
      allergies_notes: form.allergiesNotes || null,
      
      // Catering Preferences
      catering_interests: form.cateringInterests,
      
      // Logistics & Service
      logistics: form.logistics,
      extras: form.extras,
      
      // Delivery
      delivery_time: form.deliveryTime || null,
      delivery_different: form.deliveryDifferent,
      delivery_address: form.deliveryAddress || null,
      delivery_notes: form.deliveryNotes || null,
      
      // Customer Type & Notes
      customer_type: form.customerType,
      project_notes: form.projectNotes || null,
      
      // Invoice Address
      invoice_name: form.invoiceName || null,
      invoice_street: form.invoiceStreet || null,
      invoice_extra: form.invoiceExtra || null,
      invoice_zip_city: form.invoiceZipCity || null,
      
      // System
      sprache: "de"
    };
    
    console.log("API Payload (Backend format):", apiPayload);
    
    try {
      // TODO: Replace with actual backend URL
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      
      const response = await fetch(`${API_URL}/api/leads/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(apiPayload),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      console.log("✅ Lead submitted successfully:", result);
      
      setSubmitted(true); // Modal öffnen
    } catch (error) {
      console.error("❌ Error submitting lead:", error);
      // TODO: Show error message to user
      alert("Es gab einen Fehler beim Absenden. Bitte versuchen Sie es später erneut.");
    }
  };

  // ✨ Scroll bei jedem Step-Wechsel nach oben
  useEffect(() => {
    // Variante: ganze Seite
    window.scrollTo({ top: 0, behavior: "smooth" });

    // Falls du lieber nur die Card scrollen willst,
    // könntest du stattdessen das hier nutzen:
    //
    // const card = document.querySelector(".card-elevated");
    // if (card) {
    //   card.scrollTo({ top: 0, behavior: "smooth" });
    // }
  }, [step]);

  const handleNextClick = () => {
    const newErrors = {};
    setErrors({}); // alte Fehler löschen

    // ✅ Schritt 1 prüfen
    if (step === 1) {
      if (!form.date) newErrors.date = "Bitte ein Datum auswählen.";
      if (!form.time) newErrors.time = "Bitte eine Uhrzeit angeben.";
      if (!form.guests || Number(form.guests) <= 0)
        newErrors.guests = "Bitte eine gültige Gästeanzahl eingeben.";
      if (!form.budget || Number(form.budget) <= 0)
        newErrors.budget = "Bitte ein Budget angeben.";
    }

    // ✅ Schritt 2 prüfen
    if (step === 2) {
      if (!form.deliveryTime)
        newErrors.deliveryTime = "Bitte Anlieferzeit wählen.";
      if (!form.customerType)
        newErrors.customerType = "Bitte Kundentyp wählen.";
    }

    // ✅ Schritt 3 prüfen
    if (step === 3) {
      if (!form.contactFirstLast)
        newErrors.contactFirstLast = "Bitte Namen eingeben.";
      if (!form.contactPhone)
        newErrors.contactPhone = "Bitte Telefonnummer angeben.";
      if (!form.contactEmail)
        newErrors.contactEmail = "Bitte E-Mail-Adresse eingeben.";
      if (!form.invoiceStreet)
        newErrors.invoiceStreet = "Bitte Straße & Hausnummer eingeben.";
      if (!form.invoiceZipCity)
        newErrors.invoiceZipCity = "Bitte PLZ & Ort angeben.";
    }

    setErrors(newErrors);

    // Wenn Fehler → nicht weiter
    if (Object.keys(newErrors).length > 0) return;

    // letzter Schritt → Formular "abschicken"
    if (step === totalSteps) {
      handleSubmit();
    } else {
      goNext();
    }
  };

  return (
    <>
      <div className="wizard-wrap">
        <div className="wizard-card">
          <WizardHeader step={step} totalSteps={totalSteps} />

          {step === 1 && (
            <Step1_Eventdetails form={form} setForm={setForm} errors={errors} />
          )}
          {step === 2 && (
            <Step2Wishes form={form} setForm={setForm} errors={errors} />
          )}
          {step === 3 && (
            <Step3Contact form={form} setForm={setForm} errors={errors} />
          )}

          <div className="wizard-nav">
            <button
              type="button"
              className="btn"
              onClick={goBack}
              disabled={step === 1}
            >
              zurück
            </button>
            <div className="spacer" />
            <button
              type="button"
              className="btn-primary"
              onClick={handleNextClick}
            >
              {step === totalSteps ? "Absenden" : "Weiter"}
            </button>
          </div>
        </div>
      </div>

      {/* Erfolgs-Popup nach dem Absenden */}
      <SuccessModal open={submitted} onClose={() => setSubmitted(false)} />
    </>
  );
}

function WizardHeader({ step, totalSteps }) {
  const pct = (step / totalSteps) * 100;
  return (
    <header className="wizard-header">
      <h1 className="title">CaterNow – Anfrage</h1>
      <div className="progress">
        <div className="progress-bar" style={{ width: `${pct}%` }} />
      </div>
      <div className="step-info">
        Schritt {step} von {totalSteps}
      </div>
    </header>
  );
}

function Step1_Eventdetails({ form, setForm, errors = {} }) {
  const ALLERGENS = ["Gluten", "Laktose", "Nüsse", "Soja", "Ei"];
  const guestsNumber = Number(form.guests) || 0;
  const sliderMax = guestsNumber > 0 ? guestsNumber : 50;

  const toggleAllergy = (name) => {
    setForm((prev) => {
      const selected = new Set(prev.allergies);
      const counts = { ...prev.allergyCounts };

      if (selected.has(name)) {
        selected.delete(name);
        delete counts[name];
      } else {
        selected.add(name);
        if (counts[name] == null) counts[name] = 0;
      }

      return {
        ...prev,
        allergies: Array.from(selected),
        allergyCounts: counts,
      };
    });
  };

  const handleAllergyCountChange = (name, value) => {
    const num = Math.max(0, Number(value) || 0);
    setForm((prev) => ({
      ...prev,
      allergyCounts: {
        ...prev.allergyCounts,
        [name]: num,
      },
    }));
  };

  return (
    <section className="section">
      <h2 className="subtitle">Schritt 1: Eventdetails</h2>

      {/* Datum */}
      <div className="form-group">
        <label className="label">Datum *</label>
        <input
          className="input"
          type="date"
          value={form.date}
          onChange={(e) => setForm({ ...form, date: e.target.value })}
        />
        {errors.date && <p className="error-text">{errors.date}</p>}
      </div>

      {/* Uhrzeit */}
      <div className="form-group">
        <label className="label">Uhrzeit *</label>
        <input
          className="input"
          type="time"
          value={form.time}
          onChange={(e) => setForm({ ...form, time: e.target.value })}
        />
        {errors.time && <p className="error-text">{errors.time}</p>}
      </div>

      {/* Gäste */}
      <div className="form-group">
        <label className="label">Anzahl der Gäste *</label>
        <input
          className="input"
          type="number"
          min="1"
          placeholder="z. B. 50"
          value={form.guests}
          onChange={(e) => setForm({ ...form, guests: e.target.value })}
        />
        {errors.guests && <p className="error-text">{errors.guests}</p>}
      </div>

      {/* Allergene */}
      <div className="form-group">
        <label className="label">Allergene (optional)</label>
        <div className="allergy-grid">
          {ALLERGENS.map((a) => {
            const checked = form.allergies.includes(a);
            const count = form.allergyCounts?.[a] ?? 0;
            const plural = count === 1 ? "Person" : "Personen";

            return (
              <div key={a} className="allergy-card">
                <label className="check">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleAllergy(a)}
                  />
                  <span>{a}</span>
                </label>

                {checked && (
                  <div className="allergy-slider">
                    <input
                      type="range"
                      min={0}
                      max={sliderMax}
                      step={1}
                      value={count}
                      onChange={(e) =>
                        handleAllergyCountChange(a, e.target.value)
                      }
                    />
                    <div className="allergy-slider-meta">
                      <span>
                        {count} {plural}
                      </span>
                      {guestsNumber > 0 ? (
                        <span className="muted">
                          von {guestsNumber} Gästen
                        </span>
                      ) : (
                        <span className="muted">
                          Trage oben die Gästeanzahl ein.
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Sonstiges */}
          <div className="allergy-card">
            <label className="check">
              <input
                type="checkbox"
                checked={form.otherAllergiesEnabled}
                onChange={(e) =>
                  setForm({
                    ...form,
                    otherAllergiesEnabled: e.target.checked,
                    otherAllergiesText: e.target.checked
                      ? form.otherAllergiesText
                      : "",
                    otherAllergiesCount: e.target.checked
                      ? form.otherAllergiesCount
                      : 0,
                  })
                }
              />
              <span>Sonstiges</span>
            </label>

            {form.otherAllergiesEnabled && (
              <>
                <div style={{ marginTop: 6 }}>
                  <textarea
                    className="textarea"
                    placeholder="Weitere Allergene (z. B. Sellerie, Fisch, Sesam …)"
                    value={form.otherAllergiesText}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        otherAllergiesText: e.target.value,
                      })
                    }
                  />
                  <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                    Du kannst mehrere Allergene durch Komma trennen.
                  </p>
                </div>

                <div className="allergy-slider" style={{ marginTop: 8 }}>
                  <input
                    type="range"
                    min={0}
                    max={sliderMax}
                    step={1}
                    value={form.otherAllergiesCount ?? 0}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        otherAllergiesCount: Math.max(
                          0,
                          Number(e.target.value) || 0
                        ),
                      })
                    }
                  />
                  <div className="allergy-slider-meta">
                    <span>
                      {form.otherAllergiesCount}{" "}
                      {form.otherAllergiesCount === 1
                        ? "Person"
                        : "Personen"}
                    </span>
                    {guestsNumber > 0 ? (
                      <span className="muted">
                        von {guestsNumber} Gästen
                      </span>
                    ) : (
                      <span className="muted">
                        Trage oben die Gästeanzahl ein.
                      </span>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Budget */}
      <div className="form-group">
        <label className="label">Budget *</label>
        <input
          className="input"
          type="number"
          min="0"
          placeholder="z. B. 2500"
          value={form.budget}
          onChange={(e) => setForm({ ...form, budget: e.target.value })}
        />
        {errors.budget && <p className="error-text">{errors.budget}</p>}

        <div className="radio-row">
          <label className="radio">
            <input
              type="radio"
              name="budgetType"
              checked={form.budgetType === "netto"}
              onChange={() => setForm({ ...form, budgetType: "netto" })}
            />
            <span>Netto-Budget (Geschäftskunden)</span>
          </label>
          <label className="radio">
            <input
              type="radio"
              name="budgetType"
              checked={form.budgetType === "brutto"}
              onChange={() => setForm({ ...form, budgetType: "brutto" })}
            />
            <span>Brutto-Budget (Privatkunden)</span>
          </label>
        </div>
      </div>

      {/* Art des Caterings */}
      <section className="section" style={{ padding: 0, marginTop: 16 }}>
        <div style={{ padding: 20 }}>
          <h3 className="subtitle" style={{ marginTop: 0 }}>
            Art des Caterings
          </h3>
          {CAT_GROUPS.map((group) => (
            <Accordion key={group.title} title={group.title}>
              <div className="check-row">
                {group.options.map((opt) => (
                  <label key={opt} className="check">
                    <input
                      type="checkbox"
                      checked={form.cateringInterests.includes(opt)}
                      onChange={() => {
                        const set = new Set(form.cateringInterests);
                        set.has(opt) ? set.delete(opt) : set.add(opt);
                        setForm({
                          ...form,
                          cateringInterests: Array.from(set),
                        });
                      }}
                    />
                    <span>{opt}</span>
                  </label>
                ))}
              </div>
            </Accordion>
          ))}

          {/* Unsicher */}
          <div className="form-group" style={{ marginTop: 12 }}>
            <label className="check">
              <input
                type="checkbox"
                checked={form.cateringInterests.includes(
                  "Ich bin mir noch unsicher – bitte beratet mich."
                )}
                onChange={() => {
                  const opt =
                    "Ich bin mir noch unsicher – bitte beratet mich.";
                  const set = new Set(form.cateringInterests);
                  set.has(opt) ? set.delete(opt) : set.add(opt);
                  setForm({
                    ...form,
                    cateringInterests: Array.from(set),
                  });
                }}
              />
              <span>Ich bin mir noch unsicher – bitte beratet mich.</span>
            </label>
          </div>
        </div>
      </section>
    </section>
  );
}
