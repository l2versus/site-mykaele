'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAdmin } from '../AdminContext'
import Image from 'next/image'

interface GalleryImage {
  id: string
  url: string
  alt: string | null
  order: number
  createdAt: string
}
const Ico = {
  upload: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M16 16l-4-4-4 4"/><path d="M12 12v9"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/><path d="M16 16l-4-4-4 4"/></svg>,
  trash: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>,
  image: <svg width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>,
  grip: <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24"><circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/></svg>,
  up: <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24"><path d="M18 15l-6-6-6 6"/></svg>,
  down: <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>,
}

export default function GaleriaAdminPage() {
  const { fetchWithAuth, token } = useAdmin()
  const [images, setImages] = useState<GalleryImage[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [altText, setAltText] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  const loadImages = useCallback(async () => {
    try {
      const res = await fetchWithAuth('/api/admin/gallery')
      if (res.ok) {
        const data = await res.json()
        setImages(data.images || [])
      }
    } catch { /* silently */ }
    setLoading(false)
  }, [fetchWithAuth])

  useEffect(() => { loadImages() }, [loadImages])

  const handleUpload = async (files: FileList | null) => {
    if (!files?.length) return
    setUploading(true)

    let successCount = 0
    for (const file of Array.from(files)) {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('alt', altText || file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '))

      try {
        const res = await fetch('/api/admin/gallery', {
          method: 'POST',
          body: formData,
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) successCount++
        else {
          const err = await res.json().catch(() => ({}))
          showToast(err.error || `Erro ao enviar ${file.name}`, 'error')
        }
      } catch {
        showToast(`Erro ao enviar ${file.name}`, 'error')
      }
    }

    if (successCount > 0) {
      showToast(`${successCount} foto${successCount > 1 ? 's' : ''} adicionada${successCount > 1 ? 's' : ''} com sucesso!`)
      setAltText('')
    }
    setUploading(false)
    await loadImages()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta foto da galeria?')) return

    try {
      const res = await fetchWithAuth('/api/admin/gallery', {
        method: 'DELETE',
        body: JSON.stringify({ id }),
      })
      if (res.ok) {
        showToast('Foto excluída com sucesso')
        setImages(prev => prev.filter(img => img.id !== id))
      } else {
        showToast('Erro ao excluir', 'error')
      }
    } catch {
      showToast('Erro de conexão', 'error')
    }
  }

  const moveImage = async (index: number, direction: 'up' | 'down') => {
    const newImages = [...images]
    const swapIdx = direction === 'up' ? index - 1 : index + 1
    if (swapIdx < 0 || swapIdx >= newImages.length) return

    ;[newImages[index], newImages[swapIdx]] = [newImages[swapIdx], newImages[index]]
    setImages(newImages)

    try {
      await fetchWithAuth('/api/admin/gallery', {
        method: 'PUT',
        body: JSON.stringify({ orderedIds: newImages.map(i => i.id) }),
      })
    } catch { /* silently */ }
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    handleUpload(e.dataTransfer.files)
  }

  // ═══ Skeleton Loading ═══
  if (loading) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="animate-pulse space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-stone-100 rounded-2xl" />
            <div className="space-y-2 flex-1">
              <div className="h-7 bg-stone-100 rounded-lg w-1/4" />
              <div className="h-4 bg-stone-50 rounded w-1/3" />
            </div>
          </div>
          <div className="h-48 bg-stone-100 rounded-2xl border-2 border-dashed border-stone-200" />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="aspect-[3/4] bg-stone-100 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-6xl mx-auto animate-[fadeIn_0.4s_ease-out]">
      {/* ═══ Toast ═══ */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-xl shadow-lg backdrop-blur-md text-sm font-medium animate-[fadeIn_0.3s_ease-out] ${
          toast.type === 'success'
            ? 'bg-emerald-500/90 text-white'
            : 'bg-red-500/90 text-white'
        }`}>
          {toast.msg}
        </div>
      )}

      {/* ═══ Header Premium ═══ */}
      <div className="flex items-center justify-between mb-10">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#b76e79]/20 to-[#d4a0a7]/10 border border-[#b76e79]/20 flex items-center justify-center text-[#b76e79]">
            {Ico.image}
          </div>
          <div>
            <h1 className="text-xl font-semibold text-stone-800 tracking-tight">Galeria de Fotos</h1>
            <p className="text-sm text-stone-400 mt-0.5">
              {images.length} foto{images.length !== 1 ? 's' : ''} na galeria do site
            </p>
          </div>
        </div>
      </div>

      {/* ═══ Zona de Upload (Drag & Drop) ═══ */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`relative rounded-2xl border-2 border-dashed transition-all duration-300 mb-8 ${
          dragOver
            ? 'border-[#b76e79] bg-[#b76e79]/5 scale-[1.01]'
            : 'border-stone-200 hover:border-stone-300 bg-white'
        }`}
      >
        <div className="flex flex-col items-center justify-center py-12 px-6">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-all ${
            dragOver
              ? 'bg-[#b76e79]/15 text-[#b76e79] scale-110'
              : 'bg-stone-50 text-stone-300'
          }`}>
            {Ico.upload}
          </div>

          <h3 className="text-base font-medium text-stone-700 mb-1">
            {uploading ? 'Enviando...' : 'Arraste fotos aqui'}
          </h3>
          <p className="text-sm text-stone-400 mb-5">
            ou clique para selecionar • JPEG, PNG, WebP • Máx. 5 MB
          </p>

          {/* Alt text input */}
          <div className="flex items-center gap-3 mb-4 w-full max-w-md">
            <input
              type="text"
              placeholder="Descrição da foto (opcional)"
              value={altText}
              onChange={e => setAltText(e.target.value)}
              className="flex-1 h-10 px-4 rounded-xl bg-stone-50 border border-stone-200 text-sm text-stone-700 placeholder:text-stone-300 focus:outline-none focus:ring-2 focus:ring-[#b76e79]/30 focus:border-[#b76e79]/40 transition-all"
            />
          </div>

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#b76e79] to-[#c4858f] text-white text-sm font-medium shadow-md hover:shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                Enviando...
              </>
            ) : (
              <>
                {Ico.upload}
                Adicionar Fotos
              </>
            )}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            multiple
            className="hidden"
            onChange={e => handleUpload(e.target.files)}
          />
        </div>
      </div>

      {/* ═══ Grid de Imagens ═══ */}
      {images.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-20 h-20 rounded-full bg-stone-50 flex items-center justify-center mx-auto mb-4 text-stone-200">
            {Ico.image}
          </div>
          <p className="text-stone-400 text-sm">Nenhuma foto na galeria ainda.</p>
          <p className="text-stone-300 text-xs mt-1">Faça upload de fotos para exibir no site.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {images.map((img, idx) => (
            <div
              key={img.id}
              className="group relative bg-white rounded-xl overflow-hidden border border-stone-100 shadow-sm hover:shadow-md transition-all duration-300"
            >
              {/* Imagem */}
              <div className="aspect-[3/4] relative bg-stone-50">
                <Image
                  src={img.url}
                  alt={img.alt || 'Galeria'}
                  fill
                  sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
                  className="object-cover"
                />
              </div>

              {/* Overlay com ações */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300">
                <div className="absolute bottom-0 left-0 right-0 p-3 flex items-end justify-between">
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-xs font-medium truncate">
                      {img.alt || 'Sem descrição'}
                    </p>
                    <p className="text-white/50 text-[10px] mt-0.5">
                      Posição {idx + 1}
                    </p>
                  </div>

                  {/* Botões */}
                  <div className="flex items-center gap-1.5 ml-2">
                    {/* Move up */}
                    <button
                      onClick={() => moveImage(idx, 'up')}
                      disabled={idx === 0}
                      className="w-7 h-7 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Mover para cima"
                    >
                      {Ico.up}
                    </button>
                    {/* Move down */}
                    <button
                      onClick={() => moveImage(idx, 'down')}
                      disabled={idx === images.length - 1}
                      className="w-7 h-7 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Mover para baixo"
                    >
                      {Ico.down}
                    </button>
                    {/* Delete */}
                    <button
                      onClick={() => handleDelete(img.id)}
                      className="w-7 h-7 rounded-lg bg-red-500/80 backdrop-blur-sm flex items-center justify-center text-white hover:bg-red-500 transition-all"
                      title="Excluir foto"
                    >
                      {Ico.trash}
                    </button>
                  </div>
                </div>
              </div>

              {/* Badge de ordem */}
              <div className="absolute top-2 left-2 w-6 h-6 rounded-lg bg-black/50 backdrop-blur-sm flex items-center justify-center">
                <span className="text-[10px] font-bold text-white">{idx + 1}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
