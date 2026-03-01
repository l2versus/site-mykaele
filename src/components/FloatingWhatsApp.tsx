'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { usePathname, useRouter } from 'next/navigation'

// ═══════════════════════════════════════════
// MYKA IA — Chatbot Inteligente Premium
// Visual escuro/rosé com fluxos por botões
// ═══════════════════════════════════════════

interface FlowButton {
  label: string
  action: string
  emoji?: string
}

interface Message {
  id: string
  text: string
  sender: 'user' | 'bot'
  time: string
  buttons?: FlowButton[]
}

// Cores do tema
const THEME = {
  primary: '#b76e79',      // rosé ouro
  primaryDark: '#9a5a64',
  bg: '#1a1a2e',           // fundo escuro
  bgCard: '#16213e',       // card escuro
  bgInput: '#0f3460',      // input
  surface: '#1a1a2e',
  surfaceLight: '#16213e',
  text: '#e8e8e8',
  textMuted: '#8892b0',
  userBubble: '#b76e79',
  botBubble: '#16213e',
  accent: '#e2b0b5',
}

export default function FloatingWhatsApp() {
  const pathname = usePathname()
  const router = useRouter()

  // Esconder apenas no /admin
  if (pathname?.startsWith('/admin')) return null

  const isClientArea = pathname?.startsWith('/cliente')

  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [sessionId] = useState(() => Math.random().toString(36).slice(2))
  const [hasInteracted, setHasInteracted] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // ═══ Draggable button state ═══
  const [btnPos, setBtnPos] = useState<{ x: number; y: number } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef<{ x: number; y: number; bx: number; by: number } | null>(null)
  const dragMovedRef = useRef(false)
  const btnRef = useRef<HTMLButtonElement>(null)

  // Load saved position
  useEffect(() => {
    try {
      const saved = localStorage.getItem('myka_chat_pos')
      if (saved) {
        const pos = JSON.parse(saved)
        // Validate position is within viewport
        const maxX = window.innerWidth - 56
        const maxY = window.innerHeight - 56
        setBtnPos({
          x: Math.min(Math.max(0, pos.x), maxX),
          y: Math.min(Math.max(0, pos.y), maxY),
        })
      }
    } catch {}
  }, [])

  // Drag handlers (touch + mouse)
  const onDragStart = useCallback((clientX: number, clientY: number) => {
    const el = btnRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    dragStartRef.current = { x: clientX, y: clientY, bx: rect.left, by: rect.top }
    dragMovedRef.current = false
  }, [])

  const onDragMove = useCallback((clientX: number, clientY: number) => {
    if (!dragStartRef.current) return
    const dx = clientX - dragStartRef.current.x
    const dy = clientY - dragStartRef.current.y
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      dragMovedRef.current = true
      setIsDragging(true)
    }
    if (!dragMovedRef.current) return
    const maxX = window.innerWidth - 56
    const maxY = window.innerHeight - 56
    const newX = Math.min(Math.max(0, dragStartRef.current.bx + dx), maxX)
    const newY = Math.min(Math.max(0, dragStartRef.current.by + dy), maxY)
    setBtnPos({ x: newX, y: newY })
  }, [])

  const onDragEnd = useCallback(() => {
    if (dragMovedRef.current && btnPos) {
      // Snap to nearest edge (left or right)
      const midX = window.innerWidth / 2
      const snappedX = btnPos.x < midX ? 16 : window.innerWidth - 72
      const finalPos = { x: snappedX, y: btnPos.y }
      setBtnPos(finalPos)
      try { localStorage.setItem('myka_chat_pos', JSON.stringify(finalPos)) } catch {}
    }
    dragStartRef.current = null
    setTimeout(() => setIsDragging(false), 50)
  }, [btnPos])

  // Touch events
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    onDragStart(e.touches[0].clientX, e.touches[0].clientY)
  }, [onDragStart])
  const onTouchMove = useCallback((e: React.TouchEvent) => {
    onDragMove(e.touches[0].clientX, e.touches[0].clientY)
  }, [onDragMove])
  const onTouchEnd = useCallback(() => { onDragEnd() }, [onDragEnd])

  // Mouse events
  useEffect(() => {
    if (!isDragging) return
    const onMouseMove = (e: MouseEvent) => onDragMove(e.clientX, e.clientY)
    const onMouseUp = () => onDragEnd()
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [isDragging, onDragMove, onDragEnd])

  // Default position calculation
  const defaultStyle: React.CSSProperties = btnPos
    ? { position: 'fixed', left: btnPos.x, top: btnPos.y, right: 'auto', bottom: 'auto' }
    : {}


  const now = () => new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

  const scrollToBottom = useCallback(() => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }, [])

  useEffect(() => { scrollToBottom() }, [messages, isTyping, scrollToBottom])

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300)
      // Primeira abertura → envia saudação
      if (messages.length === 0) {
        loadWelcome()
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  // Carrega saudação com botões do backend
  const loadWelcome = async () => {
    setIsTyping(true)
    try {
      const res = await fetch('/api/chatbot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flowAction: 'main_menu', sessionId }),
      })
      const data = await res.json()
      await typeDelay()
      setMessages([{
        id: 'welcome',
        text: data.response || 'Olá! ✨ Sou a Myka, como posso ajudar?',
        sender: 'bot',
        time: now(),
        buttons: data.buttons || [],
      }])
    } catch {
      setMessages([{
        id: 'welcome',
        text: 'Olá! ✨ Sou a Myka, assistente da Mykaele Procópio Home Spa.\n\nComo posso te ajudar?',
        sender: 'bot',
        time: now(),
        buttons: [],
      }])
    } finally {
      setIsTyping(false)
    }
  }

  const typeDelay = () => new Promise(r => setTimeout(r, 400 + Math.random() * 600))

  // Enviar texto livre
  const sendMessage = async (text: string) => {
    if (!text.trim()) return
    setHasInteracted(true)

    const userMsg: Message = {
      id: Date.now().toString(),
      text: text.trim(),
      sender: 'user',
      time: now(),
    }

    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsTyping(true)

    try {
      const res = await fetch('/api/chatbot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text.trim(), sessionId }),
      })
      const data = await res.json()
      await typeDelay()

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        text: data.response || 'Desculpe, tente novamente.',
        sender: 'bot',
        time: now(),
        buttons: data.buttons || [],
      }])
    } catch {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        text: 'Ops, tive um problema. Tente novamente ou fale direto:\n📱 (85) 99908-6924',
        sender: 'bot',
        time: now(),
        buttons: [
          { label: 'Tentar de novo', action: 'main_menu', emoji: '🔄' },
          { label: 'WhatsApp', action: 'link_whatsapp', emoji: '📱' },
        ],
      }])
    } finally {
      setIsTyping(false)
    }
  }

  // Clique em botão de fluxo
  const handleFlowButton = async (btn: FlowButton) => {
    // Ações de link — navegação direta
    if (btn.action === 'link_schedule') {
      router.push('/cliente/agendar')
      setIsOpen(false)
      return
    }
    if (btn.action === 'link_whatsapp') {
      window.open('https://wa.me/5585999086924?text=Ol%C3%A1%20Mykaele!%20Vim%20pelo%20site%20%E2%9C%A8', '_blank')
      return
    }

    setHasInteracted(true)

    // Mostra como "mensagem" do usuário (o botão clicado)
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      text: `${btn.emoji || ''} ${btn.label}`.trim(),
      sender: 'user',
      time: now(),
    }])
    setIsTyping(true)

    try {
      const res = await fetch('/api/chatbot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flowAction: btn.action, sessionId }),
      })
      const data = await res.json()
      await typeDelay()

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        text: data.response || 'Como posso ajudar?',
        sender: 'bot',
        time: now(),
        buttons: data.buttons || [],
      }])
    } catch {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        text: 'Ops, erro temporário. Tente de novo!',
        sender: 'bot',
        time: now(),
        buttons: [{ label: 'Menu principal', action: 'main_menu', emoji: '🏠' }],
      }])
    } finally {
      setIsTyping(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(input)
  }

  // Último conjunto de botões visível
  const lastBotMsg = [...messages].reverse().find(m => m.sender === 'bot' && m.buttons && m.buttons.length > 0)

  return (
    <>
      {/* Overlay mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-[3px] z-[9998] md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* ════════════ Chat Window ════════════ */}
      <div
        className={`fixed z-[9999] transition-all duration-300 ease-out
          ${isOpen
            ? 'bottom-0 right-0 md:bottom-24 md:right-6 w-full h-[88vh] md:w-[400px] md:h-[560px] md:rounded-2xl opacity-100 scale-100 pointer-events-auto'
            : 'bottom-24 right-6 w-[400px] h-[560px] rounded-2xl opacity-0 scale-90 pointer-events-none'
          }
          overflow-hidden flex flex-col md:rounded-2xl
          shadow-2xl shadow-black/40
        `}
        style={{ background: THEME.bg }}
      >
        {/* ──── Header ──── */}
        <div
          className="px-4 py-3 flex items-center gap-3 shrink-0 border-b"
          style={{
            background: `linear-gradient(135deg, ${THEME.bg} 0%, ${THEME.bgCard} 100%)`,
            borderColor: THEME.primary + '30',
          }}
        >
          <div className="relative">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden"
              style={{ background: THEME.primary + '25', border: `2px solid ${THEME.primary}` }}
            >
              <img
                src="/media/logo-branding/logocorreta.png"
                alt="Myka IA"
                className="w-7 h-7 object-contain"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
              {/* Fallback sparkle */}
              <span className="absolute inset-0 flex items-center justify-center text-lg pointer-events-none">
                ✨
              </span>
            </div>
            {/* Online indicator */}
            <span
              className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2"
              style={{ background: '#4ade80', borderColor: THEME.bg }}
            />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold truncate" style={{ color: THEME.accent }}>
              Myka IA
              <span className="ml-1.5 text-[9px] font-medium px-1.5 py-0.5 rounded-full align-middle" style={{ background: THEME.primary + '30', color: THEME.primary }}>
                IA
              </span>
            </h3>
            <p className="text-[11px]" style={{ color: THEME.textMuted }}>
              Assistente inteligente • Online
            </p>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 rounded-lg transition-colors hover:bg-white/10"
            style={{ color: THEME.textMuted }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ──── Messages ──── */}
        <div
          className="flex-1 overflow-y-auto px-3 py-3 space-y-3"
          style={{
            background: `linear-gradient(180deg, ${THEME.bg} 0%, #0f0f23 100%)`,
          }}
        >
          {messages.map((msg, idx) => (
            <div key={msg.id}>
              {/* Message bubble */}
              <div className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} items-end gap-2`}>
                {msg.sender === 'bot' && (
                  <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px]" style={{ background: THEME.primary + '25' }}>
                    ✨
                  </div>
                )}
                <div
                  className={`max-w-[82%] px-3.5 py-2.5 text-[13px] leading-relaxed
                    ${msg.sender === 'user'
                      ? 'rounded-2xl rounded-br-md'
                      : 'rounded-2xl rounded-bl-md'
                    }
                  `}
                  style={{
                    background: msg.sender === 'user' ? THEME.userBubble : THEME.botBubble,
                    color: msg.sender === 'user' ? '#fff' : THEME.text,
                    border: msg.sender === 'bot' ? `1px solid ${THEME.primary}20` : 'none',
                  }}
                >
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                  <span className="text-[10px] mt-1 block text-right" style={{ color: msg.sender === 'user' ? 'rgba(255,255,255,0.6)' : THEME.textMuted }}>
                    {msg.time}
                  </span>
                </div>
              </div>

              {/* Flow buttons — show only on last bot message with buttons */}
              {msg.sender === 'bot' && msg.buttons && msg.buttons.length > 0 && msg.id === lastBotMsg?.id && !isTyping && (
                <div className="mt-2 ml-8 flex flex-wrap gap-1.5">
                  {msg.buttons.map((btn, bi) => (
                    <button
                      key={bi}
                      onClick={() => handleFlowButton(btn)}
                      className="text-[11px] px-3 py-1.5 rounded-full border transition-all duration-200 hover:scale-[1.03] active:scale-95"
                      style={{
                        borderColor: THEME.primary + '50',
                        color: THEME.accent,
                        background: THEME.primary + '12',
                      }}
                      onMouseEnter={e => {
                        (e.target as HTMLButtonElement).style.background = THEME.primary + '30'
                        ;(e.target as HTMLButtonElement).style.borderColor = THEME.primary
                      }}
                      onMouseLeave={e => {
                        (e.target as HTMLButtonElement).style.background = THEME.primary + '12'
                        ;(e.target as HTMLButtonElement).style.borderColor = THEME.primary + '50'
                      }}
                    >
                      {btn.emoji && <span className="mr-1">{btn.emoji}</span>}
                      {btn.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Typing indicator */}
          {isTyping && (
            <div className="flex items-end gap-2">
              <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px]" style={{ background: THEME.primary + '25' }}>
                ✨
              </div>
              <div className="rounded-2xl rounded-bl-md px-4 py-3" style={{ background: THEME.botBubble, border: `1px solid ${THEME.primary}20` }}>
                <div className="flex gap-1.5">
                  <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: THEME.primary, animationDelay: '0ms' }} />
                  <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: THEME.primary, animationDelay: '150ms' }} />
                  <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: THEME.primary, animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* ──── Input ──── */}
        <form
          onSubmit={handleSubmit}
          className="px-3 py-2.5 flex items-center gap-2 shrink-0 border-t"
          style={{ background: THEME.bg, borderColor: THEME.primary + '20' }}
        >
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Digite sua mensagem..."
            className="flex-1 rounded-full px-4 py-2.5 text-[13px] outline-none transition-colors placeholder-gray-500"
            style={{
              background: THEME.bgInput,
              color: THEME.text,
              border: `1px solid ${THEME.primary}30`,
            }}
            onFocus={e => (e.target.style.borderColor = THEME.primary)}
            onBlur={e => (e.target.style.borderColor = THEME.primary + '30')}
            disabled={isTyping}
          />
          <button
            type="submit"
            disabled={!input.trim() || isTyping}
            className="w-10 h-10 rounded-full flex items-center justify-center text-white disabled:opacity-30 transition-all duration-200 hover:scale-105 active:scale-95 shrink-0"
            style={{ background: `linear-gradient(135deg, ${THEME.primary}, ${THEME.primaryDark})` }}
          >
            <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </form>

        {/* Footer — WhatsApp direto */}
        <div className="px-3 py-1.5 text-center shrink-0 border-t" style={{ background: THEME.bg, borderColor: THEME.primary + '15' }}>
          <a
            href="https://wa.me/5585999086924?text=Ol%C3%A1%20Mykaele!%20Vim%20pelo%20site%20%E2%9C%A8"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] hover:underline transition-colors"
            style={{ color: THEME.primary }}
          >
            💬 Prefere falar direto no WhatsApp? Clique aqui →
          </a>
        </div>
      </div>

      {/* ════════════ Floating Button (Draggable) ════════════ */}
      <button
        ref={btnRef}
        onClick={() => { if (!dragMovedRef.current) setIsOpen(prev => !prev) }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseDown={(e) => { onDragStart(e.clientX, e.clientY); setIsDragging(true) }}
        aria-label="Abrir chat Myka IA"
        className={`z-[9999] w-14 h-14 rounded-full
          shadow-lg hover:shadow-xl
          flex items-center justify-center
          ${isDragging ? 'scale-110 cursor-grabbing' : 'hover:scale-110 active:scale-95 cursor-grab'}
          group select-none touch-none
          ${btnPos ? '' : `fixed ${isClientArea ? 'bottom-20' : 'bottom-6'} right-4 md:bottom-6 md:right-6`}
        `}
        style={{
          ...defaultStyle,
          background: `linear-gradient(135deg, ${THEME.primary}, ${THEME.primaryDark})`,
          boxShadow: isDragging ? `0 8px 32px ${THEME.primary}70` : `0 4px 20px ${THEME.primary}50`,
          transition: isDragging ? 'box-shadow 0.2s, transform 0.1s' : 'all 0.3s',
          zIndex: 9999,
        }}
      >
        {/* Ripple ping */}
        {!isOpen && !hasInteracted && !isDragging && (
          <span
            className="absolute inset-0 rounded-full animate-ping opacity-25"
            style={{ background: THEME.primary }}
          />
        )}

        {isOpen ? (
          <svg className="w-6 h-6 text-white transition-transform duration-300" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          /* Sparkle / chat icon */
          <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24">
            <path fill="currentColor" d="M12 2L13.09 8.26L18 6L14.74 10.91L21 12L14.74 13.09L18 18L13.09 15.74L12 22L10.91 15.74L6 18L9.26 13.09L3 12L9.26 10.91L6 6L10.91 8.26L12 2Z" />
          </svg>
        )}

        {/* Notification badge */}
        {!isOpen && !hasInteracted && (
          <span
            className="absolute -top-1 -right-1 w-5 h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center border-2 border-white"
            style={{ background: '#ef4444' }}
          >
            1
          </span>
        )}
      </button>

      {/* Tooltip — follows button position */}
      {!isOpen && !hasInteracted && !isDragging && (
        <div
          className="fixed z-[9998] pointer-events-none"
          style={btnPos
            ? { left: btnPos.x - 40, top: btnPos.y - 36, right: 'auto', bottom: 'auto' }
            : undefined
          }
        >
          <div
            className={`rounded-xl shadow-xl px-3.5 py-2 text-[11px] font-medium whitespace-nowrap animate-bounce ${!btnPos ? `fixed ${isClientArea ? 'bottom-[8.5rem]' : 'bottom-[5.5rem]'} right-4 md:bottom-[5.5rem] md:right-6` : ''}`}
            style={{ background: THEME.bgCard, color: THEME.accent, border: `1px solid ${THEME.primary}30` }}
          >
            ✨ Posso te ajudar!
          </div>
        </div>
      )}
    </>
  )
}
