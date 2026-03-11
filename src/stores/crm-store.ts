// src/stores/crm-store.ts — Estado global do CRM via Zustand
import { create } from 'zustand'

interface LeadCard {
  id: string
  name: string
  phone: string
  email: string | null
  status: 'COLD' | 'WARM' | 'HOT' | 'WON' | 'LOST'
  stageId: string
  position: number
  expectedValue: number | null
  aiScore: number | null
  aiScoreLabel: string | null
  churnRisk: number | null
  bestContactDays: string | null
  bestContactHours: string | null
  bestContactBasis: number | null
  tags: string[]
  source: string | null
  lastInteractionAt: string | null
  createdAt: string
  lastMessage: { content: string; fromMe: boolean; createdAt: string } | null
  patientId: string | null
}

interface StageData {
  id: string
  name: string
  type: 'OPEN' | 'WON' | 'LOST'
  order: number
  color: string | null
  cachedLeadCount: number
  cachedTotalValue: number
}

interface PipelineData {
  id: string
  name: string
  isDefault: boolean
}

interface CrmStore {
  // Pipeline state
  pipeline: PipelineData | null
  stages: StageData[]
  leadsByStage: Record<string, LeadCard[]>
  isLoading: boolean

  // Actions
  setPipeline: (pipeline: PipelineData) => void
  setStages: (stages: StageData[]) => void
  setLeadsByStage: (leadsByStage: Record<string, LeadCard[]>) => void
  setLoading: (loading: boolean) => void

  // Optimistic updates
  moveLeadOptimistic: (leadId: string, fromStageId: string, toStageId: string, newPosition: number) => void
  addLeadOptimistic: (lead: LeadCard) => void
  updateLeadOptimistic: (leadId: string, updates: Partial<LeadCard>) => void
  removeLeadOptimistic: (leadId: string, stageId: string) => void

  // Inbox state
  unreadTotal: number
  setUnreadTotal: (count: number) => void
  incrementUnread: () => void
}

export const useCrmStore = create<CrmStore>((set) => ({
  pipeline: null,
  stages: [],
  leadsByStage: {},
  isLoading: true,

  setPipeline: (pipeline) => set({ pipeline }),
  setStages: (stages) => set({ stages }),
  setLeadsByStage: (leadsByStage) => set({ leadsByStage }),
  setLoading: (isLoading) => set({ isLoading }),

  moveLeadOptimistic: (leadId, fromStageId, toStageId, newPosition) =>
    set((state) => {
      const newLeadsByStage = { ...state.leadsByStage }

      // Encontrar lead no estágio de origem
      const fromLeads = [...(newLeadsByStage[fromStageId] ?? [])]
      const leadIndex = fromLeads.findIndex((l) => l.id === leadId)
      if (leadIndex === -1) return state

      const [lead] = fromLeads.splice(leadIndex, 1)
      const movedLead = { ...lead, stageId: toStageId, position: newPosition }

      // Adicionar ao estágio de destino
      const toLeads = [...(newLeadsByStage[toStageId] ?? []), movedLead]
      toLeads.sort((a, b) => a.position - b.position)

      newLeadsByStage[fromStageId] = fromLeads
      newLeadsByStage[toStageId] = toLeads

      // Atualizar contadores dos estágios
      const newStages = state.stages.map((s) => {
        if (s.id === fromStageId) {
          return {
            ...s,
            cachedLeadCount: s.cachedLeadCount - 1,
            cachedTotalValue: s.cachedTotalValue - (lead.expectedValue ?? 0),
          }
        }
        if (s.id === toStageId) {
          return {
            ...s,
            cachedLeadCount: s.cachedLeadCount + 1,
            cachedTotalValue: s.cachedTotalValue + (lead.expectedValue ?? 0),
          }
        }
        return s
      })

      return { leadsByStage: newLeadsByStage, stages: newStages }
    }),

  addLeadOptimistic: (lead) =>
    set((state) => {
      const newLeadsByStage = { ...state.leadsByStage }
      const stageLeads = [...(newLeadsByStage[lead.stageId] ?? []), lead]
      stageLeads.sort((a, b) => a.position - b.position)
      newLeadsByStage[lead.stageId] = stageLeads

      const newStages = state.stages.map((s) => {
        if (s.id === lead.stageId) {
          return {
            ...s,
            cachedLeadCount: s.cachedLeadCount + 1,
            cachedTotalValue: s.cachedTotalValue + (lead.expectedValue ?? 0),
          }
        }
        return s
      })

      return { leadsByStage: newLeadsByStage, stages: newStages }
    }),

  updateLeadOptimistic: (leadId, updates) =>
    set((state) => {
      const newLeadsByStage = { ...state.leadsByStage }
      for (const stageId of Object.keys(newLeadsByStage)) {
        const leads = newLeadsByStage[stageId]
        const idx = leads.findIndex((l) => l.id === leadId)
        if (idx !== -1) {
          newLeadsByStage[stageId] = [
            ...leads.slice(0, idx),
            { ...leads[idx], ...updates },
            ...leads.slice(idx + 1),
          ]
          break
        }
      }
      return { leadsByStage: newLeadsByStage }
    }),

  removeLeadOptimistic: (leadId, stageId) =>
    set((state) => {
      const newLeadsByStage = { ...state.leadsByStage }
      const leads = newLeadsByStage[stageId] ?? []
      const lead = leads.find((l) => l.id === leadId)
      newLeadsByStage[stageId] = leads.filter((l) => l.id !== leadId)

      const newStages = state.stages.map((s) => {
        if (s.id === stageId && lead) {
          return {
            ...s,
            cachedLeadCount: s.cachedLeadCount - 1,
            cachedTotalValue: s.cachedTotalValue - (lead.expectedValue ?? 0),
          }
        }
        return s
      })

      return { leadsByStage: newLeadsByStage, stages: newStages }
    }),

  unreadTotal: 0,
  setUnreadTotal: (count) => set({ unreadTotal: count }),
  incrementUnread: () => set((state) => ({ unreadTotal: state.unreadTotal + 1 })),
}))
