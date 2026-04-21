'use client'

import { create } from 'zustand'
import type { User } from '@supabase/supabase-js'
import type { CrmUser } from '@/types'

interface AuthState {
  user: User | null
  crmUser: CrmUser | null
  setUser: (user: User | null) => void
  setCrmUser: (crmUser: CrmUser | null) => void
  clear: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  crmUser: null,
  setUser: (user) => set({ user }),
  setCrmUser: (crmUser) => set({ crmUser }),
  clear: () => set({ user: null, crmUser: null }),
}))
