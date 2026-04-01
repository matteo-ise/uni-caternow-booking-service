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

      <h2 className="final__title">Dein perfektes Menü</h2>

      {/* ── Menü-Karten ──────────────────────────────────────── */}
      <div className="final__grid">
        {COURSE_META.map(course => {
          const dish = menu[course.key]
          const displayDish = dish === '__suggest__' ? 'Individuelle Absprache' : (dish || '–')
          return (
            <div key={course.key} className="final__card">
              <img src={course.img} alt={course.label} className="final__card-img" />
              <div className="final__card-body">
                <span className="final__card-course">{course.label}</span>
                <p className="final__card-dish">{displayDish}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Services ─────────────────────────────────────────── */}
      {selectedServices.length > 0 && (
        <div className="final__services">
          <h3 className="final__services-title">Gebuchte Services</h3>
          <div className="final__services-list">
            {selectedServices.map(s => (
              <span key={s} className="final__service-tag">
                {SERVICE_ICONS[s] || '✓'} {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Absenden ─────────────────────────────────────────── */}
      <div className="final__footer">
        <button className="btn-filled btn-filled--lg" onClick={onSubmit} disabled={editing}>
          Anfrage absenden →
        </button>
      </div>
    </div>
  )
}
