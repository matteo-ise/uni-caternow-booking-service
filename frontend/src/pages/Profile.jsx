import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/Navbar'

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
      const resp = await fetch('http://localhost:8000/api/users/me/orders', {
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

  const handleFeedbackSubmit = async (orderId) => {
    const fb = feedbackState[orderId]
    if (!fb || !fb.comment) return alert('Bitte einen Kommentar eingeben.')

    try {
      const token = await currentUser.getIdToken()
      // Needs a dishId map from the backend ideally, but we can submit with just names if backend accepts, 
      // or we just submit general feedback for the order for now to keep it robust.
      // Wait, in this quick version let's submit it as general if we don't have the dish DB id.
      // Or we fetch dishes to map them. For demo, we submit as general.
      
      const payload = {
        order_id: orderId,
        rating: fb.rating || 5,
        comment: fb.comment,
        is_general: true, // simplified for demo
        dish_id: null
      }

      const resp = await fetch('http://localhost:8000/api/feedback', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify(payload)
      })

      if (resp.ok) {
        alert('Danke! Dein Feedback hilft unserer KI, noch besser zu werden.')
        setFeedbackState(prev => ({ ...prev, [orderId]: { ...prev[orderId], comment: '' } }))
      }
    } catch (err) {
      console.error(err)
    }
  }

  const updateFeedback = (orderId, field, value) => {
    setFeedbackState(prev => ({
      ...prev,
      [orderId]: { ...(prev[orderId] || {}), [field]: value }
    }))
  }

  if (loading) return <div>Lade Profil...</div>

  return (
    <>
      <Navbar />
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 20px', fontFamily: 'Montserrat, sans-serif' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: '#0f172a', marginBottom: '8px' }}>Mein Profil</h1>
        <p style={{ color: '#64748b', marginBottom: '40px' }}>Eingeloggt als {currentUser?.email}</p>

        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, borderBottom: '2px solid #e2e8f0', paddingBottom: '16px', marginBottom: '24px' }}>Meine Bestellungen</h2>

        {orders.length === 0 ? (
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
                  <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontWeight: 700, marginBottom: '8px', fontSize: '0.95rem' }}>🌟 Bewerte diese Bestellung</div>
                    <p style={{ fontSize: '0.85rem', color: '#475569', marginBottom: '16px' }}>Dein Feedback wird genutzt, um unsere KI-Empfehlungen für die Zukunft zu verbessern!</p>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <select 
                        value={feedbackState[order.id]?.rating || 5} 
                        onChange={e => updateFeedback(order.id, 'rating', parseInt(e.target.value))}
                        style={{ padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                      >
                        <option value="5">⭐⭐⭐⭐⭐ Perfekt</option>
                        <option value="4">⭐⭐⭐⭐ Sehr gut</option>
                        <option value="3">⭐⭐⭐ Okay</option>
                        <option value="2">⭐⭐ Nicht so gut</option>
                        <option value="1">⭐ Schlecht</option>
                      </select>
                      <input 
                        type="text" 
                        placeholder="Was können wir besser machen? (z.B. Portionen waren riesig!)" 
                        value={feedbackState[order.id]?.comment || ''}
                        onChange={e => updateFeedback(order.id, 'comment', e.target.value)}
                        style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                      />
                      <button 
                        onClick={() => handleFeedbackSubmit(order.id)}
                        style={{ background: '#037A8B', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}
                      >
                        Senden
                      </button>
                    </div>
                  </div>

                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
