import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

const SIZES: Record<string, number> = { '192': 192, '512': 512 }

function LeafIcon({ size }: { size: number }) {
  const s = size * 0.6
  return (
    <div
      style={{
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #b76e79 0%, #8a4f5a 100%)',
        borderRadius: size * 0.2,
      }}
    >
      <svg width={s} height={s} viewBox="0 0 100 100" fill="none">
        <path
          d="M50 8C50 8 20 30 20 55C20 72 33 88 50 92C67 88 80 72 80 55C80 30 50 8 50 8Z"
          fill="white"
          fillOpacity="0.95"
        />
        <path d="M50 20C50 20 50 70 50 85" stroke="#b76e79" strokeWidth="3" strokeLinecap="round" />
        <path d="M50 45C40 35 30 38 28 42" stroke="#b76e79" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        <path d="M50 55C60 45 70 48 72 52" stroke="#b76e79" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      </svg>
    </div>
  )
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const sizeStr = searchParams.get('size') || '192'
  const size = SIZES[sizeStr] || 192

  return new ImageResponse(<LeafIcon size={size} />, {
    width: size,
    height: size,
  })
}
