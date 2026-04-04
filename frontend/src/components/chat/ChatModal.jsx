import { useState, useEffect, useCallback, useMemo } from 'react'
import ProgressTimeline from './ProgressTimeline'
import Step1Wizard      from './Step1Wizard'
import ChatPanel        from './ChatPanel'
import MenuCanvas       from './MenuCanvas'
import Step4Final       from './Step4Final'
import { useAuth }      from '../../context/AuthContext'

export default function ChatModal({ onClose }) {
  const { currentUser } = useAuth()
  const [step,             setStep]         = useState(1)
  const [wizardData,       setWizardData]   = useState({})
  const [messages,         setMessages]     = useState([])
  const [quickReplies,     setQuickReplies] = useState([])
  const [inputValue,       setInputValue]   = useState('')
  const [isWaiting,        setIsWaiting]    = useState(false)
  const [menuOptions,      setMenuOptions]  = useState({ vorspeise: [], hauptspeise1: [], hauptspeise2: [], nachspeise: [] })
  const [menu,             setMenu]         = useState({ vorspeise: null, hauptspeise1: null, hauptspeise2: null, nachspeise: null })
  const [selectedServices, setServices]     = useState([])

  // Generate a unique lead ID for this session
  const leadId = useMemo(() => {
    const name = currentUser?.displayName?.replace(/\s/g, '') || 'guest'
    return `${name}-${Date.now()}`
  }, [currentUser])

  // Init chat when entering step 2
  useEffect(() => {
    if (step === 2 && messages.length === 0) {
      const welcome = `Hallo ${currentUser?.displayName || 'Feinschmecker'}! Ich bin Chatty. 🥂 Schön, dass du da bist! Erzähl mir mal: Was für ein Event planst du genau?`
      addBotMessage(welcome)
      setQuickReplies(['Geburtstag', 'Firmenevent', 'Hochzeit', 'Weihnachtsfeier'])
    }
  }, [step, currentUser])

  // Close on Escape
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // ── Helpers ────────────────────────────────────────────────────────────
  function addBotMessage(text) {
    setMessages(prev => [...prev, { role: 'model', content: text }])
  }

  function addUserMessage(text) {
    setMessages(prev => [...prev, { role: 'user', content: text }])
  }

  // ── Chat-Logik ──────────────────────────────────────────────────────────
  const handleSend = useCallback(async (text) => {
    const trimmed = text.trim()
    if (!trimmed || isWaiting) return

    setInputValue('')
    setQuickReplies([])
    const newMessages = [...messages, { role: 'user', content: trimmed }]
    setMessages(newMessages)
    setIsWaiting(true)

    try {
      const response = await fetch('http://localhost:8000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation: newMessages,
          wizardData: wizardData,
          leadId: leadId
        })
      })
      
      if (response.ok) {
        const data = await response.json()
        addBotMessage(data.message)
      } else {
        throw new Error("API Error")
      }
    } catch (err) {
      addBotMessage("Ups, da hat die Verbindung kurz gewackelt. Kannst du das nochmal sagen? 😉")
    } finally {
      setIsWaiting(false)
    }
  }, [messages, isWaiting, wizardData, leadId])

  // ── Handlers ─────────────────────────────────────────────────────────
  function handleMenuSelect(course, dish) {
    setMenu(prev => ({ ...prev, [course]: dish }))
  }

  function handleMenuConfirm() {
    setStep(3)
    addBotMessage("Hervorragende Wahl! Das sieht nach einem absoluten Festmahl aus. ✨ Möchtest du noch Services wie Geschirr oder Personal dazu buchen?")
    setQuickReplies(['Geschirr & Besteck', 'Servicepersonal', 'Deko & Blumen', 'Nein, danke'])
  }

  function handleWeiter() {
    setStep(4)
  }

  function handleNavigate(targetStep) {
    setStep(targetStep)
  }

  function handleSubmit() {
    alert('Bestellung abgeschickt! Wir melden uns in Kürze bei dir. 🚀')
  }

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <>
      {/* Backdrop */}
      <div className="modal-backdrop" onClick={onClose} aria-hidden />

      {/* Modal */}
      <div className={`modal ${step > 1 ? 'modal--fullscreen' : ''}`} role="dialog" aria-modal aria-label="Catersmart Beratung">

        {/* Header: Timeline + Close */}
        <div className="modal__header">
          <ProgressTimeline step={step} onNavigate={handleNavigate} />
          <button className="modal__close" onClick={onClose} aria-label="Schließen">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6"  y1="18" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="modal__content">
          {step === 1 && (
            <Step1Wizard
              onNext={data => { setWizardData(data); setStep(2) }}
              onClose={onClose}
            />
          )}

          {(step === 2 || step === 3) && (
            <div className="chat-layout">
              {/* Linke Spalte: Chat */}
              <div className="chat-layout__left">
                <ChatPanel
                  messages={messages.map(m => ({ role: m.role === 'model' ? 'bot' : m.role, text: m.content }))}
                  inputValue={inputValue}
                  onInput={setInputValue}
                  onSend={handleSend}
                  onQuickReply={handleSend}
                  quickReplies={quickReplies}
                  isWaiting={isWaiting}
                />
              </div>

              {/* Rechte Spalte: Canvas */}
              <div className="chat-layout__right">
                <MenuCanvas
                  menuOptions={menuOptions}
                  menu={menu}
                  onSelect={handleMenuSelect}
                  onConfirm={handleMenuConfirm}
                  step={step}
                />
                {/* Weiter-Button in Step 3 */}
                {step === 3 && (
                  <button className="btn-filled canvas__weiter" onClick={handleWeiter}>
                    Bestellung prüfen →
                  </button>
                )}
              </div>
            </div>
          )}

          {step === 4 && (
            <Step4Final
              menu={menu}
              selectedServices={selectedServices}
              wizardData={wizardData}
              onSubmit={handleSubmit}
            />
          )}
        </div>
      </div>
    </>
  )
}
