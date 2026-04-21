// Modal showing full lead details — chat history, menu selections, research data.
import { useState, useEffect } from 'react'
import { API_URL } from '../../config'

export default function LeadDetailModal({ leadId, getAdminToken, onClose }) {
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [benchmarkQuery, setBenchmarkQuery] = useState('')
  const [benchmarkResults, setBenchmarkResults] = useState(null)
  const [benchmarkLoading, setBenchmarkLoading] = useState(false)

  useEffect(() => {
    if (leadId) fetchDetail()
  }, [leadId])

  const fetchDetail = async () => {
    setLoading(true)
    try {
      const resp = await fetch(`${API_URL}/api/admin/lead-detail/${leadId}`, {
        headers: { 'X-Admin-Token': getAdminToken() }
      })
      if (resp.ok) {
        const data = await resp.json()
        setDetail(data)
        // Pre-fill benchmark query with company name
        const query = data.sidecar?.company_name || data.rag_context?.query || leadId
        setBenchmarkQuery(query)
        setBenchmarkResults(data.rag_context)
      }
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const runBenchmark = async () => {
    if (!benchmarkQuery.trim()) return
    setBenchmarkLoading(true)
    setBenchmarkResults(null)
    try {
      const resp = await fetch(`${API_URL}/api/admin/vector-benchmark?query=${encodeURIComponent(benchmarkQuery)}`, {
        headers: { 'X-Admin-Token': getAdminToken() }
      })
      if (resp.ok) {
        const data = await resp.json()
        setBenchmarkResults({ query: benchmarkQuery, results: data.results })
      }
    } catch (err) { console.error(err) }
    finally { setBenchmarkLoading(false) }
  }

  const parseSections = (md) => {
    if (!md) return []
    const sections = []
    const lines = md.split('\n')
    let current = null
    for (const line of lines) {
      if (line.startsWith('## ')) {
        if (current) sections.push(current)
        current = { title: line.replace('## ', ''), items: [] }
      } else if (current && line.trim().startsWith('- ')) {
        current.items.push(line.trim().replace(/^- /, ''))
      } else if (current && line.trim()) {
        current.items.push(line.trim())
      }
    }
    if (current) sections.push(current)
    return sections
  }

  const sc = detail?.sidecar || {}
  const fancyScore = sc.fancy_score ?? 50

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0, width: '680px', maxWidth: '100vw',
      background: '#fff', boxShadow: '-8px 0 30px rgba(0,0,0,0.15)', zIndex: 1000,
      display: 'flex', flexDirection: 'column', overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 24px', borderBottom: '1px solid #e2e8f0',
        display: 'flex', alignItems: 'center', gap: '16px', background: '#f8fafc', flexShrink: 0
      }}>
        <button
          onClick={onClose}
          style={{
            background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer',
            color: '#64748b', padding: '4px 8px'
          }}
        >
          ←
        </button>
        <span style={{ fontWeight: 800, fontSize: '1.1rem' }}>Lead Detail</span>
      </div>

      {loading ? (
        <div style={{ flex: 1, display: 'grid', placeItems: 'center', color: '#94a3b8' }}>
          Lade Lead-Daten...
        </div>
      ) : !detail ? (
        <div style={{ flex: 1, display: 'grid', placeItems: 'center', color: '#94a3b8' }}>
          Fehler beim Laden.
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Company Header */}
          <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
            {sc.logo_url && (
              <img
                src={sc.logo_url}
                alt="Logo"
                style={{ height: '48px', objectFit: 'contain' }}
                onError={e => { e.target.style.display = 'none' }}
              />
            )}
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: '1.2rem' }}>
                {sc.company_name || detail.lead_id}
              </div>
              {sc.hq_address && (
                <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '4px' }}>{sc.hq_address}</div>
              )}
              {/* Fancy Score bar */}
              <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>Fancy Score:</span>
                <div style={{ flex: 1, maxWidth: '200px', background: '#f1f5f9', borderRadius: '4px', height: '14px', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: '4px', width: `${fancyScore}%`,
                    background: fancyScore > 70 ? '#22c55e' : fancyScore > 40 ? '#f59e0b' : '#ef4444',
                    transition: 'width 0.3s ease'
                  }} />
                </div>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, fontFamily: 'monospace' }}>{fancyScore}/100</span>
              </div>
              {/* Colors */}
              {sc.company_colors?.length > 0 && (
                <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                  {sc.company_colors.map((c, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: '4px',
                      fontSize: '0.75rem', color: '#64748b'
                    }}>
                      <div style={{ width: '14px', height: '14px', borderRadius: '3px', background: c, border: '1px solid #e2e8f0' }} />
                      {c}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Memory Dossier */}
          <div style={{ background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem', fontWeight: 700 }}>Memory Dossier</h3>
            {parseSections(detail.content).map((section, i) => (
              <div key={i} style={{ marginBottom: '14px' }}>
                <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f172a', marginBottom: '6px' }}>
                  {section.title}
                </div>
                {section.items.map((item, j) => (
                  <div key={j} style={{ fontSize: '0.82rem', color: '#475569', lineHeight: '1.5', paddingLeft: '12px' }}>
                    {item.startsWith('**') ? (
                      <span dangerouslySetInnerHTML={{ __html: item.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                    ) : item}
                  </div>
                ))}
              </div>
            ))}
            {!detail.content && (
              <div style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.85rem' }}>Kein Dossier vorhanden.</div>
            )}
          </div>

          {/* Vector Benchmark */}
          <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '1rem', fontWeight: 700 }}>Vector Benchmark (Live RAG Context)</h3>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
              <input
                type="text"
                value={benchmarkQuery}
                onChange={e => setBenchmarkQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && runBenchmark()}
                placeholder="Query eingeben..."
                style={{
                  flex: 1, padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0',
                  fontSize: '0.9rem', fontFamily: 'Montserrat, sans-serif'
                }}
              />
              <button
                onClick={runBenchmark}
                disabled={benchmarkLoading}
                style={{
                  background: '#037A8B', color: '#fff', padding: '10px 20px', borderRadius: '8px',
                  border: 'none', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap'
                }}
              >
                {benchmarkLoading ? 'Suche...' : 'Benchmark starten'}
              </button>
            </div>

            {benchmarkResults?.results?.length > 0 && (
              <div style={{ borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead style={{ background: '#f8fafc' }}>
                    <tr>
                      <th style={thStyle}>#</th>
                      <th style={thStyle}>Gericht</th>
                      <th style={thStyle}>Kategorie</th>
                      <th style={thStyle}>Score</th>
                      <th style={{ ...thStyle, width: '120px' }}>Match</th>
                    </tr>
                  </thead>
                  <tbody>
                    {benchmarkResults.results.map((r, i) => (
                      <tr key={i} style={{ borderTop: '1px solid #f1f5f9' }}>
                        <td style={tdStyle}>{i + 1}</td>
                        <td style={{ ...tdStyle, fontWeight: 600 }}>{r.name}</td>
                        <td style={{ ...tdStyle, textTransform: 'capitalize', color: '#64748b' }}>{r.kategorie}</td>
                        <td style={{ ...tdStyle, fontFamily: 'monospace', fontWeight: 700 }}>{r.similarity_score}</td>
                        <td style={tdStyle}>
                          <div style={{ background: '#f1f5f9', borderRadius: '4px', height: '16px', overflow: 'hidden' }}>
                            <div style={{
                              height: '100%', borderRadius: '4px',
                              background: r.similarity_score > 0.7 ? '#22c55e' : r.similarity_score > 0.5 ? '#f59e0b' : '#ef4444',
                              width: `${Math.round(r.similarity_score * 100)}%`, transition: 'width 0.3s ease'
                            }} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {benchmarkResults?.results?.length === 0 && (
              <div style={{ textAlign: 'center', padding: '16px', color: '#94a3b8', fontSize: '0.85rem' }}>
                Keine Ergebnisse über dem Schwellenwert (0.25)
              </div>
            )}
          </div>

          {/* Checkouts & Orders */}
          {(detail.checkouts?.length > 0 || detail.orders?.length > 0) && (
            <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem', fontWeight: 700 }}>Bestellungen & Checkouts</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {detail.checkouts?.map(c => {
                  const wiz = c.wizard_data || {}
                  return (
                    <div key={c.checkout_id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '12px', background: '#f8fafc', borderRadius: '8px', fontSize: '0.82rem'
                    }}>
                      <span style={{ fontWeight: 700, fontFamily: 'monospace' }}>
                        {c.checkout_id?.slice(0, 8)}
                      </span>
                      <span style={{ color: '#64748b' }}>
                        {c.created_at ? new Date(c.created_at).toLocaleDateString('de-DE') : '—'}
                      </span>
                      {wiz.persons && <span>{wiz.persons} Pers.</span>}
                    </div>
                  )
                })}
                {detail.orders?.map(o => (
                  <div key={o.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '12px', background: '#fffbeb', borderRadius: '8px', fontSize: '0.82rem',
                    border: '1px solid #fef3c7'
                  }}>
                    <span style={{ fontWeight: 700 }}>Order #{o.id}</span>
                    <span style={{ fontWeight: 700 }}>
                      {o.total_price ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(o.total_price) : '—'}
                    </span>
                    <span style={{
                      padding: '2px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700,
                      background: o.status === 'neu' ? '#dcfce7' : o.status === 'abgeschlossen' ? '#e2e8f0' : '#fef08a',
                      color: o.status === 'neu' ? '#166534' : o.status === 'abgeschlossen' ? '#475569' : '#854d0e',
                    }}>
                      {o.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', top: 0, left: 0, bottom: 0, right: '680px',
          background: 'rgba(0,0,0,0.3)', zIndex: -1
        }}
      />
    </div>
  )
}

const thStyle = { padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#64748b', fontSize: '0.78rem' }
const tdStyle = { padding: '10px 12px' }
