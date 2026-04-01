// src/components/Step3Contact.jsx
export default function Step3Contact({ form, setForm, errors = {} }) {
  return (
    <section className="section">
      <h2 className="subtitle">Schritt 3: Kontakt & Adresse</h2>

      {/* Kontaktperson */}
      <div className="form-group">
        <label className="label">Kontaktperson – Vor- &amp; Nachname *</label>
        <input
          className="input"
          type="text"
          placeholder="z. B. Alex Müller"
          value={form.contactFirstLast || ""}
          onChange={(e) =>
            setForm({ ...form, contactFirstLast: e.target.value })
          }
        />
        {errors.contactFirstLast && (
          <p className="error-text">{errors.contactFirstLast}</p>
        )}
      </div>

      <div className="form-group">
        <label className="label">Telefonnummer *</label>
        <input
          className="input"
          type="tel"
          placeholder="+49 …"
          value={form.contactPhone || ""}
          onChange={(e) =>
            setForm({ ...form, contactPhone: e.target.value })
          }
        />
        {errors.contactPhone && (
          <p className="error-text">{errors.contactPhone}</p>
        )}
      </div>

      <div className="form-group">
        <label className="label">E-Mail-Adresse *</label>
        <input
          className="input"
          type="email"
          placeholder="name@beispiel.de"
          value={form.contactEmail || ""}
          onChange={(e) =>
            setForm({ ...form, contactEmail: e.target.value })
          }
        />
        {errors.contactEmail && (
          <p className="error-text">{errors.contactEmail}</p>
        )}
      </div>

      {/* Privat oder geschäftlich */}
      <div className="form-group">
        <label className="label">Privat oder geschäftlich?</label>
        <div className="radio-row">
          <label className="radio">
            <input
              type="radio"
              name="customerType"
              checked={form.customerType === "privat"}
              onChange={() => setForm({ ...form, customerType: "privat" })}
            />
            <span>Privat</span>
          </label>
          <label className="radio">
            <input
              type="radio"
              name="customerType"
              checked={form.customerType === "geschaeft"}
              onChange={() =>
                setForm({ ...form, customerType: "geschaeft" })
              }
            />
            <span>Geschäftlich</span>
          </label>
        </div>
      </div>

      {/* Rechnungs- & Angebotsadresse */}
      <div className="form-group">
        <label className="label">
          Rechnungs- &amp; Angebotsadresse – Firma / Name
        </label>
        <input
          className="input"
          type="text"
          placeholder="Firma / Name"
          value={form.invoiceName || ""}
          onChange={(e) =>
            setForm({ ...form, invoiceName: e.target.value })
          }
        />
      </div>

      <div className="form-group">
        <label className="label">Straße &amp; Hausnummer *</label>
        <input
          className="input"
          type="text"
          placeholder="Musterstraße 12"
          value={form.invoiceStreet || ""}
          onChange={(e) =>
            setForm({ ...form, invoiceStreet: e.target.value })
          }
        />
        {errors.invoiceStreet && (
          <p className="error-text">{errors.invoiceStreet}</p>
        )}
      </div>

      <div className="form-group">
        <label className="label">Anschrift Zusatz (Etage, Region …)</label>
        <input
          className="input"
          type="text"
          placeholder="z. B. 3. OG, Flügel B"
          value={form.invoiceExtra || ""}
          onChange={(e) =>
            setForm({ ...form, invoiceExtra: e.target.value })
          }
        />
      </div>

      <div className="form-group">
        <label className="label">PLZ / Ort *</label>
        <input
          className="input"
          type="text"
          placeholder="10115 Berlin"
          value={form.invoiceZipCity || ""}
          onChange={(e) =>
            setForm({ ...form, invoiceZipCity: e.target.value })
          }
        />
        {errors.invoiceZipCity && (
          <p className="error-text">{errors.invoiceZipCity}</p>
        )}
      </div>

      {/* Lieferadresse */}
      <div className="form-group">
        <label className="check">
          <input
            type="checkbox"
            checked={!!form.deliveryDifferent}
            onChange={(e) =>
              setForm({
                ...form,
                deliveryDifferent: e.target.checked,
              })
            }
          />
          <span>Lieferadresse abweichend</span>
        </label>
      </div>

      {form.deliveryDifferent && (
        <>
          <div className="form-group">
            <label className="label">Lieferadresse</label>
            <input
              className="input"
              type="text"
              placeholder="Straße, Hausnummer, PLZ/Ort"
              value={form.deliveryAddress || ""}
              onChange={(e) =>
                setForm({ ...form, deliveryAddress: e.target.value })
              }
            />
          </div>

          <div className="form-group">
            <label className="label">
              Besonderheiten (Stockwerk, Zugang, etc.)
            </label>
            <textarea
              className="textarea"
              placeholder="z. B. 4. OG ohne Aufzug, Zugang über Hof"
              value={form.deliveryNotes || ""}
              onChange={(e) =>
                setForm({ ...form, deliveryNotes: e.target.value })
              }
            />
          </div>
        </>
      )}

      <div className="note" style={{ marginTop: "16px" }}>
        Wir nutzen deine Angaben nur für die Angebotserstellung und schicken
        dir eine Bestätigung per E-Mail.
      </div>
    </section>
  );
}