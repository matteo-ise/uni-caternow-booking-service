import { useState, useEffect } from 'react'

export default function Admin() {
  const [password, setPassword] = useState('')
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [leads, setLeads] = useState([])
  const [selectedLead, setSelectedLead] = useState(null)
  const [memoryContent, setMemoryContent] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = (e) => {
    e.preventDefault()
    if (password === 'caternow-god-mode') {
      setIsAuthorized(true)
      fetchLeads()
    } else {
      alert('Falsches Passwort!')
    }
  }

  const fetchLeads = async () => {
    setLoading(true)
    try {
      const resp = await fetch('http://localhost:8000/api/admin/leads', {
        headers: { 'X-Admin-Token': password }
      })
      if (resp.ok) {
        const data = await resp.json()
        setLeads(data)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const fetchMemory = async (leadId) => {
    setSelectedLead(leadId)
    setMemoryContent('Lade Memory...')
    try {
      const resp = await fetch(`http://localhost:8000/api/admin/memory/${leadId}`, {
        headers: { 'X-Admin-Token': password }
      })
      if (resp.ok) {
        const data = await resp.json()
        setMemoryContent(data.content)
      }
    } catch (err) {
      setMemoryContent('Fehler beim Laden.')
    }
  }

  // Auto-refresh selected memory every 5 seconds for "live" feel
  useEffect(() => {
    let interval
    if (isAuthorized && selectedLead) {
      interval = setInterval(() => fetchMemory(selectedLead), 5000)
    }
    return () => clearInterval(interval)
  }, [isAuthorized, selectedLead])

  if (!isAuthorized) {
    return (
      <div style={{ height: '100vh', display: 'grid', placeItems: 'center', background: '#0f172a' }}>
        <form onSubmit={handleLogin} style={{ background: '#1e293b', padding: '40px', borderRadius: '16px', boxShadow: '0 20px 50px rgba(0,0,0,0.5)', width: '400px' }}>
          <h1 style={{ color: '#fff', marginBottom: '24px', fontSize: '1.5rem', textAlign: 'center' }}>CaterNow Admin Mode</h1>
          <input 
            type="password" 
            placeholder="Admin Passwort" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #334155', background: '#0f172a', color: '#fff', marginBottom: '16px' }}
          />
          <button type="submit" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: 'none', background: '#037A8B', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}>
            Unlock God Mode
          </button>
        </form>
      </div>
    )
  }

  return (
    <div style={{ height: '100vh', display: 'flex', background: '#f1f5f9', fontFamily: 'Montserrat, sans-serif' }}>
      {/* Sidebar: Leads */}
      <div style={{ width: '300px', background: '#fff', borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '24px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 800 }}>Aktive Leads</h2>
          <button onClick={fetchLeads} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#037A8B' }}>🔄</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {leads.map(lead => (
            <div 
              key={lead.id} 
              onClick={() => fetchMemory(lead.id)}
              style={{ 
                padding: '16px 24px', 
                borderBottom: '1px solid #f1f5f9', 
                cursor: 'pointer',
                background: selectedLead === lead.id ? '#f0f9ff' : 'transparent',
                borderLeft: selectedLead === lead.id ? '4px solid #037A8B' : '4px solid transparent'
              }}
            >
              <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{lead.id}</div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
                Update: {new Date(lead.last_updated * 1000).toLocaleTimeString()}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main: Memory Viewer */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '20px 40px', background: '#fff', borderBottom: '1px solid #e5e7eb' }}>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 800 }}>
            {selectedLead ? `Live Memory: ${selectedLead}` : 'Wähle einen Lead aus'}
          </h1>
        </div>
        <div style={{ flex: 1, padding: '40px', overflowY: 'auto' }}>
          {selectedLead ? (
            <div style={{ background: '#fff', padding: '40px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', minHeight: '100%' }}>
              <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '0.95rem', lineHeight: '1.6', color: '#1e293b' }}>
                {memoryContent}
              </pre>
            </div>
          ) : (
            <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: '#94a3b8' }}>
              Hier erscheint das Live-Gedächtnis des Leads...
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
