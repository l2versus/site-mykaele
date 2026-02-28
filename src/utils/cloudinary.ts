// src/utils/cloudinary.ts

/**
 * Configuração para upload de fotos via Cloudinary
 * 
 * SETUP:
 * 1. Criar conta em https://cloudinary.com (grátis)
 * 2. Adicionar ao .env.local:
 *    NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=seu_cloud_name
 *    CLOUDINARY_API_KEY=sua_api_key
 *    CLOUDINARY_API_SECRET=seu_secret
 * 3. Usar funções abaixo para upload
 */

export interface CloudinaryUploadResponse {
  public_id: string
  url: string
  secure_url: string
  width: number
  height: number
  format: string
}

/**
 * Upload de foto para Cloudinary
 */
export async function uploadToCloudinary(
  file: File,
  folder: string = "mykaele"
): Promise<CloudinaryUploadResponse> {
  const formData = new FormData()
  formData.append("file", file)
  formData.append("upload_preset", "mykaele_unsigned") // Criar upload preset no Cloudinary
  formData.append("folder", folder)

  try {
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`,
      {
        method: "POST",
        body: formData,
      }
    )

    if (!response.ok) {
      throw new Error("Erro ao fazer upload")
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error("Erro Cloudinary:", error)
    throw error
  }
}

/**
 * Gerar URL otimizada da Cloudinary
 */
export function getCloudinaryUrl(
  publicId: string,
  options: {
    width?: number
    height?: number
    crop?: "fill" | "fit" | "crop"
    quality?: "auto" | number
    format?: "auto" | "jpg" | "webp"
  } = {}
): string {
  const {
    width = 800,
    height = 600,
    crop = "fill",
    quality = "auto",
    format = "auto",
  } = options

  const baseUrl = `https://res.cloudinary.com/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`
  const transformations = `w_${width},h_${height},c_${crop},q_${quality},f_${format}`

  return `${baseUrl}/${transformations}/${publicId}`
}

/**
 * Deletar foto do Cloudinary
 */
export async function deleteFromCloudinary(publicId: string): Promise<boolean> {
  try {
    const response = await fetch("/api/cloudinary/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publicId }),
    })

    return response.ok
  } catch (error) {
    console.error("Erro ao deletar imagem:", error)
    return false
  }
}

/**
 * Upload múltiplas fotos (before/after)
 */
export async function uploadBeforeAfter(
  beforeFile: File,
  afterFile: File,
  procedure: string
): Promise<{
  before: CloudinaryUploadResponse
  after: CloudinaryUploadResponse
}> {
  const beforePromise = uploadToCloudinary(beforeFile, "mykaele/antes-depois")
  const afterPromise = uploadToCloudinary(afterFile, "mykaele/antes-depois")

  const [before, after] = await Promise.all([beforePromise, afterPromise])

  return { before, after }
}
