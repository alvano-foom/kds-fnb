import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppShell } from '../components/templates/AppShell'
import { KitchenSessionBadge } from '../components/molecules/KitchenSessionBadge'
import { ProductionForm } from '../components/organisms/ProductionForm'
import { ProductionList } from '../components/organisms/ProductionList'
import { CloseKitchenSessionPanel } from '../components/organisms/CloseKitchenSessionPanel'
import { Button } from '../components/atoms/Button'
import { useTenantConfig } from '../hooks/useTenantConfig'
import { useLogout } from '../hooks/useAuth'

export function ProductionPage() {
  const navigate = useNavigate()
  const tenantConfig = useTenantConfig()
  const logout = useLogout()
  const [closing, setClosing] = useState(false)

  return (
    <AppShell
      title={tenantConfig.data?.name ?? 'Kitchen Display'}
      logoUrl={tenantConfig.data?.logo_url}
      leftSlot={<KitchenSessionBadge />}
      rightSlot={
        <>
          <Button variant="ghost" onClick={() => navigate('/board')}>
            Order Board
          </Button>
          {!closing && (
            <Button variant="ghost" onClick={() => setClosing(true)}>
              Close Kitchen
            </Button>
          )}
          <Button variant="ghost" onClick={() => navigate('/errors')}>
            Error Log
          </Button>
          <Button variant="ghost" onClick={() => logout.mutate()}>
            Log out
          </Button>
        </>
      }
    >
      <div className="mx-auto max-w-lg space-y-4">
        {closing ? (
          <CloseKitchenSessionPanel
            onCancel={() => setClosing(false)}
            onClosed={() => navigate('/kitchen-session', { replace: true })}
          />
        ) : (
          <>
            <ProductionForm />
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                This Session's Manufacturing Orders
              </p>
              <ProductionList />
            </div>
          </>
        )}
      </div>
    </AppShell>
  )
}
