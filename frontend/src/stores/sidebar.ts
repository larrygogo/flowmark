import { create } from 'zustand'

interface SidebarState {
  collapsed: boolean
  mobileOpen: boolean
  expandedProjectId: string | null
  toggle: () => void
  setMobileOpen: (open: boolean) => void
  setExpandedProject: (id: string | null) => void
}

export const useSidebarStore = create<SidebarState>((set) => ({
  collapsed: false,
  mobileOpen: false,
  expandedProjectId: null,
  toggle: () => set((s) => ({ collapsed: !s.collapsed })),
  setMobileOpen: (mobileOpen) => set({ mobileOpen }),
  setExpandedProject: (expandedProjectId) => set({ expandedProjectId }),
}))
