'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAdmin } from '../AdminContext'

const fmtCur = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

interface GiftCard {
  id: number; code: string; initialBalance: number; currentBalance: number; recipientName: string | null
  recipientEmail: string | null; purchaserName: string | null; message: string | null
  status: string; expiresAt: string | null; createdAt: string
}

export default function GiftCardsPage() {
  const { fetchWithAuth } = useAdmin()
  const [cards, setCards] = useState<GiftCard[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showValidate, setShowValidate] = useState(false)
  const [validateCode, setValidateCode] = useState('')
  const [validateAmount, setValidateAmount] = useState('')
  const [validateResult, setValidateResult] = useState<string | null>(null)
  const [form, setForm] = useState({ initialBalance: '', recipientName: '', recipientEmail: '', purchaserName: '', message: '', expiresAt: '' })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchWithAuth('/api/admin/gift-cards')
      if (res.ok) setCards(await res.json())
    } catch {}
    setLoading(false)
  }, [fetchWithAuth])

  useEffect(() => { load() }, [load])

  const create = async () => {
    if (!form.initialBalance) return
    try {
      const body: Record<string, unknown> = { initialBalance: +form.initialBalance }
      if (form.recipientName) body.recipientName = form.recipientName
      if (form.recipientEmail) body.recipientEmail = form.recipientEmail
      if (form.purchaserName) body.purchaserName = form.purchaserName
      if (form.message) body.message = form.message
      if (form.expiresAt) body.expiresAt = form.expiresAt
      const res = await fetchWithAuth('/api/admin/gift-cards', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      })
      if (res.ok) {
        load(); setShowCreate(false)
        setForm({ initialBalance: '', recipientName: '', recipientEmail: '', purchaserName: '', message: '', expiresAt: '' })
      }
    } catch {}
  }

  const validate = async () => {
    if (!validateCode) return
    setValidateResult(null)
    try {
      const body: Record<string, unknown> = { code: validateCode }
      if (validateAmount) body.amount = +validateAmount
      const res = await fetchWithAuth('/api/admin/gift-cards', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      })
      const data = await res.json()
      if (res.ok) {
        setValidateResult(`Valido! Saldo restante: ${fmtCur(data.currentBalance)}`)
        load()
      } else {
        setValidateResult(data.error || 'Codigo invalido')
      }
    } catch { setValidateResult('Erro ao validar') }
  }

  const deactivate = async (id: number) => {
    if (!confirm('Desativar este gift card?')) return
    try {
      const res = await fetchWithAuth('/api/admin/gift-cards', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status: 'DEACTIVATED' })
      })
      if (res.ok) load()
    } catch {}
  }

  const statusBadge: Record<string, { bg: string; text: string; label: string }> = {
    ACTIVE: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Ativo' },
    USED: { bg: 'bg-stone-100', text: 'text-stone-500', label: 'Usado' },
    EXPIRED: { bg: 'bg-red-100', text: 'text-red-600', label: 'Expirado' },
    DEACTIVATED: { bg: 'bg-stone-100', text: 'text-stone-400', label: 'Desativado' }
  }

  return (
    <div className="space-y-6 animate-[fadeIn_0.3s_ease-out]">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">Gift Cards</h1>
          <p className="text-stone-400 text-sm mt-0.5">Vales-presente e vouchers</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowValidate(true)} className="px-4 py-2.5 bg-white text-sm font-semibold text-[#b76e79] border border-[#b76e79]/30 rounded-xl hover:bg-[#b76e79]/5 transition-colors">
            Validar Codigo
          </button>
          <button onClick={() => setShowCreate(true)} className="px-4 py-2.5 bg-[#b76e79] text-white text-sm font-semibold rounded-xl hover:bg-[#a25d68] transition-colors shadow-md">
            + Novo Gift Card
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-emerald-50 rounded-xl p-4 border border-stone-100">
          <div className="text-stone-400 text-[9px] uppercase font-semibold tracking-wider">Ativos</div>
          <div className="text-emerald-600 text-xl font-bold mt-0.5">{cards.filter(c => c.status === 'ACTIVE').length}</div>
        </div>
        <div className="bg-violet-50 rounded-xl p-4 border border-stone-100">
          <div className="text-stone-400 text-[9px] uppercase font-semibold tracking-wider">Saldo Total</div>
          <div className="text-violet-600 text-xl font-bold mt-0.5">{fmtCur(cards.filter(c => c.status === 'ACTIVE').reduce((s, c) => s + c.currentBalance, 0))}</div>
        </div>
        <div className="bg-blue-50 rounded-xl p-4 border border-stone-100">
          <div className="text-stone-400 text-[9px] uppercase font-semibold tracking-wider">Vendidos</div>
          <div className="text-blue-600 text-xl font-bold mt-0.5">{fmtCur(cards.reduce((s, c) => s + c.initialBalance, 0))}</div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-7 h-7 border-3 border-[#b76e79] border-t-transparent rounded-full animate-spin" /></div>
      ) : cards.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-stone-100 shadow-sm">
          <div className="text-3xl mb-2">🎁</div>
          <p className="text-stone-400 text-sm">Nenhum gift card criado</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {cards.map(c => {
            const badge = statusBadge[c.status] || statusBadge.ACTIVE
            return (
              <div key={c.id} className="bg-white rounded-xl border border-stone-100 shadow-sm p-4 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-mono text-lg font-bold text-[#b76e79] tracking-wider">{c.code}</div>
                    {c.recipientName && <div className="text-stone-600 text-sm mt-0.5">Para: {c.recipientName}</div>}
                    {c.purchaserName && <div className="text-stone-400 text-xs">De: {c.purchaserName}</div>}
                    {c.message && <div className="text-stone-400 text-xs italic mt-1">&ldquo;{c.message}&rdquo;</div>}
                  </div>
                  <span className={`${badge.bg} ${badge.text} text-[10px] px-2 py-0.5 rounded-full font-semibold`}>{badge.label}</span>
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-stone-100">
                  <div>
                    <div className="text-xs text-stone-400">Saldo</div>
                    <div className="text-stone-800 font-bold">{fmtCur(c.currentBalance)} <span className="text-stone-300 text-xs font-normal">/ {fmtCur(c.initialBalance)}</span></div>
                  </div>
                  <div className="text-right text-xs text-stone-400">
                    {c.expiresAt && <div>Exp: {new Date(c.expiresAt).toLocaleDateString('pt-BR')}</div>}
                    <div>{new Date(c.createdAt).toLocaleDateString('pt-BR')}</div>
                  </div>
                </div>
                {c.status === 'ACTIVE' && (
                  <button onClick={() => deactivate(c.id)} className="mt-2 w-full py-1.5 text-[10px] font-semibold text-red-500 bg-red-50 rounded-lg hover:bg-red-100 transition-colors">Desativar</button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-stone-800">Novo Gift Card</h2>
            <div className="space-y-3">
              <input type="number" placeholder="Valor (R$)" value={form.initialBalance} onChange={e => setForm({ ...form, initialBalance: e.target.value })} className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-700 focus:outline-none focus:border-[#b76e79]/40" />
              <input placeholder="Nome do destinatario" value={form.recipientName} onChange={e => setForm({ ...form, recipientName: e.target.value })} className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-700 focus:outline-none focus:border-[#b76e79]/40" />
              <input placeholder="Email do destinatario" value={form.recipientEmail} onChange={e => setForm({ ...form, recipientEmail: e.target.value })} className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-700 focus:outline-none focus:border-[#b76e79]/40" />
              <input placeholder="Nome de quem presenteia" value={form.purchaserName} onChange={e => setForm({ ...form, purchaserName: e.target.value })} className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-700 focus:outline-none focus:border-[#b76e79]/40" />
              <textarea placeholder="Mensagem personalizada" value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-700 focus:outline-none focus:border-[#b76e79]/40 resize-none" rows={2} />
              <input type="date" value={form.expiresAt} onChange={e => setForm({ ...form, expiresAt: e.target.value })} className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-700 focus:outline-none focus:border-[#b76e79]/40" />
              <p className="text-stone-400 text-[10px]">Deixe vazio para sem validade</p>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setShowCreate(false)} className="flex-1 py-2.5 text-sm font-semibold text-stone-500 bg-stone-100 rounded-xl hover:bg-stone-200 transition-colors">Cancelar</button>
              <button onClick={create} className="flex-1 py-2.5 text-sm font-semibold text-white bg-[#b76e79] rounded-xl hover:bg-[#a25d68] transition-colors">Criar</button>
            </div>
          </div>
        </div>
      )}

      {/* Validate Modal */}
      {showValidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4" onClick={() => { setShowValidate(false); setValidateResult(null) }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-stone-800">Validar Gift Card</h2>
            <input placeholder="Codigo (ex: GC-ABCD1234)" value={validateCode} onChange={e => setValidateCode(e.target.value.toUpperCase())} className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-700 font-mono focus:outline-none focus:border-[#b76e79]/40" />
            <input type="number" placeholder="Valor a descontar (opcional)" value={validateAmount} onChange={e => setValidateAmount(e.target.value)} className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-700 focus:outline-none focus:border-[#b76e79]/40" />
            {validateResult && (
              <div className={`text-sm font-medium p-3 rounded-xl ${validateResult.includes('Valido') ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
                {validateResult}
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => { setShowValidate(false); setValidateResult(null) }} className="flex-1 py-2.5 text-sm font-semibold text-stone-500 bg-stone-100 rounded-xl hover:bg-stone-200 transition-colors">Fechar</button>
              <button onClick={validate} className="flex-1 py-2.5 text-sm font-semibold text-white bg-[#b76e79] rounded-xl hover:bg-[#a25d68] transition-colors">Validar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
