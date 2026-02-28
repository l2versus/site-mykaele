// src/components/MediaUploadManager.tsx
'use client'

import { useState, useRef } from 'react'
import { Button } from './Button'

interface UploadedFile {
  file: File
  preview: string
  category: string
  name: string
}

const CATEGORIES = [
  { id: 'profissionais', label: '👨‍⚕️ Profissionais' },
  { id: 'procedimentos', label: '🏥 Procedimentos' },
  { id: 'antes-depois', label: '✨ Antes & Depois' },
  { id: 'tecnologias', label: '🔬 Tecnologias' },
  { id: 'ambiente', label: '🏢 Ambiente' },
  { id: 'certificados', label: '📜 Certificados' },
  { id: 'videos', label: '🎥 Vídeos (Thumbnails)' },
  { id: 'logo-branding', label: '🎨 Logo & Branding' },
]

export default function MediaUploadManager() {
  const [selectedFiles, setSelectedFiles] = useState<UploadedFile[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('profissionais')
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])

    files.forEach((file) => {
      if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
        alert('Apenas imagens e vídeos são aceitos')
        return
      }

      const reader = new FileReader()
      reader.onload = (e) => {
        setSelectedFiles((prev) => [
          ...prev,
          {
            file,
            preview: e.target?.result as string,
            category: selectedCategory,
            name: file.name.replace(/\.[^/.]+$/, ''), // Remove extensão
          },
        ])
      }
      reader.readAsDataURL(file)
    })
  }

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      alert('Selecione pelo menos um arquivo')
      return
    }

    setIsUploading(true)

    try {
      // Aqui você integraria com API real (Cloudinary, AWS S3, etc)
      // Por enquanto, apenas simulamos
      console.log('Arquivos para upload:', selectedFiles)

      // Simular delay
      await new Promise((resolve) => setTimeout(resolve, 2000))

      alert(`✅ ${selectedFiles.length} arquivo(s) preparado(s) para upload!`)
      setSelectedFiles([])
    } catch (error) {
      alert('Erro ao preparar upload')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Seleção de Categoria */}
      <div>
        <label className="block text-sm font-semibold text-slate-900 mb-3">
          📁 Selecione a Categoria
        </label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`p-3 rounded-lg border-2 transition-all ${
                selectedCategory === cat.id
                  ? 'border-blue-500 bg-blue-50 text-blue-900'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <span className="text-xs font-semibold">{cat.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Input Oculto */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,video/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Zona de Drop */}
      <div
        onDragOver={(e) => {
          e.preventDefault()
          e.currentTarget.classList.add('bg-blue-50')
        }}
        onDragLeave={(e) => {
          e.currentTarget.classList.remove('bg-blue-50')
        }}
        onDrop={(e) => {
          e.preventDefault()
          e.currentTarget.classList.remove('bg-blue-50')

          const files = Array.from(e.dataTransfer.files)
          const event = {
            target: {
              files: files,
            },
          } as unknown as React.ChangeEvent<HTMLInputElement>
          handleFileSelect(event)
        }}
        className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 transition-colors"
      >
        <div className="text-4xl mb-3">📤</div>
        <p className="text-slate-900 font-semibold mb-1">Arraste arquivos aqui</p>
        <p className="text-slate-500 text-sm mb-4">ou clique para selecioná-los</p>
        <Button
          onClick={() => fileInputRef.current?.click()}
          className="mx-auto"
        >
          Selecionar Arquivos
        </Button>
      </div>

      {/* Preview dos Arquivos */}
      {selectedFiles.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-900 mb-3">
            📸 Arquivos Selecionados ({selectedFiles.length})
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {selectedFiles.map((file, idx) => (
              <div key={idx} className="relative group">
                <img
                  src={file.preview}
                  alt={file.name}
                  className="w-full h-32 object-cover rounded-lg border-2 border-slate-200"
                />

                {/* Info */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                  <button
                    onClick={() => removeFile(idx)}
                    className="bg-red-500 text-white px-3 py-1 rounded-lg text-sm font-semibold hover:bg-red-600"
                  >
                    Remover
                  </button>
                </div>

                {/* Nome do arquivo */}
                <p className="text-xs text-slate-600 mt-1 truncate">{file.name}</p>
              </div>
            ))}
          </div>

          {/* Botão de Upload */}
          <div className="flex gap-3 mt-4">
            <Button
              onClick={handleUpload}
              disabled={isUploading}
              className="flex-1"
            >
              {isUploading ? '⏳ Enviando...' : `✅ Upload para ${CATEGORIES.find((c) => c.id === selectedCategory)?.label}`}
            </Button>
            <Button
              onClick={() => setSelectedFiles([])}
              className="flex-1 bg-red-500 hover:bg-red-600"
            >
              🗑️ Limpar
            </Button>
          </div>
        </div>
      )}

      {/* Instruções */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-900 font-semibold mb-2">💡 Dica</p>
        <p className="text-sm text-blue-800">
          Os arquivos serão salvos em <code className="bg-blue-100 px-2 py-1 rounded">public/media/{selectedCategory}</code>
        </p>
      </div>
    </div>
  )
}
