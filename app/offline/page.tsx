'use client'

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#faf9f7] px-6 text-center">
      {/* Leaf icon */}
      <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
        style={{ background: 'linear-gradient(135deg, #b76e79, #8a4f5a)' }}>
        <svg width="40" height="40" viewBox="0 0 100 100" fill="none">
          <path d="M50 8C50 8 20 30 20 55C20 72 33 88 50 92C67 88 80 72 80 55C80 30 50 8 50 8Z" fill="white" fillOpacity="0.95" />
          <path d="M50 20C50 20 50 70 50 85" stroke="#b76e79" strokeWidth="3" strokeLinecap="round" />
        </svg>
      </div>

      <h1 className="text-2xl font-semibold text-[#1a1a1a] mb-2">
        Sem conexão
      </h1>
      <p className="text-gray-500 mb-8 max-w-sm">
        Parece que você está offline. Verifique sua conexão e tente novamente.
      </p>

      <button
        onClick={() => window.location.reload()}
        className="px-6 py-3 rounded-full text-white font-medium transition-all hover:scale-105 active:scale-95"
        style={{ background: 'linear-gradient(135deg, #b76e79, #8a4f5a)' }}
      >
        Tentar novamente
      </button>

      <p className="mt-6 text-xs text-gray-400">
        Myka Home Spa • Estética Avançada
      </p>
    </div>
  )
}
