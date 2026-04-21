// Admin sub-tab for browsing and editing user accounts.
import { useState, useEffect } from 'react'
import { API_URL } from '../../config'
import UserProfileCard from './UserProfileCard'

export default function UserEditorSubTab({ users, getAdminToken, onUsersRefresh }) {
  const [selectedUid, setSelectedUid] = useState(null)
  const [profile, setProfile] = useState(null)
  const [userMemoryContent, setUserMemoryContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [seeding, setSeeding] = useState(false)

  useEffect(() => {
    if (selectedUid) fetchProfile(selectedUid)
  }, [selectedUid])

  const fetchProfile = async (uid) => {
    setLoading(true)
    setProfile(null)
    setUserMemoryContent('')
    try {
      const resp = await fetch(`${API_URL}/api/admin/user-profile/${uid}`, {
        headers: { 'X-Admin-Token': getAdminToken() }
      })
      if (resp.ok) {
        const data = await resp.json()
        setProfile(data)
        setUserMemoryContent(data.memory?.content || '')
      }
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const saveMemory = async () => {
    if (!selectedUid) return
    try {
      const resp = await fetch(`${API_URL}/api/admin/user-memory/${selectedUid}`, {
        method: 'PUT',
        headers: { 'X-Admin-Token': getAdminToken(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: userMemoryContent })
      })
      if (resp.ok) alert('User-Profil gespeichert!')
      else alert('Fehler beim Speichern.')
    } catch { alert('Netzwerkfehler') }
  }

  const extractProfile = async () => {
    if (!selectedUid) return
    setExtracting(true)
    try {
      const resp = await fetch(`${API_URL}/api/admin/user-profile/${selectedUid}/extract`, {
        method: 'POST',
        headers: { 'X-Admin-Token': getAdminToken() }
      })
      if (resp.ok) {
        const data = await resp.json()
        // Refresh profile after extraction
        await fetchProfile(selectedUid)
        alert('Profil erfolgreich extrahiert!')
      } else {
        const err = await resp.json()
        alert('Fehler: ' + (err.detail || 'Unbekannt'))
      }
    } catch { alert('Netzwerkfehler bei Extraktion') }
    finally { setExtracting(false) }
  }

  const seedUsers = async () => {
    setSeeding(true)
    try {
      const resp = await fetch(`${API_URL}/api/admin/seed-users`, {
        method: 'POST',
        headers: { 'X-Admin-Token': getAdminToken() }
      })
      if (resp.ok) {
        const data = await resp.json()
        alert(data.message)
        if (onUsersRefresh) onUsersRefresh()
      } else {
        alert('Fehler beim Seeden')
      }
    } catch { alert('Netzwerkfehler') }
    finally { setSeeding(false) }
  }

  const formatCurrency = (n) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n || 0)

  return (
    <div style={{ display: 'flex', height: '100%', gap: '24px' }}>
      {/* User List Sidebar */}
      <div style={{
        width: '280px', background: '#fff', border: '1px solid #e2e8f0',
        borderRadius: '16px', overflow: 'hidden', display: 'flex', flexDirection: 'column', flexShrink: 0
      }}>
        <div style={{
          padding: '16px', borderBottom: '1px solid #e2e8f0', fontWeight: 700,
          background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <span>Nutzer ({users.length})</span>
          <button
            onClick={seedUsers}
            disabled={seeding}
            style={{
              background: '#7c3aed', color: '#fff', padding: '4px 10px', borderRadius: '6px',
              border: 'none', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer'
            }}
          >
            {seeding ? '...' : 'Seed'}
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {users.map(u => (
            <div
              key={u.firebase_uid}
              onClick={() => setSelectedUid(u.firebase_uid)}
              style={{
                padding: '14px 16px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer',
                background: selectedUid === u.firebase_uid ? '#e0f2fe' : 'transparent',
                borderLeft: selectedUid === u.firebase_uid ? '4px solid #0369a1' : '4px solid transparent'
              }}
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
      </div>

      {/* Main Panel */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {loading ? (
          <div style={{ flex: 1, background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', display: 'grid', placeItems: 'center', color: '#94a3b8' }}>
            Lade Profil...
          </div>
        ) : selectedUid && profile ? (
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Profile Card */}
            <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px' }}>
              <UserProfileCard profile={profile} />
            </div>

            {/* AI Extracted Profile */}
            <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>KI-Extrahiertes Profil</h3>
                <button
                  onClick={extractProfile}
                  disabled={extracting}
                  style={{
                    background: '#7c3aed', color: '#fff', padding: '8px 16px', borderRadius: '8px',
                    border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem'
                  }}
                >
                  {extracting ? 'Extrahiere...' : 'Extrahieren'}
                </button>
              </div>
              {profile.leads?.length > 0 ? (
                <div style={{ fontSize: '0.82rem', color: '#475569' }}>
                  <div style={{ marginBottom: '8px', color: '#94a3b8' }}>
                    Verknüpfte Leads: {profile.leads.map(l => l.company_name || l.lead_id).join(', ')}
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: '0.82rem', color: '#94a3b8', fontStyle: 'italic' }}>
                  Keine verknüpften Lead-Dossiers gefunden. Extraktion benötigt mindestens ein Dossier.
                </div>
              )}
            </div>

            {/* Manual Notes / Textarea */}
            <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px', display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '1rem', fontWeight: 700 }}>Profil & Notizen (Markdown)</h3>
              <p style={{ fontSize: '0.83rem', color: '#64748b', marginBottom: '12px', marginTop: 0 }}>
                Persistentes KI-Profil — wird bei <strong>jeder</strong> KI-Konversation dieses Nutzers berücksichtigt.
              </p>
              <textarea
                value={userMemoryContent}
                onChange={e => setUserMemoryContent(e.target.value)}
                placeholder={'## Diätanforderungen\n- Glutenfrei (medizinisch!)\n\n## Präferenzen\n- Mediterrane Küche'}
                style={{
                  width: '100%', padding: '16px', fontFamily: 'monospace', fontSize: '0.9rem',
                  lineHeight: '1.6', color: '#1e293b', border: '1px solid #e2e8f0', borderRadius: '8px',
                  outline: 'none', resize: 'vertical', background: '#f8fafc', minHeight: '250px'
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
                <button
                  onClick={saveMemory}
                  style={{
                    background: '#037A8B', color: '#fff', padding: '10px 24px', borderRadius: '8px',
                    border: 'none', fontWeight: 700, cursor: 'pointer'
                  }}
                >
                  Profil speichern
                </button>
              </div>
            </div>

            {/* Order History */}
            {profile.orders?.length > 0 && (
              <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px' }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem', fontWeight: 700 }}>Bestellhistorie</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {profile.orders.map(o => (
                    <div key={o.id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '12px', background: '#f8fafc', borderRadius: '8px', fontSize: '0.85rem'
                    }}>
                      <span style={{ fontWeight: 700 }}>Order #{o.id}</span>
                      <span style={{ color: '#64748b' }}>{o.lead_id}</span>
                      <span style={{ fontWeight: 700 }}>{formatCurrency(o.total_price)}</span>
                      <span style={{
                        padding: '2px 10px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 700,
                        background: o.status === 'neu' ? '#dcfce7' : o.status === 'abgeschlossen' ? '#e2e8f0' : '#fef08a',
                        color: o.status === 'neu' ? '#166534' : o.status === 'abgeschlossen' ? '#475569' : '#854d0e',
                      }}>
                        {o.status}
                      </span>
                      <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>
                        {o.created_at ? new Date(o.created_at).toLocaleDateString('de-DE') : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{
            flex: 1, background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0',
            display: 'grid', placeItems: 'center', color: '#94a3b8'
          }}>
            Wähle einen Nutzer aus der Liste, um sein KI-Profil zu bearbeiten.
          </div>
        )}
      </div>
    </div>
  )
}
