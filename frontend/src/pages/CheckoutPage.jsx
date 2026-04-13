import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/Navbar'
import Step4Final from '../components/chat/Step4Final'
import { API_URL } from '../config'

export default function CheckoutPage() {
  const { checkoutId } = useParams()
  const { currentUser, loginWithGoogle } = useAuth()
  const navigate = useNavigate()

  const [checkoutData, setCheckoutData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [orderSubmitted, setOrderSubmitted] = useState(false)

  useEffect(() => {
    const fetchCheckout = async () => {
      try {
        const resp = await fetch(`${API_URL}/api/checkouts/${checkoutId}`)
        if (!resp.ok) {
          setError(resp.status === 404 ? 'Checkout nicht gefunden.' : 'Fehler beim Laden.')
          return
        }
        setCheckoutData(await resp.json())
      } catch {
        setError('Netzwerkfehler. Bitte versuche es erneut.')
      } finally {
        setLoading(false)
      }
    }
    fetchCheckout()
  }, [checkoutId])

  const handleSubmit = async (finalData) => {
    if (!currentUser) return
    const token = await currentUser.getIdToken()
    const payload = {
      lead_id: checkoutData.lead_id,
      total_price: finalData.totalPrice || 0,
      order_data: {
        menu: checkoutData.menu,
        services: checkoutData.selected_services,
        event_details: checkoutData.wizard_data,
        contact: { name: finalData.name, email: finalData.email, address: finalData.address },
        additionalNotes: finalData.additionalNotes,
        customWish: checkoutData.custom_wish,
      }
    }
    const resp = await fetch(`${API_URL}/api/orders`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    if (resp.ok) {
      setOrderSubmitted(true)
    }
  }

  if (loading) {
    return (
      <>
        <Navbar />
        <div style={{ height: '80vh', display: 'grid', placeItems: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: '16px' }}>Loading...</div>
            <p style={{ color: '#64748b' }}>Checkout wird geladen...</p>
          </div>
        </div>
      </>
    )
  }

  if (error) {
    return (
      <>
        <Navbar />
        <div style={{ height: '80vh', display: 'grid', placeItems: 'center' }}>
          <div style={{ textAlign: 'center', maxWidth: '400px' }}>
            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>404</div>
            <p style={{ color: '#64748b', fontSize: '1.1rem' }}>{error}</p>
            <button className="btn-filled" onClick={() => navigate('/')} style={{ marginTop: '24px', padding: '12px 32px' }}>
              Zur Startseite
            </button>
          </div>
        </div>
      </>
    )
  }

  if (!currentUser) {
    return (
      <>
        <Navbar />
        <div style={{ height: '80vh', display: 'grid', placeItems: 'center' }}>
          <div style={{ textAlign: 'center', maxWidth: '450px', padding: '40px', background: '#fff', borderRadius: '24px', border: '1px solid #e2e8f0', boxShadow: '0 8px 30px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🔐</div>
            <h2 style={{ fontWeight: 800, fontSize: '1.5rem', color: '#0f172a', marginBottom: '12px' }}>Anmelden erforderlich</h2>
            <p style={{ color: '#64748b', marginBottom: '24px', lineHeight: '1.6' }}>
              Bitte melde dich an, um diese Catering-Anfrage zu bearbeiten und abzuschicken.
            </p>
            <button
              onClick={loginWithGoogle}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px',
                width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0',
                background: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '1rem',
                fontFamily: 'Montserrat, sans-serif', transition: 'all 0.2s ease'
              }}
            >
              <svg width="20" height="20" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
              Mit Google anmelden
            </button>
          </div>
        </div>
      </>
    )
  }

  if (orderSubmitted) {
    return (
      <>
        <Navbar />
        <div style={{ height: '80vh', display: 'grid', placeItems: 'center' }}>
          <div style={{ textAlign: 'center', padding: '60px' }}>
            <div style={{ fontSize: '4rem', marginBottom: '20px' }}>🥂🍽️✨</div>
            <h2 style={{ fontSize: '2.5rem', fontWeight: 800, color: '#037A8B', marginBottom: '16px' }}>Vielen Dank!</h2>
            <p style={{ fontSize: '1.2rem', color: '#475569', maxWidth: '600px', lineHeight: '1.6', marginBottom: '40px' }}>
              Ihre Anfrage wurde erfolgreich gesendet. Wir melden uns in Kuerze bei Ihnen.
            </p>
            <button className="btn-filled" onClick={() => navigate('/profile')} style={{ padding: '16px 40px', fontSize: '1.1rem' }}>
              Zu meinen Bestellungen
            </button>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Navbar />
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '24px 20px' }}>
        <Step4Final
          menu={checkoutData.menu}
          selectedServices={checkoutData.selected_services}
          customWish={checkoutData.custom_wish || ''}
          wizardData={checkoutData.wizard_data}
          onSubmit={handleSubmit}
          userEmail={currentUser?.email}
          userName={currentUser?.displayName}
          leadId={checkoutData.lead_id}
          checkoutId={checkoutId}
        />
      </div>
    </>
  )
}
