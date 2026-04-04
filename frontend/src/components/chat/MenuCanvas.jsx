import { useState, useEffect } from 'react'

const SECTIONS = [
  { key: 'vorspeise',    label: 'Vorspeise', icon: '🥗', kpi: 'Appetizer' },
  { key: 'hauptspeise1', label: 'Hauptspeise 1', icon: '🍖', kpi: 'Signature' },
  { key: 'hauptspeise2', label: 'Hauptspeise 2', icon: '🍽️', kpi: 'Variation' },
  { key: 'nachspeise',   label: 'Nachspeise', icon: '🍮', kpi: 'Sweet Finish' },
]

export default function MenuCanvas({ menuOptions, menu, onSelect, onConfirm, step }) {
  const [confirmed, setConfirmed] = useState({ vorspeise: false, hauptspeise1: false, hauptspeise2: false, nachspeise: false })
  const [indices, setIndices] = useState({ vorspeise: 0, hauptspeise1: 0, hauptspeise2: 0, nachspeise: 0 })

  const showH2 = menu['hauptgericht2'] || confirmed['hauptspeise1']
  const allFilled = confirmed['vorspeise'] && confirmed['hauptspeise1'] && confirmed['nachspeise']

  const handleNext = (key) => {
    const opts = menuOptions[key] || []
    if (opts.length === 0) return
    const nextIdx = (indices[key] + 1) % opts.length
    setIndices(prev => ({ ...prev, [key]: nextIdx }))
    onSelect(key, opts[nextIdx])
    setConfirmed(prev => ({ ...prev, [key]: false }))
  }

  const handlePrev = (key) => {
    const opts = menuOptions[key] || []
    if (opts.length === 0) return
    const prevIdx = (indices[key] - 1 + opts.length) % opts.length
    setIndices(prev => ({ ...prev, [key]: prevIdx }))
    onSelect(key, opts[prevIdx])
    setConfirmed(prev => ({ ...prev, [key]: false }))
  }

  const toggleConfirm = (key) => {
    setConfirmed(prev => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <div className="canvas">
      <div className="canvas__header">
        <h3 className="canvas__title" style={{ fontWeight: 800 }}>Dein interaktives Menü</h3>
        {allFilled && (
          <span className="canvas__badge" style={{ background: '#037A8B', color: '#fff', padding: '4px 12px', borderRadius: '20px', fontSize: '0.75rem' }}>
            Bereit zur Anfrage ✓
          </span>
        )}
      </div>

      <div className="canvas__sections" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
        {SECTIONS.map(section => {
          if (section.key === 'hauptspeise2' && !showH2) return null
          
          const selected = menu[section.key]
          const isConfirmed = confirmed[section.key]
          const hasOptions = (menuOptions[section.key] || []).length > 1

          return (
            <div
              key={section.key}
              className={`canvas__section ${isConfirmed ? 'canvas__section--filled' : ''}`}
              style={{ 
                opacity: isConfirmed ? 1 : 0.7,
                border: isConfirmed ? '2px solid #037A8B' : '1px solid #eef2f6',
                background: isConfirmed ? '#f0fdfa' : '#fff'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span className="bento-kpi">{section.kpi}</span>
                  <div className="canvas__section-label" style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>{section.icon}</span> {section.label}
                  </div>
                </div>
                <button 
                  onClick={() => toggleConfirm(section.key)}
                  disabled={!selected}
                  style={{
                    background: isConfirmed ? '#037A8B' : 'transparent',
                    color: isConfirmed ? '#fff' : '#037A8B',
                    border: '1px solid #037A8B',
                    padding: '4px 12px',
                    borderRadius: '8px',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {isConfirmed ? 'Geprüft ✓' : 'Bestätigen'}
                </button>
              </div>

              <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                {hasOptions && !isConfirmed && (
                  <button onClick={() => handlePrev(section.key)} className="nav-btn">‹</button>
                )}
                
                <div style={{ flex: 1 }}>
                  {selected ? (
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontWeight: 700, fontSize: '1rem' }}>{selected.name}</div>
                      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                        <div style={{ color: '#64748b', fontSize: '0.8rem' }}>{selected.preis?.toFixed(2)} €</div>
                        {selected.similarity_score && (
                          <div style={{ 
                            background: '#f0fdf4', 
                            color: '#166534', 
                            fontSize: '0.65rem', 
                            padding: '2px 6px', 
                            borderRadius: '4px', 
                            fontWeight: 700,
                            border: '1px solid #bbf7d0'
                          }}>
                            {(selected.similarity_score * 100).toFixed(0)}% AI Match
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div style={{ color: '#94a3b8', fontSize: '0.8rem', textAlign: 'center' }}>KI wählt aus...</div>
                  )}
                </div>

                {hasOptions && !isConfirmed && (
                  <button onClick={() => handleNext(section.key)} className="nav-btn">›</button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {step === 2 && (
        <div style={{ padding: '20px' }}>
          <button
            className={`canvas__confirm-btn ${allFilled ? 'canvas__confirm-btn--active' : ''}`}
            disabled={!allFilled}
            onClick={onConfirm}
            style={{ width: '100%', padding: '16px', borderRadius: '12px', fontWeight: 800, background: allFilled ? '#037A8B' : '#e2e8f0' }}
          >
            Menü verbindlich anfragen
          </button>
        </div>
      )}

      <style jsx>{`
        .nav-btn {
          background: #f1f5f9;
          border: none;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-weight: 800;
          color: #037A8B;
        }
        .nav-btn:hover { background: #e2e8f0; }
      `}</style>
    </div>
  )
}
