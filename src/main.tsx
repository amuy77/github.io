import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router'
import { MutationCache, QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import './styles/index.css'
import { App } from './app/App'
import { AuthProvider } from './features/auth/AuthProvider'
import { ToastProvider, toastBus } from './components/ui/Toast'
import { ErrorBoundary } from './app/ErrorBoundary'
import { friendlyError } from './lib/errors'

const CACHE_DAYS = 7
const queryClient = new QueryClient({
  defaultOptions: {
    // gcTime は端末に残す期間と同じにする（短いと復元した直後に捨てられる）
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: true, gcTime: CACHE_DAYS * 86_400_000 },
  },
  // 保存・削除の失敗は、どの画面からでも必ずトーストで知らせる（各画面で catch していなくても無音にしない）
  mutationCache: new MutationCache({ onError: (e) => toastBus.error(friendlyError(e)) }),
})

// 最後に読んだネタ帳・図鑑・記録を端末（localStorage）に残して、圏外でも開ける・読める。保存はつながってから
let storage: Storage | undefined
try { storage = window.localStorage } catch { storage = undefined }
const persister = createSyncStoragePersister({ storage: storage ?? null, key: 'lara.query-cache', throttleTime: 2000 })
const persistOptions = {
  persister,
  maxAge: CACHE_DAYS * 86_400_000,
  buster: 'v1',
  // 読み終えたものだけ。AI ジョブと予定は毎回読み直すので残さない
  dehydrateOptions: { shouldDehydrateQuery: (q: { state: { status: string }; queryKey: readonly unknown[] }) => q.state.status === 'success' && !['ai-jobs', 'planner-agenda'].includes(String(q.queryKey[0])) },
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
        <HashRouter>
          <ToastProvider>
            <AuthProvider>
              <App />
            </AuthProvider>
          </ToastProvider>
        </HashRouter>
      </PersistQueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
)
