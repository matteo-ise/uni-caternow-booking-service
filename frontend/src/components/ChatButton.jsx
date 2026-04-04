export default function ChatButton({ isOpen, onToggle, disabled }) {
  return (
    <button
      className="chat-fab"
      onClick={onToggle}
      aria-label={isOpen ? 'Chat schließen' : 'Chat öffnen'}
      disabled={disabled}
      style={{ cursor: disabled ? 'not-allowed' : 'pointer', filter: disabled ? 'grayscale(1)' : 'none' }}
    >
      {/* Grüner Online-Indikator – nur wenn geschlossen */}
      {!isOpen && <span className="chat-fab-badge" aria-hidden />}

      {isOpen ? (
        /* X-Icon wenn offen */
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" strokeWidth="2.5" aria-hidden>
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6"  y1="6" x2="18" y2="18"/>
        </svg>
      ) : (
        /* Chat-Bubble-Icon wenn geschlossen */
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      )}
    </button>
  )
}
