// app/admin/upload-media/page.tsx
'use client'

import MediaUploadManager from '@/components/MediaUploadManager'
import { Button } from '@/components/Button'
import { useState } from 'react'

export default function AdminUploadMediaPage() {
  const [activeTab, setActiveTab] = useState<'upload' | 'instrucoes'>('upload')

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">📤 Upload de Mídias</h1>
          <p className="text-slate-600">Adicione fotos e vídeos para seu site</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-slate-200">
          <button
            onClick={() => setActiveTab('upload')}
            className={`px-6 py-3 font-semibold border-b-2 transition-colors ${
              activeTab === 'upload'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            📤 Upload
          </button>
          <button
            onClick={() => setActiveTab('instrucoes')}
            className={`px-6 py-3 font-semibold border-b-2 transition-colors ${
              activeTab === 'instrucoes'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            ❓ Como Usar
          </button>
        </div>

        {/* Content */}
        <div className="bg-white rounded-lg border border-slate-200 p-8">
          {activeTab === 'upload' ? (
            <MediaUploadManager />
          ) : (
            <div className="space-y-6">
              <section>
                <h2 className="text-2xl font-bold text-slate-900 mb-4">📖 Guia de Uso</h2>

                <div className="space-y-6">
                  {/* Passo 1 */}
                  <div className="border-l-4 border-blue-500 pl-4">
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                      1️⃣ Selecione a Categoria
                    </h3>
                    <p className="text-slate-600 mb-2">
                      Escolha a categoria onde seus arquivos serão salvos:
                    </p>
                    <ul className="list-disc list-inside text-slate-600 space-y-1">
                      <li>👨‍⚕️ Profissionais - Fotos de perfil</li>
                      <li>🏥 Procedimentos - Fotos dos procedimentos</li>
                      <li>✨ Antes & Depois - Galeriaantes/depois</li>
                      <li>🔬 Tecnologias - Equipamentos</li>
                      <li>🏢 Ambiente - Fotos da clínica</li>
                      <li>📜 Certificados - Credenciais</li>
                      <li>🎥 Vídeos - Thumbnails</li>
                      <li>🎨 Logo & Branding - Assets da marca</li>
                    </ul>
                  </div>

                  {/* Passo 2 */}
                  <div className="border-l-4 border-green-500 pl-4">
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                      2️⃣ Selecione Arquivos
                    </h3>
                    <p className="text-slate-600 mb-2">
                      Você pode:
                    </p>
                    <ul className="list-disc list-inside text-slate-600 space-y-1">
                      <li>Clicar no botão para selecioná-los</li>
                      <li>Arrastar e soltar múltiplos arquivos</li>
                      <li>Suporta JPG, PNG, GIF, WebP e vídeos</li>
                    </ul>
                  </div>

                  {/* Passo 3 */}
                  <div className="border-l-4 border-purple-500 pl-4">
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                      3️⃣ Revisar Preview
                    </h3>
                    <p className="text-slate-600">
                      Os arquivos selecionados aparecem no preview. Você pode remover qualquer um clicando nele.
                    </p>
                  </div>

                  {/* Passo 4 */}
                  <div className="border-l-4 border-orange-500 pl-4">
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                      4️⃣ Fazer Upload
                    </h3>
                    <p className="text-slate-600 mb-2">
                      Clique em "Upload" e os arquivos serão salvos em:
                    </p>
                    <code className="block bg-slate-100 p-3 rounded-lg text-sm text-slate-900 font-mono">
                      public/media/[categoria]/
                    </code>
                  </div>

                  {/* Passo 5 */}
                  <div className="border-l-4 border-red-500 pl-4">
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                      5️⃣ Atualizar Catálogo
                    </h3>
                    <p className="text-slate-600 mb-2">
                      Após o upload, atualize o catálogo em:
                    </p>
                    <code className="block bg-slate-100 p-3 rounded-lg text-sm text-slate-900 font-mono">
                      src/lib/media-catalog.ts
                    </code>
                  </div>
                </div>
              </section>

              {/* Convenções */}
              <section className="border-t border-slate-200 pt-6">
                <h2 className="text-2xl font-bold text-slate-900 mb-4">📝 Convenções de Nomes</h2>

                <div className="space-y-4">
                  <div>
                    <p className="font-semibold text-slate-900 mb-2">Profissionais:</p>
                    <code className="block bg-slate-100 p-2 rounded text-sm text-slate-900">
                      joao.jpg, maria.jpg, carlos.jpg
                    </code>
                  </div>

                  <div>
                    <p className="font-semibold text-slate-900 mb-2">Antes/Depois:</p>
                    <code className="block bg-slate-100 p-2 rounded text-sm text-slate-900">
                      harmonizacao-1-antes.jpg<br />
                      harmonizacao-1-depois.jpg
                    </code>
                  </div>

                  <div>
                    <p className="font-semibold text-slate-900 mb-2">Vídeos:</p>
                    <code className="block bg-slate-100 p-2 rounded text-sm text-slate-900">
                      apresentacao-thumb.jpg<br />
                      tecnicas-thumb.jpg
                    </code>
                  </div>
                </div>
              </section>

              {/* Tamanhos Recomendados */}
              <section className="border-t border-slate-200 pt-6">
                <h2 className="text-2xl font-bold text-slate-900 mb-4">📐 Tamanhos Recomendados</h2>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-100">
                      <tr>
                        <th className="px-4 py-2 text-left font-semibold text-slate-900">Tipo</th>
                        <th className="px-4 py-2 text-left font-semibold text-slate-900">Dimensões</th>
                        <th className="px-4 py-2 text-left font-semibold text-slate-900">Formato</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      <tr>
                        <td className="px-4 py-2">Profissional</td>
                        <td className="px-4 py-2">300 × 360px</td>
                        <td className="px-4 py-2">JPG</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2">Procedimento</td>
                        <td className="px-4 py-2">400 × 267px</td>
                        <td className="px-4 py-2">JPG</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2">Antes/Depois</td>
                        <td className="px-4 py-2">600 × 600px</td>
                        <td className="px-4 py-2">JPG</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2">Ambiente</td>
                        <td className="px-4 py-2">1000 × 667px</td>
                        <td className="px-4 py-2">JPG</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2">Logo</td>
                        <td className="px-4 py-2">200 × 100px mín</td>
                        <td className="px-4 py-2">PNG</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2">OG Image</td>
                        <td className="px-4 py-2">1200 × 630px</td>
                        <td className="px-4 py-2">JPG</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}
        </div>

        {/* Link para Gerenciador */}
        <div className="mt-6 p-4 bg-slate-100 rounded-lg flex items-center justify-between">
          <div>
            <p className="font-semibold text-slate-900">🎨 Quer gerenciar suas mídias?</p>
            <p className="text-sm text-slate-600">Acesse o gerenciador de mídias para visualizar tudo</p>
          </div>
          <a href="/admin/media" className="inline-block">
            <Button>📁 Ir para Gerenciador</Button>
          </a>
        </div>
      </div>
    </div>
  )
}
