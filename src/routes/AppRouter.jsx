import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { LoginPage } from '@/pages/LoginPage'
import { useIsAuthenticated } from '@/hooks/useAuth'
import { ConfigPage } from '@/pages/ConfigPage'
import { useTenantStore } from '@/store/tenantStore'
import { KitchenSessionPage } from '@/pages/KitchenSessionPage'
import { ProductionPage } from '@/pages/ProductionPage'
import { useIsKitchenSessionOpen } from '@/store/kitchenSessionStore'
import { ShiftChecklistPage } from '@/pages/ShiftChecklistPage'
import { BoardPage } from '@/pages/BoardPage'
import { ErrorLogPage } from '@/pages/ErrorLogPage'

function RequireAuth() {
  return useIsAuthenticated() ? <Outlet /> : <Navigate to="/login" replace />
}

function RequireCompany() {
  const hasCompany = useTenantStore((s) => Boolean(s.companyId))
  return hasCompany ? <Outlet /> : <Navigate to="/config" replace />
}

function RequireKitchenSession() {
  return useIsKitchenSessionOpen() ? <Outlet /> : <Navigate to="/kitchen-session" replace />
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<RequireAuth />}>
          <Route path="/config" element={<ConfigPage />} />
          <Route path="/errors" element={<ErrorLogPage />} />
          <Route element={<RequireCompany />}>
            <Route path="/kitchen-session" element={<KitchenSessionPage />} />
            <Route element={<RequireKitchenSession />}>
              <Route path="/production" element={<ProductionPage />} />
              <Route path="/shift-checklist" element={<ShiftChecklistPage />} />
              <Route path="/board" element={<BoardPage />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/board" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
