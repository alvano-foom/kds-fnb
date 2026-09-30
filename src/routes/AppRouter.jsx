import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { LoginPage } from '../pages/LoginPage'
import { ConfigPage } from '../pages/ConfigPage'
import { KitchenSessionPage } from '../pages/KitchenSessionPage'
import { ProductionPage } from '../pages/ProductionPage'
import { BoardPage } from '../pages/BoardPage'
import { ErrorLogPage } from '../pages/ErrorLogPage'
import { useIsAuthenticated } from '../hooks/useAuth'
import { useTenantStore } from '../store/tenantStore'
import { useIsKitchenSessionOpen } from '../store/kitchenSessionStore'

function RequireAuth({ children }) {
  const isAuthenticated = useIsAuthenticated()
  return isAuthenticated ? children : <Navigate to="/login" replace />
}

function RequireConfig({ children }) {
  const hasConfig = useTenantStore((s) => Boolean(s.companyId))
  return hasConfig ? children : <Navigate to="/config" replace />
}

/**
 * The "lasting" gate: Login and Config are one-time-ish setup, but every
 * shift needs its own open kitchen session before either working screen
 * (Board or Production) is reachable — see KodeAbsensiGate.
 */
function RequireKitchenSession({ children }) {
  const isOpen = useIsKitchenSessionOpen()
  return isOpen ? children : <Navigate to="/kitchen-session" replace />
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
          path="/kitchen-session"
          element={
            <RequireAuth>
              <RequireConfig>
                <KitchenSessionPage />
              </RequireConfig>
            </RequireAuth>
          }
        />
        <Route
          path="/production"
          element={
            <RequireAuth>
              <RequireConfig>
                <RequireKitchenSession>
                  <ProductionPage />
                </RequireKitchenSession>
              </RequireConfig>
            </RequireAuth>
          }
        />
        <Route
          path="/board"
          element={
            <RequireAuth>
              <RequireConfig>
                <RequireKitchenSession>
                  <BoardPage />
                </RequireKitchenSession>
              </RequireConfig>
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/board" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
