import { useState } from 'react'

const BUDGET_OPTIONS = [
  { value: 'economy',  label: 'Economy  –  10–30 € / Person' },
  { value: 'standard', label: 'Standard  –  30–60 € / Person' },
  { value: 'premium',  label: 'Premium  –  60 € + / Person'  },
]

export default function Step1Wizard({ onNext, onClose }) {
  const [data, setData] = useState({
    persons:       '',
    date:          '',
    budget:        '',
    customerType:  'private',
    companyName:   '',
    companyDomain: '',
  })

  const isBusiness = data.customerType === 'business'
  const isValid    = data.persons && data.date && data.budget

  function set(field, value) {
    setData(prev => ({ ...prev, [field]: value }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (isValid) onNext(data)
  }

  return (
    <div className="wizard-wrap">
      <form className="wizard-form" onSubmit={handleSubmit} noValidate>
        <h2 className="wizard-form__title">Erzähl uns von deinem Event</h2>
        <p className="wizard-form__sub">
          Wir brauchen ein paar Details, um das perfekte Menü für dich zusammenzustellen.
        </p>

        <div className="wizard-grid">
          {/* Personenanzahl */}
          <div className="form-field">
            <label className="form-field__label" htmlFor="persons">
              Personenanzahl
            </label>
            <input
              id="persons"
              type="number"
              min="1"
              className="form-field__input"
              placeholder="z.B. 50"
              value={data.persons}
              onChange={e => set('persons', e.target.value)}
              required
            />
          </div>

          {/* Datum */}
          <div className="form-field">
            <label className="form-field__label" htmlFor="date">
              Datum des Events
            </label>
            <input
              id="date"
              type="date"
              className="form-field__input"
              min={new Date().toISOString().split('T')[0]}
              value={data.date}
              onChange={e => set('date', e.target.value)}
              required
            />
          </div>

          {/* Budget */}
          <div className="form-field form-field--full">
            <label className="form-field__label" htmlFor="budget">
              Budget pro Person
            </label>
            <select
              id="budget"
              className="form-field__input form-field__select"
              value={data.budget}
              onChange={e => set('budget', e.target.value)}
              required
            >
              <option value="">Bitte wählen…</option>
              {BUDGET_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Kundentyp */}
          <div className="form-field form-field--full">
            <span className="form-field__label">Kundentyp</span>
            <div className="toggle-row">
              <label className={`toggle-option${data.customerType === 'private' ? ' toggle-option--active' : ''}`}>
                <input
                  type="radio"
                  name="customerType"
                  value="private"
                  checked={data.customerType === 'private'}
                  onChange={() => set('customerType', 'private')}
                />
                Privatkunde
              </label>
              <label className={`toggle-option${data.customerType === 'business' ? ' toggle-option--active' : ''}`}>
                <input
                  type="radio"
                  name="customerType"
                  value="business"
                  checked={data.customerType === 'business'}
                  onChange={() => set('customerType', 'business')}
                />
                Firmenkunde
              </label>
            </div>
          </div>

          {/* Firmendaten (nur wenn business) */}
          {isBusiness && (
            <>
              <div className="form-field">
                <label className="form-field__label" htmlFor="companyName">
                  Firmenname
                </label>
                <input
                  id="companyName"
                  type="text"
                  className="form-field__input"
                  placeholder="Musterfirma GmbH"
                  value={data.companyName}
                  onChange={e => set('companyName', e.target.value)}
                />
              </div>
              <div className="form-field">
                <label className="form-field__label" htmlFor="companyDomain">
                  Domain
                </label>
                <input
                  id="companyDomain"
                  type="text"
                  className="form-field__input"
                  placeholder="musterfirma.de"
                  value={data.companyDomain}
                  onChange={e => set('companyDomain', e.target.value)}
                />
              </div>
            </>
          )}
        </div>

        {/* Buttons */}
        <div className="wizard-actions">
          <button type="button" className="btn-outlined" onClick={onClose}>
            Zurück
          </button>
          <button type="submit" className="btn-filled" disabled={!isValid}>
            Menü selber erstellen →
          </button>
        </div>
      </form>
    </div>
  )
}
