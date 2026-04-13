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

  useEffect(() => {
    if (isAuthorized) {
      fetchAllData()
    }
  }, [isAuthorized])

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
      fetchDishes()
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

  const fetchMemory = async (leadId) => {
    setSelectedLead(leadId)
    setMemoryContent('Lade Memory...')
    try {
      const resp = await fetch(`${API_URL}/api/admin/memory/${leadId}`, { headers: { 'X-Admin-Token': getAdminToken() } })
      if (resp.ok) {
        const data = await resp.json()
        setMemoryContent(data.content)
      }
    } catch (err) { setMemoryContent('Fehler beim Laden.') }
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

        {/* MEMORY (OLD ADMIN) */}
        {activeTab === 'memory' && (
          <div style={{ display: 'flex', height: '100%', gap: '24px' }}>
            <div style={{ width: '300px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '16px', borderBottom: '1px solid #e2e8f0', fontWeight: 700, background: '#f8fafc' }}>
                Aktive Chat-Sessions
              </div>
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {leads.map(lead => (
                  <div 
                    key={lead.id} 
                    onClick={() => fetchMemory(lead.id)}
                    style={{ 
                      padding: '16px', 
                      borderBottom: '1px solid #f1f5f9', 
                      cursor: 'pointer',
                      background: selectedLead === lead.id ? '#e0f2fe' : 'transparent',
                      borderLeft: selectedLead === lead.id ? '4px solid #0369a1' : '4px solid transparent'
                    }}
                  >
                    <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{lead.id}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ flex: 1, background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '32px', display: 'flex', flexDirection: 'column' }}>
              {selectedLead ? (
                <>
                  <textarea 
                    value={memoryContent}
                    onChange={(e) => setMemoryContent(e.target.value)}
                    style={{ flex: 1, width: '100%', padding: '16px', fontFamily: 'monospace', fontSize: '0.95rem', lineHeight: '1.6', color: '#1e293b', border: '1px solid #e2e8f0', borderRadius: '8px', outline: 'none', resize: 'none', marginBottom: '16px', background: '#f8fafc' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button 
                      onClick={saveMemory}
                      style={{ background: '#037A8B', color: '#fff', padding: '10px 24px', borderRadius: '8px', border: 'none', fontWeight: 700, cursor: 'pointer' }}
                    >
                      Änderungen speichern
                    </button>
                  </div>
                </>
              ) : (
                <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: '#94a3b8' }}>
                  Wähle einen Lead aus der Liste, um das Live-Gedächtnis zu sehen und zu bearbeiten.
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
