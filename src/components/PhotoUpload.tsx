// src/components/PhotoUpload.tsx
'use client'

import { useState, useRef } from 'react'
import { uploadToCloudinary } from '@/utils/cloudinary'
import { Button } from './Button'

interface PhotoUploadProps {
  folder?: string
  onSuccess?: (url: string) => void
  maxSize?: number // em MB
}

export default function PhotoUpload({
  folder = 'mykaele',
  onSuccess,
  maxSize = 5,
}: PhotoUploadProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [preview, setPreview] = useState<string>('')
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validar tamanho
    if (file.size > maxSize * 1024 * 1024) {
      setError(`Arquivo maior que ${maxSize}MB`)
      return
    }

    // Validar tipo
    if (!file.type.startsWith('image/')) {
      setError('Apenas imagens são aceitas')
      return
    }

    // Preview local
    const reader = new FileReader()
    reader.onload = (e) => {
      setPreview(e.target?.result as string)
    }
    reader.readAsDataURL(file)

    // Fazer upload
    setIsLoading(true)
    setError('')

    try {
      const response = await uploadToCloudinary(file, folder)
      setPreview('')
      onSuccess?.(response.secure_url)
      alert('✅ Foto enviada com sucesso!')
    } catch (err) {
      setError('Erro ao enviar foto')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md mx-auto p-6 border-2 border-dashed border-slate-300 rounded-lg">
      <h3 className="text-lg font-semibold mb-4 text-slate-900">📸 Enviar Foto</h3>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {preview && (
        <div className="mb-4">
          <img
            src={preview}
            alt="Preview"
            className="w-full h-40 object-cover rounded-lg"
          />
        </div>
      )}

      <Button
        onClick={() => fileInputRef.current?.click()}
        disabled={isLoading}
        className="w-full mb-2"
      >
        {isLoading ? '⏳ Enviando...' : '📤 Selecionar Foto'}
      </Button>

      {error && <p className="text-red-600 text-sm mt-2">{error}</p>}

      <p className="text-xs text-slate-500 mt-4">
        💡 Máximo: {maxSize}MB | Formatos: JPG, PNG, WebP
      </p>
    </div>
  )
}
