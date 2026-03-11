// src/lib/fractional-index.ts — Posição fracionária para Kanban (evita reordenação em cascata)

/**
 * Calcula posição entre dois vizinhos.
 * Se não há vizinhos, usa 1.0.
 * Se só há anterior, soma 1.0.
 * Se só há posterior, divide por 2.
 */
export function calcPosition(before: number | null, after: number | null): number {
  if (before === null && after === null) return 1.0
  if (before === null) return (after as number) / 2
  if (after === null) return before + 1.0
  return (before + after) / 2
}

/**
 * Detecta se é necessário rebalancear (precisão menor que 1e-10).
 */
export function needsRebalance(positions: number[]): boolean {
  if (positions.length < 2) return false
  const sorted = [...positions].sort((a, b) => a - b)
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - sorted[i - 1] < 1e-10) return true
  }
  return false
}

/**
 * Gera posições rebalanceadas com espaçamento uniforme.
 * Retorna array de { id, position } para atualizar em batch.
 */
export function rebalancePositions(
  items: Array<{ id: string; position: number }>
): Array<{ id: string; position: number }> {
  const sorted = [...items].sort((a, b) => a.position - b.position)
  return sorted.map((item, index) => ({
    id: item.id,
    position: (index + 1) * 1.0,
  }))
}
