import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom'
import Navbar      from './components/Navbar'
import HeroSection from './components/HeroSection'
import ChatButton  from './components/ChatButton'
import ChatModal   from './components/chat/ChatModal'
import Admin       from './pages/Admin'
import Profile     from './pages/Profile'
import { useAuth } from './context/AuthContext'
import { API_URL } from './config'

function Home() {
  const [chatOpen, setChatOpen] = useState(false)
  const [backendReady, setBackendReady] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('CaterNow startet! Gleich geht\'s los...')

  // Health Check Polling für Kaltstart-Abfang
  useEffect(() => {
    let intervalId;
    const checkHealth = async () => {
      try {
        const resp = await fetch(`${API_URL}/api/health`, { signal: AbortSignal.timeout(3000) })
        if (resp.ok) {
          setBackendReady(true)
          if (intervalId) clearInterval(intervalId)
        }
      } catch (err) {
        // Render Free Tier Spin-up takes time
        setLoadingMsg('CaterNow startet! Gleich geht\'s los...')
      }
    }
    
    checkHealth()
    if (!backendReady) {
      intervalId = setInterval(checkHealth, 5000) // Poll alle 5 Sekunden
    }
    return () => { if (intervalId) clearInterval(intervalId) }
  }, [backendReady])

  return (
    <>
      <Navbar />
      <main>
        {!backendReady && (
          <div style={{ background: '#fef08a', color: '#854d0e', padding: '12px', textAlign: 'center', fontWeight: 600, fontSize: '0.9rem' }}>
            ⏳ {loadingMsg}
          </div>
        )}
        <HeroSection onOpenChat={() => {
          if (backendReady) setChatOpen(true)
        }} disabled={!backendReady} />
      </main>

      <div style={{ opacity: backendReady ? 1 : 0.5, transition: 'opacity 0.3s' }}>
        <ChatButton 
          isOpen={chatOpen} 
          onToggle={() => {
            if (backendReady) setChatOpen(p => !p)
          }} 
          disabled={!backendReady}
        />
      </div>
      {backendReady && <ChatModal isOpen={chatOpen} onClose={() => setChatOpen(false)} />}
    </>
  )
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/profile" element={<Profile />} />
      </Routes>
    </Router>
  )
}

