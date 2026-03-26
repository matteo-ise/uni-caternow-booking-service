import Select from "./Select.jsx";

export default function Step2Wishes({ form, setForm, errors = {} }) {
  const toggleInArray = (key, value) => {
    setForm((prev) => {
      const set = new Set(prev[key]);
      set.has(value) ? set.delete(value) : set.add(value);
      return { ...prev, [key]: Array.from(set) };
    });
  };

  const TIMES = [
    "08:00", "09:00", "10:00", "11:00",
    "12:00", "13:00", "14:00", "15:00",
    "16:00", "17:00", "18:00", "19:00",
  ];
  const CUSTOMER_TYPES = [
    { value: "privat", label: "Privat" },
    { value: "geschaeft", label: "Geschäftlich" },
  ];

  const LOGISTICS = [
    "Reine Lieferung ohne Aufbau",
    "Mit Aufbau des Caterings",
    "Fahrstuhl vorhanden",
    "Fahrstuhl nicht vorhanden",
  ];

  const EXTRAS = [
    "Buffettisch wird benötigt",
    "Getränke AFG´s",
    "Gläser werden benötigt",
    "Servicepersonal wird benötigt",
    "Messen & Konferenzen Paket",
    "Getränke AFG´s + Wein + Bier",
    "Teller/Geschirr wird benötigt",
    "nichts davon",
  ];

  return (
    <section className="section">
      <h2 className="subtitle">Schritt 2: Wünsche & Ausstattung</h2>

      {/* Header-Zweispalter wie im Mockup */}
      <div
        className="two-cols"
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}
      >
        <div>
          <Select
            label="Anlieferzeit *"
            value={form.deliveryTime || ""}
            onChange={(v) => setForm({ ...form, deliveryTime: v })}
            options={TIMES}
            placeholder="Uhrzeit"
          />
          {errors.deliveryTime && (
            <p className="error-text">{errors.deliveryTime}</p>
          )}
        </div>

        <div>
          <Select
            label="Privat / Geschäftlich *"
            value={form.customerType || "privat"}
            onChange={(v) => setForm({ ...form, customerType: v })}
            options={CUSTOMER_TYPES}
            placeholder="Bitte wählen"
          />
          {errors.customerType && (
            <p className="error-text">{errors.customerType}</p>
          )}
        </div>
      </div>

      {/* Logistik */}
      <div className="form-group" style={{ marginTop: 8 }}>
        <label className="label">Logistik</label>
        <div className="check-row">
          {LOGISTICS.map((opt) => (
            <label key={opt} className="check">
              <input
                type="checkbox"
                checked={form.logistics?.includes(opt)}
                onChange={() => toggleInArray("logistics", opt)}
              />
              <span>{opt}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Zusätzliches / Ausstattung */}
      <div className="form-group">
        <label className="label">Zusätzliches</label>
        <div className="check-row">
          {EXTRAS.map((opt) => (
            <label key={opt} className="check">
              <input
                type="checkbox"
                checked={form.extras?.includes(opt)}
                onChange={() => toggleInArray("extras", opt)}
              />
              <span>{opt}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Freitexte */}
      <div className="form-group">
        <label className="label">
          Allergien, Intoleranzen, Sonderwünsche (optional)
        </label>
        <textarea
          className="textarea"
          placeholder="Beschreibe Besonderheiten oder Unverträglichkeiten…"
          value={form.allergiesNotes || ""}
          onChange={(e) =>
            setForm({ ...form, allergiesNotes: e.target.value })
          }
        />
      </div>

      <div className="form-group">
        <label className="label">Erzähl uns von deinem Vorhaben</label>
        <textarea
          className="textarea"
          placeholder="Anlass, Ablauf, genaue Wünsche, Erreichbarkeit…"
          value={form.projectNotes || ""}
          onChange={(e) =>
            setForm({ ...form, projectNotes: e.target.value })
          }
        />
      </div>
    </section>
  );
}
