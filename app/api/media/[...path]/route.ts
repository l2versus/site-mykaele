// app/api/media/[...path]/route.ts
// Streaming de vídeo com HTTP Range Requests (206 Partial Content)
// iOS Safari EXIGE range requests para reproduzir vídeos.
// Next.js standalone NÃO implementa isso nativamente.

import { NextRequest, NextResponse } from 'next/server'
import { stat, open } from 'fs/promises'
import { join } from 'path'

const MIME_TYPES: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.m4v': 'video/x-m4v',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
}

function getMimeType(filePath: string): string {
  const ext = filePath.substring(filePath.lastIndexOf('.')).toLowerCase()
  return MIME_TYPES[ext] ?? 'application/octet-stream'
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params
  const relativePath = segments.join('/')

  // Segurança: bloquear path traversal
  if (relativePath.includes('..') || relativePath.includes('\\')) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  const filePath = join(process.cwd(), 'public', 'media', relativePath)
  const mimeType = getMimeType(filePath)

  let fileStats
  try {
    fileStats = await stat(filePath)
  } catch {
    return new NextResponse('Not Found', { status: 404 })
  }

  const fileSize = fileStats.size
  const rangeHeader = request.headers.get('range')

  // Headers comuns
  const commonHeaders: Record<string, string> = {
    'Content-Type': mimeType,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'public, max-age=2592000, stale-while-revalidate=86400',
    'Access-Control-Allow-Origin': '*',
  }

  // Sem Range header → retorna arquivo completo
  if (!rangeHeader) {
    const fh = await open(filePath, 'r')
    const stream = fh.createReadStream()
    const webStream = readableNodeToWeb(stream, fh)

    return new NextResponse(webStream as unknown as ReadableStream, {
      status: 200,
      headers: {
        ...commonHeaders,
        'Content-Length': String(fileSize),
      },
    })
  }

  // Com Range header → resposta 206 Partial Content
  const match = rangeHeader.match(/bytes=(\d+)-(\d*)/)
  if (!match) {
    return new NextResponse('Range Not Satisfiable', {
      status: 416,
      headers: { 'Content-Range': `bytes */${fileSize}` },
    })
  }

  const start = parseInt(match[1], 10)
  const end = match[2] ? parseInt(match[2], 10) : Math.min(start + 1024 * 1024 - 1, fileSize - 1) // 1MB chunks

  if (start >= fileSize || end >= fileSize) {
    return new NextResponse('Range Not Satisfiable', {
      status: 416,
      headers: { 'Content-Range': `bytes */${fileSize}` },
    })
  }

  const contentLength = end - start + 1
  const fh = await open(filePath, 'r')
  const stream = fh.createReadStream({ start, end })
  const webStream = readableNodeToWeb(stream, fh)

  return new NextResponse(webStream as unknown as ReadableStream, {
    status: 206,
    headers: {
      ...commonHeaders,
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Content-Length': String(contentLength),
    },
  })
}

/**
 * Converte Node.js ReadableStream para Web ReadableStream.
 * Fecha o file handle quando o stream termina.
 */
function readableNodeToWeb(
  nodeStream: NodeJS.ReadableStream,
  fileHandle: { close: () => Promise<void> }
): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      nodeStream.on('data', (chunk: Buffer) => {
        controller.enqueue(new Uint8Array(chunk))
      })
      nodeStream.on('end', () => {
        controller.close()
        fileHandle.close().catch(() => {})
      })
      nodeStream.on('error', (err) => {
        controller.error(err)
        fileHandle.close().catch(() => {})
      })
    },
    cancel() {
      if ('destroy' in nodeStream && typeof nodeStream.destroy === 'function') {
        nodeStream.destroy()
      }
      fileHandle.close().catch(() => {})
    },
  })
}
