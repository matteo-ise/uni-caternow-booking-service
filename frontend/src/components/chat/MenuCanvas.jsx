import { useState, useEffect, useCallback } from 'react'
import DishImage from './DishImage'

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768)
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  return isMobile
}

const SECTIONS = [
  { key: 'vorspeise',    label: 'Vorspeise', icon: '🥗', kpi: 'Appetizer' },
  { key: 'hauptspeise1', label: 'Hauptspeise 1', icon: '🍖', kpi: 'Signature' },
  { key: 'hauptspeise2', label: 'Hauptspeise 2', icon: '🍽️', kpi: 'Variation' },
  { key: 'nachspeise',   label: 'Nachspeise', icon: '🍮', kpi: 'Sweet Finish' },
]

export default function MenuCanvas({ menuOptions, menu, onSelect, onConfirm, step, onWeiter }) {
  const isMobile = useIsMobile()
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
    const newState = !confirmed[key]
    setConfirmed(prev => ({ ...prev, [key]: newState }))
    
    // Wenn Hauptspeise 1 bestätigt wurde, benachrichtige den Chat für Upselling
    if (key === 'hauptspeise1' && newState && onSelect) {
      onSelect('TRIGGER_UPSELL', true)
    }
  }

  // ── Compact mobile strip ────────────────────────────────
  if (isMobile) {
    const allConfirmedMobile = confirmed['vorspeise'] && confirmed['hauptspeise1'] && confirmed['nachspeise']
    return (
      <div className="canvas-mobile-strip">
        <div className="canvas-mobile-chips">
          {SECTIONS.map(section => {
            if (section.key === 'hauptspeise2' && !showH2) return null
            const selected = menu[section.key]
            const isConf = confirmed[section.key]
            return (
              <div
                key={section.key}
                className={`canvas-chip ${selected ? 'canvas-chip--active' : ''} ${isConf ? 'canvas-chip--confirmed' : ''}`}
                onClick={() => selected && toggleConfirm(section.key)}
                title={selected ? (isConf ? 'Auswahl bestätigt' : 'Tippen zum Bestätigen') : ''}
              >
                <span className="canvas-chip__icon">{section.icon}</span>
                <span className="canvas-chip__label">
                  {selected && !isConf ? '👉 Bestätigen' : section.kpi}
                </span>
                <span className="canvas-chip__name">
                  {selected ? selected.name : '—'}
                </span>
                {isConf && <span className="canvas-chip__check">✓</span>}
              </div>
            )
          })}
          {step === 2 && allConfirmedMobile && (
            <button className="canvas-chip canvas-chip--cta" onClick={onConfirm}>
              <span className="canvas-chip__icon">🎉</span>
              <span className="canvas-chip__label">Fertig</span>
              <span className="canvas-chip__name">Anfragen</span>
            </button>
          )}
          {step === 3 && onWeiter && (
            <button className="canvas-chip canvas-chip--cta" onClick={onWeiter}>
              <span className="canvas-chip__icon">→</span>
              <span className="canvas-chip__label">Weiter</span>
              <span className="canvas-chip__name">Prüfen</span>
            </button>
          )}
        </div>
      </div>
    )
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
          
          const selected   = menu[section.key]
          const isConfirmed = confirmed[section.key]
          const hasOptions = (menuOptions[section.key] || []).length > 1

          // Inaktiver Status: Weder ausgewählt noch bestätigt
          const isActive = !!selected

          return (
            <div
              key={section.key}
              className={`canvas__section ${isConfirmed ? 'canvas__section--filled' : ''}`}
              style={{ 
                opacity: isConfirmed ? 1 : (isActive ? 0.9 : 0.5),
                border: isConfirmed ? '2px solid #037A8B' : (isActive ? '1.5px solid #037A8B' : '1.5px solid #e2e8f0'),
                background: isConfirmed ? '#f0fdfa' : (isActive ? '#fff' : '#f8fafc'),
                filter: isActive || isConfirmed ? 'none' : 'grayscale(0.8)',
                transition: 'all 0.4s ease'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span className="bento-kpi" style={{ color: isActive || isConfirmed ? '#037A8B' : '#94a3b8' }}>{section.kpi}</span>
                  <div className="canvas__section-label" style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: isActive || isConfirmed ? '#0f172a' : '#94a3b8' }}>
                    <span>{section.icon}</span> {section.label}
                  </div>
                </div>
                <button 
                  onClick={() => toggleConfirm(section.key)}
                  disabled={!selected}
                  style={{
                    background: isConfirmed ? '#037A8B' : 'transparent',
                    color: isConfirmed ? '#fff' : (selected ? '#037A8B' : '#94a3b8'),
                    border: '1px solid',
                    borderColor: isConfirmed ? '#037A8B' : (selected ? '#037A8B' : '#e2e8f0'),
                    padding: '4px 12px',
                    borderRadius: '8px',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    cursor: selected ? 'pointer' : 'not-allowed',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {isConfirmed ? 'Geprüft ✓' : 'Bestätigen'}
                </button>
              </div>

              {selected && (
                <div style={{ marginTop: '12px', width: '100%', height: '100px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #eee' }}>
                  <DishImage 
                    src={selected.image_url} 
                    alt={selected.name} 
                    category={section.key.includes('hauptspeise') ? 'hauptgericht' : section.key}
                    style={{ width: '100%', height: '100%' }}
                  />
                </div>
              )}

              <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                {hasOptions && !isConfirmed && (
                  <button onClick={() => handlePrev(section.key)} className="nav-btn" disabled={!isActive}>‹</button>
                )}
                
                <div style={{ flex: 1 }}>
                  {selected ? (
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontWeight: 700, fontSize: '1rem', color: '#0f172a' }}>{selected.name}</div>
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
                            {(selected.similarity_score * 100).toFixed(0)}% Match
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '10px' }}>
                      {/* Hier prüfen wir, ob die KI gerade schreibt oder ob wir wirklich nichts gefunden haben */}
                      <div className="pulse-placeholder" style={{ height: '12px', width: '50%', background: '#e2e8f0', borderRadius: '4px', margin: '0 auto 8px' }}></div>
                      <div style={{ color: '#cbd5e1', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.05em' }}>
                        SUCHE LÄUFT...
                      </div>
                      <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '4px', fontStyle: 'italic' }}>
                        Der Kellner prüft den Bestand...
                      </div>
                    </div>
                  )}
                </div>

                {hasOptions && !isConfirmed && (
                  <button onClick={() => handleNext(section.key)} className="nav-btn" disabled={!isActive}>›</button>
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
            style={{ 
              width: '100%', 
              padding: '16px', 
              borderRadius: '12px', 
              fontWeight: 800, 
              background: allFilled ? '#037A8B' : '#f1f5f9',
              color: allFilled ? '#fff' : '#94a3b8',
              border: 'none',
              cursor: allFilled ? 'pointer' : 'not-allowed',
              transition: 'all 0.3s ease'
            }}
          >
            Menü verbindlich anfragen
          </button>
        </div>
      )}

      <style>{`
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
        .nav-btn:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }
        .nav-btn:hover:not(:disabled) { background: #e2e8f0; }
      `}</style>
    </div>
  )
}
