import { lazy, Suspense, type ComponentType } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { paths } from './routes'
import { AppShell } from './AppShell'
import { RequireAuth } from './RequireAuth'
import { LoginPage } from '@/features/auth/LoginPage'
import { HomePage } from '@/features/home/HomePage'
import { Skeleton } from '@/components/ui/Page'

// ホーム以外の画面は開くときに読む（最初に全部を読まない）。PWA は全部先にキャッシュするので、2 回目からはオフラインでも開ける
const page = <T extends Record<string, ComponentType>, K extends keyof T>(load: () => Promise<T>, name: K) => lazy(() => load().then((m) => ({ default: m[name] })))
const ClipsPage = page(() => import('@/features/clips/ClipsPage'), 'ClipsPage')
const ClipDetailPage = page(() => import('@/features/clips/ClipDetailPage'), 'ClipDetailPage')
const QuickAddPage = page(() => import('@/features/clips/QuickAddPage'), 'QuickAddPage')
const RecipesPage = page(() => import('@/features/recipes/RecipesPage'), 'RecipesPage')
const RecipeDetailPage = page(() => import('@/features/recipes/RecipeDetailPage'), 'RecipeDetailPage')
const RecipeEditorPage = page(() => import('@/features/recipes/RecipeEditorPage'), 'RecipeEditorPage')
const RecipeComparePage = page(() => import('@/features/recipes/RecipeComparePage'), 'RecipeComparePage')
const AskPage = page(() => import('@/features/ask/AskPage'), 'AskPage')
const MenuCalendarPage = page(() => import('@/features/menu/MenuCalendarPage'), 'MenuCalendarPage')
const MenuDayPage = page(() => import('@/features/menu/MenuDayPage'), 'MenuDayPage')
const MenuStatsPage = page(() => import('@/features/menu/MenuStatsPage'), 'MenuStatsPage')
const InboxPage = page(() => import('@/features/ai/InboxPage'), 'InboxPage')
const SettingsPage = page(() => import('@/features/settings/SettingsPage'), 'SettingsPage')
const DevUiPage = page(() => import('@/features/dev/DevUiPage'), 'DevUiPage')

function Loading() {
  return <div className="flex flex-col gap-3 pt-[calc(14px+var(--safe-top))]"><Skeleton className="h-8 w-40" /><Skeleton className="h-40" /></div>
}

export function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path={paths.login} element={<LoginPage />} />
        <Route element={<RequireAuth />}>
          <Route element={<AppShell />}>
            <Route index element={<HomePage />} />
            <Route path={paths.clips} element={<ClipsPage />} />
            <Route path="/clips/:id" element={<ClipDetailPage />} />
            <Route path={paths.add} element={<QuickAddPage />} />
            <Route path={paths.recipes} element={<RecipesPage key="recipes" />} />
            <Route path={paths.shopMenu} element={<RecipesPage key="menu" side="menu" />} />
            <Route path={paths.recipeNew} element={<RecipeEditorPage />} />
            <Route path="/recipes/:id" element={<RecipeDetailPage />} />
            <Route path="/recipes/:id/edit" element={<RecipeEditorPage />} />
            <Route path="/recipes/:id/compare" element={<RecipeComparePage />} />
            <Route path={paths.ask} element={<AskPage />} />
            <Route path={paths.menu} element={<MenuCalendarPage />} />
            <Route path={paths.menuStats} element={<MenuStatsPage />} />
            <Route path="/menu/:date" element={<MenuDayPage />} />
            <Route path={paths.inbox} element={<InboxPage />} />
            <Route path={paths.settings} element={<SettingsPage />} />
            {import.meta.env.DEV && <Route path={paths.devUi} element={<DevUiPage />} />}
            <Route path="*" element={<Navigate to={paths.home} replace />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  )
}
