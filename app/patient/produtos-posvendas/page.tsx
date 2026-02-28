// app/patient/produtos-posvendas/page.tsx
'use client'

import { PatientLayout } from '@/components/patient/PatientLayout'

export default function ProdutosPosvenda() {
  const products = [
    {
      id: 1,
      name: 'Sérum Rejuvenescedor Noturno',
      description: 'Potencializa os resultados de procedimentos faciais. Uso: noturno',
      price: 'R$ 199,90',
      category: 'Pós-Procedimento',
      image: '🧴',
      recommendedFor: ['Harmonização Facial', 'Laser CO2'],
    },
    {
      id: 2,
      name: 'Protetor Solar Corporal SPF 70',
      description: 'Proteção máxima após procedimentos corporais. Refeço a cada 2h',
      price: 'R$ 89,90',
      category: 'Proteção',
      image: '☀️',
      recommendedFor: ['Lipoaspiração', 'Laser Corporal'],
    },
    {
      id: 3,
      name: 'Creme Hidratante Premium',
      description: 'Hidratação profunda para pele recuperada. Uso: dia e noite',
      price: 'R$ 159,90',
      category: 'Hidratação',
      image: '💧',
      recommendedFor: ['Todos os Procedimentos'],
    },
    {
      id: 4,
      name: 'Colágeno Marinho Bebível',
      description: 'Suplemento para regeneração da pele de dentro para fora',
      price: 'R$ 299,90',
      category: 'Suplemento',
      image: '🥤',
      recommendedFor: ['Todos os Procedimentos'],
    },
  ]

  return (
    <PatientLayout>
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-slate-800 to-slate-700 text-white p-6 rounded-lg">
          <h1 className="text-2xl font-bold mb-2">Produtos de Cuidado Pós-Venda</h1>
          <p className="text-slate-300">
            Produtos recomendados para maximizar e manter seus resultados
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {products.map((product) => (
            <div key={product.id} className="bg-white rounded-lg border border-slate-200 overflow-hidden hover:shadow-lg transition-shadow">
              <div className="p-6">
                <div className="text-5xl mb-4">{product.image}</div>
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">{product.name}</h3>
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full inline-block mt-2">
                      {product.category}
                    </span>
                  </div>
                </div>

                <p className="text-sm text-slate-600 mb-4">{product.description}</p>

                <div className="mb-4 p-3 bg-slate-50 rounded">
                  <p className="text-xs text-slate-600 mb-2 font-medium">Recomendado para:</p>
                  <div className="flex flex-wrap gap-1">
                    {product.recommendedFor.map((proc) => (
                      <span key={proc} className="text-xs bg-white text-slate-700 px-2 py-1 rounded border border-slate-200">
                        {proc}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-xl font-bold text-slate-900">{product.price}</span>
                  <button className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 text-sm font-medium">
                    Comprar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Info Box */}
        <div className="bg-amber-50 p-6 rounded-lg border border-amber-200">
          <h3 className="font-semibold text-amber-900 mb-3">💡 Dica Importante</h3>
          <p className="text-sm text-amber-800">
            Os produtos foram selecionados especialmente para sua rotina pós-procedimento. Use conforme recomendado por seu profissional para potencializar resultados.
            <br /><br />
            <strong>Frete grátis</strong> para pedidos acima de R$ 300 em sua primeira compra!
          </p>
        </div>
      </div>
    </PatientLayout>
  )
}
