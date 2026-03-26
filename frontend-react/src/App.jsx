import { useState } from 'react'
import Navbar from './components/Navbar'
import HeroSection from './components/HeroSection'
import ChatButton from './components/ChatButton'
import ChatWindow from './components/ChatWindow'

export default function App() {
  const [chatOpen, setChatOpen] = useState(false)

  function openChat()  { setChatOpen(true) }
  function closeChat() { setChatOpen(false) }
  function toggleChat() { setChatOpen(prev => !prev) }

  return (
    <>
      <Navbar />

      <main>
        <HeroSection onOpenChat={openChat} />
      </main>

      {/* Chat-Widget */}
      {chatOpen && <ChatWindow onClose={closeChat} />}
      <ChatButton isOpen={chatOpen} onToggle={toggleChat} />
    </>
  )
}
