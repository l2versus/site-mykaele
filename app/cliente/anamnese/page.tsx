'use client'

import { useState, useEffect } from 'react'
import { useClient } from '../ClientContext'

/* ─── Types ─── */
interface AnamneseData {
  birthDate?: string; gender?: string; bloodType?: string; weight?: number; height?: number; occupation?: string
  allergies?: string; medications?: string; chronicConditions?: string; surgeries?: string; healthNotes?: string
  hasAllergies: boolean; hasDiabetes: boolean; hasHypertension: boolean; hasHeartCondition: boolean
  hasCirculatory: boolean; hasProsthetics: boolean; hasThyroid: boolean; isPregnant: boolean
  isBreastfeeding: boolean; hasSkinSensitivity: boolean; hasVaricoseVeins: boolean; hasRecentSurgery: boolean
  smokingStatus?: string; alcoholUse?: string; exerciseLevel?: string; sleepQuality?: string
  waterIntake?: string; dietDescription?: string
  mainGoals?: string; bodyAreas?: string; previousTreatments?: string; expectations?: string
  consentGiven: boolean; completedAt?: string
}

const defaultData: AnamneseData = {
  hasAllergies: false, hasDiabetes: false, hasHypertension: false, hasHeartCondition: false,
  hasCirculatory: false, hasProsthetics: false, hasThyroid: false, isPregnant: false,
  isBreastfeeding: false, hasSkinSensitivity: false, hasVaricoseVeins: false, hasRecentSurgery: false,
  consentGiven: false,
}

/* ─── Section Component ─── */
function Section({ icon, title, color, children, badge }: {
  icon: string; title: string; color: string; children: React.ReactNode; badge?: string
}) {
  const colorMap: Record<string, { bg: string; border: string; text: string; glow: string }> = {
    rose: { bg: 'from-[#b76e79]/12 to-[#b76e79]/3', border: 'border-[#b76e79]/12', text: 'text-[#d4a0a7]', glow: 'bg-[#b76e79]/6' },
    emerald: { bg: 'from-emerald-500/12 to-emerald-500/3', border: 'border-emerald-500/12', text: 'text-emerald-400', glow: 'bg-emerald-500/6' },
    blue: { bg: 'from-blue-500/12 to-blue-500/3', border: 'border-blue-500/12', text: 'text-blue-400', glow: 'bg-blue-500/6' },
    amber: { bg: 'from-amber-500/12 to-amber-500/3', border: 'border-amber-500/12', text: 'text-amber-400', glow: 'bg-amber-500/6' },
    purple: { bg: 'from-purple-500/12 to-purple-500/3', border: 'border-purple-500/12', text: 'text-purple-400', glow: 'bg-purple-500/6' },
    pink: { bg: 'from-pink-500/12 to-pink-500/3', border: 'border-pink-500/12', text: 'text-pink-400', glow: 'bg-pink-500/6' },
  }
  const c = colorMap[color] || colorMap.rose
  return (
    <div className="relative overflow-hidden rounded-3xl">
      <div className={`absolute inset-0 bg-gradient-to-br ${c.bg}`} />
      <div className={`absolute top-0 right-0 w-32 h-32 ${c.glow} rounded-full -translate-y-12 translate-x-12 blur-2xl`} />
      <div className={`relative border ${c.border} rounded-3xl`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.04]">
          <div className="flex items-center gap-3">
            <span className="text-xl">{icon}</span>
            <h3 className={`text-sm font-semibold ${c.text}`}>{title}</h3>
          </div>
          {badge && <span className="text-[9px] px-2.5 py-1 rounded-full bg-white/[0.05] text-white/30 font-medium">{badge}</span>}
        </div>
        <div className="p-5 space-y-4">{children}</div>
      </div>
    </div>
  )
}

/* ─── Field Components ─── */
function Field({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-white/30 text-[10px] font-medium uppercase tracking-wider">{label}</label>
      <input type={type} value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.06] rounded-xl text-white text-sm placeholder-white/10 focus:outline-none focus:border-white/15 transition-all" />
    </div>
  )
}

