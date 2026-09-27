import { useAuth } from './AuthProvider'

export function useSession() {
  const { session, user, loading } = useAuth()
  return { session, user, loading, userId: user?.id ?? null }
}
