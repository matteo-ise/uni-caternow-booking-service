import { useState, useEffect, useMemo } from 'react'
import { API_URL } from '../../config'
import DishImage from './DishImage'

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
        <span className="acc-icon">{open ? "-" : "+"}</span>
      </button>
      {open && <div className="acc-body">{children}</div>}
    </div>
  );
}

export default function Step4Final({ menu, selectedServices, wizardData, onSubmit, userEmail, userName, leadId }) {
  const [editing, setEditing] = useState(false)
  const [local, setLocal]     = useState({ ...wizardData })
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Delivery Setup State
  const [withSetup, setWithSetup] = useState(true)
  
  // Storytelling State
  const [story, setStory] = useState('Lade deine persönliche Menü-Story...')
  
  // Kontaktdaten
  const [name, setName] = useState(userName || '')
  const [email, setEmail] = useState(userEmail || '')
  const [address, setAddress] = useState('')
  const [additionalNotes, setAdditionalNotes] = useState('')
  const [isAiAddress] = useState(wizardData.customerType === 'business' && !!wizardData.companyName)
  const [addressGlow, setAddressGlow] = useState(false)

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
        const resp = await fetch(`${API_URL}/api/checkout/story`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lead_id: leadId })
        })
        if (resp.ok) {
          const data = await resp.json()
          setStory(data.story)
          if (data.hq_address && (address === '' || address.includes('Musterstraße 1'))) {
            setAddress(data.hq_address)
            setAddressGlow(true)
            setTimeout(() => setAddressGlow(false), 2000)
          }
          if (data.logo_url) {
            setLocal(prev => ({ ...prev, companyLogo: data.logo_url }))
          }
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
    : '-'
  
  const canSubmit = email.trim() !== '' && address.trim() !== '' && name.trim() !== '' && !editing && !isSubmitting

  const handleFinalSubmit = async () => {
    if (isSubmitting) return
    setIsSubmitting(true)

    const finalData = {
      ...display,
      name,
      email,
      address,
      additionalNotes,
      totalPrice: priceStats.total,
      deliveryWithSetup: withSetup
    }
    
    try {
      await onSubmit(finalData)
    } catch (err) {
      console.error(err)
      // Wir setzen isSubmitting nur zurück wenn es fehlgeschlagen ist, 
      // damit der User es nochmal probieren kann.
      setIsSubmitting(false)
    }
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
            <button className="final__edit-save" onClick={() => setEditing(false)}>
              ✓ Speichern
            </button>
          </>
        ) : (
          <>
            <span>📅 {dateFormatted}</span>
            <button className="final__edit-btn" onClick={() => setEditing(true)} title="Datum bearbeiten">
              ✏️ Ändern
            </button>
          </>
        )}
      </div>

      <h2 className="final__title" style={{ fontWeight: 800 }}>Zusammenfassung & Abschluss</h2>

      <div className="final__two-col">
        {/* Left Col: Menu */}
        <div>
          <h3 style={{ marginBottom: '16px', fontSize: '1.1rem', fontWeight: 700 }}>🍽️ Dein gewähltes Menü</h3>
          <div className="final__grid" style={{ gridTemplateColumns: '1fr', gap: '16px' }}>
            {COURSE_META.map(course => {
              const dish = menu[course.key]
              if (!dish && course.key === 'hauptspeise2') return null
              
              const dishName = dish && typeof dish === 'object' ? dish.name : (dish || '-')
              
              return (
                <div key={course.key} style={{ display: 'flex', gap: '16px', background: '#fff', padding: '12px', borderRadius: '12px', border: '1px solid #eef2f6' }}>
                  <div style={{ width: '80px', height: '60px', borderRadius: '8px', overflow: 'hidden' }}>
                    <DishImage 
                      src={dish?.image_url} 
                      alt={dishName} 
                      category={course.key.includes('hauptspeise') ? 'hauptgericht' : course.key}
                      style={{ width: '100%', height: '100%' }}
                    />
                  </div>
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
                className={addressGlow ? 'ai-glow-pulse' : ''}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', minHeight: '60px', resize: 'vertical', transition: 'all 0.3s ease' }}
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
            <p><strong>Firma:</strong> {wizardData.companyName || '-'}</p>
            <p><strong>Kundentyp:</strong> {wizardData.customerType === 'business' ? 'B2B' : 'B2C'}</p>
            <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '8px' }}>Unsere KI hat Ihr Profil analysiert, um dieses Angebot zu personalisieren.</p>
          </Accordion>
        </div>
      </div>

      {/* ── Story at the bottom ──────────────────────────── */}
      <div style={{ marginTop: '40px', background: '#f0fdfa', padding: '32px', borderRadius: '24px', border: '1px solid #037A8B', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        {local.companyLogo && (
          <img src={local.companyLogo} alt="Firmenlogo" style={{ height: '40px', marginBottom: '16px', objectFit: 'contain' }} />
        )}
        <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#037A8B', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          ✨ Deine persönliche Menü-Story
        </h3>
        <p style={{ fontStyle: 'italic', fontSize: '1.1rem', color: '#1e293b', lineHeight: '1.6', maxWidth: '800px', margin: '0 auto' }}>
          "{story}"
        </p>
      </div>

      {/* Easter Egg / Osterei - Outside the box */}
      <div className="easter-egg-container" style={{ marginTop: '40px', textAlign: 'center' }}>
        <div className="pulsing-egg" style={{ fontSize: '4rem', cursor: 'pointer', display: 'inline-block' }} title="Happy Easter!">
          🥚✨
        </div>
        <p style={{ fontSize: '1.2rem', color: '#037A8B', fontWeight: 800, marginTop: '12px', textTransform: 'uppercase', letterSpacing: '0.15em' }}>
          Happy Easter
        </p>
      </div>

      <style>{`
        .loading-spinner {
          width: 18px;
          height: 18px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .pulsing-egg {
          animation: egg-float 3s infinite ease-in-out;
        }
        @keyframes egg-float {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-15px) rotate(8deg); }
        }
        .ai-glow-pulse {
          animation: ai-glow 1s ease-in-out infinite alternate;
          border-color: #037A8B !important;
          box-shadow: 0 0 15px rgba(3, 122, 139, 0.4);
          background-color: #f0fdfa !important;
        }
        @keyframes ai-glow {
          from { box-shadow: 0 0 5px rgba(3, 122, 139, 0.2); }
          to { box-shadow: 0 0 20px rgba(3, 122, 139, 0.6); }
        }
      `}</style>

      {/* ── Absenden ─────────────────────────────────────────── */}
      <div className="final__footer">
        <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: 0 }}>* Pflichtfelder. Bitte fülle Name, E-Mail und Adresse aus.</p>
        <button 
          className={`btn-filled btn-filled--lg ${!canSubmit ? 'btn-disabled' : ''}`} 
          onClick={handleFinalSubmit} 
          disabled={!canSubmit}
          style={{ width: '100%', maxWidth: '400px' }}
        >
          {isSubmitting ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
              <span className="loading-spinner"></span>
              Anfrage wird gesendet...
            </span>
          ) : (
            `Jetzt anfragen: ${priceStats.total.toFixed(2)} € →`
          )}
        </button>
      </div>
    </div>
  )
}
