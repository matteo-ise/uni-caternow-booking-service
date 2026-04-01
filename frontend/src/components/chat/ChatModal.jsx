import { useState, useEffect, useCallback } from 'react'
import ProgressTimeline from './ProgressTimeline'
import Step1Wizard      from './Step1Wizard'
import ChatPanel        from './ChatPanel'
import MenuCanvas       from './MenuCanvas'
import Step4Final       from './Step4Final'

// ── Dummy-Daten ──────────────────────────────────────────────────────────
const EVENT_REPLIES   = ['Geburtstag', 'Hochzeit', 'Weihnachtsfeier', 'Sommerfest', '…', 'Noch nicht sicher']
const CUISINE_REPLIES = ['Italienisch', 'Asiatisch', 'Mediterran', 'Deutsch', 'International', 'Ich bin offen']
const SERVICE_REPLIES = ['Geschirr', 'Kellner', 'Dekoration', 'Nein danke']

const MENU_OPTIONS = {
  vorspeise:    ['Toskanischer Antipasti-Teller', 'Bruschetta mit Tomaten & Basilikum', 'Kürbiscremesuppe'],
  hauptspeise1: ['Geflügel mit Oreganokartoffeln & Honigkarotten', 'Gefüllte Paprika mit Rinderhack', 'Auberginenmoussaka'],
  hauptspeise2: ['Gemüsefrikadellen mit Wildreis', 'Hühnchenfrikadelle mit Zitronensauce', 'Vegetarische Lasagne'],
  nachspeise:   ['Tiramisu', 'Panna Cotta mit Beerensauce', 'Mousse au Chocolat'],
}

const WELCOME = 'Hi, ich bin Catersmart Chatty! 🍽️\n\nErzähl mir von deinem Event und wir erstellen zusammen dein perfektes Menü!'
// ────────────────────────────────────────────────────────────────────────

export default function ChatModal({ onClose }) {
  const [step,             setStep]         = useState(1)
  const [wizardData,       setWizardData]   = useState({})
  const [messages,         setMessages]     = useState([])
  const [chatPhase,        setChatPhase]    = useState('event')   // event | cuisine | open | services | done
  const [quickReplies,     setQuickReplies] = useState([])
  const [inputValue,       setInputValue]   = useState('')
  const [isWaiting,        setIsWaiting]    = useState(false)
  const [menuOptions,      setMenuOptions]  = useState({ vorspeise: [], hauptspeise1: [], hauptspeise2: [], nachspeise: [] })
  const [menu,             setMenu]         = useState({ vorspeise: null, hauptspeise1: null, hauptspeise2: null, nachspeise: null })
  const [selectedServices, setServices]     = useState([])
  const [servicesConfirmed, setServicesConfirmed] = useState(false)

  // Init chat when entering step 2
  useEffect(() => {
    if (step === 2 && messages.length === 0) {
      addBotMessage(WELCOME)
      setTimeout(() => setQuickReplies(EVENT_REPLIES), 600)
    }
    if (step === 3 && chatPhase !== 'services') {
      setChatPhase('services')
      addBotMessage('Super Wahl! 🎉\n\nMöchtest du noch Zusatz-Services dazu buchen?')
      setTimeout(() => setQuickReplies(SERVICE_REPLIES), 400)
    }
  }, [step])

  // Close on Escape
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // ── Helpers ────────────────────────────────────────────────────────────
  function addBotMessage(text) {
    setMessages(prev => [...prev, { role: 'bot', text }])
  }

  function addUserMessage(text) {
    setMessages(prev => [...prev, { role: 'user', text }])
  }

  function addLoading() {
    setMessages(prev => [...prev, { role: 'loading' }])
  }

  function removeLoading() {
    setMessages(prev => prev.filter(m => m.role !== 'loading'))
  }

  // ── Chat-Logik ──────────────────────────────────────────────────────────
  const handleSend = useCallback((text) => {
    const trimmed = text.trim()
    if (!trimmed || isWaiting) return

    setInputValue('')
    setQuickReplies([])
    addUserMessage(trimmed)
    setIsWaiting(true)
    addLoading()

    setTimeout(() => {
      removeLoading()
      respondToMessage(trimmed)
      setIsWaiting(false)
    }, 900 + Math.random() * 500)
  }, [chatPhase, isWaiting, wizardData])

  function respondToMessage(text) {
    if (chatPhase === 'event') {
      addBotMessage(`${text} – eine tolle Wahl! 🎊\n\nWelche Küche bevorzugst du?`)
      setQuickReplies(CUISINE_REPLIES)
      setChatPhase('cuisine')

    } else if (chatPhase === 'cuisine') {
      addBotMessage(`Perfekt! Ich stelle ein ${text.toLowerCase()} inspiriertes Menü für ${wizardData.persons || '?'} Personen zusammen…`)
      setChatPhase('building')
      setTimeout(() => {
        setMenuOptions(MENU_OPTIONS)
        addBotMessage('Hier sind meine Vorschläge! 👉\n\nWähle im Menü-Canvas rechts deine Lieblingsgerichte. Schreib mir gerne, wenn du etwas anpassen möchtest.')
        setChatPhase('open')
      }, 1400)

    } else if (chatPhase === 'services') {
      if (text === 'Nein danke') {
        addBotMessage('Alles klar! Dein Menü ist fertig. Klicke auf „Weiter" um die Zusammenfassung zu sehen.')
        setServicesConfirmed(true)
        setQuickReplies([])
      } else {
        const updated = selectedServices.includes(text)
          ? selectedServices.filter(s => s !== text)
          : [...selectedServices, text]
        setServices(updated)
        addBotMessage(`Ich habe "${text}" für dich notiert. Möchtest du noch weitere Services?`)
        setQuickReplies(SERVICE_REPLIES.filter(s => s !== text && s !== 'Nein danke').concat(['Nein danke']))
        if (updated.length >= SERVICE_REPLIES.length - 1) setServicesConfirmed(true)
      }

    } else {
      // Freier Chat in Phase 'open'
      addBotMessage('Ich habe deine Anmerkung notiert! Wenn du möchtest, passe ich das Menü entsprechend an. 😊')
    }
  }

  // ── Handlers ─────────────────────────────────────────────────────────
  function handleMenuSelect(course, dish) {
    setMenu(prev => ({ ...prev, [course]: dish }))
  }

  function handleMenuConfirm() {
    setStep(3)
  }

  function handleWeiter() {
    setStep(4)
  }

  function handleNavigate(targetStep) {
    setStep(targetStep)
    // Services-Status zurücksetzen wenn man vor Schritt 3 zurückgeht
    if (targetStep < 3) {
      setServicesConfirmed(false)
      setServices([])
    }
  }

  function handleSubmit() {
    alert('Anfrage gesendet! (Demo-Modus)')
  }

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <>
      {/* Backdrop */}
      <div className="modal-backdrop" onClick={onClose} aria-hidden />

      {/* Modal */}
      <div className="modal" role="dialog" aria-modal aria-label="Catersmart Beratung">

        {/* Header: Timeline + Close */}
        <div className="modal__header">
          <ProgressTimeline step={step} onNavigate={handleNavigate} />
          <button className="modal__close" onClick={onClose} aria-label="Schließen">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6"  y1="6" x2="18" y2="18"/>
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
                  messages={messages}
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
                {step === 3 && servicesConfirmed && (
                  <button className="btn-filled canvas__weiter" onClick={handleWeiter}>
                    Weiter →
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
