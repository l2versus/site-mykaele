'use client'

import { useState, useEffect, useCallback } from 'react'
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

export default function ImportarClientesPage() {
  const { fetchWithAuth } = useAdmin()
  const [services, setServices] = useState<ServiceOption[]>([])
  const [packageOptions, setPackageOptions] = useState<PackageOptionItem[]>([])
  const [rows, setRows] = useState<ClientRow[]>([EMPTY_ROW()])
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [results, setResults] = useState<ImportResult[] | null>(null)
  const [summary, setSummary] = useState<{ created: number; exists: number; errors: number } | null>(null)
  const [showPasswords, setShowPasswords] = useState(false)

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
    <div className="space-y-6 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Importar Clientes</h1>
          <p className="text-white/40 text-sm mt-1">
            Cadastre clientes existentes com pacotes e agendamentos. Eles receberão uma senha temporária e serão orientados a trocá-la no primeiro login.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPasswords(!showPasswords)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.04] border border-white/[0.08] text-white/50 hover:text-white/80 hover:bg-white/[0.08] transition-all"
          >
            {showPasswords ? '🔒 Ocultar Senhas' : '👁️ Mostrar Senhas'}
          </button>
          <button
            onClick={resetForm}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.04] border border-white/[0.08] text-white/50 hover:text-white/80 hover:bg-white/[0.08] transition-all"
          >
            Limpar Tudo
          </button>
        </div>
      </div>

      {/* Info Card */}
      <div className="bg-gradient-to-r from-[#b76e79]/10 to-[#b76e79]/5 border border-[#b76e79]/20 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <span className="text-lg">💡</span>
          <div className="text-sm text-white/60 space-y-1">
            <p><strong className="text-white/80">Como funciona:</strong></p>
            <p>1. Preencha os dados de cada cliente (nome, email e senha temporária são obrigatórios)</p>
            <p>2. Opcionalmente, selecione o pacote e a quantidade de sessões já realizadas</p>
            <p>3. Opcionalmente, agende o próximo horário do cliente</p>
            <p>4. Ao importar, cada cliente receberá login e será <strong className="text-[#b76e79]">obrigado a trocar a senha no primeiro acesso</strong></p>
          </div>
        </div>
      </div>

      {/* Results (se já importou) */}
      {summary && results && (
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5 space-y-4">
          <h2 className="text-white/90 font-semibold text-base">Resultado da Importação</h2>
          <div className="flex gap-4 flex-wrap">
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg px-4 py-2">
              <p className="text-green-400 text-2xl font-bold">{summary.created}</p>
              <p className="text-green-400/60 text-xs">Criados</p>
            </div>
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-4 py-2">
              <p className="text-yellow-400 text-2xl font-bold">{summary.exists}</p>
              <p className="text-yellow-400/60 text-xs">Já existiam</p>
            </div>
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2">
              <p className="text-red-400 text-2xl font-bold">{summary.errors}</p>
              <p className="text-red-400/60 text-xs">Erros</p>
            </div>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {results.map((r, i) => (
              <div
                key={i}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${
                  r.status === 'created'
                    ? 'bg-green-500/10 text-green-400'
                    : r.status === 'exists'
                    ? 'bg-yellow-500/10 text-yellow-400'
                    : 'bg-red-500/10 text-red-400'
                }`}
              >
                <span>{r.status === 'created' ? '✅' : r.status === 'exists' ? '⚠️' : '❌'}</span>
                <span className="font-medium">{r.name}</span>
                <span className="text-white/30">({r.email})</span>
                {r.error && <span className="text-xs opacity-70 ml-auto">{r.error}</span>}
              </div>
            ))}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={resetForm}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-white/[0.06] border border-white/[0.08] text-white/70 hover:bg-white/[0.1] transition-all"
            >
              Importar Mais
            </button>
            <a
              href="/admin/clientes"
              className="px-4 py-2 rounded-lg text-sm font-medium bg-[#b76e79]/20 border border-[#b76e79]/30 text-[#b76e79] hover:bg-[#b76e79]/30 transition-all"
            >
              Ver Lista de Clientes
            </a>
          </div>
        </div>
      )}

      {/* Client Rows */}
      {!summary && (
        <>
          <div className="space-y-4">
            {rows.map((row, index) => (
              <div
                key={row.id}
                className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5 space-y-4 hover:border-white/[0.1] transition-colors"
              >
                {/* Row header */}
                <div className="flex items-center justify-between">
                  <h3 className="text-white/70 text-sm font-semibold flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-[#b76e79]/20 text-[#b76e79] text-xs flex items-center justify-center font-bold">
                      {index + 1}
                    </span>
                    {row.name || 'Novo cliente'}
                  </h3>
                  {rows.length > 1 && (
                    <button
                      onClick={() => removeRow(row.id)}
                      className="text-red-400/50 hover:text-red-400 text-xs transition-colors"
                    >
                      ✕ Remover
                    </button>
                  )}
                </div>

                {/* Dados pessoais */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-white/30 text-[10px] font-medium mb-1 uppercase tracking-wider">
                      Nome Completo <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={row.name}
                      onChange={e => updateRow(row.id, 'name', e.target.value)}
                      placeholder="Maria Silva"
                      className="w-full px-3 py-2 bg-white/[0.03] border border-white/[0.07] rounded-lg text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#b76e79]/40 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-white/30 text-[10px] font-medium mb-1 uppercase tracking-wider">
                      Email <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="email"
                      value={row.email}
                      onChange={e => updateRow(row.id, 'email', e.target.value)}
                      placeholder="maria@email.com"
                      className="w-full px-3 py-2 bg-white/[0.03] border border-white/[0.07] rounded-lg text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#b76e79]/40 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-white/30 text-[10px] font-medium mb-1 uppercase tracking-wider">Telefone</label>
                    <input
                      type="tel"
                      value={row.phone}
                      onChange={e => updateRow(row.id, 'phone', e.target.value)}
                      placeholder="(11) 99999-9999"
                      className="w-full px-3 py-2 bg-white/[0.03] border border-white/[0.07] rounded-lg text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#b76e79]/40 transition-all"
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
                        className="w-full px-3 py-2 bg-white/[0.03] border border-white/[0.07] rounded-lg text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#b76e79]/40 transition-all pr-8"
                      />
                      {row.tempPassword && (
                        <button
                          onClick={() => navigator.clipboard.writeText(row.tempPassword)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                          title="Copiar senha"
                        >
                          📋
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Pacote */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-white/30 text-[10px] font-medium mb-1 uppercase tracking-wider">Pacote</label>
                    <select
                      value={row.packageOptionId}
                      onChange={e => updateRow(row.id, 'packageOptionId', e.target.value)}
                      className="w-full px-3 py-2 bg-white/[0.03] border border-white/[0.07] rounded-lg text-white text-sm focus:outline-none focus:border-[#b76e79]/40 transition-all"
                    >
                      <option value="" className="bg-[#1a1a2e]">Sem pacote</option>
                      {packageOptions.map(po => (
                        <option key={po.id} value={po.id} className="bg-[#1a1a2e]">
                          {po.service.name} — {po.name} ({po.sessions} sessões) — {fmtCur(po.price)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-white/30 text-[10px] font-medium mb-1 uppercase tracking-wider">Total Sessões</label>
                    <input
                      type="number"
                      min={0}
                      value={row.totalSessions || ''}
                      onChange={e => updateRow(row.id, 'totalSessions', parseInt(e.target.value) || 0)}
                      placeholder="10"
                      className="w-full px-3 py-2 bg-white/[0.03] border border-white/[0.07] rounded-lg text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#b76e79]/40 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-white/30 text-[10px] font-medium mb-1 uppercase tracking-wider">Sessões Usadas</label>
                    <input
                      type="number"
                      min={0}
                      max={row.totalSessions}
                      value={row.usedSessions || ''}
                      onChange={e => updateRow(row.id, 'usedSessions', parseInt(e.target.value) || 0)}
                      placeholder="3"
                      className="w-full px-3 py-2 bg-white/[0.03] border border-white/[0.07] rounded-lg text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#b76e79]/40 transition-all"
                    />
                  </div>
                </div>

                {/* Progresso visual do pacote */}
                {row.packageOptionId && row.totalSessions > 0 && (
                  <div className="bg-white/[0.02] rounded-lg px-3 py-2">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-white/40">Progresso do pacote</span>
                      <span className="text-[#b76e79]">
                        {row.usedSessions}/{row.totalSessions} sessões
                        {' '}({row.totalSessions - row.usedSessions} restantes)
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

                {/* Próximo agendamento */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-white/30 text-[10px] font-medium mb-1 uppercase tracking-wider">Próximo Agendamento</label>
                    <input
                      type="datetime-local"
                      value={row.nextAppointmentDate}
                      onChange={e => updateRow(row.id, 'nextAppointmentDate', e.target.value)}
                      className="w-full px-3 py-2 bg-white/[0.03] border border-white/[0.07] rounded-lg text-white text-sm focus:outline-none focus:border-[#b76e79]/40 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-white/30 text-[10px] font-medium mb-1 uppercase tracking-wider">Serviço</label>
                    <select
                      value={row.nextAppointmentServiceId}
                      onChange={e => updateRow(row.id, 'nextAppointmentServiceId', e.target.value)}
                      className="w-full px-3 py-2 bg-white/[0.03] border border-white/[0.07] rounded-lg text-white text-sm focus:outline-none focus:border-[#b76e79]/40 transition-all"
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
                      className="w-full px-3 py-2 bg-white/[0.03] border border-white/[0.07] rounded-lg text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#b76e79]/40 transition-all"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between flex-wrap gap-3 pt-2">
            <button
              onClick={addRow}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-white/[0.04] border border-dashed border-white/[0.12] text-white/50 hover:text-white/80 hover:border-white/[0.2] hover:bg-white/[0.06] transition-all"
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Adicionar Cliente
            </button>

            <div className="flex items-center gap-3">
              <span className="text-white/30 text-xs">
                {rows.filter(r => r.name.trim() && r.email.trim()).length} de {rows.length} prontos
              </span>
              <button
                onClick={handleImport}
                disabled={loading || rows.filter(r => r.name.trim() && r.email.trim()).length === 0}
                className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-[#b76e79] to-[#c28a93] text-white shadow-lg shadow-[#b76e79]/20 hover:shadow-[#b76e79]/30 hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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

          {/* Dica sobre WhatsApp */}
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
            <div className="flex items-start gap-3">
              <span className="text-lg">📱</span>
              <div className="text-sm text-white/50 space-y-1">
                <p className="text-white/70 font-medium">Após importar, envie as credenciais via WhatsApp:</p>
                <p className="text-white/40 text-xs font-mono bg-white/[0.03] rounded-lg p-3 leading-relaxed">
                  Olá [Nome]! 🌸{'\n'}
                  Seu acesso ao app da Mykaele Procópio Home Spa está pronto!{'\n'}
                  {'\n'}
                  📧 Email: [email]{'\n'}
                  🔑 Senha temporária: [senha]{'\n'}
                  {'\n'}
                  Acesse: mykaprocopio.com.br/cliente{'\n'}
                  No primeiro login, você será solicitada a criar uma nova senha.{'\n'}
                  {'\n'}
                  Qualquer dúvida, estou à disposição! 💕
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
