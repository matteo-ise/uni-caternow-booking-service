import { useRef, useEffect } from 'react'

const BUSINESS_EVENTS = [
  { id: 'Firmenfeier', img: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=400&q=80' },
  { id: 'Konferenz', img: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=400&q=80' },
  { id: 'Seminar/Workshop', img: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=400&q=80' },
  { id: 'Networking-Event', img: 'https://images.unsplash.com/photo-1515187029135-18ee286d815b?auto=format&fit=crop&w=400&q=80' },
  { id: 'Produktpräsentation', img: 'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?auto=format&fit=crop&w=400&q=80' },
  { id: 'Messe', img: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=400&q=80' },
  { id: 'Weihnachtsfeier', img: 'https://images.unsplash.com/photo-1513885535751-8b9238bd345a?auto=format&fit=crop&w=400&q=80' }
]

const PRIVATE_EVENTS = [
  { id: 'Hochzeit', img: 'https://images.unsplash.com/photo-1519225421980-715cb0215aed?auto=format&fit=crop&w=400&q=80' },
  { id: 'Geburtstag', img: 'https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?auto=format&fit=crop&w=400&q=80' },
  { id: 'Private Dinner', img: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=400&q=80' },
  { id: 'Trauerfeier', img: 'https://images.unsplash.com/photo-1522037969399-e68fa707ea2f?auto=format&fit=crop&w=400&q=80' }
]

export default function ChatPanel({
  messages,
  inputValue,
  onInput,
  onSend,
  onQuickReply,
  quickReplies,
  isWaiting,
  isEventSelection,
  onEventSelect,
  isGlow,
  customerType // New prop
}) {
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isEventSelection])

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (isEventSelection) {
        onEventSelect(inputValue)
      } else {
        onSend(inputValue)
      }
    }
  }

  const currentEventCards = customerType === 'business' ? BUSINESS_EVENTS : PRIVATE_EVENTS

  return (
    <div className="chat-panel">
      {/* Nachrichtenverlauf */}
      <div className="chat-panel__messages">
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
              {msg.role === 'bot' && (
                <div className="msg__avatar">C</div>
              )}
              <div className="msg__bubble">{msg.text}</div>
            </div>
          )
        })}

        {/* Visual Event Selection Cards */}
        {isEventSelection && (
          <div className="event-cards-container">
            <div className="event-category-title">
              {customerType === 'business' ? 'Business & Corporate' : 'Private Anlässe'}
            </div>
            <div className="event-cards-grid">
              {currentEventCards.map(ev => (
                <div key={ev.id} className="event-card" onClick={() => onEventSelect(ev.id)}>
                  <img 
                    src={ev.img} 
                    alt={ev.id} 
                    onError={(e) => {
                      e.target.onerror = null; 
                      e.target.src="https://images.unsplash.com/photo-1495191746160-713f09762446?auto=format&fit=crop&w=400&q=80" // Generic Fallback
                    }}
                  />
                  <div className="event-card-overlay"><span className="event-card-title">{ev.id}</span></div>
                </div>
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick-Reply Buttons */}
      {quickReplies.length > 0 && !isEventSelection && (
        <div className="chat-panel__chips">
          {quickReplies.map(reply => (
            <button
              key={reply}
              className="chip"
              onClick={() => onQuickReply(reply)}
              disabled={isWaiting}
            >
              {reply}
            </button>
          ))}
        </div>
      )}

      {/* Eingabezeile */}
      <div className="chat-panel__input-row">
        <input
          type="text"
          className={`chat-panel__input ${isGlow ? 'input-glow' : ''}`}
          placeholder={isEventSelection ? "Anlass eingeben oder Karte wählen…" : "Nachricht schreiben…"}
          value={inputValue}
          onChange={e => onInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isWaiting}
          maxLength={500}
          autoComplete="off"
        />
        <button
          className="chat-panel__send"
          onClick={() => isEventSelection ? onEventSelect(inputValue) : onSend(inputValue)}
          disabled={isWaiting || !inputValue.trim()}
          aria-label="Senden"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="2.2">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>
    </div>
  )
}
