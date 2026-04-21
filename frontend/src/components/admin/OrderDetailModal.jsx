export default function OrderDetailModal({ order, onClose, onStatusChange }) {
  if (!order) return null

  const od = order.order_data || {}
  const menu = od.menu || {}
  const wizard = od.wizard || od.wizard_data || {}
  const services = od.selected_services || od.services || []
  const customWish = od.custom_wish || od.customWish || ''

  const formatCurrency = (n) => n != null ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n) : '—'
  const formatDate = (d) => d ? new Date(d).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

  const statusColors = {
    'neu': { bg: '#dcfce7', color: '#166534' },
    'in bearbeitung': { bg: '#fef08a', color: '#854d0e' },
    'angebot versendet': { bg: '#e0f2fe', color: '#0369a1' },
    'abgeschlossen': { bg: '#e2e8f0', color: '#475569' },
    'storniert': { bg: '#fee2e2', color: '#991b1b' },
  }
  const sc = statusColors[order.status] || { bg: '#f1f5f9', color: '#64748b' }

  // Extract dish items from menu
  const dishSlots = [
    { key: 'vorspeise', label: 'Vorspeise', emoji: '🥗' },
    { key: 'hauptspeise1', label: 'Hauptgericht 1', emoji: '🍖' },
    { key: 'hauptgericht1', label: 'Hauptgericht 1', emoji: '🍖' },
    { key: 'hauptspeise2', label: 'Hauptgericht 2', emoji: '🍽️' },
    { key: 'hauptgericht2', label: 'Hauptgericht 2', emoji: '🍽️' },
    { key: 'nachspeise', label: 'Dessert', emoji: '🍮' },
    { key: 'dessert', label: 'Dessert', emoji: '🍮' },
  ]

  const renderedSlots = new Set()
  const menuDishes = dishSlots.filter(slot => {
    const val = menu[slot.key]
    if (!val || renderedSlots.has(slot.label)) return false
    renderedSlots.add(slot.label)
    return true
  }).map(slot => {
    const val = menu[slot.key]
    const name = typeof val === 'string' ? val : (val?.name || val?.dish_name || '—')
    const preis = val?.preis || val?.price || null
    return { ...slot, name, preis }
  })

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0, width: '640px', maxWidth: '100vw',
      background: '#fff', boxShadow: '-8px 0 30px rgba(0,0,0,0.15)', zIndex: 1000,
      display: 'flex', flexDirection: 'column', overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        padding: '20px 24px', borderBottom: '1px solid #e2e8f0',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#64748b', padding: '4px 8px' }}>←</button>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.2rem' }}>Bestellung #{order.id}</div>
            <div style={{ fontSize: '0.82rem', color: '#64748b' }}>{order.lead_id}</div>
          </div>
        </div>
        <select
          value={order.status}
          onChange={e => onStatusChange(order.id, e.target.value)}
          style={{
            background: sc.bg, color: sc.color,
            padding: '8px 14px', borderRadius: '8px', border: '1px solid transparent',
            fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', outline: 'none'
          }}
        >
          <option value="neu">Neu</option>
          <option value="in bearbeitung">In Bearbeitung</option>
          <option value="angebot versendet">Angebot versendet</option>
          <option value="abgeschlossen">Abgeschlossen</option>
          <option value="storniert">Storniert</option>
        </select>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* Summary Card */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
          <InfoBox label="Gesamtpreis" value={formatCurrency(order.total_price)} highlight />
          <InfoBox label="Datum" value={formatDate(order.created_at)} />
          <InfoBox label="Personen" value={wizard.persons || wizard.guestCount || od.persons || '—'} />
        </div>

        {/* Menu / Dishes */}
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem', fontWeight: 700 }}>Bestellte Gerichte</h3>
          {menuDishes.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {menuDishes.map((dish, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '14px 16px', background: '#f8fafc', borderRadius: '10px',
                  border: '1px solid #e2e8f0'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '1.4rem' }}>{dish.emoji}</span>
                    <div>
                      <div style={{ fontSize: '0.78rem', color: '#037A8B', fontWeight: 700, textTransform: 'uppercase', marginBottom: '2px' }}>{dish.label}</div>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{dish.name}</div>
                    </div>
                  </div>
                  {dish.preis && (
                    <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.95rem' }}>
                      {formatCurrency(dish.preis)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.85rem' }}>
              Keine Gerichte-Details in den Bestelldaten vorhanden.
            </div>
          )}
        </div>

        {/* Services */}
        {services.length > 0 && (
          <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '1rem', fontWeight: 700 }}>Zusatzleistungen</h3>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {services.map((s, i) => (
                <span key={i} style={{
                  background: '#e0f2fe', color: '#0369a1', padding: '6px 14px',
                  borderRadius: '20px', fontSize: '0.82rem', fontWeight: 600
                }}>
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Custom Wish */}
        {customWish && (
          <div style={{ background: '#fffbeb', borderRadius: '12px', border: '1px solid #fef3c7', padding: '20px' }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '1rem', fontWeight: 700 }}>Sonderwunsch</h3>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#92400e', lineHeight: '1.5', fontStyle: 'italic' }}>
              „{customWish}"
            </p>
          </div>
        )}

        {/* Event Details */}
        {(wizard.budget || wizard.date || wizard.companyName || wizard.eventType) && (
          <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '1rem', fontWeight: 700 }}>Event-Details</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
              {wizard.companyName && <DetailRow label="Firma" value={wizard.companyName} />}
              {wizard.eventType && <DetailRow label="Event-Typ" value={wizard.eventType} />}
              {wizard.date && <DetailRow label="Event-Datum" value={wizard.date} />}
              {wizard.budget && <DetailRow label="Budget" value={wizard.budget} />}
              {wizard.location && <DetailRow label="Ort" value={wizard.location} />}
              {wizard.customerType && <DetailRow label="Kundentyp" value={wizard.customerType} />}
            </div>
          </div>
        )}

        {/* Raw Order Data (collapsed) */}
        <details style={{ background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '16px' }}>
          <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', color: '#64748b' }}>
            Rohdaten (JSON)
          </summary>
          <pre style={{
            marginTop: '12px', fontSize: '0.78rem', color: '#475569', lineHeight: '1.5',
            whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: '300px', overflow: 'auto'
          }}>
            {JSON.stringify(od, null, 2)}
          </pre>
        </details>
      </div>

      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', top: 0, left: 0, bottom: 0, right: '640px',
          background: 'rgba(0,0,0,0.3)', zIndex: -1
        }}
      />
    </div>
  )
}

function InfoBox({ label, value, highlight }) {
  return (
    <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '14px', border: '1px solid #e2e8f0' }}>
      <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, marginBottom: '4px' }}>{label}</div>
      <div style={{
        fontSize: highlight ? '1.3rem' : '1rem',
        fontWeight: 700,
        color: highlight ? '#037A8B' : '#0f172a'
      }}>
        {value}
      </div>
    </div>
  )
}

function DetailRow({ label, value }) {
  return (
    <div style={{ padding: '8px 0' }}>
      <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>{value}</div>
    </div>
  )
}
