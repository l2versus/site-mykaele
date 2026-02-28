'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

interface Message {
  id: string
  text: string
  sender: 'user' | 'bot'
  time: string
}

const INITIAL_MESSAGE: Message = {
  id: 'welcome',
  text: 'Olá! 💖 Sou a assistente virtual da Mykaele Procópio Home Spa. Como posso te ajudar?',
  sender: 'bot',
  time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
}

const QUICK_REPLIES = [
  '📅 Quero agendar',
  '💰 Preços',
  '📍 Localização',
  '⏰ Horários',
]

export default function FloatingWhatsApp() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [sessionId] = useState(() => Math.random().toString(36).slice(2))
  const [pulse, setPulse] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, isTyping, scrollToBottom])

  useEffect(() => {
    if (isOpen) {
      setPulse(false)
      setTimeout(() => inputRef.current?.focus(), 300)
    }
  }, [isOpen])

  // Pulse a cada 30s se fechado
  useEffect(() => {
    if (isOpen) return
    const t = setInterval(() => setPulse(true), 30000)
    const t2 = setTimeout(() => setPulse(false), 3000)
    return () => { clearInterval(t); clearTimeout(t2) }
  }, [isOpen])

  const sendMessage = async (text: string) => {
    if (!text.trim()) return

    const userMsg: Message = {
      id: Date.now().toString(),
      text: text.trim(),
      sender: 'user',
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
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

      // Simula delay de digitação
      await new Promise(r => setTimeout(r, 600 + Math.random() * 800))

      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        text: data.response || 'Desculpe, tente novamente.',
        sender: 'bot',
        time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      }

      setMessages(prev => [...prev, botMsg])
    } catch {
      const errMsg: Message = {
        id: (Date.now() + 1).toString(),
        text: 'Ops, tive um problema. Tente novamente ou fale direto no WhatsApp (85) 99908-6924 💖',
        sender: 'bot',
        time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      }
      setMessages(prev => [...prev, errMsg])
    } finally {
      setIsTyping(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(input)
  }

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-[9998] md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Chat Window */}
      <div
        className={`fixed z-[9999] transition-all duration-300 ease-out
          ${isOpen 
            ? 'bottom-0 right-0 md:bottom-24 md:right-6 w-full h-[85vh] md:w-[380px] md:h-[520px] md:rounded-2xl opacity-100 scale-100 pointer-events-auto'
            : 'bottom-24 right-6 w-[380px] h-[520px] rounded-2xl opacity-0 scale-90 pointer-events-none'
          }
          bg-white shadow-2xl shadow-black/20 overflow-hidden flex flex-col
          md:rounded-2xl
        `}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-[#1a5e3a] to-[#25d366] px-4 py-3 flex items-center gap-3 shrink-0">
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center overflow-hidden">
              <img 
                src="/media/logo-branding/logocorreta.png" 
                alt="Mykaele" 
                className="w-8 h-8 object-contain"
              />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-[#1a5e3a]" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-white text-sm font-semibold truncate">Mykaele Procópio</h3>
            <p className="text-white/80 text-[11px]">Online agora • Responde em instantes</p>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="text-white/70 hover:text-white transition-colors p-1"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div 
          className="flex-1 overflow-y-auto px-3 py-3 space-y-2"
          style={{ 
            backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'400\' height=\'400\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cdefs%3E%3Cpattern id=\'p\' width=\'60\' height=\'60\' patternUnits=\'userSpaceOnUse\'%3E%3Cpath d=\'M30 5 L35 25 L30 20 L25 25Z\' fill=\'%23dcf8c6\' opacity=\'0.15\'/%3E%3C/pattern%3E%3C/defs%3E%3Crect fill=\'%23e5ddd5\' width=\'400\' height=\'400\'/%3E%3Crect fill=\'url(%23p)\' width=\'400\' height=\'400\'/%3E%3C/svg%3E")',
            backgroundSize: '200px 200px',
          }}
        >
          {messages.map(msg => (
            <div
              key={msg.id}
              className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] px-3 py-2 rounded-xl text-[13px] leading-relaxed relative
                  ${msg.sender === 'user'
                    ? 'bg-[#dcf8c6] text-[#1a1a1a] rounded-tr-sm'
                    : 'bg-white text-[#1a1a1a] rounded-tl-sm shadow-sm'
                  }
                `}
              >
                <p className="whitespace-pre-wrap">{msg.text}</p>
                <span className={`text-[10px] mt-1 block text-right
                  ${msg.sender === 'user' ? 'text-[#6a6a6a]' : 'text-[#999]'}
                `}>
                  {msg.time}
                </span>
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-white rounded-xl rounded-tl-sm px-4 py-3 shadow-sm">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Replies */}
        {messages.length <= 1 && !isTyping && (
          <div className="px-3 pb-2 flex flex-wrap gap-1.5 shrink-0 bg-[#e5ddd5]/50">
            {QUICK_REPLIES.map(qr => (
              <button
                key={qr}
                onClick={() => sendMessage(qr)}
                className="text-[11px] px-3 py-1.5 rounded-full border border-[#25d366]/40 text-[#1a5e3a] hover:bg-[#25d366]/10 transition-colors whitespace-nowrap"
              >
                {qr}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <form onSubmit={handleSubmit} className="px-3 py-2.5 bg-[#f0f0f0] flex items-center gap-2 shrink-0">
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Digite sua mensagem..."
            className="flex-1 bg-white rounded-full px-4 py-2 text-[13px] text-[#1a1a1a] placeholder-[#999] outline-none border border-gray-200 focus:border-[#25d366]/50 transition-colors"
            disabled={isTyping}
          />
          <button
            type="submit"
            disabled={!input.trim() || isTyping}
            className="w-9 h-9 rounded-full bg-[#25d366] flex items-center justify-center text-white disabled:opacity-40 hover:bg-[#1ea952] transition-colors shrink-0"
          >
            <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </form>

        {/* Footer link para WhatsApp direto */}
        <div className="px-3 py-1.5 bg-[#f0f0f0] border-t border-gray-200 text-center shrink-0">
          <a
            href="https://wa.me/5585999086924?text=Ol%C3%A1%20Mykaele!%20Vim%20pelo%20site"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-[#25d366] hover:underline"
          >
            Prefere falar direto no WhatsApp? Clique aqui →
          </a>
        </div>
      </div>

      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(prev => !prev)}
        aria-label="Abrir chat WhatsApp"
        className={`fixed bottom-6 right-6 z-[9999] w-14 h-14 rounded-full
          bg-gradient-to-br from-[#25d366] to-[#1a8d46] 
          shadow-lg shadow-[#25d366]/30 hover:shadow-xl hover:shadow-[#25d366]/40
          flex items-center justify-center
          transition-all duration-300 hover:scale-105 active:scale-95
          group
          ${pulse ? 'animate-pulse' : ''}
          ${isOpen ? 'rotate-0' : ''}
        `}
      >
        {/* Ripple effect */}
        {!isOpen && (
          <span className="absolute inset-0 rounded-full bg-[#25d366] animate-ping opacity-20" />
        )}
        
        {isOpen ? (
          <svg className="w-6 h-6 text-white transition-transform duration-300" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
        )}

        {/* Notification badge */}
        {!isOpen && messages.length <= 1 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-white text-[10px] font-bold flex items-center justify-center border-2 border-white">
            1
          </span>
        )}
      </button>

      {/* Tooltip when closed */}
      {!isOpen && (
        <div className="fixed bottom-[5.5rem] right-6 z-[9998] pointer-events-none">
          <div className="bg-white rounded-lg shadow-lg px-3 py-1.5 text-[11px] text-[#333] whitespace-nowrap animate-fade-in-up opacity-0 animation-delay-2000">
            Dúvidas? Fale comigo! 💬
          </div>
        </div>
      )}
    </>
  )
}
