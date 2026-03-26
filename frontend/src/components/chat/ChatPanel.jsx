import { useRef, useEffect } from 'react'

export default function ChatPanel({
  messages,
  inputValue,
  onInput,
  onSend,
  onQuickReply,
  quickReplies,
  isWaiting,
}) {
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSend(inputValue)
    }
  }

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
        <div ref={bottomRef} />
      </div>

      {/* Quick-Reply Buttons */}
      {quickReplies.length > 0 && (
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
          className="chat-panel__input"
          placeholder="Nachricht schreiben…"
          value={inputValue}
          onChange={e => onInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isWaiting}
          maxLength={500}
          autoComplete="off"
        />
        <button
          className="chat-panel__send"
          onClick={() => onSend(inputValue)}
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
