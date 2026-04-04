import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import ProgressTimeline from './ProgressTimeline'
import Step1Wizard      from './Step1Wizard'
import ChatPanel        from './ChatPanel'
import MenuCanvas       from './MenuCanvas'
import Step4Final       from './Step4Final'
import { useAuth }      from '../../context/AuthContext'
import { API_URL }      from '../../config'

export default function ChatModal({ isOpen, onClose }) {
  const { currentUser } = useAuth()
  const navigate = useNavigate()
  const [step,             setStep]         = useState(1)
  const [wizardData,       setWizardData]   = useState({})
  const [messages,         setMessages]     = useState([])
  const [quickReplies,     setQuickReplies] = useState([])
  const [inputValue,       setInputValue]   = useState('')
  const [isWaiting,        setIsWaiting]    = useState(false)
  const [isEventSelection, setIsEventSelection] = useState(false)
  const [hasSelectedEvent, setHasSelectedEvent] = useState(false)
  const [menuOptions,      setMenuOptions]  = useState({ vorspeise: [], hauptspeise1: [], hauptspeise2: [], nachspeise: [] })
  const [menu,             setMenu]         = useState({ vorspeise: null, hauptspeise1: null, hauptspeise2: null, nachspeise: null })
  const [selectedServices, setServices]     = useState([])

  const leadId = useMemo(() => {
    const name = currentUser?.displayName?.replace(/\s/g, '') || 'guest'
    return `${name}-${Date.now()}`
  }, [currentUser])

  useEffect(() => {
    if (step === 2 && messages.length === 0) {
      const name = currentUser?.displayName ? currentUser.displayName.split(' ')[0] : 'Gast'
      const welcome = `Guten Tag, ${name}. Schön, dass Sie die Planung in unsere Hände legen. Damit ich Ihnen eine erste Auswahl zusammenstellen kann: Welchen Anlass dürfen wir kulinarisch begleiten?`
      addBotMessage(welcome)
      setIsEventSelection(true)
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

  const handleEventSelect = (eventName) => {
    setIsEventSelection(false)
    setHasSelectedEvent(true)
    handleSend(eventName)
  }

  const handleSend = useCallback(async (text) => {
    const trimmed = text.trim()
    if (!trimmed || isWaiting) return

    setInputValue('')
    setQuickReplies([])

    // Tracking für zusätzliche Leistungen in Schritt 3
    if (step === 3 && trimmed !== 'Nein, danke' && trimmed !== 'Bestellung prüfen →') {
      setServices(prev => {
        if (prev.includes(trimmed)) return prev
        return [...prev, trimmed]
      })
    }

    const userMsg = { role: 'user', content: trimmed }
    const updatedMessages = [...messages, userMsg]
    setMessages(updatedMessages)
    setIsWaiting(true)
    setMessages(prev => [...prev, { role: 'loading', content: '' }])

    try {
      const response = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          conversation: updatedMessages, 
          wizardData: wizardData, 
          leadId: leadId,
          context_services: selectedServices 
        })
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

      // Once finished, extract JSON if present
      let cleanText = fullText
      
      // We check for VERIFIED_JSON first (the ground truth from our Python layer)
      const verifiedMatch = fullText.match(/\[VERIFIED_JSON\](.*?)\[\/VERIFIED_JSON\]/s)
      const aiMatch = fullText.match(/\[MENU_JSON\](.*?)\[\/MENU_JSON\]/s)
      
      if (verifiedMatch) {
        try {
          const verifiedData = JSON.parse(verifiedMatch[1].trim())
          setMenu(prev => ({
            ...prev,
            ...verifiedData
          }))
          // Update options as well if possible, or just keep verified choice
        } catch (e) { console.error("Verified JSON Error", e) }
      } else if (aiMatch) {
        // Fallback to AI JSON if no verification happened
        try {
          const data = JSON.parse(aiMatch[1].trim())
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
        } catch (e) { console.error("AI JSON Error", e) }
      }

      // Cleanup visible text from all JSON markers
      cleanText = fullText
        .replace(/\[VERIFIED_JSON\].*?\[\/VERIFIED_JSON\]/gs, '')
        .replace(/\[MENU_JSON\].*?\[\/MENU_JSON\]/gs, '')
        .trim()

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
  }, [messages, isWaiting, wizardData, leadId, selectedServices])

  function handleMenuSelect(course, dish) {
    if (course === 'TRIGGER_UPSELL') {
      handleSend("Hauptspeise 1 gefällt mir sehr gut! Was würdest du als zweite Hauptspeise dazu empfehlen, damit für jeden Gast etwas dabei ist?")
      return
    }
    setMenu(prev => ({ ...prev, [course]: dish }))
  }

  function handleMenuConfirm() {
    setStep(3)
    addBotMessage("Hervorragende Wahl! Das sieht nach einem absoluten Festmahl aus. ✨ Welche zusätzlichen Leistungen benötigen Sie?")
    setQuickReplies(['Geschirr/Besteck', 'Gläser', 'Dekoration', 'Personal (z. B. Servicekräfte, Barkeeper)', 'Mietmöbel (z. B. Tische, Stühle)', 'Nein, danke'])
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
        total_price: 0,
        order_data: {
          menu: menu,
          services: selectedServices,
          event_details: wizardData
        }
      }

      const resp = await fetch(`${API_URL}/api/orders`, {
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
      {isOpen && <div className="modal-backdrop" onClick={step < 4 ? onClose : undefined} aria-hidden />}
      
      <div 
        className={`modal ${step > 1 ? 'modal--fullscreen' : ''}`} 
        style={{ display: isOpen ? 'flex' : 'none' }}
        role="dialog" 
        aria-modal 
        aria-label="Catersmart Beratung"
      >
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
                  isEventSelection={isEventSelection} onEventSelect={handleEventSelect} isGlow={hasSelectedEvent && !isWaiting}
                  customerType={wizardData.customerType}
                />
              </div>
              <div className="chat-layout__right">
                <MenuCanvas menuOptions={menuOptions} menu={menu} onSelect={handleMenuSelect} onConfirm={handleMenuConfirm} step={step} />
                {step === 3 && <button className="btn-filled canvas__weiter" onClick={handleWeiter}>Bestellung prüfen →</button>}
              </div>
            </div>
          )}
          {step === 4 && (
            <Step4Final 
              menu={menu} 
              selectedServices={selectedServices} 
              wizardData={wizardData} 
              onSubmit={handleSubmit} 
              userEmail={currentUser?.email} 
              userName={currentUser?.displayName}
              leadId={leadId}
            />
          )}
          {step === 5 && (
            <div style={{ padding: '60px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <div style={{ fontSize: '4rem', marginBottom: '20px' }}>🥂🍽️✨</div>
              <h2 style={{ fontSize: '2.5rem', fontWeight: 800, color: '#037A8B', marginBottom: '16px' }}>Vielen Dank für Ihre Anfrage!</h2>
              <p style={{ fontSize: '1.2rem', color: '#475569', maxWidth: '600px', lineHeight: '1.6', marginBottom: '40px' }}>
                Wir haben Ihre Details erhalten und melden uns in Kürze bei Ihnen. Sie können den Status jederzeit in Ihrem Profil einsehen.
              </p>
              <div style={{ display: 'flex', gap: '16px' }}>
                <button 
                  className="btn-filled" 
                  onClick={() => { onClose(); navigate('/profile'); }} 
                  style={{ padding: '16px 40px', fontSize: '1.1rem' }}
                >
                  Zu meinen Bestellungen
                </button>
                <button 
                  className="btn-outlined" 
                  onClick={onClose} 
                  style={{ padding: '16px 40px', fontSize: '1.1rem' }}
                >
                  Schließen
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
