'use client'

import { useState, useEffect, ReactNode, useCallback } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AdminContextProvider, AdminContextType, AdminUser } from './AdminContext'

/* ─── SVG Icons (Lucide-style) ─── */
const I = {
  grid: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="4" rx="1"/><rect x="14" y="11" width="7" height="10" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>,
  cal: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  heart: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>,
  users: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  dollar: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  gear: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  out: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  menu: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/></svg>,
  left: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>,
}

const NAV = [
  { href: '/admin', label: 'Dashboard', icon: I.grid },
  { href: '/admin/agenda', label: 'Agenda', icon: I.cal },
  { href: '/admin/servicos', label: 'Serviços', icon: I.heart },
  { href: '/admin/clientes', label: 'Clientes', icon: I.users },
  { href: '/admin/financeiro', label: 'Financeiro', icon: I.dollar },
  { href: '/admin/configuracoes', label: 'Configurações', icon: I.gear },
]

/* ─── Leaf Logo PNG Component ─── */
function LeafLogo({ className = '', style = {} }: { className?: string; style?: React.CSSProperties }) {
  return (
    <img
      src="/media/logo-branding/logocorreta.png"
      alt="Mykaele Procópio"
      className={className}
      style={{ objectFit: 'contain', ...style }}
      draggable={false}
    />
  )
}

