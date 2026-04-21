import { useState, useEffect } from 'react'
import { API_URL } from '../config'
import UserEditorSubTab from '../components/admin/UserEditorSubTab'
import AnalyticsDashboard from '../components/admin/AnalyticsDashboard'
import OverviewSubTab from '../components/admin/OverviewSubTab'
import LeadDetailModal from '../components/admin/LeadDetailModal'
import OrderDetailModal from '../components/admin/OrderDetailModal'

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
  
  const [memorySubTab, setMemorySubTab] = useState('overview')

  // User Editor state
  const [users, setUsers] = useState([])

  // Overview state
  const [overviewData, setOverviewData] = useState([])
  const [overviewDate, setOverviewDate] = useState(new Date().toISOString().split('T')[0])
  const [overviewLoading, setOverviewLoading] = useState(false)

  // Lead detail modal
  const [selectedLeadDetail, setSelectedLeadDetail] = useState(null)

  // Order detail modal
  const [selectedOrder, setSelectedOrder] = useState(null)

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
          <AnalyticsDashboard
            orders={orders}
            leads={leads}
            feedbacks={feedbacks}
            dishes={dishes}
            users={users}
            systemHealth={{ geminiOk: true, firebaseOk: true, researchOk: true }}
          />
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
                    <th style={{ padding: '16px', fontWeight: 600, color: '#64748b' }}>Personen</th>
                    <th style={{ padding: '16px', fontWeight: 600, color: '#64748b' }}>Umsatz</th>
                    <th style={{ padding: '16px', fontWeight: 600, color: '#64748b' }}>Datum</th>
                    <th style={{ padding: '16px', fontWeight: 600, color: '#64748b' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map(o => (
                    <tr
                      key={o.id}
                      onClick={() => setSelectedOrder(o)}
                      style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '16px' }}>#{o.id}</td>
                      <td style={{ padding: '16px', fontWeight: 600 }}>{o.lead_id}</td>
                      <td style={{ padding: '16px' }} onClick={e => e.stopPropagation()}>
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
                      <td style={{ padding: '16px', color: '#64748b' }}>{(() => { const w = o.order_data?.wizard || o.order_data?.wizard_data || {}; return w.persons || w.guestCount || '—'; })()}</td>
                      <td style={{ padding: '16px', fontWeight: 700 }}>{o.total_price ? `${o.total_price.toFixed(2)} €` : '—'}</td>
                      <td style={{ padding: '16px', color: '#64748b' }}>{new Date(o.created_at).toLocaleDateString('de-DE')}</td>
                      <td style={{ padding: '16px', color: '#037A8B', fontSize: '0.85rem', fontWeight: 600 }}>Details →</td>
                    </tr>
                  ))}
                  {orders.length === 0 && <tr><td colSpan="7" style={{ padding: '24px', textAlign: 'center' }}>Keine Bestellungen vorhanden.</td></tr>}
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

        {/* AI MEMORY — 2 Sub-Tabs: Overview | User Editor */}
        {activeTab === 'memory' && (
          <div style={{ display: 'flex', height: '100%', gap: '24px' }}>
            {/* Main Panel */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

              {/* Sub-Tab Switcher */}
              <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', background: '#f1f5f9', padding: '4px', borderRadius: '12px', width: 'fit-content' }}>
                {[{k:'overview',l:'Overview'},{k:'editor',l:'User Editor'}].map(t => (
                  <button key={t.k} onClick={() => { setMemorySubTab(t.k); if (t.k === 'overview') fetchOverview(overviewDate) }} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: memorySubTab === t.k ? '#fff' : 'transparent', color: memorySubTab === t.k ? '#0f172a' : '#64748b', fontWeight: memorySubTab === t.k ? 700 : 500, fontSize: '0.85rem', cursor: 'pointer', boxShadow: memorySubTab === t.k ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', fontFamily: 'Montserrat, sans-serif' }}>
                    {t.l}
                  </button>
                ))}
              </div>

              {/* ── OVERVIEW ── */}
              {memorySubTab === 'overview' && (
                <OverviewSubTab
                  overviewData={overviewData}
                  overviewDate={overviewDate}
                  overviewLoading={overviewLoading}
                  onDateChange={setOverviewDate}
                  onFetch={fetchOverview}
                  onUpdateOrderStatus={updateOrderStatus}
                  onLeadClick={(leadId) => setSelectedLeadDetail(leadId)}
                />
              )}

              {/* ── EDITOR (User Profile) ── */}
              {memorySubTab === 'editor' && (
                <UserEditorSubTab
                  users={users}
                  getAdminToken={getAdminToken}
                  onUsersRefresh={fetchUsers}
                />
              )}

            </div>
          </div>
        )}

      </div>

      {/* Lead Detail Slide-in Panel */}
      {selectedLeadDetail && (
        <LeadDetailModal
          leadId={selectedLeadDetail}
          getAdminToken={getAdminToken}
          onClose={() => setSelectedLeadDetail(null)}
        />
      )}

      {/* Order Detail Slide-in Panel */}
      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onStatusChange={(orderId, newStatus) => { updateOrderStatus(orderId, newStatus); setSelectedOrder(prev => prev ? { ...prev, status: newStatus } : null) }}
        />
      )}
    </div>
  )
}
