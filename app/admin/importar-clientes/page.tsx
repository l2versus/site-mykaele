'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAdmin } from '../AdminContext'

interface ServiceOption {
  id: string
  name: string
  duration: number
  price: number
  priceReturn?: number
}

interface PackageOptionItem {
  id: string
  name: string
  sessions: number
  price: number
  service: { name: string }
}

interface ClientRow {
  id: string
  name: string
  email: string
  phone: string
  cpfRg: string
  tempPassword: string
  packageOptionId: string
  totalSessions: number
  usedSessions: number
  nextAppointmentDate: string
  nextAppointmentServiceId: string
  notes: string
}

interface ImportResult {
  name: string
  email: string
  status: 'created' | 'error' | 'exists'
  error?: string
}

const EMPTY_ROW = (): ClientRow => ({
  id: crypto.randomUUID(),
  name: '',
  email: '',
  phone: '',
  cpfRg: '',
  tempPassword: '',
  packageOptionId: '',
  totalSessions: 0,
  usedSessions: 0,
  nextAppointmentDate: '',
  nextAppointmentServiceId: '',
  notes: '',
})

function generateTempPassword(name: string): string {
  const firstName = name.split(' ')[0].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const num = Math.floor(1000 + Math.random() * 9000)
  return `${firstName}${num}`
}

const fmtCur = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

// Parse vCard (.vcf) file content
function parseVCard(vcf: string): { name: string; phone: string; email: string; photo: string }[] {
  const contacts: { name: string; phone: string; email: string; photo: string }[] = []
  // Split multiple vCards
  const cards = vcf.split(/(?=BEGIN:VCARD)/i).filter(c => c.trim())

  for (const card of cards) {
    const contact = { name: '', phone: '', email: '', photo: '' }

    // FN (formatted name) — priority
    const fnMatch = card.match(/^FN[;:](.+)$/m)
    if (fnMatch) {
      contact.name = fnMatch[1].replace(/\\,/g, ',').replace(/\\;/g, ';').trim()
    } else {
      // N field: Last;First;Middle;...
      const nMatch = card.match(/^N[;:]([^;]*);([^;]*)(?:;|$)/m)
      if (nMatch) contact.name = `${nMatch[2].trim()} ${nMatch[1].trim()}`.trim()
    }

    // TEL — get all phones, prefer CELL/mobile
    const telMatches = [...card.matchAll(/^TEL[^:]*:(.+)$/gm)]
    const cellMatch = [...card.matchAll(/^TEL[^:]*(?:CELL|cell|pref)[^:]*:(.+)$/gm)]
    const tel = cellMatch.length > 0 ? cellMatch[0][1] : telMatches.length > 0 ? telMatches[0][1] : ''
    if (tel) {
      contact.phone = tel.trim().replace(/[^\d+()-\s]/g, '')
    }

    // EMAIL
    const emailMatch = card.match(/^EMAIL[^:]*:(.+)$/m)
    if (emailMatch) contact.email = emailMatch[1].trim()

    // PHOTO — try to get base64 or URL
    const photoUrlMatch = card.match(/^PHOTO;VALUE=URI[^:]*:(https?:\/\/.+)$/m)
    if (photoUrlMatch) {
      contact.photo = photoUrlMatch[1].trim()
    } else {
      // Base64 photo (multi-line)
      const photoB64Match = card.match(/^PHOTO;[^:]*ENCODING=b[^:]*;[^:]*:(.+(?:\n .+)*)$/mi)
      if (photoB64Match) {
        const b64 = photoB64Match[1].replace(/\n\s?/g, '').trim()
        // Detect image type
        const typeMatch = card.match(/^PHOTO;[^:]*TYPE=([^;:]+)/mi)
        const imgType = typeMatch ? typeMatch[1].toLowerCase() : 'jpeg'
        contact.photo = `data:image/${imgType};base64,${b64}`
      }
    }

    if (contact.name || contact.phone) {
      contacts.push(contact)
    }
  }

  return contacts
}

// Format Brazilian phone number
function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  // Remove country code if present
  const local = digits.startsWith('55') && digits.length > 11 ? digits.slice(2) : digits
  if (local.length === 11) return `(${local.slice(0,2)}) ${local.slice(2,7)}-${local.slice(7)}`
  if (local.length === 10) return `(${local.slice(0,2)}) ${local.slice(2,6)}-${local.slice(6)}`
  return phone
}

