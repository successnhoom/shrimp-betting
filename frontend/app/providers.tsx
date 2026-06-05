'use client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { useState, useEffect } from 'react'
import { useAuthStore } from '@/store/auth'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 10_000, retry: 1 } },
  }))

  useEffect(() => {
    // Rehydrate zustand persist store once on client mount
    useAuthStore.persist.rehydrate()
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster
        position="top-center"
        containerStyle={{ zIndex: 99999 }}
        toastOptions={{
          duration: 3000,
          style: { borderRadius: '12px', fontSize: '15px' },
        }}
      />
    </QueryClientProvider>
  )
}
