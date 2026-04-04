import { useState, useEffect, useMemo } from 'react'

const COURSE_META = [
  { key: 'vorspeise',    label: 'Vorspeise',     fallbackImg: 'https://images.unsplash.com/photo-1626808642875-0aa545482dfb?auto=format&fit=crop&w=480&q=80' },
  { key: 'hauptspeise1', label: 'Hauptspeise 1', fallbackImg: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=480&q=80' },
  { key: 'hauptspeise2', label: 'Hauptspeise 2', fallbackImg: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=480&q=80' },
  { key: 'nachspeise',   label: 'Nachspeise',    fallbackImg: 'https://images.unsplash.com/photo-1563805042-7684c8e9e5cb?auto=format&fit=crop&w=480&q=80' },
]

const SERVICE_ICONS = { 
  'Geschirr/Besteck': '🍴', 
  'Gläser': '🍷', 
  'Dekoration': '🌸', 
  'Personal (z. B. Servicekräfte, Barkeeper)': '🤵', 
  'Mietmöbel (z. B. Tische, Stühle)': '🪑' 
}
const DELIVERY_FEE = 25.00
const SETUP_FEE = 45.00 // Zusätzliche Gebühr für Auf/Abbau
const VAT_RATE = 0.19 // 19% MwSt

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

export default function Step4Final({ menu, selectedServices, wizardData, onSubmit, userEmail, userName, leadId }) {
  const [editing, setEditing] = useState(false)
  const [local, setLocal]     = useState({ ...wizardData })
  
  // Delivery Setup State
  const [withSetup, setWithSetup] = useState(true)
  
  // Storytelling State
  const [story, setStory] = useState('Lade deine persönliche Menü-Story...')
  
  // Kontaktdaten
  const [name, setName] = useState(userName || '')
  const [email, setEmail] = useState(userEmail || '')
  const [address, setAddress] = useState(wizardData.customerType === 'business' && wizardData.companyName ? `${wizardData.companyName} Headquarters, Musterstraße 1, Berlin` : '')
  const [additionalNotes, setAdditionalNotes] = useState('')
  const [isAiAddress] = useState(wizardData.customerType === 'business' && !!wizardData.companyName)

  // Quantities logic
  const participantCount = parseInt(wizardData.persons) || 0
  const hasTwoMains = !!menu.hauptspeise1 && !!menu.hauptspeise2

  const [quantities, setQuantities] = useState({
    vorspeise: participantCount,
    hauptspeise1: hasTwoMains ? Math.ceil(participantCount / 2) : participantCount,
    hauptspeise2: hasTwoMains ? Math.floor(participantCount / 2) : 0,
    nachspeise: participantCount
  })

  // Calculation
  const priceStats = useMemo(() => {
    let subtotal = 0
    const items = []

    COURSE_META.forEach(course => {
      const dish = menu[course.key]
      if (dish) {
        const qty = quantities[course.key] || 0
        const price = dish.preis || 15.0 // Fallback price
        const itemTotal = qty * price
        subtotal += itemTotal
        items.push({ label: dish.name || course.label, qty, price, total: itemTotal })
      }
    })

    const currentDelivery = DELIVERY_FEE + (withSetup ? SETUP_FEE : 0)
    const vat = subtotal * VAT_RATE
    const total = subtotal + vat + currentDelivery

    return { items, subtotal, vat, total, currentDelivery }
  }, [menu, quantities, withSetup])

  // Fetch Story
  useEffect(() => {
    const fetchStory = async () => {
      try {
        const resp = await fetch('http://localhost:8000/api/checkout/story', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lead_id: leadId })
        })
        if (resp.ok) {
          const data = await resp.json()
          setStory(data.story)
        }
      } catch (err) {
        setStory('Dein perfektes Menü ist bereit. Wir freuen uns auf dein Event!')
      }
    }
    if (leadId) fetchStory()
  }, [leadId])

  useEffect(() => {
    if (userEmail && !email) setEmail(userEmail)
    if (userName && !name) setName(userName)
  }, [userEmail, userName])

  function set(field, value) { setLocal(prev => ({ ...prev, [field]: value })) }

  const display = editing ? local : wizardData
  const dateFormatted = display.date
    ? new Date(display.date).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })
    : '–'
  
  const canSubmit = email.trim() !== '' && address.trim() !== '' && name.trim() !== '' && !editing

  const handleFinalSubmit = () => {
    const finalData = {
      ...display,
      name,
      email,
      address,
      additionalNotes,
      totalPrice: priceStats.total,
      deliveryWithSetup: withSetup
    }
    onSubmit(finalData)
  }

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
            <button className="final__edit-save" onClick={() => setEditing(false)}>
              ✓ Speichern
            </button>
          </>
        ) : (
          <>
            <span>📅 {dateFormatted}</span>
            <span>👥 {display.persons} Personen</span>
            <button className="final__edit-btn" onClick={() => setEditing(true)} title="Angaben bearbeiten">
              ✏️ Ändern
            </button>
          </>
        )}
      </div>

      <h2 className="final__title" style={{ fontWeight: 800 }}>Zusammenfassung & Abschluss</h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', marginTop: '32px' }}>
        {/* Left Col: Menu */}
        <div>
          <h3 style={{ marginBottom: '16px', fontSize: '1.1rem', fontWeight: 700 }}>🍽️ Dein gewähltes Menü</h3>
          <div className="final__grid" style={{ gridTemplateColumns: '1fr', gap: '16px' }}>
            {COURSE_META.map(course => {
              const dish = menu[course.key]
              if (!dish && course.key === 'hauptspeise2') return null
              
              const dishName = dish && typeof dish === 'object' ? dish.name : (dish || '–')
              const dishImg = (dish && dish.image_url) ? dish.image_url : course.fallbackImg
              
              return (
                <div key={course.key} style={{ display: 'flex', gap: '16px', background: '#fff', padding: '12px', borderRadius: '12px', border: '1px solid #eef2f6' }}>
                  <img src={dishImg} alt={course.label} style={{ width: '80px', height: '60px', objectFit: 'cover', borderRadius: '8px' }} />
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: '0.7rem', color: '#037A8B', fontWeight: 700, textTransform: 'uppercase' }}>{course.label}</span>
                    <p style={{ fontWeight: 600, margin: '2px 0', fontSize: '0.95rem' }}>{dishName}</p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center' }}>
                    <label style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Anzahl</label>
                    <input 
                      type="number" 
                      value={quantities[course.key] || 0}
                      onChange={(e) => setQuantities(prev => ({ ...prev, [course.key]: parseInt(e.target.value) || 0 }))}
                      style={{ width: '50px', padding: '4px', border: '1px solid #e2e8f0', borderRadius: '4px', textAlign: 'center', fontWeight: 700 }}
                    />
                  </div>
                </div>
              )
            })}
          </div>

          {/* Price Breakdown */}
          <div style={{ marginTop: '24px', background: '#fff', padding: '24px', borderRadius: '16px', border: '1.5px solid #0f172a' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '16px' }}>Kalkulation</h3>
            <div style={{ display: 'grid', gap: '8px', fontSize: '0.9rem' }}>
              {priceStats.items.map((it, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{it.qty}x {it.label}</span>
                  <span style={{ fontWeight: 600 }}>{it.total.toFixed(2)} €</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #f1f5f9', paddingTop: '8px' }}>
                <span>Lieferung {withSetup ? '& Aufbau' : ''}</span>
                <span style={{ fontWeight: 600 }}>{priceStats.currentDelivery.toFixed(2)} €</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', color: '#64748b', fontSize: '0.85rem' }}>
                <span>Zwischensumme (Netto)</span>
                <span>{priceStats.subtotal.toFixed(2)} €</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '0.85rem' }}>
                <span>MwSt. (19%)</span>
                <span>{priceStats.vat.toFixed(2)} €</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', paddingTop: '12px', borderTop: '2px solid #0f172a', fontSize: '1.1rem', fontWeight: 900 }}>
                <span>Gesamtbetrag</span>
                <span>{priceStats.total.toFixed(2)} €</span>
              </div>
              {selectedServices.length > 0 && (
                <p style={{ fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic', marginTop: '12px', textAlign: 'center', borderTop: '1px dashed #e2e8f0', paddingTop: '8px' }}>
                  Zusatzleistungen (Personal, Möbel etc.) werden gesondert nach Aufwand berechnet und erscheinen auf der finalen Rechnung.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Right Col: Details via Accordion */}
        <div>
          <h3 style={{ marginBottom: '16px', fontSize: '1.1rem', fontWeight: 700 }}>📋 Liefer- & Kontaktdaten</h3>
          
          <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#475569', marginBottom: '8px' }}>Name *</label>
              <input 
                type="text" 
                value={name} 
                onChange={e => setName(e.target.value)} 
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                placeholder="Dein voller Name"
              />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#475569', marginBottom: '8px' }}>E-Mail Adresse *</label>
              <input 
                type="email" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                placeholder="deine@email.de"
              />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 700, color: '#475569', marginBottom: '8px' }}>
                Lieferadresse *
                {isAiAddress && <span style={{ background: '#fef08a', color: '#166534', padding: '2px 8px', borderRadius: '12px', fontSize: '0.65rem' }}>✨ AI Filled</span>}
              </label>
              <textarea 
                value={address} 
                onChange={e => setAddress(e.target.value)} 
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', minHeight: '60px', resize: 'vertical' }}
                placeholder="Straße, PLZ, Ort"
              />
            </div>
            
            {/* Delivery Option Selection */}
            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#475569', marginBottom: '12px' }}>
                Wünschen Sie eine Lieferung mit oder ohne Auf- und Abbau? *
              </label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  onClick={() => setWithSetup(true)}
                  style={{ 
                    flex: 1, padding: '10px', borderRadius: '8px', border: '1.5px solid', 
                    borderColor: withSetup ? '#037A8B' : '#e2e8f0',
                    background: withSetup ? '#f0fdfa' : '#fff',
                    color: withSetup ? '#037A8B' : '#64748b',
                    fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer'
                  }}
                >
                  Lieferung (inkl. Aufbau/Abbau)
                </button>
                <button 
                  onClick={() => setWithSetup(false)}
                  style={{ 
                    flex: 1, padding: '10px', borderRadius: '8px', border: '1.5px solid', 
                    borderColor: !withSetup ? '#037A8B' : '#e2e8f0',
                    background: !withSetup ? '#f0fdfa' : '#fff',
                    color: !withSetup ? '#037A8B' : '#64748b',
                    fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer'
                  }}
                >
                  Lieferung (ohne Aufbau/Abbau)
                </button>
              </div>
            </div>
          </div>

          <Accordion title="Services & Logistik" defaultOpen={true}>
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
            <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #f1f5f9', fontSize: '0.85rem' }}>
              <p>Rechnungsstellung erfolgt nach der Veranstaltung. Lieferung {withSetup ? 'erfolgt inklusive professionellem Auf- und Abbau' : 'erfolgt bis zur Bordsteinkante ohne Aufbau'}.</p>
            </div>
            
            <div style={{ marginTop: '20px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#475569', marginBottom: '8px' }}>Zusätzliche Wünsche & Allergien</label>
              <textarea 
                value={additionalNotes} 
                onChange={e => setAdditionalNotes(e.target.value)} 
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', minHeight: '80px', resize: 'vertical' }}
                placeholder="z.B. glutenfreier Nachtisch, vegane Optionen..."
              />
            </div>
          </Accordion>

          <Accordion title="Firmen-Infos (Research Intelligence)">
            <p><strong>Firma:</strong> {wizardData.companyName || '–'}</p>
            <p><strong>Kundentyp:</strong> {wizardData.customerType === 'business' ? 'B2B' : 'B2C'}</p>
            <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '8px' }}>Unsere KI hat Ihr Profil analysiert, um dieses Angebot zu personalisieren.</p>
          </Accordion>
        </div>
      </div>

      {/* ── Story at the bottom ──────────────────────────── */}
      <div style={{ marginTop: '40px', background: '#f0fdfa', padding: '32px', borderRadius: '24px', border: '1px solid #037A8B', textAlign: 'center' }}>
        <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#037A8B', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          ✨ Deine persönliche Menü-Story
        </h3>
        <p style={{ fontStyle: 'italic', fontSize: '1.1rem', color: '#1e293b', lineHeight: '1.6', margin: 0, maxWidth: '800px', margin: '0 auto' }}>
          "{story}"
        </p>
      </div>

      {/* ── Absenden ─────────────────────────────────────────── */}
      <div className="final__footer" style={{ borderTop: '1px solid #eef2f6', paddingTop: '32px', marginTop: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: 0 }}>* Pflichtfelder. Bitte fülle Name, E-Mail und Adresse aus.</p>
        <button 
          className={`btn-filled btn-filled--lg ${!canSubmit ? 'btn-disabled' : ''}`} 
          onClick={handleFinalSubmit} 
          disabled={!canSubmit} 
          style={{ width: 'auto', padding: '16px 48px', opacity: canSubmit ? 1 : 0.5, cursor: canSubmit ? 'pointer' : 'not-allowed' }}
        >
          Jetzt verbindlich anfragen für {priceStats.total.toFixed(2)} € →
        </button>
      </div>
    </div>
  )
}