function LoginScreen({ onLogin }: { onLogin: (t: string, u: AdminUser) => void }) {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('')
  const [error, setError] = useState(''); const [loading, setLoading] = useState(false)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError('')
    try {
      const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Erro'); return }
      if (data.user.role !== 'ADMIN') { setError('Acesso restrito'); return }
      onLogin(data.token, data.user)
    } catch { setError('Erro de conexão') } finally { setLoading(false) }
  }
  return (
    <div className="min-h-screen bg-[#09090b] flex relative overflow-hidden">
      {/* Pattern watermark — cor real + blur + degradê escuro */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 opacity-[0.12] blur-[1px]" style={{ backgroundImage: 'url(/media/logo-branding/pattern-leaf.png)', backgroundSize: '280px', backgroundRepeat: 'repeat' }} />
        <div className="absolute inset-0 bg-gradient-to-b from-[#09090b]/80 via-[#09090b]/60 to-[#09090b]/90" />
      </div>

      {/* ── Left Panel: Foto editorial da Mykaele ── */}
      <div className="hidden lg:block w-[48%] relative overflow-hidden">
        <img src="/media/profissionais/mykaele-principal.png" alt="Mykaele Procópio" className="absolute inset-0 w-full h-full object-cover" style={{ objectPosition: 'center 15%' }} />
        <div className="absolute inset-0 bg-gradient-to-r from-[#09090b]/30 via-transparent to-[#09090b]/90" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#09090b]/90 via-[#09090b]/20 to-[#09090b]/50" />
        <div className="absolute bottom-0 left-0 w-full h-1/3 bg-gradient-to-t from-[#b76e79]/8 to-transparent" />
        <div className="absolute inset-0 flex flex-col justify-end p-10 pb-14">
          <LeafLogo className="w-7 h-10 text-white/30 mb-5" />
          <h1 className="text-3xl font-extralight text-white/90 tracking-[-0.01em] leading-tight">Mykaele<br />Procópio</h1>
          <div className="mt-3 w-8 h-[1px] bg-[#b76e79]/40" />
          <p className="mt-3 text-white/35 text-[11px] tracking-[0.2em] uppercase font-light">Home Spa Premium</p>
          <p className="mt-2 text-white/20 text-[11px] font-light leading-relaxed max-w-[250px]">Fisioterapeuta Dermatofuncional · Arquitetura Corporal</p>
        </div>
        <div className="absolute top-0 right-0 w-[1px] h-full bg-gradient-to-b from-transparent via-[#b76e79]/15 to-transparent" />
      </div>

      {/* ── Right Panel: Login Form ── */}
      <div className="flex-1 flex items-center justify-center px-6 relative z-10">
        <div className="absolute top-1/4 left-1/4 w-[300px] h-[300px] bg-[#b76e79]/[0.02] rounded-full blur-[120px] pointer-events-none" />
        <LeafLogo className="absolute top-8 right-8 w-[100px] h-[100px] text-[#b76e79]/[0.02] rotate-12 pointer-events-none" />

        <div className="w-full max-w-sm">
          <div className="lg:hidden text-center mb-8">
            <div className="flex justify-center mb-4"><LeafLogo className="w-10 h-14 text-[#b76e79]/50" /></div>
            <h1 className="text-xl font-light text-white/90 tracking-tight">Mykaele Procópio</h1>
            <p className="text-white/25 text-[10px] mt-1 tracking-[0.2em] uppercase">Home Spa Premium</p>
          </div>

          <div className="text-center mb-8">
            <h2 className="text-lg font-semibold text-white tracking-tight">Painel Administrativo</h2>
            <p className="text-white/30 text-xs mt-1.5">Acesse sua área de gestão</p>
          </div>

          <form onSubmit={submit} className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6 space-y-4 backdrop-blur-xl">
            {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-lg px-3 py-2">{error}</div>}
            <div>
              <label className="block text-white/40 text-[11px] font-medium mb-1.5 uppercase tracking-wider">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                className="w-full px-3.5 py-2.5 bg-white/[0.03] border border-white/[0.07] rounded-lg text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#b76e79]/40 focus:bg-white/[0.05] transition-all" placeholder="admin@homespa.com" />
            </div>
            <div>
              <label className="block text-white/40 text-[11px] font-medium mb-1.5 uppercase tracking-wider">Senha</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
                className="w-full px-3.5 py-2.5 bg-white/[0.03] border border-white/[0.07] rounded-lg text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#b76e79]/40 focus:bg-white/[0.05] transition-all" placeholder="••••••••" />
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-lg bg-gradient-to-r from-[#b76e79] to-[#d4a0a7] text-white text-sm font-semibold shadow-lg shadow-[#b76e79]/20 hover:shadow-[#b76e79]/30 hover:brightness-110 active:scale-[0.99] transition-all disabled:opacity-50">
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <p className="text-center text-white/10 text-[10px] mt-6">Mykaele Procópio Home Spa &copy; 2026</p>
        </div>
      </div>

      {/* Dev credit badge */}
      <a href="https://www.instagram.com/emmanuelbezerra_" target="_blank" rel="noopener noreferrer"
        className="fixed bottom-3 left-4 z-50 flex items-center gap-2 px-3.5 py-2 rounded-full bg-white/[0.05] backdrop-blur-md border border-white/[0.08] group hover:bg-white/[0.1] hover:border-white/[0.15] transition-all duration-300">
        <span className="text-[10px] text-white/25 tracking-wider font-light group-hover:text-white/40 transition-colors">dev</span>
        <span className="text-[10px] text-rose-400/40">&#9829;</span>
        <img src="/media/logo-branding/logo-emmanuel.png" alt="Emmanuel Bezerra" className="h-6 w-auto object-contain brightness-200 opacity-45 group-hover:opacity-70 transition-opacity duration-300" />
      </a>
    </div>
  )
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [sb, setSb] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const pathname = usePathname()

  const handleCloseSidebar = () => setMobileOpen(false);
  useEffect(() => { setMobileOpen(false) }, [pathname])
  useEffect(() => { setMounted(true); try { const t = localStorage.getItem('admin_token'); const u = localStorage.getItem('admin_user'); if (t && u) { setToken(t); setUser(JSON.parse(u)) } } catch {} }, [])

  const fetchWithAuth = useCallback(async (url: string, opts: RequestInit = {}) => {
    return fetch(url, { ...opts, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(opts.headers || {}) } })
  }, [token])

  const handleLogin = (t: string, u: AdminUser) => { setToken(t); setUser(u); localStorage.setItem('admin_token', t); localStorage.setItem('admin_user', JSON.stringify(u)) }
  const logout = () => { setToken(null); setUser(null); localStorage.removeItem('admin_token'); localStorage.removeItem('admin_user') }

  if (!mounted) return null
  if (!token || !user) return <LoginScreen onLogin={handleLogin} />

  return (
    <AdminContextProvider value={{ user, token, fetchWithAuth, logout }}>
      <div className="min-h-screen bg-gradient-to-b from-[#0e0b10] via-[#100d14] to-[#0e0b10] flex relative">

        {/* ── Mobile Backdrop ── */}
        {mobileOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-300 lg:hidden"
            onClick={handleCloseSidebar}
            aria-label="Fechar menu mobile"
          />
        )}

        {/* ── Sidebar ── */}
        <aside
          className={`fixed top-0 left-0 z-50 h-full bg-[#13111a] border-r border-white/[0.06] shadow-xl lg:shadow-none flex flex-col transition-all duration-300 ${
            mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          } ${sb ? 'w-64 lg:w-60' : 'w-64 lg:w-[68px]'}`}
          aria-hidden={!mobileOpen}
        >
          {/* Botão fechar mobile (X) - Fica oculto em telas grandes */}
          <button
            className="absolute top-4 right-4 z-60 p-2 rounded-full bg-white/[0.06] hover:bg-white/[0.1] focus:outline-none lg:hidden"
            onClick={handleCloseSidebar}
            aria-label="Fechar menu"
          >
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>

          <div className="px-4 h-14 lg:h-16 border-b border-white/[0.06] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#b76e79] to-[#c28a93] flex items-center justify-center flex-shrink-0 shadow-sm">
                <LeafLogo className="w-4.5 h-6 text-white" />
              </div>
              <span className={`text-white/90 text-sm font-semibold tracking-tight ${!sb ? 'lg:hidden' : ''}`}>Mykaele Procópio</span>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 p-2 space-y-0.5 mt-1 overflow-y-auto">
            {NAV.map(item => {
              const active = pathname === item.href
              return (
                <Link key={item.href} href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] transition-all ${
                    active
                      ? 'bg-[#b76e79]/15 text-[#b76e79] font-semibold shadow-sm shadow-[#b76e79]/10'
                      : 'text-white/35 hover:text-white/60 hover:bg-white/[0.04]'
                  }`}
                  onClick={() => setMobileOpen(false)}
                >
                  <span className="flex-shrink-0 [&>svg]:stroke-current">{item.icon}</span>
                  <span className={!sb ? 'lg:hidden' : ''}>{item.label}</span>
                </Link>
              )
            })}
          </nav>

          {/* Sidebar bottom — Mini profile */}
          <div className={`px-3 py-3 border-t border-white/[0.06] ${!sb ? 'lg:hidden' : ''}`}>
            <div className="flex items-center gap-3 p-2 rounded-xl bg-white/[0.04]">
              <div className="w-9 h-9 rounded-full overflow-hidden ring-2 ring-[#b76e79]/15 flex-shrink-0 shadow-sm">
                <img src="/media/profissionais/mykaele-principal.png" alt=""
                  className="w-full h-full object-cover" style={{ objectPosition: 'center 15%' }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display='none' }} />
              </div>
              <div className="min-w-0">
                <p className="text-white/80 text-[12px] font-semibold truncate">{user.name}</p>
                <p className="text-white/30 text-[10px] truncate">{user.email}</p>
              </div>
            </div>
          </div>

          <div className="p-2 border-t border-white/[0.06] space-y-1">
            <button onClick={logout} className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-[13px] text-red-400 hover:text-red-500 hover:bg-red-500/10 transition-all justify-start">
              <span className="flex-shrink-0">{I.out}</span>
              <span className={`font-medium ${!sb ? 'lg:hidden' : ''}`}>Sair</span>
            </button>
            <a href="https://www.instagram.com/emmanuelbezerra_" target="_blank" rel="noopener noreferrer"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg group hover:bg-white/[0.04] transition-all ${!sb ? 'lg:justify-center' : ''}`}>
              <span className={`text-[9px] text-white/20 tracking-wider font-light group-hover:text-white/35 transition-colors ${!sb ? 'lg:hidden' : ''}`}>dev</span>
              <span className={`text-[8px] text-rose-300/50 ${!sb ? 'lg:hidden' : ''}`}>&#9829;</span>
              <img src="/media/logo-branding/logo-emmanuel.png" alt="Emmanuel Bezerra" className="h-4 w-auto object-contain opacity-40 group-hover:opacity-70 transition-opacity duration-300" />
            </a>
          </div>
        </aside>

        {/* ── Main area ── */}
        <main className={`flex-1 ml-0 ${sb ? 'lg:ml-60' : 'lg:ml-[68px]'} transition-[margin] duration-300 w-full min-w-0`}>
          {/* Top header */}
          <header className="h-14 lg:h-16 bg-[#13111a]/80 border-b border-white/[0.06] flex items-center justify-between px-4 lg:px-6 sticky top-0 z-30 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <button onClick={() => setMobileOpen(true)} className="lg:hidden text-white/35 hover:text-white/60 transition-colors">
                {I.menu}
              </button>
              <button onClick={() => setSb(!sb)} className="hidden lg:block text-white/25 hover:text-white/50 transition-colors">
                {sb ? I.left : I.menu}
              </button>
            </div>
            <div className="flex items-center gap-3 lg:gap-4">
              <LeafLogo className="w-3.5 h-5 text-[#b76e79]/40 hidden sm:block" />
              <div className="h-8 w-px bg-white/[0.06] hidden sm:block" />
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full overflow-hidden ring-2 ring-[#b76e79]/10 shadow-sm">
                  <img src="/media/profissionais/mykaele-principal.png" alt=""
                    className="w-full h-full object-cover" style={{ objectPosition: 'center 15%' }}
                    onError={(e) => { const el = e.target as HTMLImageElement; el.style.display='none'; el.parentElement!.innerHTML=`<span class="text-[#b76e79] text-xs font-bold">${user.name?.charAt(0)}</span>` }} />
                </div>
                <span className="text-white/70 text-xs font-medium hidden sm:inline">{user.name}</span>
              </div>
            </div>
          </header>

          {/* Content area */}
          <div className="p-4 lg:p-6 max-w-full overflow-x-hidden">{children}</div>
        </main>

      </div>
    </AdminContextProvider>
  )
}