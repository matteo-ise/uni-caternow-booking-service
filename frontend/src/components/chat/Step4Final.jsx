import { useState } from 'react'

const COURSE_META = [
  { key: 'vorspeise',    label: 'Vorspeise',     img: 'https://placehold.co/480x280/037A8B/ffffff?text=Vorspeise' },
  { key: 'hauptspeise1', label: 'Hauptspeise 1', img: 'https://placehold.co/480x280/026373/ffffff?text=Hauptspeise+1' },
  { key: 'hauptspeise2', label: 'Hauptspeise 2', img: 'https://placehold.co/480x280/2A9D8F/ffffff?text=Hauptspeise+2' },
  { key: 'nachspeise',   label: 'Nachspeise',    img: 'https://placehold.co/480x280/0f172a/ffffff?text=Nachspeise' },
]

const SERVICE_ICONS = { 'Geschirr': '🍴', 'Kellner': '🤵', 'Dekoration': '🌸' }

const BUDGET_OPTIONS = [
  { value: 'economy',  label: 'Economy (10–30 €)' },
  { value: 'standard', label: 'Standard (30–60 €)' },
  { value: 'premium',  label: 'Premium (60 €+)' },
]

const TODAY = new Date().toISOString().split('T')[0]

function Accordion({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="acc">
      <button
        type="button"
        className="acc-head"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span>{title}</span>
        <span className="acc-icon">{open ? "–" : "+"}</span>
      </button>
      {open && <div className="acc-body">{children}</div>}
    </div>
  );
}

export default function Step4Final({ menu, selectedServices, wizardData, onSubmit }) {
  const [editing, setEditing] = useState(false)
  const [local, setLocal]     = useState({ ...wizardData })

  function set(field, value) { setLocal(prev => ({ ...prev, [field]: value })) }

  const display = editing ? local : wizardData
  const dateFormatted = display.date
    ? new Date(display.date).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })
    : '–'
  const budgetLabel = BUDGET_OPTIONS.find(o => o.value === display.budget)?.label ?? '–'

  return (
    <div className="final">
      {/* ── Summary Bar ──────────────────────────────────────── */}
      <div className={`final__summary-bar${editing ? ' final__summary-bar--editing' : ''}`}>
        {editing ? (
          <>
            <label className="final__edit-field">
              <span>📅</span>
              <input
                type="date"
                min={TODAY}
                value={local.date}
                onChange={e => set('date', e.target.value)}
                className="final__edit-input"
              />
            </label>
            <label className="final__edit-field">
              <span>👥</span>
              <input
                type="number"
                min="1"
                value={local.persons}
                onChange={e => set('persons', e.target.value)}
                className="final__edit-input final__edit-input--sm"
                placeholder="Personen"
              />
            </label>
            <label className="final__edit-field">
              <span>💰</span>
              <select
                value={local.budget}
                onChange={e => set('budget', e.target.value)}
                className="final__edit-input"
              >
                {BUDGET_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
            <button className="final__edit-save" onClick={() => setEditing(false)}>
              ✓ Speichern
            </button>
          </>
        ) : (
          <>
            <span>📅 {dateFormatted}</span>
            <span>👥 {display.persons} Personen</span>
            <span>💰 {budgetLabel}</span>
            <button className="final__edit-btn" onClick={() => setEditing(true)} title="Angaben bearbeiten">
              ✏️ Ändern
            </button>
          </>
        )}
      </div>

      <h2 className="final__title" style={{ fontWeight: 800 }}>Zusammenfassung deiner Anfrage</h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', marginTop: '32px' }}>
        {/* Left Col: Menu */}
        <div>
          <h3 style={{ marginBottom: '16px', fontSize: '1.1rem', fontWeight: 700 }}>🍽️ Dein gewähltes Menü</h3>
          <div className="final__grid" style={{ gridTemplateColumns: '1fr', gap: '16px' }}>
            {COURSE_META.map(course => {
              const dish = menu[course.key]
              const dishName = dish && typeof dish === 'object' ? dish.name : (dish || '–')
              return (
                <div key={course.key} style={{ display: 'flex', gap: '16px', background: '#fff', padding: '12px', borderRadius: '12px', border: '1px solid #eef2f6' }}>
                  <img src={course.img} alt={course.label} style={{ width: '80px', height: '60px', objectFit: 'cover', borderRadius: '8px' }} />
                  <div>
                    <span style={{ fontSize: '0.7rem', color: '#037A8B', fontWeight: 700, textTransform: 'uppercase' }}>{course.label}</span>
                    <p style={{ fontWeight: 600, margin: 0 }}>{dishName}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right Col: Details via Accordion */}
        <div>
          <h3 style={{ marginBottom: '16px', fontSize: '1.1rem', fontWeight: 700 }}>📋 Weitere Details</h3>
          
          <Accordion title="Services & Add-ons" defaultOpen={true}>
            {selectedServices.length > 0 ? (
              <div className="final__services-list">
                {selectedServices.map(s => (
                  <span key={s} className="final__service-tag">
                    {SERVICE_ICONS[s] || '✓'} {s}
                  </span>
                ))}
              </div>
            ) : (
              <p>Keine zusätzlichen Services ausgewählt.</p>
            )}
          </Accordion>

          <Accordion title="Firmen-Infos (Research Intelligence)">
            <p><strong>Firma:</strong> {wizardData.companyName || '–'}</p>
            <p><strong>Kundentyp:</strong> {wizardData.customerType === 'business' ? 'B2B' : 'B2C'}</p>
            <p>Unsere KI hat Ihr Profil analysiert, um dieses Angebot zu personalisieren.</p>
          </Accordion>

          <Accordion title="Zahlung & Logistik">
            <p>Rechnungsstellung erfolgt nach der Veranstaltung.</p>
            <p>Lieferung und Aufbau sind im Grundpreis enthalten.</p>
          </Accordion>
        </div>
      </div>

      {/* ── Absenden ─────────────────────────────────────────── */}
      <div className="final__footer" style={{ borderTop: '1px solid #eef2f6', paddingTop: '32px' }}>
        <button className="btn-filled btn-filled--lg" onClick={onSubmit} disabled={editing} style={{ width: 'auto', padding: '16px 48px' }}>
          Jetzt unverbindlich anfragen →
        </button>
      </div>
    </div>
  )
}

