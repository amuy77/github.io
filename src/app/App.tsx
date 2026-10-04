import { Navigate, Route, Routes } from 'react-router'
import { paths } from './routes'
import { AppShell } from './AppShell'
import { RequireAuth } from './RequireAuth'
import { LoginPage } from '@/features/auth/LoginPage'
import { HomePage } from '@/features/home/HomePage'
import { ClipsPage } from '@/features/clips/ClipsPage'
import { ClipDetailPage } from '@/features/clips/ClipDetailPage'
import { QuickAddPage } from '@/features/clips/QuickAddPage'
import { RecipesPage } from '@/features/recipes/RecipesPage'
import { RecipeDetailPage } from '@/features/recipes/RecipeDetailPage'
import { RecipeEditorPage } from '@/features/recipes/RecipeEditorPage'
import { RecipeComparePage } from '@/features/recipes/RecipeComparePage'
import { AskPage } from '@/features/ask/AskPage'
import { MenuCalendarPage } from '@/features/menu/MenuCalendarPage'
import { MenuDayPage } from '@/features/menu/MenuDayPage'
import { MenuStatsPage } from '@/features/menu/MenuStatsPage'
import { InboxPage } from '@/features/ai/InboxPage'
import { SettingsPage } from '@/features/settings/SettingsPage'
import { DevUiPage } from '@/features/dev/DevUiPage'

export function App() {
  return (
    <>
      <Routes>
        <Route path={paths.login} element={<LoginPage />} />
        <Route element={<RequireAuth />}>
          <Route element={<AppShell />}>
            <Route index element={<HomePage />} />
            <Route path={paths.clips} element={<ClipsPage />} />
            <Route path="/clips/:id" element={<ClipDetailPage />} />
            <Route path={paths.add} element={<QuickAddPage />} />
            <Route path={paths.recipes} element={<RecipesPage />} />
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
    </>
  )
}
