import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router'
import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './styles/index.css'
import { App } from './app/App'
import { AuthProvider } from './features/auth/AuthProvider'
import { ToastProvider, toastBus } from './components/ui/Toast'
import { ErrorBoundary } from './app/ErrorBoundary'
import { friendlyError } from './lib/errors'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: true },
  },
  // 保存・削除の失敗は、どの画面からでも必ずトーストで知らせる（各画面で catch していなくても無音にしない）
  mutationCache: new MutationCache({ onError: (e) => toastBus.error(friendlyError(e)) }),
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <HashRouter>
          <ToastProvider>
            <AuthProvider>
              <App />
            </AuthProvider>
          </ToastProvider>
        </HashRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
)
