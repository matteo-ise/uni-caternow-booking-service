import { useState, useEffect, useRef } from 'react'
import logo from '../assets/caternow-logo.svg'

const API_URL = 'http://localhost:8000/api/chat'
const DEMO_MODE = true  // auf false setzen wenn Backend läuft

const DEMO_RESPONSES = [
  'Sehr schön! Für dein Event empfehle ich:\n\n🥗 Vorspeise: Toskanischer Antipasti-Teller mit Bruschetta\n🍖 Hauptgang: Gefüllte Paprika mit Rinderhack und Tomatensauce\n🍮 Nachspeise: Milchreis mit Zimt und Zucker\n\nSoll ich etwas anpassen oder weitere Optionen zeigen?',
  'Gerne! Für vegetarische Gäste empfehle ich:\n\n🥗 Vorspeise: Gemüsefrikadellen mit Wildreisbeilage\n🌿 Hauptgang: Auberginenmoussaka – ein mediterraner Klassiker\n🍰 Nachspeise: Frisches Dessert nach Saison\n\nAlles ohne Fleisch und sehr aromatisch. Passt das?',
  'Perfekt für einen Business-Lunch! Mein Vorschlag:\n\n🥗 Vorspeise: Leichte Tagessuppe\n🐔 Hauptgang: Toskanisches Geflügel mit Oreganokartoffeln und Honigkarotten\n🍮 Nachspeise: Kleines Dessert\n\nElegant, sättigend und professionell. Möchtest du die Anfrage starten?',
]

const CHIPS = [
  { label: 'Hochzeitsmenü',  text: 'Ich plane eine Hochzeit für 60 Personen' },
  { label: 'Business Lunch', text: 'Wir brauchen Catering für ein Firmenevent' },
  { label: 'Vegetarisch',    text: 'Ich suche rein vegetarische Optionen' },
]

export default function ChatWindow({ onClose }) {
  const [messages, setMessages] = useState([
    {
      role: 'bot',
      text: 'Willkommen bei CaterNow! 🍽️\n\nIch bin dein persönlicher Menü-Berater. Erzähl mir von deinem Anlass – z.B. eine Hochzeit, ein Firmenevent oder eine private Feier – und ich stelle ein passendes 3-Gang-Menü zusammen.',
    },
  ])
  const [inputValue, setInputValue]   = useState('')
  const [isWaiting, setIsWaiting]     = useState(false)
  const [showChips, setShowChips]     = useState(true)
  const [conversation, setConversation] = useState([])
  const [demoIdx, setDemoIdx]         = useState(0)
  const messagesEndRef                = useRef(null)
  const inputRef                      = useRef(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  async function send(text) {
    const trimmed = text.trim()
    if (!trimmed || isWaiting) return

    setShowChips(false)
    setInputValue('')
    setIsWaiting(true)

    const newConversation = [...conversation, { role: 'user', content: trimmed }]
    setConversation(newConversation)
    setMessages(prev => [...prev, { role: 'user', text: trimmed }, { role: 'loading' }])

    try {
      let reply

      if (DEMO_MODE) {
        await sleep(1000 + Math.random() * 700)
        reply = DEMO_RESPONSES[demoIdx % DEMO_RESPONSES.length]
        setDemoIdx(i => i + 1)
      } else {
        const res = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversation: newConversation }),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        reply = data.message
      }

      setConversation(prev => [...prev, { role: 'model', content: reply }])
      setMessages(prev => [...prev.filter(m => m.role !== 'loading'), { role: 'bot', text: reply }])
    } catch {
      setMessages(prev => [
        ...prev.filter(m => m.role !== 'loading'),
        { role: 'bot', text: 'Entschuldigung, da ist etwas schiefgelaufen. Bitte versuch es erneut.' },
      ])
    } finally {
      setIsWaiting(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send(inputValue)
    }
  }

  return (
    <div className="chat-window" role="dialog" aria-label="CaterNow Beratungs-Chat">
      {/* Header */}
      <div className="chat-header">
        <div className="chat-header-left">
          <img src={logo} alt="CaterNow" className="chat-header-logo" />
          <div className="chat-header-info">
            <div className="chat-header-name">Cater Now Beratung</div>
            <div className="chat-header-status">
              <span className="chat-status-dot" />
              Online – antwortet sofort
            </div>
          </div>
        </div>
        <button className="chat-close-btn" onClick={onClose} aria-label="Chat schließen">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6"  y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      {/* Nachrichtenverlauf */}
      <div className="chat-messages">
        {messages.map((msg, i) => {
          if (msg.role === 'loading') {
            return (
              <div key={i} className="msg msg--loading">
                <span /><span /><span />
              </div>
            )
          }
          return (
            <div key={i} className={`msg msg--${msg.role}`}>
              {msg.text}
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick-Reply-Chips */}
      {showChips && (
        <div className="chat-chips">
          {CHIPS.map(chip => (
            <button
              key={chip.label}
              className="chip"
              onClick={() => send(chip.text)}
            >
              {chip.label}
            </button>
          ))}
        </div>
      )}

      {/* Eingabe */}
      <div className="chat-input-row">
        <input
          ref={inputRef}
          type="text"
          className="chat-input"
          placeholder="Deine Nachricht…"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isWaiting}
          maxLength={500}
          autoComplete="off"
        />
        <button
          className="chat-send-btn"
          onClick={() => send(inputValue)}
          disabled={isWaiting || !inputValue.trim()}
          aria-label="Senden"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="2">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>
    </div>
  )
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
