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

  const leadId = useMemo(() => {
    const name = currentUser?.displayName?.replace(/\s/g, '') || 'guest'
    return `${name}-${Date.now()}`
  }, [currentUser])

  useEffect(() => {
    if (step === 2 && messages.length === 0) {
      const welcome = `Hallo ${currentUser?.displayName || 'Feinschmecker'}! Ich bin Chatty. 🥂 Schön, dass du da bist! Erzähl mir mal: Was für ein Event planst du genau?`
      addBotMessage(welcome)
      setQuickReplies(['Geburtstag', 'Firmenevent', 'Hochzeit', 'Weihnachtsfeier'])
    }
  }, [step, currentUser])

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function addBotMessage(text) {
    setMessages(prev => [...prev, { role: 'model', content: text }])
  }

  const handleSend = useCallback(async (text) => {
    const trimmed = text.trim()
    if (!trimmed || isWaiting) return

    setInputValue('')
    setQuickReplies([])
    const userMsg = { role: 'user', content: trimmed }
    const updatedMessages = [...messages, userMsg]
    setMessages(updatedMessages)
    setIsWaiting(true)
    setMessages(prev => [...prev, { role: 'loading', content: '' }])

    try {
      const response = await fetch('http://localhost:8000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation: updatedMessages, wizardData: wizardData, leadId: leadId })
      })
      
      if (!response.ok) throw new Error("API Error")

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let fullText = ''
      let isFirstChunk = true

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        fullText += chunk
        if (isFirstChunk && chunk.trim()) isFirstChunk = false
        setMessages(prev => {
          const newMsgs = [...prev]
          newMsgs[newMsgs.length - 1] = { role: isFirstChunk ? 'loading' : 'model', content: fullText }
          return newMsgs
        })
      }

      const jsonMatch = fullText.match(/\[MENU_JSON\](.*?)\[\/MENU_JSON\]/s)
      if (jsonMatch) {
        try {
          const data = JSON.parse(jsonMatch[1].trim())
          const newOptions = {
            vorspeise: data.vorspeise?.alternativen || (data.vorspeise ? [data.vorspeise] : []),
            hauptspeise1: data.hauptgericht1?.alternativen || (data.hauptgericht1 ? [data.hauptgericht1] : []),
            hauptspeise2: data.hauptgericht2?.alternativen || (data.hauptgericht2 ? [data.hauptgericht2] : []),
            nachspeise: data.dessert?.alternativen || (data.dessert ? [data.dessert] : []),
          }
          setMenuOptions(newOptions)
          setMenu({
            vorspeise: data.vorspeise || null,
            hauptspeise1: data.hauptgericht1 || null,
            hauptspeise2: data.hauptgericht2 || null,
            nachspeise: data.dessert || null
          })
        } catch (e) { console.error("JSON Parse Error", e) }
      }

      const cleanText = fullText.replace(/\[MENU_JSON\].*?\[\/MENU_JSON\]/gs, '').trim()
      setMessages(prev => {
        const newMsgs = [...prev]
        newMsgs[newMsgs.length - 1] = { role: 'model', content: cleanText }
        return newMsgs
      })
    } catch (err) {
      setMessages(prev => {
        const newMsgs = [...prev]
        newMsgs[newMsgs.length - 1] = { role: 'model', content: "Ups, da hat die Verbindung kurz gewackelt. 😉" }
        return newMsgs
      })
    } finally { setIsWaiting(false) }
  }, [messages, isWaiting, wizardData, leadId])

  function handleMenuSelect(course, dish) {
    if (course === 'TRIGGER_UPSELL') {
      handleSend("Hauptspeise 1 gefällt mir sehr gut! Was würdest du als zweite Hauptspeise dazu empfehlen, damit für jeden Gast etwas dabei ist?")
      return
    }
    setMenu(prev => ({ ...prev, [course]: dish }))
  }

  function handleMenuConfirm() {
    setStep(3)
    addBotMessage("Hervorragende Wahl! Das sieht nach einem absoluten Festmahl aus. ✨ Möchtest du noch Services wie Geschirr oder Personal dazu buchen?")
    setQuickReplies(['Geschirr & Besteck', 'Servicepersonal', 'Deko & Blumen', 'Nein, danke'])
  }

  function handleWeiter() { setStep(4) }
  function handleNavigate(targetStep) { setStep(targetStep) }
  async function handleSubmit() {
    if (!currentUser) {
      alert("Bitte logge dich ein, um die Anfrage abzuschließen!")
      return
    }
    
    try {
      const token = await currentUser.getIdToken()
      const payload = {
        lead_id: leadId,
        total_price: 0, // calculate from menu if needed
        order_data: {
          menu: menu,
          services: selectedServices,
          event_details: wizardData
        }
      }

      const resp = await fetch('http://localhost:8000/api/orders', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify(payload)
      })

      if (resp.ok) {
        setStep(5)
      } else {
        alert("Es gab ein Problem bei der Übermittlung.")
      }
    } catch(err) {
      console.error(err)
      alert("Netzwerkfehler.")
    }
  }

  return (
    <>
      <div className="modal-backdrop" onClick={step < 4 ? onClose : undefined} aria-hidden />
      <div className={`modal ${step > 1 ? 'modal--fullscreen' : ''}`} role="dialog" aria-modal aria-label="Catersmart Beratung">
        <div className="modal__header">
          <ProgressTimeline step={step} onNavigate={step < 4 ? handleNavigate : () => {}} />
          {step < 4 && (
            <button className="modal__close" onClick={onClose} aria-label="Schließen">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6"  y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}
        </div>
        <div className="modal__content">
          {step === 1 && <Step1Wizard onNext={data => { setWizardData(data); setStep(2) }} onClose={onClose} />}
          {(step === 2 || step === 3) && (
            <div className="chat-layout">
              <div className="chat-layout__left">
                <ChatPanel
                  messages={messages.map(m => ({ role: m.role === 'model' ? 'bot' : m.role, text: m.content }))}
                  inputValue={inputValue} onInput={setInputValue} onSend={handleSend} onQuickReply={handleSend} quickReplies={quickReplies} isWaiting={isWaiting}
                />
              </div>
              <div className="chat-layout__right">
                <MenuCanvas menuOptions={menuOptions} menu={menu} onSelect={handleMenuSelect} onConfirm={handleMenuConfirm} step={step} />
                {step === 3 && <button className="btn-filled canvas__weiter" onClick={handleWeiter}>Bestellung prüfen →</button>}
              </div>
            </div>
          )}
          {step === 4 && <Step4Final menu={menu} selectedServices={selectedServices} wizardData={wizardData} onSubmit={handleSubmit} userEmail={currentUser?.email} />}
          {step === 5 && (
            <div style={{ padding: '60px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <div style={{ fontSize: '4rem', marginBottom: '20px', animation: 'bounce 2s infinite' }}>🎉🥚✨</div>
              <h2 style={{ fontSize: '2.5rem', fontWeight: 800, color: '#037A8B', marginBottom: '16px' }}>Frohe Ostern & Guten Appetit!</h2>
              <p style={{ fontSize: '1.2rem', color: '#475569', maxWidth: '600px', lineHeight: '1.6', marginBottom: '40px' }}>
                Deine Anfrage wurde erfolgreich übermittelt! Wir zaubern jetzt im Hintergrund und melden uns in Kürze bei dir.
              </p>
              <button className="btn-filled" onClick={onClose} style={{ padding: '16px 40px', fontSize: '1.1rem' }}>Zurück zur Startseite</button>
              <style jsx>{`
                @keyframes bounce {
                  0%, 100% { transform: translateY(0); }
                  50% { transform: translateY(-20px); }
                }
              `}</style>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