export default function ImportarClientesPage() {
  const { fetchWithAuth } = useAdmin()
  const searchParams = useSearchParams()
  const vcfInputRef = useRef<HTMLInputElement>(null)
  const [services, setServices] = useState<ServiceOption[]>([])
  const [packageOptions, setPackageOptions] = useState<PackageOptionItem[]>([])
  const [rows, setRows] = useState<ClientRow[]>([EMPTY_ROW()])
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [results, setResults] = useState<ImportResult[] | null>(null)
  const [summary, setSummary] = useState<{ created: number; exists: number; errors: number } | null>(null)
  const [showPasswords, setShowPasswords] = useState(false)
  const [contactPhotos, setContactPhotos] = useState<Record<string, string>>({}) // row.id → photo URL/base64
  const [importFeedback, setImportFeedback] = useState<string | null>(null)
  const [hasContactPicker, setHasContactPicker] = useState(false)
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

  // Detect Contact Picker API (Android Chrome, some browsers)
  useEffect(() => {
    setHasContactPicker('contacts' in navigator && 'ContactsManager' in window)
  }, [])

  // Handle Share Target — when user shares a contact from Contacts app to this PWA
  useEffect(() => {
    if (searchParams.get('shared') === '1') {
      const name = searchParams.get('name') || ''
      const phone = searchParams.get('phone') || ''
      const email = searchParams.get('email') || ''
      const photo = searchParams.get('photo') || ''

      if (name || phone) {
        setRows(prev => {
          const firstEmpty = prev.find(r => !r.name.trim() && !r.phone.trim())
          if (firstEmpty) {
            return prev.map(r => {
              if (r.id !== firstEmpty.id) return r
              const updated = { ...r, name, phone: formatPhone(phone), email }
              if (name.length >= 2) updated.tempPassword = generateTempPassword(name)
              if (photo) setContactPhotos(p => ({ ...p, [r.id]: photo }))
              return updated
            })
          }
          const newRow = { ...EMPTY_ROW(), name, phone: formatPhone(phone), email, tempPassword: name.length >= 2 ? generateTempPassword(name) : '' }
          if (photo) setContactPhotos(p => ({ ...p, [newRow.id]: photo }))
          return [...prev, newRow]
        })
        setImportFeedback(`Contato "${name}" importado!`)
        setTimeout(() => setImportFeedback(null), 4000)
      }
      window.history.replaceState({}, '', '/admin/importar-clientes')
    }
  }, [searchParams])

  // Contact Picker API (Android Chrome)
  const pickContact = async () => {
    try {
      const props = ['name', 'tel', 'email']
      // @ts-expect-error Contact Picker API
      const contacts = await navigator.contacts.select(props, { multiple: false })
      if (contacts && contacts.length > 0) {
        const c = contacts[0]
        const name = c.name?.[0] || ''
        const phone = c.tel?.[0] || ''
        const email = c.email?.[0] || ''
        addContactToRows(name, formatPhone(phone), email, '')
      }
    } catch (e) {
      console.error('Contact Picker error:', e)
    }
  }

  // Shared logic to add a contact to rows
  const addContactToRows = (name: string, phone: string, email: string, photo: string) => {
    setRows(prev => {
      const firstEmpty = prev.find(r => !r.name.trim() && !r.phone.trim())
      if (firstEmpty) {
        return prev.map(r => {
          if (r.id !== firstEmpty.id) return r
          const updated = { ...r, name, phone, email }
          if (name.length >= 2) updated.tempPassword = generateTempPassword(name)
          if (photo) setContactPhotos(p => ({ ...p, [r.id]: photo }))
          return updated
        })
      }
      const newRow = { ...EMPTY_ROW(), name, phone, email, tempPassword: name.length >= 2 ? generateTempPassword(name) : '' }
      if (photo) setContactPhotos(p => ({ ...p, [newRow.id]: photo }))
      return [...prev, newRow]
    })
    setImportFeedback(`Contato "${name}" adicionado!`)
    setTimeout(() => setImportFeedback(null), 3000)
  }

  // Handle .vcf file selection
  const handleVcfFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    let totalImported = 0

    for (const file of Array.from(files)) {
      const text = await file.text()
      const contacts = parseVCard(text)

      for (const contact of contacts) {
        addContactToRows(contact.name, formatPhone(contact.phone), contact.email, contact.photo)
        totalImported++
      }
    }

    if (totalImported > 0) {
      setImportFeedback(`${totalImported} contato(s) importado(s)!`)
      setTimeout(() => setImportFeedback(null), 4000)
    }

    if (vcfInputRef.current) vcfInputRef.current.value = ''
  }

  // Send WhatsApp message with credentials
  const sendWhatsApp = (row: ClientRow) => {
    const phone = row.phone.replace(/\D/g, '')
    const fullPhone = phone.startsWith('55') ? phone : `55${phone}`
    const msg = encodeURIComponent(
      `Olá ${row.name.split(' ')[0]}! ✨\n` +
      `Seu acesso ao app da Mykaele Procópio Home Spa está pronto!\n\n` +
      `Email: ${row.email}\nSenha temporária: ${row.tempPassword}\n\n` +
      `Acesse: mykaprocopio.com.br/cliente\n` +
      `No primeiro login, você será solicitada a criar uma nova senha.\n\n` +
      `Qualquer dúvida, estou à disposição! ❤️`
    )
    window.open(`https://wa.me/${fullPhone}?text=${msg}`, '_blank')
  }

  // Carregar serviços e pacotes disponíveis
  const loadData = useCallback(async () => {
    try {
      const res = await fetchWithAuth('/api/admin/import-clients')
      if (res.ok) {
        const data = await res.json()
        setServices(data.services || [])
        setPackageOptions(data.packageOptions || [])
      }
    } catch (e) {
      console.error('Erro ao carregar dados:', e)
    } finally {
      setLoadingData(false)
    }
  }, [fetchWithAuth])

  useEffect(() => { loadData() }, [loadData])

  const updateRow = (id: string, field: keyof ClientRow, value: string | number) => {
    setRows(prev =>
      prev.map(r => {
        if (r.id !== id) return r
        const updated = { ...r, [field]: value }
        // Auto-gerar senha temporária baseada no nome
        if (field === 'name' && typeof value === 'string' && value.length >= 2 && !r.tempPassword) {
          updated.tempPassword = generateTempPassword(value)
        }
        // Auto-ajustar totalSessions quando selecionar pacote
        if (field === 'packageOptionId' && typeof value === 'string') {
          const pkg = packageOptions.find(p => p.id === value)
          if (pkg) updated.totalSessions = pkg.sessions
        }
        return updated
      })
    )
  }

  const addRow = () => setRows(prev => [...prev, EMPTY_ROW()])
  const removeRow = (id: string) => {
    if (rows.length <= 1) return
    setRows(prev => prev.filter(r => r.id !== id))
  }

  const handleImport = async () => {
    // Validar que pelo menos 1 cliente tem nome + email
    const valid = rows.filter(r => r.name.trim() && r.email.trim())
    if (valid.length === 0) {
      alert('Preencha pelo menos um cliente com nome e email.')
      return
    }

    setLoading(true)
    setResults(null)
    setSummary(null)

    try {
      const clients = valid.map(r => ({
        name: r.name.trim(),
        email: r.email.trim().toLowerCase(),
        phone: r.phone.trim() || undefined,
        cpfRg: r.cpfRg.trim() || undefined,
        tempPassword: r.tempPassword || generateTempPassword(r.name),
        packageOptionId: r.packageOptionId || undefined,
        totalSessions: r.totalSessions || undefined,
        usedSessions: r.usedSessions || undefined,
        nextAppointmentDate: r.nextAppointmentDate || undefined,
        nextAppointmentServiceId: r.nextAppointmentServiceId || undefined,
        notes: r.notes || undefined,
      }))

      const res = await fetchWithAuth('/api/admin/import-clients', {
        method: 'POST',
        body: JSON.stringify({ clients }),
      })

      const data = await res.json()
      if (res.ok) {
        setResults(data.results)
        setSummary({ created: data.created, exists: data.exists, errors: data.errors })
      } else {
        alert(data.error || 'Erro na importação')
      }
    } catch (e) {
      console.error('Erro:', e)
      alert('Erro de conexão')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setRows([EMPTY_ROW()])
    setResults(null)
    setSummary(null)
  }

  if (loadingData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[#b76e79]/30 border-t-[#b76e79] rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6 max-w-[1400px] pb-6">
      {/* ── Hidden file input ── */}
      <input
        ref={vcfInputRef}
        type="file"
        accept=".vcf,.vcard,text/vcard,text/x-vcard"
        multiple
        onChange={handleVcfFile}
        className="hidden"
      />

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">Importar Clientes</h1>
          <p className="text-white/40 text-xs sm:text-sm mt-1">
            Cadastre clientes com pacotes e agendamentos.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPasswords(!showPasswords)}
            className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-white/[0.04] border border-white/[0.08] text-white/50 hover:text-white/80 transition-all"
          >
            {showPasswords ? '🔒 Ocultar' : '👁️ Senhas'}
          </button>
          <button
            onClick={resetForm}
            className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-white/[0.04] border border-white/[0.08] text-white/50 hover:text-white/80 transition-all"
          >
            Limpar
          </button>
        </div>
      </div>

      {/* ── Mobile-first: BIG import contact button ── */}
      <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/5 border border-green-500/20 rounded-xl p-4 space-y-3">
        <p className="text-white/60 text-xs sm:text-sm">
          <strong className="text-white/80">Importar do celular:</strong> Puxe nome e telefone direto da agenda
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          {/* Contact Picker (Android Chrome) */}
          {hasContactPicker && (
            <button
              onClick={pickContact}
              className="flex-1 flex items-center justify-center gap-2.5 px-4 py-3.5 rounded-xl text-sm font-semibold bg-green-500/20 border border-green-500/30 text-green-400 hover:bg-green-500/30 active:scale-[0.98] transition-all"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
              Escolher da Agenda
            </button>
          )}

          {/* VCF file picker (iOS + Android) */}
          <button
            onClick={() => vcfInputRef.current?.click()}
            className={`${hasContactPicker ? 'flex-1' : 'w-full'} flex items-center justify-center gap-2.5 px-4 py-3.5 rounded-xl text-sm font-semibold bg-green-500/20 border border-green-500/30 text-green-400 hover:bg-green-500/30 active:scale-[0.98] transition-all`}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            Importar Contato do Celular
          </button>
        </div>
        <div className="text-white/30 text-[10px] leading-relaxed space-y-1">
          <p>📱 <strong className="text-white/40">No iPhone:</strong></p>
          <p className="pl-4">1. Abra o app <strong className="text-white/50">Contatos</strong></p>
          <p className="pl-4">2. Toque no contato que deseja importar</p>
          <p className="pl-4">3. Role para baixo e toque em <strong className="text-white/50">Compartilhar Contato</strong></p>
          <p className="pl-4">4. Toque em <strong className="text-white/50">Salvar em Arquivos</strong></p>
          <p className="pl-4">5. Volte aqui e toque no botão acima — selecione o arquivo salvo</p>
        </div>
      </div>

      {/* ── Import feedback banner ── */}
      {importFeedback && (
        <div className="bg-green-500/15 border border-green-500/25 rounded-xl px-4 py-3 flex items-center gap-2">
          <span className="text-lg">✅</span>
          <span className="text-green-400 font-medium text-sm">{importFeedback}</span>
        </div>
      )}

      {/* ── Results ── */}
      {summary && results && (
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 sm:p-5 space-y-4">
          <h2 className="text-white/90 font-semibold text-base">Resultado</h2>
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2 text-center">
              <p className="text-green-400 text-xl sm:text-2xl font-bold">{summary.created}</p>
              <p className="text-green-400/60 text-[10px] sm:text-xs">Criados</p>
            </div>
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2 text-center">
              <p className="text-yellow-400 text-xl sm:text-2xl font-bold">{summary.exists}</p>
              <p className="text-yellow-400/60 text-[10px] sm:text-xs">Existiam</p>
            </div>
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-center">
              <p className="text-red-400 text-xl sm:text-2xl font-bold">{summary.errors}</p>
              <p className="text-red-400/60 text-[10px] sm:text-xs">Erros</p>
            </div>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto">
            {results.map((r, i) => (
              <div
                key={i}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs sm:text-sm ${
                  r.status === 'created'
                    ? 'bg-green-500/10 text-green-400'
                    : r.status === 'exists'
                    ? 'bg-yellow-500/10 text-yellow-400'
                    : 'bg-red-500/10 text-red-400'
                }`}
              >
                <span>{r.status === 'created' ? '✅' : r.status === 'exists' ? '⚠️' : '❌'}</span>
                <span className="font-medium truncate">{r.name}</span>
                <span className="text-white/30 text-[10px] truncate hidden sm:inline">({r.email})</span>
                {r.error && <span className="text-[10px] opacity-70 ml-auto">{r.error}</span>}
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <button
              onClick={resetForm}
              className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium bg-white/[0.06] border border-white/[0.08] text-white/70 hover:bg-white/[0.1] transition-all text-center"
            >
              Importar Mais
            </button>
            <a
              href="/admin/clientes"
              className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium bg-[#b76e79]/20 border border-[#b76e79]/30 text-[#b76e79] hover:bg-[#b76e79]/30 transition-all text-center"
            >
              Ver Clientes
            </a>
          </div>
        </div>
      )}

      {/* ── Client Rows ── */}
      {!summary && (
        <>
          <div className="space-y-3">
            {rows.map((row, index) => {
              const isExpanded = expandedRow === row.id || (!expandedRow && index === 0)
              const hasData = row.name.trim() || row.phone.trim()

              return (
                <div
                  key={row.id}
                  className="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden hover:border-white/[0.1] transition-colors"
                >
                  {/* Row header — always visible, tap to expand on mobile */}
                  <div
                    className="flex items-center justify-between p-3 sm:p-4 cursor-pointer"
                    onClick={() => setExpandedRow(isExpanded ? null : row.id)}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {contactPhotos[row.id] ? (
                        <img
                          src={contactPhotos[row.id]}
                          alt={row.name || 'Contato'}
                          className="w-9 h-9 rounded-full object-cover border border-white/10 flex-shrink-0"
                        />
                      ) : (
                        <span className="w-7 h-7 rounded-full bg-[#b76e79]/20 text-[#b76e79] text-xs flex items-center justify-center font-bold flex-shrink-0">
                          {index + 1}
                        </span>
                      )}
                      <div className="min-w-0">
                        <p className="text-white/80 text-sm font-medium truncate">
                          {row.name || 'Novo cliente'}
                        </p>
                        {hasData && (
                          <p className="text-white/30 text-[10px] truncate">
                            {row.phone && row.phone}{row.phone && row.email && ' · '}{row.email && row.email}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {row.phone && !row.email && (
                        <span className="text-[9px] font-medium text-yellow-400/70 bg-yellow-400/10 px-1.5 py-0.5 rounded">falta email</span>
                      )}
                      {hasData && row.email && row.tempPassword && (
                        <span className="text-[9px] font-medium text-green-400/70 bg-green-400/10 px-1.5 py-0.5 rounded">pronto</span>
                      )}
                      {rows.length > 1 && (
                        <button
                          onClick={(e) => { e.stopPropagation(); removeRow(row.id) }}
                          className="text-red-400/40 hover:text-red-400 p-1 transition-colors"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                      )}
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`text-white/20 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                        <polyline points="6 9 12 15 18 9"/>
                      </svg>
                    </div>
                  </div>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div className="px-3 sm:px-4 pb-4 space-y-3 border-t border-white/[0.04]">
                      {/* Quick actions per row */}
                      {!hasData && (
                        <div className="flex gap-2 pt-3">
                          {hasContactPicker && (
                            <button
                              onClick={pickContact}
                              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-medium bg-green-500/10 border border-green-500/20 text-green-400 active:scale-[0.98] transition-all"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                              Dos Contatos
                            </button>
                          )}
                          <button
                            onClick={() => vcfInputRef.current?.click()}
                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-medium bg-green-500/10 border border-green-500/20 text-green-400 active:scale-[0.98] transition-all"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                            Arquivo .vcf
                          </button>
                        </div>
                      )}

                      {/* Nome + Telefone (stacked on mobile) */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                        <div>
                          <label className="block text-white/30 text-[10px] font-medium mb-1 uppercase tracking-wider">
                            Nome Completo <span className="text-red-400">*</span>
                          </label>
                          <input
                            type="text"
                            value={row.name}
                            onChange={e => updateRow(row.id, 'name', e.target.value)}
                            placeholder="Maria Silva"
                            className="w-full px-3 py-2.5 bg-white/[0.03] border border-white/[0.07] rounded-lg text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#b76e79]/40 transition-all"
                          />
                        </div>
                        <div>
                          <label className="block text-white/30 text-[10px] font-medium mb-1 uppercase tracking-wider">Telefone / WhatsApp</label>
                          <input
                            type="tel"
                            value={row.phone}
                            onChange={e => updateRow(row.id, 'phone', e.target.value)}
                            placeholder="(85) 99999-9999"
                            className="w-full px-3 py-2.5 bg-white/[0.03] border border-white/[0.07] rounded-lg text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#b76e79]/40 transition-all"
                          />
                        </div>
                      </div>

                      {/* Email + Senha */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-white/30 text-[10px] font-medium mb-1 uppercase tracking-wider">
                            Email <span className="text-red-400">*</span>
                          </label>
                          <input
                            type="email"
                            value={row.email}
                            onChange={e => updateRow(row.id, 'email', e.target.value)}
                            placeholder="maria@email.com"
                            className="w-full px-3 py-2.5 bg-white/[0.03] border border-white/[0.07] rounded-lg text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#b76e79]/40 transition-all"
                          />
                        </div>
                        <div>
                          <label className="block text-white/30 text-[10px] font-medium mb-1 uppercase tracking-wider">
                            Senha Temporária <span className="text-red-400">*</span>
                          </label>
                          <div className="relative">
                            <input
                              type={showPasswords ? 'text' : 'password'}
                              value={row.tempPassword}
                              onChange={e => updateRow(row.id, 'tempPassword', e.target.value)}
                              placeholder="Auto-gerada"
                              className="w-full px-3 py-2.5 bg-white/[0.03] border border-white/[0.07] rounded-lg text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#b76e79]/40 transition-all pr-9"
                            />
                            {row.tempPassword && (
                              <button
                                onClick={() => navigator.clipboard.writeText(row.tempPassword)}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors p-1"
                                title="Copiar"
                              >
                                📋
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Pacote (collapsible section) */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="sm:col-span-1">
                          <label className="block text-white/30 text-[10px] font-medium mb-1 uppercase tracking-wider">Pacote</label>
                          <select
                            value={row.packageOptionId}
                            onChange={e => updateRow(row.id, 'packageOptionId', e.target.value)}
                            className="w-full px-3 py-2.5 bg-white/[0.03] border border-white/[0.07] rounded-lg text-white text-sm focus:outline-none focus:border-[#b76e79]/40 transition-all"
                          >
                            <option value="" className="bg-[#1a1a2e]">Sem pacote</option>
                            {packageOptions.map(po => (
                              <option key={po.id} value={po.id} className="bg-[#1a1a2e]">
                                {po.service.name} — {po.name} ({po.sessions}x) — {fmtCur(po.price)}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-white/30 text-[10px] font-medium mb-1 uppercase tracking-wider">Total Sessões</label>
                          <input
                            type="number"
                            min={0}
                            inputMode="numeric"
                            value={row.totalSessions || ''}
                            onChange={e => updateRow(row.id, 'totalSessions', parseInt(e.target.value) || 0)}
                            placeholder="10"
                            className="w-full px-3 py-2.5 bg-white/[0.03] border border-white/[0.07] rounded-lg text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#b76e79]/40 transition-all"
                          />
                        </div>
                        <div>
                          <label className="block text-white/30 text-[10px] font-medium mb-1 uppercase tracking-wider">Sessões Usadas</label>
                          <input
                            type="number"
                            min={0}
                            max={row.totalSessions}
                            inputMode="numeric"
                            value={row.usedSessions || ''}
                            onChange={e => updateRow(row.id, 'usedSessions', parseInt(e.target.value) || 0)}
                            placeholder="3"
                            className="w-full px-3 py-2.5 bg-white/[0.03] border border-white/[0.07] rounded-lg text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#b76e79]/40 transition-all"
                          />
                        </div>
                      </div>

                      {/* Package progress */}
                      {row.packageOptionId && row.totalSessions > 0 && (
                        <div className="bg-white/[0.02] rounded-lg px-3 py-2">
                          <div className="flex items-center justify-between text-[10px] sm:text-xs mb-1">
                            <span className="text-white/40">Progresso</span>
                            <span className="text-[#b76e79]">
                              {row.usedSessions}/{row.totalSessions} ({row.totalSessions - row.usedSessions} restantes)
                            </span>
                          </div>
                          <div className="w-full bg-white/[0.05] rounded-full h-1.5">
                            <div
                              className="bg-gradient-to-r from-[#b76e79] to-[#d4a0a7] h-1.5 rounded-full transition-all"
                              style={{ width: `${Math.min(100, (row.usedSessions / row.totalSessions) * 100)}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Agendamento + Serviço + Obs */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-white/30 text-[10px] font-medium mb-1 uppercase tracking-wider">Próximo Agendamento</label>
                          <input
                            type="datetime-local"
                            value={row.nextAppointmentDate}
                            onChange={e => updateRow(row.id, 'nextAppointmentDate', e.target.value)}
                            className="w-full px-3 py-2.5 bg-white/[0.03] border border-white/[0.07] rounded-lg text-white text-sm focus:outline-none focus:border-[#b76e79]/40 transition-all"
                          />
                        </div>
                        <div>
                          <label className="block text-white/30 text-[10px] font-medium mb-1 uppercase tracking-wider">Serviço</label>
                          <select
                            value={row.nextAppointmentServiceId}
                            onChange={e => updateRow(row.id, 'nextAppointmentServiceId', e.target.value)}
                            className="w-full px-3 py-2.5 bg-white/[0.03] border border-white/[0.07] rounded-lg text-white text-sm focus:outline-none focus:border-[#b76e79]/40 transition-all"
                          >
                            <option value="" className="bg-[#1a1a2e]">Selecione</option>
                            {services.map(s => (
                              <option key={s.id} value={s.id} className="bg-[#1a1a2e]">
                                {s.name} ({s.duration}min)
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-white/30 text-[10px] font-medium mb-1 uppercase tracking-wider">Observações</label>
                          <input
                            type="text"
                            value={row.notes}
                            onChange={e => updateRow(row.id, 'notes', e.target.value)}
                            placeholder="Ex: cliente desde 2023"
                            className="w-full px-3 py-2.5 bg-white/[0.03] border border-white/[0.07] rounded-lg text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#b76e79]/40 transition-all"
                          />
                        </div>
                      </div>

                      {/* Quick WhatsApp send for filled rows */}
                      {row.name && row.phone && row.email && row.tempPassword && (
                        <button
                          onClick={() => sendWhatsApp(row)}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-medium bg-green-600/15 border border-green-600/25 text-green-400 hover:bg-green-600/25 active:scale-[0.98] transition-all"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                          Enviar credenciais via WhatsApp
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* ── Actions ── */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
            <div className="flex gap-2">
              <button
                onClick={addRow}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-white/[0.04] border border-dashed border-white/[0.12] text-white/50 hover:text-white/80 hover:border-white/[0.2] active:scale-[0.98] transition-all"
              >
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                + Cliente
              </button>
              <button
                onClick={() => vcfInputRef.current?.click()}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-green-500/5 border border-dashed border-green-500/20 text-green-400/70 hover:text-green-400 active:scale-[0.98] transition-all"
              >
                📱 Do Celular
              </button>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-3">
              <span className="text-white/30 text-xs">
                {rows.filter(r => r.name.trim() && r.email.trim()).length} de {rows.length} prontos
              </span>
              <button
                onClick={handleImport}
                disabled={loading || rows.filter(r => r.name.trim() && r.email.trim()).length === 0}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-[#b76e79] to-[#c28a93] text-white shadow-lg shadow-[#b76e79]/20 hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Importando...
                  </span>
                ) : (
                  `Importar ${rows.filter(r => r.name.trim() && r.email.trim()).length} Cliente(s)`
                )}
              </button>
            </div>
          </div>

          {/* ── WhatsApp template ── */}
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3 sm:p-4">
            <div className="flex items-start gap-2.5">
              <span className="text-base">📱</span>
              <div className="text-sm text-white/50 space-y-1 min-w-0">
                <p className="text-white/70 font-medium text-xs sm:text-sm">Mensagem WhatsApp (enviada por botão em cada cliente):</p>
                <p className="text-white/30 text-[10px] sm:text-xs font-mono bg-white/[0.03] rounded-lg p-2.5 sm:p-3 leading-relaxed whitespace-pre-line break-words">
                  {`Olá [Nome]! ✨\nSeu acesso ao app da Mykaele Procópio Home Spa está pronto!\n\nEmail: [email]\nSenha temporária: [senha]\n\nAcesse: mykaprocopio.com.br/cliente`}
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
