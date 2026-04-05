import { useRef, useEffect, useState } from 'react'

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
  customerType,
  selectedServices = [],
  step
}) {
  const bottomRef = useRef(null)

  const [hasInteracted, setHasInteracted] = useState(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isEventSelection])

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      setHasInteracted(true)
      if (isEventSelection) {
        onEventSelect(inputValue)
      } else {
        onSend(inputValue)
      }
    }
  }

  const handleHotkeyClick = (text) => {
    const current = inputValue.trim();
    onInput(current ? `${current} ${text}` : text);
    setHasInteracted(true);
  }

  const SMART_HOTKEYS = [
    "etwas leichtes sommerliches ☀️",
    "etwas frisches/fruchtiges 🍓",
    "mit viel Protein 💪",
    "vegane Optionen 🌱",
    "Fingerfood 🍢",
    "italienischer Abend 🇮🇹"
  ];

  const currentEventCards = customerType === 'business' ? BUSINESS_EVENTS : PRIVATE_EVENTS
  const isInitialState = isEventSelection && messages.length <= 1;

  return (
    <div className={`chat-panel ${isInitialState ? 'chat-panel--centered' : ''}`}>
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
                <div className="msg__avatar" style={{ background: 'linear-gradient(135deg, #037A8B, #026373)', fontSize: '1rem' }}>🤖</div>
              )}
              <div className="msg__bubble" style={{ whiteSpace: 'pre-wrap' }}>{msg.text || ''}</div>
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
                <div key={ev.id} className="event-card" onClick={() => { setHasInteracted(true); onEventSelect(ev.id); }}>
                  <img 
                    src={ev.img} 
                    alt={ev.id} 
                    onError={(e) => {
                      e.target.onerror = null; 
                      e.target.src="https://images.unsplash.com/photo-1495191746160-713f09762446?auto=format&fit=crop&w=400&q=80"
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

      <div className={`chat-panel__input-area ${isInitialState ? 'input-area--hero' : ''}`}>
        {/* SMART HOTKEYS */}
        {!isEventSelection && (
          <div className="chat-panel__hotkeys-wrapper">
            <div className="hotkeys-scroll">
              <span className="hotkeys-label">Inspiration:</span>
              {SMART_HOTKEYS.map(hk => (
                <button
                  key={hk}
                  className="hotkey-chip"
                  onClick={() => handleHotkeyClick(hk)}
                  disabled={isWaiting}
                >
                  {hk}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Quick-Reply Buttons */}
        {quickReplies.length > 0 && !isEventSelection && (
          <div className="chat-panel__chips">
            {quickReplies.map(reply => {
              const isSelected = step === 3 && selectedServices.includes(reply);
              return (
                <button
                  key={reply}
                  className={`chip ${isSelected ? 'chip--active' : ''}`}
                  onClick={() => onQuickReply(reply)}
                  disabled={isWaiting}
                  style={isSelected ? { background: '#037A8B', color: '#fff', border: '1px solid #037A8B' } : {}}
                >
                  {isSelected && '✓ '}{reply}
                </button>
              )
            })}
          </div>
        )}

        {/* Eingabezeile */}
        <div className="chat-panel__input-row">
          <input
            type="text"
            className={`chat-panel__input ${isGlow ? 'input-glow' : ''}`}
            placeholder={isEventSelection ? "Eigenen Anlass eingeben..." : "Wünsche beschreiben..."}
            value={inputValue}
            onChange={e => onInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isWaiting}
            maxLength={500}
            autoComplete="off"
          />
          <button
            className={`chat-panel__send ${inputValue.trim() && !isWaiting ? 'chat-panel__send--pulse' : ''}`}
            onClick={() => { setHasInteracted(true); isEventSelection ? onEventSelect(inputValue) : onSend(inputValue); }}
            disabled={isWaiting || !inputValue.trim()}
            aria-label="Senden"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth="2.5">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
