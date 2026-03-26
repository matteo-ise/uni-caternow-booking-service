import { useState } from 'react'
import Navbar      from './components/Navbar'
import HeroSection from './components/HeroSection'
import ChatButton  from './components/ChatButton'
import ChatModal   from './components/chat/ChatModal'

export default function App() {
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
