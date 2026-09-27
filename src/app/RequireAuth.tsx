import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '@/features/auth/AuthProvider'
import { paths } from './routes'
import { SetupPage } from './SetupPage'
import { Mascot } from '@/components/mascot/Mascot'

export function RequireAuth() {
  const { configured, loading, session } = useAuth()
  const loc = useLocation()
  if (!configured) return <SetupPage />
  if (loading) {
    return (
      <div className="flex min-h-full items-center justify-center">
        <Mascot mood="thinking" size={80} />
      </div>
    )
  }
  if (!session) return <Navigate to={paths.login} replace state={{ from: loc.pathname }} />
  return <Outlet />
}
