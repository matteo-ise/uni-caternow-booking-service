// Admin dashboard overview — daily orders, leads, and status management.
import { useState } from 'react'

export default function OverviewSubTab({
  overviewData, overviewDate, overviewLoading,
  onDateChange, onFetch, onUpdateOrderStatus, onLeadClick
}) {

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      {/* Date Filter Bar */}
      <div style={{
        background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px',
        padding: '16px 20px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap'
      }}>
        <label style={{ fontWeight: 700, fontSize: '0.9rem', color: '#475569' }}>Datum:</label>
        <input
          type="date"
          value={overviewDate}
          onChange={e => { onDateChange(e.target.value); onFetch(e.target.value) }}
          style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.9rem', fontFamily: 'Montserrat, sans-serif' }}
        />
        <button
          onClick={() => onFetch(overviewDate)}
          style={{ background: '#037A8B', color: '#fff', padding: '8px 16px', borderRadius: '8px', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' }}
        >
          Laden
        </button>
        <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>{overviewData.length} Einträge</span>
      </div>

      {overviewLoading && <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>Lade Bestellungen...</div>}

      {!overviewLoading && overviewData.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px', background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', color: '#94a3b8' }}>
          Keine Einträge für diesen Tag.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '20px' }}>
        {overviewData.map(item => {
          const wiz = item.wizard_data || {}
          const menuItems = item.menu || {}
          const sc = item.sidecar || {}
          return (
            <div
              key={item.checkout_id}
              onClick={() => onLeadClick(item.lead_id)}
              style={{
                background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px',
                display: 'flex', flexDirection: 'column', gap: '12px', cursor: 'pointer',
                transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(3,122,139,0.15)'; e.currentTarget.style.borderColor = '#037A8B' }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = '#e2e8f0' }}
            >
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  {sc.logo_url && (
                    <img src={sc.logo_url} alt="Logo" style={{ height: '28px', objectFit: 'contain' }} onError={e => { e.target.style.display = 'none' }} />
                  )}
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>{sc.company_name || wiz.companyName || 'Privatkunde'}</div>
                    {sc.hq_address && <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{sc.hq_address}</div>}
                  </div>
                </div>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8', textAlign: 'right', flexShrink: 0, marginLeft: '8px' }}>
                  {item.created_at ? new Date(item.created_at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                </div>
              </div>

              {/* Event Meta */}
              <div style={{ display: 'flex', gap: '16px', fontSize: '0.82rem', color: '#475569' }}>
                {wiz.persons && <span>👥 {wiz.persons} Personen</span>}
                {item.total_price && <span>💰 {item.total_price.toFixed(2)} €</span>}
                {wiz.budget && <span>Budget: {wiz.budget}</span>}
              </div>

              {/* Menu */}
              <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '10px', fontSize: '0.8rem', lineHeight: '1.6' }}>
                {menuItems.vorspeise && <div>🥗 <strong>Vorspeise:</strong> {typeof menuItems.vorspeise === 'string' ? menuItems.vorspeise : menuItems.vorspeise?.name}</div>}
                {menuItems.hauptspeise1 && <div>🍖 <strong>HP1:</strong> {typeof menuItems.hauptspeise1 === 'string' ? menuItems.hauptspeise1 : menuItems.hauptspeise1?.name}</div>}
                {menuItems.hauptspeise2 && <div>🍽️ <strong>HP2:</strong> {typeof menuItems.hauptspeise2 === 'string' ? menuItems.hauptspeise2 : menuItems.hauptspeise2?.name}</div>}
                {menuItems.nachspeise && <div>🍮 <strong>Dessert:</strong> {typeof menuItems.nachspeise === 'string' ? menuItems.nachspeise : menuItems.nachspeise?.name}</div>}
              </div>

              {/* Custom Wish */}
              {item.custom_wish && (
                <div style={{ fontSize: '0.8rem', color: '#475569', fontStyle: 'italic' }}>✍️ „{item.custom_wish}"</div>
              )}

              {/* Footer */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '10px' }}>
                <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>#{item.checkout_id?.slice(0, 8)}</span>
                {item.order_id ? (
                  <select
                    value={item.status}
                    onClick={e => e.stopPropagation()}
                    onChange={e => { e.stopPropagation(); onUpdateOrderStatus(item.order_id, e.target.value) }}
                    style={{
                      background: item.status === 'neu' ? '#dcfce7' : item.status === 'abgeschlossen' ? '#e2e8f0' : item.status === 'storniert' ? '#fee2e2' : '#fef08a',
                      color: item.status === 'neu' ? '#166534' : item.status === 'abgeschlossen' ? '#475569' : item.status === 'storniert' ? '#991b1b' : '#854d0e',
                      padding: '4px 10px', borderRadius: '8px', border: '1px solid transparent',
                      fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', outline: 'none'
                    }}
                  >
                    <option value="neu">Neu</option>
                    <option value="in bearbeitung">In Bearbeitung</option>
                    <option value="angebot versendet">Angebot versendet</option>
                    <option value="abgeschlossen">Abgeschlossen</option>
                    <option value="storniert">Storniert</option>
                  </select>
                ) : (
                  <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontStyle: 'italic' }}>Kein Auftrag</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
