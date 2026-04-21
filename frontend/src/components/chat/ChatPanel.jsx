import { useRef, useEffect, useState, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import { useAuth } from '../../context/AuthContext'

const REASONING_MESSAGES = [
  "Analysiere deine Anfrage...",
  "Durchsuche 177 Gerichte...",
  "Vergleiche Geschmacksprofile...",
  "Erstelle Empfehlung...",
  "Optimiere Menu-Zusammenstellung...",
  "Berechne AI Match Scores...",
]

function ReasoningLoader() {
  const [idx, setIdx] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => {
      setIdx(prev => (prev + 1) % REASONING_MESSAGES.length)
    }, 2500)
    return () => clearInterval(timer)
  }, [])
  return (
    <div className="msg msg--reasoning">
      <div className="msg__avatar msg__avatar--bot">
        <img src="/favicon.svg" alt="CaterNow" />
      </div>
      <div className="reasoning-bubble">
        <div className="reasoning-bar" />
        <span className="reasoning-text">{REASONING_MESSAGES[idx]}</span>
      </div>
    </div>
  )
}

const SERVICE_META = {
  'Geschirr/Besteck':                              { icon: '🍽️', sub: 'Teller & Besteck' },
  'Gläser':                                        { icon: '🥂', sub: 'Wein, Sekt & Wasser' },
  'Dekoration':                                    { icon: '🌸', sub: 'Tischdeko & Ambiente' },
  'Personal (z. B. Servicekräfte, Barkeeper)':     { icon: '👨‍🍳', sub: 'Service & Bar' },
  'Mietmöbel (z. B. Tische, Stühle)':             { icon: '🪑', sub: 'Tische & Stühle' },
}

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
  step,
  customWish = '',
  onCustomWishChange
}) {
  const { currentUser } = useAuth()
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
            return <ReasoningLoader key={i} />
          }
          const isBot = msg.role === 'bot'
          return (
            <div key={i} className={`msg msg--${msg.role}`}>
              <div className={`msg__avatar ${isBot ? 'msg__avatar--bot' : 'msg__avatar--user'}`}>
                {isBot ? (
                  <img src="/favicon.svg" alt="CaterNow" />
                ) : (
                  currentUser?.photoURL ? (
                    <img src={currentUser.photoURL} alt="User" referrerPolicy="no-referrer" />
                  ) : (
                    <span>{currentUser?.displayName?.charAt(0).toUpperCase() || '👤'}</span>
                  )
                )}
              </div>
              <div className="msg__bubble">
                <ReactMarkdown components={{
                  p: ({children}) => <span>{children}</span>,
                }}>{msg.text || ''}</ReactMarkdown>
              </div>
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

        {/* Service-Auswahl Cards (Step 3) */}
        {step === 3 && quickReplies.length > 0 && !isEventSelection && (
          <div className="service-selection">
            <p className="service-selection__hint">Mehrfachauswahl möglich</p>
            <div className="service-grid">
              {quickReplies.filter(r => r !== 'Nein, danke').map(reply => {
                const meta = SERVICE_META[reply] || { icon: '✓', sub: '' }
                const isSelected = selectedServices.includes(reply)
                const mainLabel = reply.split(' (')[0]
                return (
                  <button
                    key={reply}
                    className={`service-card ${isSelected ? 'service-card--active' : ''}`}
                    onClick={() => onQuickReply(reply)}
                    disabled={isWaiting}
                  >
                    {isSelected && <span className="service-card__check">✓</span>}
                    <span className="service-card__icon">{meta.icon}</span>
                    <span className="service-card__label">{mainLabel}</span>
                    <span className="service-card__sub">{meta.sub}</span>
                  </button>
                )
              })}
            </div>
            {/* Sonderwünsche Freitextfeld */}
            <div className="service-custom-wish">
              <textarea
                className="service-custom-wish__input"
                placeholder="Sonderwünsche eingeben (z.B. vegane Optionen, Allergien, spezielle Deko-Wünsche...)"
                value={customWish}
                onChange={e => onCustomWishChange(e.target.value)}
                disabled={isWaiting}
                rows={2}
                maxLength={500}
              />
            </div>

            <button
              className="service-skip-btn"
              onClick={() => onQuickReply('Nein, danke')}
              disabled={isWaiting}
            >
              Ohne Extras fortfahren
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            </button>
          </div>
        )}

        {/* Quick-Reply Buttons (alle anderen Steps) */}
        {quickReplies.length > 0 && !isEventSelection && step !== 3 && (
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
