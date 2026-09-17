import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { LoginPage } from '../pages/LoginPage'
import { ConfigPage } from '../pages/ConfigPage'
import { BoardPage } from '../pages/BoardPage'
import { ErrorLogPage } from '../pages/ErrorLogPage'
import { useIsAuthenticated } from '../hooks/useAuth'
import { useTenantStore } from '../store/tenantStore'

function RequireAuth({ children }) {
  const isAuthenticated = useIsAuthenticated()
  return isAuthenticated ? children : <Navigate to="/login" replace />
}

function RequireConfig({ children }) {
  const hasConfig = useTenantStore((s) => Boolean(s.companyId))
  return hasConfig ? children : <Navigate to="/config" replace />
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/config"
          element={
            <RequireAuth>
              <ConfigPage />
            </RequireAuth>
          }
        />
        <Route
          path="/errors"
          element={
            <RequireAuth>
              <ErrorLogPage />
            </RequireAuth>
          }
        />
        <Route
          path="/board"
          element={
            <RequireAuth>
              <RequireConfig>
                <BoardPage />
              </RequireConfig>
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/board" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
