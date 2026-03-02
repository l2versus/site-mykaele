import { NextRequest, NextResponse } from 'next/server'

// Receives shared .vcf file from PWA Share Target
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('contact') as File | null
    const textData = formData.get('description') as string | null
    const nameData = formData.get('name') as string | null

    let vcfText = ''

    if (file) {
      vcfText = await file.text()
    } else if (textData) {
      vcfText = textData
    }

    const contact = parseVCard(vcfText, nameData)

    // Redirect to importar-clientes with contact data as query params
    const params = new URLSearchParams()
    if (contact.name) params.set('name', contact.name)
    if (contact.phone) params.set('phone', contact.phone)
    if (contact.email) params.set('email', contact.email)
    if (contact.photo) params.set('photo', contact.photo)

    return NextResponse.redirect(new URL(`/admin/importar-clientes?shared=1&${params.toString()}`, req.url))
  } catch (error) {
    console.error('[share-contact] Error:', error)
    return NextResponse.redirect(new URL('/admin/importar-clientes?shared=1&error=parse', req.url))
  }
}

function parseVCard(vcf: string, fallbackName?: string | null): { name: string; phone: string; email: string; photo: string } {
  const result = { name: '', phone: '', email: '', photo: '' }

  if (!vcf) {
    if (fallbackName) result.name = fallbackName
    return result
  }

  // Name: FN field (formatted name) takes priority, then N field
  const fnMatch = vcf.match(/^FN[;:](.+)$/m)
  if (fnMatch) {
    result.name = fnMatch[1].trim()
  } else {
    const nMatch = vcf.match(/^N[;:]([^;]*);([^;]*)(?:;|$)/m)
    if (nMatch) {
      result.name = `${nMatch[2].trim()} ${nMatch[1].trim()}`.trim()
    }
  }

  // Phone: TEL field — multiple formats
  const telMatch = vcf.match(/^TEL[^:]*:(.+)$/m)
  if (telMatch) {
    result.phone = telMatch[1].trim().replace(/[^\d+()-\s]/g, '')
  }

  // Email
  const emailMatch = vcf.match(/^EMAIL[^:]*:(.+)$/m)
  if (emailMatch) {
    result.email = emailMatch[1].trim()
  }

  // Photo: base64 encoded
  const photoMatch = vcf.match(/^PHOTO[^:]*:(data:image\/[^;]+;base64,[^\s]+)$/m)
  if (photoMatch) {
    result.photo = photoMatch[1]
  } else {
    // Try multiline base64 photo
    const photoStart = vcf.match(/^PHOTO;[^:]*:(.+)$/m)
    if (photoStart) {
      // For URLs
      const url = photoStart[1].trim()
      if (url.startsWith('http')) {
        result.photo = url
      }
    }
  }

  if (!result.name && fallbackName) result.name = fallbackName

  return result
}
