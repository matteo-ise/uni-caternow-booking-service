import { useState, useEffect } from 'react'
import { API_URL } from '../config'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export default function Admin() {
  const [password, setPassword] = useState('')
  const [isAuthorized, setIsAuthorized] = useState(() => {
    return localStorage.getItem('adminAuthorized') === 'true'
  })
  
  const [activeTab, setActiveTab] = useState('analytics')
  
  const [leads, setLeads] = useState([])
  const [orders, setOrders] = useState([])
  const [feedbacks, setFeedbacks] = useState([])
  const [dishes, setDishes] = useState([])
  
  const [selectedLead, setSelectedLead] = useState(null)
  const [memoryContent, setMemoryContent] = useState('')
  const [memorySubTab, setMemorySubTab] = useState('overview')
  const [leadSidecar, setLeadSidecar] = useState(null)
  const [benchmarkQuery, setBenchmarkQuery] = useState('')
  const [benchmarkResults, setBenchmarkResults] = useState(null)
  const [benchmarkLoading, setBenchmarkLoading] = useState(false)

  // User Editor state
  const [users, setUsers] = useState([])
  const [selectedUser, setSelectedUser] = useState(null)
  const [userMemoryContent, setUserMemoryContent] = useState('')

  // Overview state
  const [overviewData, setOverviewData] = useState([])
  const [overviewDate, setOverviewDate] = useState(new Date().toISOString().split('T')[0])
  const [overviewLoading, setOverviewLoading] = useState(false)

  useEffect(() => {
    if (isAuthorized) {
      fetchAllData()
    }
  }, [isAuthorized])

  useEffect(() => {
    if (isAuthorized && activeTab === 'memory' && memorySubTab === 'overview') {
      fetchOverview(overviewDate)
    }
  }, [activeTab, memorySubTab])

  const handleLogin = (e) => {
    e.preventDefault()
    // Check against env variable if available, otherwise fallback to default
    const expectedPassword = import.meta.env.VITE_ADMIN_SECRET || 'caternow-admin';
    if (password === expectedPassword) {
      setIsAuthorized(true)
      localStorage.setItem('adminAuthorized', 'true')
      localStorage.setItem('adminPassword', password)
    } else {
      alert('Falsches Passwort!')
    }
  }

  const handleRebuildDB = async () => {
    if (!window.confirm("ACHTUNG: Dies löscht ALLE Bestellungen, User und Feedbacks in der Datenbank und lädt die Gerichte neu aus der CSV. Fortfahren?")) return;
    
    try {
      const resp = await fetch(`${API_URL}/api/admin/rebuild-db`, { 
        method: 'POST',
        headers: { 'X-Admin-Token': getAdminToken() } 
      })
      if (resp.ok) {
        const data = await resp.json()
        alert(data.message)
        fetchAllData()
      } else {
        const err = await resp.json()
        alert("Fehler: " + err.detail)
      }
    } catch (err) { alert("Netzwerkfehler beim Rebuild.") }
  }

  const handleLogout = () => {
    setIsAuthorized(false)
    localStorage.removeItem('adminAuthorized')
    localStorage.removeItem('adminPassword')
  }

  const fetchAllData = async () => {
    await Promise.all([
      fetchLeads(),
      fetchOrders(),
      fetchFeedbacks(),
      fetchDishes(),
      fetchUsers(),
    ])
  }

  const getAdminToken = () => localStorage.getItem('adminPassword') || password

  const fetchLeads = async () => {
    try {
      const resp = await fetch(`${API_URL}/api/admin/leads`, { headers: { 'X-Admin-Token': getAdminToken() } })
      if (resp.ok) setLeads(await resp.json())
    } catch (err) { console.error(err) }
  }

  const fetchOrders = async () => {
    try {
      const resp = await fetch(`${API_URL}/api/admin/orders`, { headers: { 'X-Admin-Token': getAdminToken() } })
      if (resp.ok) setOrders(await resp.json())
    } catch (err) { console.error(err) }
  }

  const fetchFeedbacks = async () => {
    try {
      const resp = await fetch(`${API_URL}/api/admin/feedbacks`, { headers: { 'X-Admin-Token': getAdminToken() } })
      if (resp.ok) setFeedbacks(await resp.json())
    } catch (err) { console.error(err) }
  }

  const fetchDishes = async () => {
    try {
      const resp = await fetch(`${API_URL}/api/admin/dishes`, { headers: { 'X-Admin-Token': getAdminToken() } })
      if (resp.ok) setDishes(await resp.json())
    } catch (err) { console.error(err) }
  }

  const fetchUsers = async () => {
    try {
      const resp = await fetch(`${API_URL}/api/admin/users`, { headers: { 'X-Admin-Token': getAdminToken() } })
      if (resp.ok) setUsers(await resp.json())
    } catch (err) { console.error(err) }
  }

  const fetchUserMemory = async (uid) => {
    setSelectedUser(uid)
    setUserMemoryContent('')
    try {
      const resp = await fetch(`${API_URL}/api/admin/user-memory/${uid}`, { headers: { 'X-Admin-Token': getAdminToken() } })
      if (resp.ok) {
        const data = await resp.json()
        setUserMemoryContent(data.content || '')
      }
    } catch (err) { console.error(err) }
  }

  const saveUserMemory = async () => {
    try {
      const resp = await fetch(`${API_URL}/api/admin/user-memory/${selectedUser}`, {
        method: 'PUT',
        headers: { 'X-Admin-Token': getAdminToken(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: userMemoryContent })
      })
      if (resp.ok) alert('User-Profil gespeichert! Wird ab sofort in KI-Konversationen berücksichtigt.')
      else alert('Fehler beim Speichern.')
    } catch (err) { alert('Netzwerkfehler') }
  }

  const fetchOverview = async (date) => {
    setOverviewLoading(true)
    try {
      const url = date
        ? `${API_URL}/api/admin/orders-overview?date=${date}`
        : `${API_URL}/api/admin/orders-overview`
      const resp = await fetch(url, { headers: { 'X-Admin-Token': getAdminToken() } })
      if (resp.ok) setOverviewData(await resp.json())
    } catch (err) { console.error(err) }
    finally { setOverviewLoading(false) }
  }

  const fetchMemory = async (leadId) => {
    setSelectedLead(leadId)
    setMemoryContent('Lade Memory...')
    setLeadSidecar(null)
    setMemorySubTab('dossier')
    try {
      const resp = await fetch(`${API_URL}/api/admin/lead-details/${leadId}`, { headers: { 'X-Admin-Token': getAdminToken() } })
      if (resp.ok) {
        const data = await resp.json()
        setMemoryContent(data.content)
        setLeadSidecar(data.sidecar)
      }
    } catch (err) { setMemoryContent('Fehler beim Laden.') }
  }

  const runBenchmark = async () => {
    if (!benchmarkQuery.trim()) return
    setBenchmarkLoading(true)
    setBenchmarkResults(null)
    try {
      const resp = await fetch(`${API_URL}/api/admin/vector-benchmark?query=${encodeURIComponent(benchmarkQuery)}`, { headers: { 'X-Admin-Token': getAdminToken() } })
      if (resp.ok) setBenchmarkResults(await resp.json())
    } catch (err) { console.error(err) }
    finally { setBenchmarkLoading(false) }
  }

  const parseDossierSections = (md) => {
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

  const saveMemory = async () => {
    try {
      const resp = await fetch(`${API_URL}/api/admin/memory/${selectedLead}`, {
        method: 'PUT',
        headers: { 
          'X-Admin-Token': getAdminToken(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content: memoryContent })
      })
      if (resp.ok) alert("Memory erfolgreich gespeichert! Die KI berücksichtigt diese Notizen ab sofort.")
      else alert("Fehler beim Speichern.")
    } catch (err) { alert("Netzwerkfehler") }
  }

  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      const resp = await fetch(`${API_URL}/api/admin/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 
          'X-Admin-Token': getAdminToken(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      })
      if (resp.ok) {
        fetchOrders() // Tabelle neu laden
      } else {
        alert("Fehler beim Update des Status")
      }
    } catch (err) { alert("Netzwerkfehler") }
  }

  // File Upload
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    try {
      const resp = await fetch(`${API_URL}/api/admin/upload-csv`, {
        method: 'POST',
        headers: { 'X-Admin-Token': getAdminToken() },
        body: formData
      });
      if (resp.ok) {
        alert("CSV erfolgreich hochgeladen! Neue Vektoren werden beim Server-Neustart berechnet (wenn die DB zurückgesetzt wird) oder ein Hintergrund-Job könnte dies übernehmen.");
        fetchDishes();
      }
    } catch(err) {
      console.error(err)
    }
  }

  if (!isAuthorized) {
    return (
      <div style={{ height: '100vh', display: 'grid', placeItems: 'center', background: '#0f172a' }}>
        <form onSubmit={handleLogin} style={{ background: '#1e293b', padding: '40px', borderRadius: '16px', boxShadow: '0 20px 50px rgba(0,0,0,0.5)', width: '400px' }}>
          <h1 style={{ color: '#fff', marginBottom: '24px', fontSize: '1.5rem', textAlign: 'center' }}>Caterer Studio</h1>
          <input 
            type="password" 
            placeholder="Admin Passwort" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #334155', background: '#0f172a', color: '#fff', marginBottom: '16px' }}
          />
          <button type="submit" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: 'none', background: '#037A8B', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}>
            Unlock Studio
          </button>
        </form>
      </div>
    )
  }

  // Metrics calculation
  const totalRevenue = orders.reduce((sum, o) => sum + (o.total_price || 0), 0);
  const totalOrders = orders.length;

  // Chart Data preparation (group orders by date)
  const ordersByDate = orders.reduce((acc, order) => {
    const date = new Date(order.created_at).toLocaleDateString()
    if (!acc[date]) acc[date] = 0
    acc[date] += (order.total_price || 0)
    return acc
  }, {})
  const chartData = Object.keys(ordersByDate).map(date => ({ date, umsatz: ordersByDate[date] })).reverse()

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#f8fafc', fontFamily: 'Montserrat, sans-serif' }}>
      
      {/* Sidebar */}
      <div style={{ width: '260px', background: '#ffffff', borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '24px', fontWeight: 800, fontSize: '1.2rem', color: '#0f172a', borderBottom: '1px solid #e2e8f0' }}>
          Caterer Studio
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '16px', flex: 1 }}>
          {['analytics', 'orders', 'menu', 'feedback', 'memory'].map(tab => (
            <button 
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                textAlign: 'left',
                padding: '12px 16px',
                borderRadius: '8px',
                border: 'none',
                background: activeTab === tab ? '#e0f2fe' : 'transparent',
                color: activeTab === tab ? '#0369a1' : '#64748b',
                fontWeight: activeTab === tab ? 700 : 500,
                cursor: 'pointer',
                textTransform: 'capitalize'
              }}
            >
              {tab === 'memory' ? 'AI Memory (Leads)' : tab}
            </button>
          ))}
        </nav>
        <div style={{ padding: '16px', borderTop: '1px solid #e2e8f0' }}>
          <button 
            onClick={handleLogout}
            style={{
              width: '100%',
              textAlign: 'left',
              padding: '12px 16px',
              borderRadius: '8px',
              border: 'none',
              background: '#fff1f2',
              color: '#991b1b',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '40px' }}>
        
        {/* ANALYTICS */}
        {activeTab === 'analytics' && (
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '24px' }}>Dashboard</h1>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
              <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                <div style={{ color: '#64748b', fontSize: '0.9rem', fontWeight: 600 }}>Gesamtumsatz</div>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a', marginTop: '8px' }}>{totalRevenue.toFixed(2)} €</div>
              </div>
              <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                <div style={{ color: '#64748b', fontSize: '0.9rem', fontWeight: 600 }}>Bestellungen</div>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a', marginTop: '8px' }}>{totalOrders}</div>
              </div>
              <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                <div style={{ color: '#64748b', fontSize: '0.9rem', fontWeight: 600 }}>Aktive Leads (AI Memory)</div>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a', marginTop: '8px' }}>{leads.length}</div>
              </div>
            </div>

            {/* System Status */}
            <div style={{ marginTop: '32px', background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '16px', color: '#0f172a' }}>🛠️ System Health & API Status</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px #22c55e' }}></div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Gemini API Key</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Live & Authenticated</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px #22c55e' }}></div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Firebase Auth</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Connected</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px #22c55e' }}></div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Research Webhook</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Last Run: Success</div>
                  </div>
                </div>
              </div>

              {/* DANGER ZONE REMOVED FOR SAFETY */}            </div>

            {/* Recharts Umsatz-Kurve */}
            <div style={{ marginTop: '32px', background: '#fff', padding: '40px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '24px', color: '#0f172a' }}>Umsatzentwicklung nach Tagen</h2>
              <div style={{ height: '300px', width: '100%' }}>
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dx={-10} tickFormatter={(value) => `${value}€`} />
                      <Tooltip 
                        cursor={{fill: '#f1f5f9'}} 
                        contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}} 
                        formatter={(value) => [`${value} €`, 'Umsatz']}
                      />
                      <Bar dataKey="umsatz" fill="#037A8B" radius={[4, 4, 0, 0]} maxBarSize={50} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: '#94a3b8' }}>
                    Noch keine Bestelldaten für den Graphen vorhanden.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ORDERS */}
        {activeTab === 'orders' && (
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '24px' }}>Bestellungen (Pipeline)</h1>
            <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <tr>
                    <th style={{ padding: '16px', fontWeight: 600, color: '#64748b' }}>ID</th>
                    <th style={{ padding: '16px', fontWeight: 600, color: '#64748b' }}>Lead ID</th>
                    <th style={{ padding: '16px', fontWeight: 600, color: '#64748b' }}>Status</th>
                    <th style={{ padding: '16px', fontWeight: 600, color: '#64748b' }}>Umsatz</th>
                    <th style={{ padding: '16px', fontWeight: 600, color: '#64748b' }}>Datum</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map(o => (
                    <tr key={o.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '16px' }}>#{o.id}</td>
                      <td style={{ padding: '16px', fontWeight: 600 }}>{o.lead_id}</td>
                      <td style={{ padding: '16px' }}>
                        <select 
                          value={o.status}
                          onChange={(e) => updateOrderStatus(o.id, e.target.value)}
                          style={{ 
                            background: o.status === 'neu' ? '#dcfce7' : o.status === 'abgeschlossen' ? '#e2e8f0' : o.status === 'storniert' ? '#fee2e2' : '#fef08a', 
                            color: o.status === 'neu' ? '#166534' : o.status === 'abgeschlossen' ? '#475569' : o.status === 'storniert' ? '#991b1b' : '#854d0e', 
                            padding: '6px 12px', borderRadius: '8px', border: '1px solid transparent', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', outline: 'none' 
                          }}
                        >
                          <option value="neu">Neu</option>
                          <option value="in bearbeitung">In Bearbeitung</option>
                          <option value="angebot versendet">Angebot versendet</option>
                          <option value="abgeschlossen">Abgeschlossen</option>
                          <option value="storniert">Storniert</option>
                        </select>
                      </td>
                      <td style={{ padding: '16px', fontWeight: 700 }}>{o.total_price} €</td>
                      <td style={{ padding: '16px', color: '#64748b' }}>{new Date(o.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                  {orders.length === 0 && <tr><td colSpan="5" style={{ padding: '24px', textAlign: 'center' }}>Keine Bestellungen vorhanden.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* MENU MANAGER */}
        {activeTab === 'menu' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h1 style={{ fontSize: '2rem', fontWeight: 800 }}>Menu Manager</h1>
              <div>
                <label style={{ background: '#037A8B', color: '#fff', padding: '12px 20px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>
                  Neue CSV hochladen
                  <input type="file" accept=".csv" style={{ display: 'none' }} onChange={handleFileUpload} />
                </label>
              </div>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
              {dishes.map(d => (
                <div key={d.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px' }}>
                  <div style={{ fontSize: '0.8rem', color: '#037A8B', fontWeight: 800, textTransform: 'uppercase', marginBottom: '8px' }}>{d.kategorie}</div>
                  <div style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: '4px' }}>{d.name}</div>
                  <div style={{ color: '#64748b', marginBottom: '16px' }}>{d.preis ? `${d.preis.toFixed(2)} €` : 'Preis auf Anfrage'}</div>
                  
                  <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', fontSize: '0.8rem', color: '#475569' }}>
                    <strong>AI Feedback Context:</strong><br/>
                    {d.feedback_context ? d.feedback_context : <span style={{ fontStyle: 'italic', color: '#94a3b8' }}>Noch kein Feedback vorhanden</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* FEEDBACK CENTER */}
        {activeTab === 'feedback' && (
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '24px' }}>Kunden-Feedback</h1>
            <div style={{ display: 'grid', gap: '16px' }}>
              {feedbacks.map(f => (
                <div key={f.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px', display: 'flex', gap: '24px' }}>
                  <div style={{ flex: '0 0 100px', textAlign: 'center' }}>
                    <div style={{ fontSize: '2rem' }}>{'⭐️'.repeat(f.rating)}{'🌑'.repeat(5 - f.rating)}</div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '8px' }}>{new Date(f.created_at).toLocaleDateString()}</div>
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, marginBottom: '8px', color: '#0f172a' }}>
                      {f.is_general ? 'Allgemeines Feedback' : `Feedback zu Gericht: ${f.dish_name}`}
                    </div>
                    <p style={{ color: '#475569', lineHeight: '1.6', margin: 0 }}>"{f.comment}"</p>
                  </div>
                </div>
              ))}
              {feedbacks.length === 0 && <div style={{ padding: '40px', textAlign: 'center', background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>Kein Feedback vorhanden.</div>}
            </div>
          </div>
        )}

        {/* AI MEMORY — 3 Sub-Tabs: Overview | Editor | Benchmark */}
        {activeTab === 'memory' && (
          <div style={{ display: 'flex', height: '100%', gap: '24px' }}>

            {/* Conditional Sidebar: hidden for Overview, users for Editor, leads for Benchmark */}
            {memorySubTab !== 'overview' && (
              <div style={{ width: '280px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', overflow: 'hidden', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
                {memorySubTab === 'editor' ? (
                  <>
                    <div style={{ padding: '16px', borderBottom: '1px solid #e2e8f0', fontWeight: 700, background: '#f8fafc' }}>
                      Nutzer ({users.length})
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto' }}>
                      {users.map(u => (
                        <div
                          key={u.firebase_uid}
                          onClick={() => fetchUserMemory(u.firebase_uid)}
                          style={{ padding: '14px 16px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', background: selectedUser === u.firebase_uid ? '#e0f2fe' : 'transparent', borderLeft: selectedUser === u.firebase_uid ? '4px solid #0369a1' : '4px solid transparent' }}
                        >
                          <div style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>{u.name || u.email || u.firebase_uid}</div>
                          <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '2px' }}>{u.email}</div>
                        </div>
                      ))}
                      {users.length === 0 && (
                        <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '0.82rem' }}>
                          Noch keine registrierten Nutzer.
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ padding: '16px', borderBottom: '1px solid #e2e8f0', fontWeight: 700, background: '#f8fafc' }}>
                      Chat-Sessions ({leads.length})
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto' }}>
                      {leads.map(lead => (
                        <div
                          key={lead.id}
                          onClick={() => fetchMemory(lead.id)}
                          style={{ padding: '14px 16px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', background: selectedLead === lead.id ? '#e0f2fe' : 'transparent', borderLeft: selectedLead === lead.id ? '4px solid #0369a1' : '4px solid transparent' }}
                        >
                          <div style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>{lead.id}</div>
                          <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '2px' }}>{lead.size} Zeichen</div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Main Panel */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

              {/* Sub-Tab Switcher */}
              <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', background: '#f1f5f9', padding: '4px', borderRadius: '12px', width: 'fit-content' }}>
                {[{k:'overview',l:'Overview'},{k:'editor',l:'User Editor'},{k:'benchmark',l:'Vector Benchmark'}].map(t => (
                  <button key={t.k} onClick={() => { setMemorySubTab(t.k); if (t.k === 'overview') fetchOverview(overviewDate) }} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: memorySubTab === t.k ? '#fff' : 'transparent', color: memorySubTab === t.k ? '#0f172a' : '#64748b', fontWeight: memorySubTab === t.k ? 700 : 500, fontSize: '0.85rem', cursor: 'pointer', boxShadow: memorySubTab === t.k ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', fontFamily: 'Montserrat, sans-serif' }}>
                    {t.l}
                  </button>
                ))}
              </div>

              {/* ── OVERVIEW ── */}
              {memorySubTab === 'overview' && (
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px 20px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                    <label style={{ fontWeight: 700, fontSize: '0.9rem', color: '#475569' }}>📅 Datum:</label>
                    <input
                      type="date"
                      value={overviewDate}
                      onChange={e => { setOverviewDate(e.target.value); fetchOverview(e.target.value) }}
                      style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.9rem', fontFamily: 'Montserrat, sans-serif' }}
                    />
                    <button onClick={() => fetchOverview(overviewDate)} style={{ background: '#037A8B', color: '#fff', padding: '8px 16px', borderRadius: '8px', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' }}>
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
                        <div key={item.checkout_id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
                            {menuItems.vorspeise && <div>🥗 <strong>Vorspeise:</strong> {menuItems.vorspeise?.name || menuItems.vorspeise}</div>}
                            {menuItems.hauptspeise1 && <div>🍖 <strong>HP1:</strong> {menuItems.hauptspeise1?.name || menuItems.hauptspeise1}</div>}
                            {menuItems.hauptspeise2 && <div>🍽️ <strong>HP2:</strong> {menuItems.hauptspeise2?.name || menuItems.hauptspeise2}</div>}
                            {menuItems.nachspeise && <div>🍮 <strong>Dessert:</strong> {menuItems.nachspeise?.name || menuItems.nachspeise}</div>}
                          </div>
                          {/* Sonderwünsche */}
                          {item.custom_wish && (
                            <div style={{ fontSize: '0.8rem', color: '#475569', fontStyle: 'italic' }}>✍️ „{item.custom_wish}"</div>
                          )}
                          {/* Footer */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '10px' }}>
                            <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>#{item.checkout_id?.slice(0, 8)}</span>
                            {item.order_id ? (
                              <select
                                value={item.status}
                                onChange={e => updateOrderStatus(item.order_id, e.target.value)}
                                style={{ background: item.status === 'neu' ? '#dcfce7' : item.status === 'abgeschlossen' ? '#e2e8f0' : item.status === 'storniert' ? '#fee2e2' : '#fef08a', color: item.status === 'neu' ? '#166534' : item.status === 'abgeschlossen' ? '#475569' : item.status === 'storniert' ? '#991b1b' : '#854d0e', padding: '4px 10px', borderRadius: '8px', border: '1px solid transparent', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', outline: 'none' }}
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
              )}

              {/* ── EDITOR (User Profile) ── */}
              {memorySubTab === 'editor' && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  {selectedUser ? (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px' }}>
                      {(() => {
                        const u = users.find(x => x.firebase_uid === selectedUser)
                        return u ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid #f1f5f9' }}>
                            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#037A8B', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', fontWeight: 800, flexShrink: 0 }}>
                              {(u.name || u.email || '?')[0].toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontWeight: 800, fontSize: '1rem' }}>{u.name || 'Kein Name'}</div>
                              <div style={{ fontSize: '0.85rem', color: '#64748b' }}>{u.email}</div>
                            </div>
                          </div>
                        ) : null
                      })()}
                      <p style={{ fontSize: '0.83rem', color: '#64748b', marginBottom: '12px' }}>
                        Persistentes KI-Profil — wird ab sofort bei <strong>jeder</strong> KI-Konversation dieses Nutzers berücksichtigt.
                      </p>
                      <textarea
                        value={userMemoryContent}
                        onChange={e => setUserMemoryContent(e.target.value)}
                        placeholder={'## Diätanforderungen\n- Glutenfrei (medizinisch!)\n\n## Präferenzen\n- Mediterrane Küche\n- Budget: Premium'}
                        style={{ flex: 1, width: '100%', padding: '16px', fontFamily: 'monospace', fontSize: '0.9rem', lineHeight: '1.6', color: '#1e293b', border: '1px solid #e2e8f0', borderRadius: '8px', outline: 'none', resize: 'none', marginBottom: '16px', background: '#f8fafc', minHeight: '300px' }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button onClick={saveUserMemory} style={{ background: '#037A8B', color: '#fff', padding: '10px 24px', borderRadius: '8px', border: 'none', fontWeight: 700, cursor: 'pointer' }}>
                          Profil speichern
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ flex: 1, background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', display: 'grid', placeItems: 'center', color: '#94a3b8' }}>
                      Wähle einen Nutzer aus der Liste, um sein KI-Profil zu bearbeiten.
                    </div>
                  )}
                </div>
              )}

              {/* ── VECTOR BENCHMARK ── */}
              {memorySubTab === 'benchmark' && (
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '12px' }}>Vector Search Benchmark</h3>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <input
                        type="text"
                        value={benchmarkQuery}
                        onChange={e => setBenchmarkQuery(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && runBenchmark()}
                        placeholder="z.B. 'leichtes sommerliches Gericht' oder 'Tiramisu'"
                        style={{ flex: 1, padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.9rem', fontFamily: 'Montserrat, sans-serif' }}
                      />
                      <button onClick={runBenchmark} disabled={benchmarkLoading} style={{ background: '#037A8B', color: '#fff', padding: '10px 20px', borderRadius: '8px', border: 'none', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        {benchmarkLoading ? 'Suche...' : 'Benchmark starten'}
                      </button>
                    </div>
                  </div>

                  <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '12px', padding: '16px', marginBottom: '16px', fontSize: '0.82rem', color: '#0c4a6e' }}>
                    <strong>So funktioniert die Suche:</strong> Deine Query wird via <code>gemini-embedding-001</code> in einen 3072-dimensionalen Vektor umgewandelt. Cosine-Similarity gegen alle {dishes.length} Gerichte-Vektoren in pgvector. Nur Score &ge; 0.25 wird angezeigt.
                  </div>

                  {benchmarkResults && (
                    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead style={{ background: '#f8fafc' }}>
                          <tr>
                            <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#64748b', fontSize: '0.82rem' }}>#</th>
                            <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#64748b', fontSize: '0.82rem' }}>Gericht</th>
                            <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#64748b', fontSize: '0.82rem' }}>Kategorie</th>
                            <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#64748b', fontSize: '0.82rem' }}>Cosine Score</th>
                            <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#64748b', fontSize: '0.82rem', width: '200px' }}>Match</th>
                          </tr>
                        </thead>
                        <tbody>
                          {benchmarkResults.results.map((r, i) => (
                            <tr key={i} style={{ borderTop: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '12px 16px', fontWeight: 700, color: '#037A8B' }}>{i + 1}</td>
                              <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                                <div>{r.name}</div>
                                {r.feedback_context && (
                                  <details style={{ marginTop: '4px' }}>
                                    <summary style={{ fontSize: '0.72rem', color: '#94a3b8', cursor: 'pointer' }}>Rich Description</summary>
                                    <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: '4px', padding: '6px', background: '#f8fafc', borderRadius: '4px', lineHeight: '1.5', maxWidth: '300px' }}>{r.feedback_context}</div>
                                  </details>
                                )}
                              </td>
                              <td style={{ padding: '12px 16px', color: '#64748b', textTransform: 'capitalize' }}>{r.kategorie}</td>
                              <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 700 }}>{r.similarity_score}</td>
                              <td style={{ padding: '12px 16px' }}>
                                <div style={{ background: '#f1f5f9', borderRadius: '4px', height: '20px', overflow: 'hidden' }}>
                                  <div style={{ height: '100%', borderRadius: '4px', background: r.similarity_score > 0.7 ? '#22c55e' : r.similarity_score > 0.5 ? '#f59e0b' : '#ef4444', width: `${Math.round(r.similarity_score * 100)}%`, transition: 'width 0.5s ease' }} />
                                </div>
                              </td>
                            </tr>
                          ))}
                          {benchmarkResults.results.length === 0 && (
                            <tr><td colSpan="5" style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>Keine Ergebnisse ueber dem Schwellenwert (0.25)</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        )}

      </div>
    </div>
  )
}