function TextArea({ label, value, onChange, placeholder, rows = 3 }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-white/30 text-[10px] font-medium uppercase tracking-wider">{label}</label>
      <textarea value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows}
        className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.06] rounded-xl text-white text-sm placeholder-white/10 focus:outline-none focus:border-white/15 transition-all resize-none" />
    </div>
  )
}

function Toggle({ label, checked, onChange, description }: {
  label: string; checked: boolean; onChange: (v: boolean) => void; description?: string
}) {
  return (
    <label className="flex items-center justify-between gap-3 py-2.5 cursor-pointer group">
      <div className="flex-1 min-w-0">
        <div className="text-white/50 text-xs font-medium group-hover:text-white/70 transition-colors">{label}</div>
        {description && <div className="text-white/15 text-[10px] mt-0.5">{description}</div>}
      </div>
      <div className={`relative w-10 h-5 rounded-full transition-all ${checked ? 'bg-[#b76e79]' : 'bg-white/[0.08]'}`}>
        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-md transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
      </div>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="hidden" />
    </label>
  )
}

function RadioGroup({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string; icon?: string }[]
}) {
  return (
    <div className="space-y-2">
      <label className="text-white/30 text-[10px] font-medium uppercase tracking-wider">{label}</label>
      <div className="flex flex-wrap gap-2">
        {options.map(opt => (
          <button key={opt.value} type="button" onClick={() => onChange(opt.value)}
            className={`px-3.5 py-2 rounded-xl text-xs font-medium border transition-all ${
              value === opt.value
                ? 'bg-[#b76e79]/15 border-[#b76e79]/25 text-[#d4a0a7]'
                : 'bg-white/[0.02] border-white/[0.06] text-white/30 hover:text-white/50 hover:border-white/10'
            }`}>
            {opt.icon && <span className="mr-1">{opt.icon}</span>}{opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function AnamnesePage() {
  const { fetchWithAuth } = useClient()
  const [data, setData] = useState<AnamneseData>(defaultData)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [tab, setTab] = useState(0)

  useEffect(() => {
    (async () => {
      try {
        const res = await fetchWithAuth('/api/patient/anamnese')
        if (res.ok) {
          const json = await res.json()
          if (json.anamnese) setData({ ...defaultData, ...json.anamnese })
        }
      } catch { /* */ }
      setLoading(false)
    })()
  }, [fetchWithAuth])

  const set = <K extends keyof AnamneseData>(key: K, val: AnamneseData[K]) => setData(d => ({ ...d, [key]: val }))

  const save = async () => {
    if (!data.consentGiven) { setMessage('Voce precisa aceitar o termo de consentimento'); return }
    setSaving(true); setMessage('')
    try {
      const res = await fetchWithAuth('/api/patient/anamnese', {
        method: 'POST',
        body: JSON.stringify(data),
      })
      if (res.ok) {
        setMessage('Anamnese salva com sucesso!')
        const json = await res.json()
        if (json.anamnese) setData({ ...defaultData, ...json.anamnese })
      } else setMessage('Erro ao salvar')
    } catch { setMessage('Erro de conexao') }
    setSaving(false)
    setTimeout(() => setMessage(''), 5000)
  }

  // Calculate completion percentage
  const totalFields = 28
  let filled = 0
  if (data.birthDate) filled++
  if (data.gender) filled++
  if (data.bloodType) filled++
  if (data.weight) filled++
  if (data.height) filled++
  if (data.occupation) filled++
  if (data.allergies) filled++
  if (data.medications) filled++
  if (data.chronicConditions) filled++
  if (data.surgeries) filled++
  if (data.smokingStatus) filled++
  if (data.alcoholUse) filled++
  if (data.exerciseLevel) filled++
  if (data.sleepQuality) filled++
  if (data.waterIntake) filled++
  if (data.dietDescription) filled++
  if (data.mainGoals) filled++
  if (data.bodyAreas) filled++
  if (data.previousTreatments) filled++
  if (data.expectations) filled++
  const bools = [data.hasAllergies, data.hasDiabetes, data.hasHypertension, data.hasHeartCondition,
    data.hasCirculatory, data.hasSkinSensitivity, data.hasVaricoseVeins, data.hasRecentSurgery]
  bools.forEach(b => { if (b) filled++ })
  const pct = Math.round((filled / totalFields) * 100)

  const tabs = [
    { label: 'Dados', id: 0 },
    { label: 'Saude', id: 1 },
    { label: 'Estilo', id: 2 },
    { label: 'Metas', id: 3 },
  ]

  if (loading) return <div className="flex justify-center py-16"><div className="w-7 h-7 border-2 border-[#b76e79] border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="space-y-5 animate-[fadeIn_0.5s_ease-out]">

      {/* Header Card */}
      <div className="relative overflow-hidden rounded-3xl">
        <div className="absolute inset-0 bg-gradient-to-br from-[#b76e79]/20 via-[#9e6670]/10 to-emerald-500/5" />
        <div className="absolute bottom-0 right-0 w-48 h-48 bg-emerald-500/[0.04] rounded-full translate-y-20 translate-x-12 blur-3xl" />
        <div className="relative border border-[#b76e79]/10 rounded-3xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold text-white/90 tracking-tight">Anamnese</h1>
              <p className="text-white/25 text-[11px] mt-1">Sua ficha de saude para tratamentos seguros</p>
            </div>
            <div className="relative w-14 h-14">
              <svg width="56" height="56" className="-rotate-90">
                <circle cx="28" cy="28" r="22" fill="none" stroke="white" strokeOpacity="0.05" strokeWidth="4" />
                <circle cx="28" cy="28" r="22" fill="none" stroke="url(#anamGrad)" strokeWidth="4"
                  strokeDasharray={2 * Math.PI * 22} strokeDashoffset={2 * Math.PI * 22 * (1 - pct / 100)} strokeLinecap="round" />
                <defs><linearGradient id="anamGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#b76e79" /><stop offset="100%" stopColor="#4ade80" />
                </linearGradient></defs>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-white/80 text-xs font-bold">{pct}%</span>
              </div>
            </div>
          </div>
          {data.completedAt && (
            <div className="mt-3 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="text-emerald-400/60 text-[10px] font-medium">
                Preenchida em {new Date(data.completedAt).toLocaleDateString('pt-BR')}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 bg-white/[0.02] border border-white/[0.05] rounded-2xl p-1.5">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 py-2.5 rounded-xl text-[11px] font-medium transition-all ${
              tab === t.id
                ? 'bg-gradient-to-r from-[#b76e79]/20 to-[#c28a93]/15 text-[#d4a0a7] border border-[#b76e79]/15'
                : 'text-white/25 hover:text-white/40 border border-transparent'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab 0: Dados Pessoais */}
      {tab === 0 && (
        <Section icon="U" title="Dados Pessoais" color="rose" badge="Basico">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Data de Nascimento" value={data.birthDate || ''} onChange={v => set('birthDate', v)} type="date" />
            <Field label="Peso (kg)" value={data.weight?.toString() || ''} onChange={v => set('weight', v ? parseFloat(v) : undefined)} type="number" placeholder="65" />
            <Field label="Altura (cm)" value={data.height?.toString() || ''} onChange={v => set('height', v ? parseFloat(v) : undefined)} type="number" placeholder="165" />
            <Field label="Tipo Sanguineo" value={data.bloodType || ''} onChange={v => set('bloodType', v)} placeholder="O+" />
          </div>
          <Field label="Profissao" value={data.occupation || ''} onChange={v => set('occupation', v)} placeholder="Sua profissao" />
          <RadioGroup label="Genero" value={data.gender || ''} onChange={v => set('gender', v)} options={[
            { value: 'feminino', label: 'Feminino' },
            { value: 'masculino', label: 'Masculino' },
            { value: 'outro', label: 'Outro' },
          ]} />
        </Section>
      )}

      {/* Tab 1: Saude */}
      {tab === 1 && (
        <>
          <Section icon="H" title="Condicoes de Saude" color="pink" badge="Importante">
            <div className="divide-y divide-white/[0.03]">
              <Toggle label="Possui alergias" checked={data.hasAllergies} onChange={v => set('hasAllergies', v)} description="Medicamentos, cosmeticos, etc" />
              <Toggle label="Diabetes" checked={data.hasDiabetes} onChange={v => set('hasDiabetes', v)} />
              <Toggle label="Hipertensao (pressao alta)" checked={data.hasHypertension} onChange={v => set('hasHypertension', v)} />
              <Toggle label="Problemas cardiacos" checked={data.hasHeartCondition} onChange={v => set('hasHeartCondition', v)} />
              <Toggle label="Problemas circulatorios" checked={data.hasCirculatory} onChange={v => set('hasCirculatory', v)} />
              <Toggle label="Tireoide" checked={data.hasThyroid} onChange={v => set('hasThyroid', v)} />
              <Toggle label="Proteses ou implantes" checked={data.hasProsthetics} onChange={v => set('hasProsthetics', v)} />
              <Toggle label="Varizes" checked={data.hasVaricoseVeins} onChange={v => set('hasVaricoseVeins', v)} />
              <Toggle label="Sensibilidade na pele" checked={data.hasSkinSensitivity} onChange={v => set('hasSkinSensitivity', v)} />
              <Toggle label="Cirurgia recente (menos de 6 meses)" checked={data.hasRecentSurgery} onChange={v => set('hasRecentSurgery', v)} />
            </div>
          </Section>

          <Section icon="G" title="Gestacao" color="purple">
            <Toggle label="Gestante" checked={data.isPregnant} onChange={v => set('isPregnant', v)} />
            <Toggle label="Amamentando" checked={data.isBreastfeeding} onChange={v => set('isBreastfeeding', v)} />
          </Section>

          <Section icon="M" title="Detalhes Medicos" color="blue">
            {data.hasAllergies && <TextArea label="Descreva suas alergias" value={data.allergies || ''} onChange={v => set('allergies', v)} placeholder="Ex: dipirona, latex..." />}
            <TextArea label="Medicamentos em uso" value={data.medications || ''} onChange={v => set('medications', v)} placeholder="Liste seus medicamentos atuais" />
            <TextArea label="Condicoes cronicas" value={data.chronicConditions || ''} onChange={v => set('chronicConditions', v)} placeholder="Doencas ou condicoes pre-existentes" />
            <TextArea label="Cirurgias anteriores" value={data.surgeries || ''} onChange={v => set('surgeries', v)} placeholder="Cirurgias que ja realizou" />
            <TextArea label="Observacoes de saude" value={data.healthNotes || ''} onChange={v => set('healthNotes', v)} placeholder="Qualquer informacao adicional relevante" />
          </Section>
        </>
      )}

      {/* Tab 2: Estilo de Vida */}
      {tab === 2 && (
        <Section icon="L" title="Estilo de Vida" color="emerald" badge="Bem-estar">
          <RadioGroup label="Tabagismo" value={data.smokingStatus || ''} onChange={v => set('smokingStatus', v)} options={[
            { value: 'never', label: 'Nunca fumou' }, { value: 'former', label: 'Ex-fumante' }, { value: 'current', label: 'Fumante' },
          ]} />
          <RadioGroup label="Consumo de Alcool" value={data.alcoholUse || ''} onChange={v => set('alcoholUse', v)} options={[
            { value: 'never', label: 'Nunca' }, { value: 'occasional', label: 'Ocasional' }, { value: 'regular', label: 'Regular' },
          ]} />
          <RadioGroup label="Nivel de Exercicio" value={data.exerciseLevel || ''} onChange={v => set('exerciseLevel', v)} options={[
            { value: 'sedentary', label: 'Sedentario' }, { value: 'light', label: 'Leve' },
            { value: 'moderate', label: 'Moderado' }, { value: 'intense', label: 'Intenso' },
          ]} />
          <RadioGroup label="Qualidade do Sono" value={data.sleepQuality || ''} onChange={v => set('sleepQuality', v)} options={[
            { value: 'poor', label: 'Ruim' }, { value: 'fair', label: 'Regular' },
            { value: 'good', label: 'Boa' }, { value: 'excellent', label: 'Excelente' },
          ]} />
          <RadioGroup label="Ingestao de Agua" value={data.waterIntake || ''} onChange={v => set('waterIntake', v)} options={[
            { value: 'low', label: 'Pouca' }, { value: 'moderate', label: 'Moderada' }, { value: 'adequate', label: 'Adequada' },
          ]} />
          <TextArea label="Alimentacao" value={data.dietDescription || ''} onChange={v => set('dietDescription', v)}
            placeholder="Descreva brevemente seus habitos alimentares" />
        </Section>
      )}

      {/* Tab 3: Metas */}
      {tab === 3 && (
        <>
          <Section icon="T" title="Objetivos e Expectativas" color="amber" badge="Tratamento">
            <TextArea label="Principais Objetivos" value={data.mainGoals || ''} onChange={v => set('mainGoals', v)}
              placeholder="O que deseja alcancar com os tratamentos?" rows={4} />
            <TextArea label="Areas do Corpo" value={data.bodyAreas || ''} onChange={v => set('bodyAreas', v)}
              placeholder="Quais regioes gostaria de tratar? Ex: abdomen, flancos, coxas..." />
            <TextArea label="Tratamentos Anteriores" value={data.previousTreatments || ''} onChange={v => set('previousTreatments', v)}
              placeholder="Ja fez algum tratamento estetico antes? Quais?" />
            <TextArea label="Expectativas" value={data.expectations || ''} onChange={v => set('expectations', v)}
              placeholder="O que espera dos resultados?" />
          </Section>

          {/* Consent */}
          <div className="relative overflow-hidden rounded-3xl">
            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-white/[0.01]" />
            <div className="relative border border-white/[0.06] rounded-3xl p-5">
              <label className="flex items-start gap-3 cursor-pointer">
                <div className={`mt-0.5 w-5 h-5 rounded-lg border flex items-center justify-center transition-all ${
                  data.consentGiven
                    ? 'bg-[#b76e79] border-[#b76e79] text-white'
                    : 'border-white/15 bg-white/[0.03]'
                }`}>
                  {data.consentGiven && <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>}
                </div>
                <div className="flex-1">
                  <div className="text-white/50 text-xs font-medium">Termo de Consentimento</div>
                  <div className="text-white/20 text-[10px] mt-1 leading-relaxed">
                    Autorizo o uso dessas informacoes pela profissional Mykaele Procopio exclusivamente
                    para fins de avaliacao e planejamento dos meus tratamentos esteticos. Declaro que todas
                    as informacoes fornecidas sao verdadeiras.
                  </div>
                </div>
                <input type="checkbox" checked={data.consentGiven} onChange={e => set('consentGiven', e.target.checked)} className="hidden" />
              </label>
            </div>
          </div>
        </>
      )}

      {/* Message */}
      {message && (
        <div className={`text-xs rounded-xl px-4 py-3 text-center animate-[fadeIn_0.3s] ${
          message.includes('sucesso') ? 'bg-emerald-500/10 border border-emerald-500/15 text-emerald-400' : 'bg-amber-500/10 border border-amber-500/15 text-amber-400'
        }`}>{message}</div>
      )}

      {/* Save Button */}
      <button onClick={save} disabled={saving}
        className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#b76e79] to-[#c28a93] text-white font-medium text-sm shadow-xl shadow-[#b76e79]/20 hover:shadow-[#b76e79]/35 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
        {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Salvar Anamnese'}
      </button>

      {/* Navigation Hint */}
      <div className="flex gap-2">
        {tab > 0 && (
          <button onClick={() => setTab(tab - 1)}
            className="flex-1 py-3 rounded-xl border border-white/[0.06] text-white/30 text-xs font-medium hover:text-white/50 transition-all">
            Anterior
          </button>
        )}
        {tab < 3 && (
          <button onClick={() => setTab(tab + 1)}
            className="flex-1 py-3 rounded-xl border border-[#b76e79]/10 text-[#d4a0a7]/60 text-xs font-medium hover:text-[#d4a0a7] hover:border-[#b76e79]/25 transition-all">
            Proximo
          </button>
        )}
      </div>
    </div>
  )
}
