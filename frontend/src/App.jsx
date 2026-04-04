import { useState } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Navbar      from './components/Navbar'
import HeroSection from './components/HeroSection'
import ChatButton  from './components/ChatButton'
import ChatModal   from './components/chat/ChatModal'
import Admin       from './pages/Admin'

function Home() {
  const [chatOpen, setChatOpen] = useState(false)

  return (
    <>
      <Navbar />
      <main>
        <HeroSection onOpenChat={() => setChatOpen(true)} />
      </main>

      <ChatButton isOpen={chatOpen} onToggle={() => setChatOpen(p => !p)} />
      {chatOpen && <ChatModal onClose={() => setChatOpen(false)} />}
    </>
  )
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </Router>
  )
}

