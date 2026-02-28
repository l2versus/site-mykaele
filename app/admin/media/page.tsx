// app/admin/media/page.tsx
'use client'

import { useState } from 'react'
import { getMediaStats, getAllMedia } from '@/lib/media-catalog'
import { Button } from '@/components/Button'

export default function AdminMediaPage() {
  const stats = getMediaStats()
  const allMedia = getAllMedia()
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">📁 Gerenciador de Mídias</h1>
          <p className="text-slate-600">Visualize e organize todas as mídias do seu site</p>
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
          <StatCard label="Profissionais" value={stats.profissionais} icon="👨‍⚕️" />
          <StatCard label="Procedimentos" value={stats.procedimentos} icon="🏥" />
          <StatCard label="Antes/Depois" value={stats.antes_depois} icon="✨" />
          <StatCard label="Tecnologias" value={stats.tecnologias} icon="🔬" />
          <StatCard label="Certificados" value={stats.certificados} icon="📜" />
          <StatCard label="Vídeos" value={stats.videos} icon="🎥" />
          <StatCard label="Total de Mídias" value={stats.total} icon="📊" color="blue" />
        </div>

        {/* Aviso de Setup */}
        <div className="mb-8 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-amber-900 font-semibold mb-2">⚠️ Próximo Passo</p>
          <p className="text-amber-800 text-sm mb-4">
            Para ativar todas as mídias, siga estas etapas:
          </p>
          <ol className="text-amber-800 text-sm space-y-2 ml-4 list-decimal">
            <li>Copie suas fotos para: <code className="bg-amber-100 px-2 py-1 rounded">public/media/</code></li>
            <li>Atualize os nomes em: <code className="bg-amber-100 px-2 py-1 rounded">src/lib/media-catalog.ts</code></li>
            <li>Reinicie o servidor: <code className="bg-amber-100 px-2 py-1 rounded">npm run dev</code></li>
          </ol>
        </div>

        {/* Categorias de Mídias */}
        <div className="space-y-4">
          <CategorySection
            title="👨‍⚕️ Profissionais"
            isExpanded={expandedCategory === 'profissionais'}
            onToggle={() =>
              setExpandedCategory(
                expandedCategory === 'profissionais' ? null : 'profissionais'
              )
            }
            items={Object.entries(allMedia.profissionais).map(([key, value]) => ({
              id: key,
              ...value,
            }))}
          />

          <CategorySection
            title="🏥 Procedimentos"
            isExpanded={expandedCategory === 'procedimentos'}
            onToggle={() =>
              setExpandedCategory(
                expandedCategory === 'procedimentos' ? null : 'procedimentos'
              )
            }
            items={Object.entries(allMedia.procedimentos).map(([key, value]) => ({
              id: key,
              ...value,
            }))}
          />

          <CategorySection
            title="✨ Antes & Depois"
            isExpanded={expandedCategory === 'antes_depois'}
            onToggle={() =>
              setExpandedCategory(
                expandedCategory === 'antes_depois' ? null : 'antes_depois'
              )
            }
            items={allMedia.antes_depois.map((item) => ({
              ...item,
            }))}
            isBeforeAfter
          />

          <CategorySection
            title="🔬 Tecnologias"
            isExpanded={expandedCategory === 'tecnologias'}
            onToggle={() =>
              setExpandedCategory(
                expandedCategory === 'tecnologias' ? null : 'tecnologias'
              )
            }
            items={Object.entries(allMedia.tecnologias).map(([key, value]) => ({
              id: key,
              ...value,
            }))}
          />

          <CategorySection
            title="🏢 Ambiente"
            isExpanded={expandedCategory === 'ambiente'}
            onToggle={() =>
              setExpandedCategory(expandedCategory === 'ambiente' ? null : 'ambiente')
            }
            items={Object.entries(allMedia.ambiente).map(([key, value]) => ({
              id: key,
              foto: value,
              nome: key.replace(/-/g, ' ').toUpperCase(),
            }))}
          />
        </div>

        {/* Footer Info */}
        <div className="mt-12 p-6 bg-white rounded-lg border border-slate-200">
          <h3 className="font-semibold text-slate-900 mb-3">📚 Documentação</h3>
          <p className="text-slate-600 text-sm mb-4">
            Para gerenciar melhor suas mídias, consulte:
          </p>
          <ul className="space-y-2 text-sm text-slate-600">
            <li>
              📄 <code className="bg-slate-100 px-2 py-1 rounded">public/media/README.md</code> - Estrutura e convenções
            </li>
            <li>
              📄 <code className="bg-slate-100 px-2 py-1 rounded">src/lib/media-catalog.ts</code> - Catálogo centralizado
            </li>
            <li>
              📄 <code className="bg-slate-100 px-2 py-1 rounded">FOTOS_UPLOAD_GUIDE.md</code> - Guia de upload
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}

interface StatCardProps {
  label: string
  value: number
  icon: string
  color?: 'default' | 'blue'
}

function StatCard({ label, value, icon, color = 'default' }: StatCardProps) {
  const bgColor = color === 'blue' ? 'bg-blue-50' : 'bg-white'
  const borderColor = color === 'blue' ? 'border-blue-200' : 'border-slate-200'
  const textColor = color === 'blue' ? 'text-blue-900' : 'text-slate-900'

  return (
    <div className={`${bgColor} border ${borderColor} rounded-lg p-4`}>
      <div className="text-3xl mb-2">{icon}</div>
      <p className={`${textColor} text-2xl font-bold`}>{value}</p>
      <p className="text-sm text-slate-600">{label}</p>
    </div>
  )
}

interface CategorySectionProps {
  title: string
  isExpanded: boolean
  onToggle: () => void
  items: any[]
  isBeforeAfter?: boolean
}

function CategorySection({
  title,
  isExpanded,
  onToggle,
  items,
  isBeforeAfter = false,
}: CategorySectionProps) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <span className="bg-blue-100 text-blue-900 px-3 py-1 rounded-full text-sm font-medium">
            {items.length}
          </span>
        </div>
        <svg
          className={`w-5 h-5 text-slate-600 transition-transform ${
            isExpanded ? 'rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      </button>

      {/* Conteúdo */}
      {isExpanded && (
        <div className="border-t border-slate-200 p-6">
          {items.length === 0 ? (
            <p className="text-slate-500 text-center py-8">Nenhuma mídia adicionada ainda</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map((item) => (
                <div key={item.id} className="border border-slate-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
                  {/* Imagem */}
                  {isBeforeAfter ? (
                    <div className="bg-slate-200 h-40 flex">
                      <img
                        src={item.antes || item.beforeImage}
                        alt="Antes"
                        className="w-1/2 h-full object-cover"
                      />
                      <img
                        src={item.depois || item.afterImage}
                        alt="Depois"
                        className="w-1/2 h-full object-cover"
                      />
                    </div>
                  ) : (
                    <img
                      src={item.foto}
                      alt={item.nome || item.titulo}
                      className="w-full h-40 object-cover"
                    />
                  )}

                  {/* Info */}
                  <div className="p-3">
                    <h3 className="font-semibold text-slate-900 text-sm">
                      {item.nome || item.titulo || item.procedimento}
                    </h3>
                    {item.descricao && (
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                        {item.descricao}
                      </p>
                    )}
                    {isBeforeAfter && item.profissional && (
                      <p className="text-xs text-slate-500 mt-1">👨‍⚕️ {item.profissional}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
