import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface User {
  id: string
  phone: string
  displayName: string
  role: 'customer' | 'staff' | 'admin'
  wallet?: { balance: number; lockedAmount: number }
}

interface AuthState {
  token: string | null
  user: User | null
  _hasHydrated: boolean
  setHasHydrated: (v: boolean) => void
  setAuth: (token: string, user: User) => void
  setUser: (user: User) => void
  logout: () => void
  isStaff: () => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      _hasHydrated: false,
      setHasHydrated: (v) => set({ _hasHydrated: v }),
      setAuth: (token, user) => {
        if (typeof window !== 'undefined') localStorage.setItem('token', token)
        set({ token, user })
      },
      setUser: (user) => set({ user }),
      logout: () => {
        if (typeof window !== 'undefined') localStorage.removeItem('token')
        set({ token: null, user: null })
      },
      isStaff: () => {
        const role = get().user?.role
        return role === 'staff' || role === 'admin'
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ token: state.token, user: state.user }),
      skipHydration: true,
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    }
  )
)
