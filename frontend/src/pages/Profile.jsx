import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/Navbar'
import { API_URL } from '../config'

const skeletonStyle = (width, height, borderRadius = 6) => ({
  width: typeof width === 'number' ? `${width}px` : width,
  height: `${height}px`,
  borderRadius: `${borderRadius}px`,
  background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
  backgroundSize: '800px 100%',
  animation: 'shimmer 1.5s infinite linear',
})

export default function Profile() {
  const { currentUser, logout } = useAuth()
  const navigate = useNavigate()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  const [feedbackState, setFeedbackState] = useState({}) // { [orderId]: { dishId: '', rating: 5, comment: '', isGeneral: true } }

  useEffect(() => {
    if (!currentUser) {
      navigate('/')
      return
    }
    fetchOrders()
  }, [currentUser, navigate])

  const fetchOrders = async () => {
    try {
      const token = await currentUser.getIdToken()
      const resp = await fetch(`${API_URL}/api/users/me/orders`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (resp.ok) {
        setOrders(await resp.json())
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleFeedbackSubmit = async (orderId, menu) => {
    const fb = feedbackState[orderId] || {}
    if (!fb.comment?.trim()) {
      setFeedbackState(prev => ({ ...prev, [orderId]: { ...prev[orderId], error: 'Bitte einen Kommentar eingeben.' } }))
      return
    }

    const target = fb.target || 'general'
    const isGeneral = target === 'general'
    let dishId = null
    if (!isGeneral) {
      // target is a string from <select>, dish.id (csv_id) is a number — coerce for comparison
      const dishObj = Object.values(menu).find(d => d && String(d.id || d.name || d) === target)
      dishId = dishObj?.id ?? dishObj?.csv_id ?? null
    }

    setFeedbackState(prev => ({ ...prev, [orderId]: { ...prev[orderId], submitting: true, error: null } }))

    try {
      const token = await currentUser.getIdToken()
      const resp = await fetch(`${API_URL}/api/feedback`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId, rating: fb.rating || 5, comment: fb.comment, is_general: isGeneral, dish_id: dishId ? parseInt(dishId) : null })
      })
      if (resp.ok) {
        setFeedbackState(prev => ({ ...prev, [orderId]: { rating: 5, comment: '', target: 'general', success: true, submitting: false } }))
        setTimeout(() => setFeedbackState(prev => ({ ...prev, [orderId]: { ...prev[orderId], success: false } })), 3500)
      } else {
        setFeedbackState(prev => ({ ...prev, [orderId]: { ...prev[orderId], submitting: false, error: 'Fehler beim Senden. Bitte nochmal versuchen.' } }))
      }
    } catch (err) {
      setFeedbackState(prev => ({ ...prev, [orderId]: { ...prev[orderId], submitting: false, error: 'Netzwerkfehler.' } }))
    }
  }

  const updateFeedback = (orderId, field, value) => {
    setFeedbackState(prev => ({
      ...prev,
      [orderId]: { ...(prev[orderId] || {}), [field]: value, error: null }
    }))
  }

  return (
    <>
      <Navbar />
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 20px', fontFamily: 'Montserrat, sans-serif' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: '#0f172a', marginBottom: '8px' }}>Mein Profil</h1>
        <p style={{ color: '#64748b', marginBottom: '40px' }}>Eingeloggt als {currentUser?.email}</p>

        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, borderBottom: '2px solid #e2e8f0', paddingBottom: '16px', marginBottom: '24px' }}>Meine Bestellungen</h2>

        {loading ? (
          <div style={{ display: 'grid', gap: '24px' }}>
            {[1, 2].map(n => (
              <div key={n} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '24px', overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <div style={skeletonStyle(120, 18)} />
                  <div style={skeletonStyle(80, 16)} />
                </div>
                <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                  <div style={skeletonStyle(100, 32, 8)} />
                  <div style={skeletonStyle(120, 32, 8)} />
                  <div style={skeletonStyle(90, 32, 8)} />
                </div>
                <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '20px' }}>
                  <div style={skeletonStyle(140, 16, 4)} />
                  <div style={{ ...skeletonStyle('100%', 40, 8), marginTop: '16px' }} />
                </div>
              </div>
            ))}
            <style>{`
              @keyframes shimmer { 0% { background-position: -400px 0; } 100% { background-position: 400px 0; } }
            `}</style>
          </div>
        ) : orders.length === 0 ? (
          <div style={{ background: '#f8fafc', padding: '40px', textAlign: 'center', borderRadius: '16px', color: '#64748b' }}>
            Du hast noch keine Caterings bei uns gebucht.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '24px' }}>
            {orders.map(order => {
              const menu = order.order_data?.menu || {}
              return (
                <div key={order.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '24px', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div style={{ fontWeight: 800, color: '#037A8B' }}>Bestellung #{order.id}</div>
                    <div style={{ color: '#64748b', fontSize: '0.9rem' }}>{new Date(order.created_at).toLocaleDateString()}</div>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
                    {Object.entries(menu).map(([key, dish]) => dish && (
                      <div key={key} style={{ background: '#f1f5f9', padding: '8px 12px', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 600 }}>
                        {dish.name || dish}
                      </div>
                    ))}
                  </div>

                  {/* Feedback Section */}
                  {(() => {
                    const fb = feedbackState[order.id] || {}
                    const isSubmitting = fb.submitting
                    const rating = fb.rating || 5
                    return (
                      <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                        <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '14px' }}>🌟 Feedback geben</div>

                        {fb.success ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '10px', padding: '16px' }}>
                            <span style={{ fontSize: '1.5rem' }}>✅</span>
                            <div>
                              <div style={{ fontWeight: 700, color: '#166534' }}>Danke für dein Feedback!</div>
                              <div style={{ fontSize: '0.82rem', color: '#16a34a' }}>Deine Bewertung hilft unserer KI, noch besser zu werden.</div>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            {/* Target selector */}
                            <div>
                              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Feedback für</label>
                              <select
                                value={fb.target || 'general'}
                                onChange={e => updateFeedback(order.id, 'target', e.target.value)}
                                disabled={isSubmitting}
                                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #e2e8f0', fontSize: '0.9rem', fontWeight: 600, background: '#fff', fontFamily: 'Montserrat, sans-serif' }}
                              >
                                <option value="general">🏠 Allgemein (Caterer)</option>
                                {Object.entries(menu).map(([key, dish]) => dish && (
                                  <option key={key} value={String(dish.id || dish.name || dish)}>🍽️ {dish.name || dish}</option>
                                ))}
                              </select>
                            </div>

                            {/* Star rating */}
                            <div>
                              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Bewertung</label>
                              <div style={{ display: 'flex', gap: '4px' }}>
                                {[1,2,3,4,5].map(star => (
                                  <button
                                    key={star}
                                    onClick={() => updateFeedback(order.id, 'rating', star)}
                                    disabled={isSubmitting}
                                    style={{ background: 'none', border: 'none', fontSize: '1.6rem', cursor: 'pointer', padding: '0 2px', color: star <= rating ? '#f59e0b' : '#e2e8f0', transition: 'color 0.15s, transform 0.1s', transform: star <= rating ? 'scale(1.1)' : 'scale(1)' }}
                                  >★</button>
                                ))}
                                <span style={{ marginLeft: '8px', fontSize: '0.82rem', color: '#64748b', alignSelf: 'center' }}>
                                  {['','Schlecht','Nicht so gut','Okay','Sehr gut','Perfekt'][rating]}
                                </span>
                              </div>
                            </div>

                            {/* Comment + Send */}
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                              <input
                                type="text"
                                placeholder={(fb.target || 'general') === 'general' ? 'Was hat dir besonders gefallen?' : 'Wie hat es geschmeckt?'}
                                value={fb.comment || ''}
                                onChange={e => updateFeedback(order.id, 'comment', e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && !isSubmitting && handleFeedbackSubmit(order.id, menu)}
                                disabled={isSubmitting}
                                style={{ flex: 1, padding: '11px 14px', borderRadius: '8px', border: `1.5px solid ${fb.error ? '#fca5a5' : '#e2e8f0'}`, fontSize: '0.9rem', fontFamily: 'Montserrat, sans-serif', outline: 'none' }}
                              />
                              <button
                                onClick={() => handleFeedbackSubmit(order.id, menu)}
                                disabled={isSubmitting || !fb.comment?.trim()}
                                style={{ minWidth: '90px', height: '44px', borderRadius: '8px', border: 'none', background: isSubmitting ? '#0891a3' : '#037A8B', color: '#fff', fontWeight: 700, cursor: isSubmitting ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '0.88rem', opacity: (!fb.comment?.trim() && !isSubmitting) ? 0.5 : 1, transition: 'all 0.2s', fontFamily: 'Montserrat, sans-serif' }}
                              >
                                {isSubmitting ? (
                                  <>
                                    <span style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.35)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
                                    Sende…
                                  </>
                                ) : 'Senden'}
                              </button>
                            </div>

                            {fb.error && (
                              <div style={{ fontSize: '0.82rem', color: '#dc2626', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '6px', padding: '8px 12px' }}>
                                ⚠️ {fb.error}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })()}

                </div>
              )
            })}
          </div>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  )
}
