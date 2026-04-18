import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UIState {
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
  leadsView: 'kanban' | 'list'
  dealsView: 'kanban' | 'list'
  contactsView: 'list' | 'grid'
  setLeadsView: (view: 'kanban' | 'list') => void
  setDealsView: (view: 'kanban' | 'list') => void
  setContactsView: (view: 'list' | 'grid') => void
  activePipeline: string
  setActivePipeline: (pipeline: string) => void
  createLeadOpen: boolean
  createDealOpen: boolean
  createContactOpen: boolean
  createTaskOpen: boolean
  setCreateLeadOpen: (open: boolean) => void
  setCreateDealOpen: (open: boolean) => void
  setCreateContactOpen: (open: boolean) => void
  setCreateTaskOpen: (open: boolean) => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      leadsView: 'kanban', dealsView: 'kanban', contactsView: 'list',
      setLeadsView: (view) => set({ leadsView: view }),
      setDealsView: (view) => set({ dealsView: view }),
      setContactsView: (view) => set({ contactsView: view }),
      activePipeline: 'sales',
      setActivePipeline: (pipeline) => set({ activePipeline: pipeline }),
      createLeadOpen: false, createDealOpen: false, createContactOpen: false, createTaskOpen: false,
      setCreateLeadOpen: (open) => set({ createLeadOpen: open }),
      setCreateDealOpen: (open) => set({ createDealOpen: open }),
      setCreateContactOpen: (open) => set({ createContactOpen: open }),
      setCreateTaskOpen: (open) => set({ createTaskOpen: open }),
    }),
    { name: 'td-crm-ui', partialize: (state) => ({ sidebarCollapsed: state.sidebarCollapsed, leadsView: state.leadsView, dealsView: state.dealsView, contactsView: state.contactsView, activePipeline: state.activePipeline }) }
  )
)
