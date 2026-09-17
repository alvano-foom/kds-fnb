import { useNavigate } from 'react-router-dom'
import { AppShell } from '../components/templates/AppShell'
import { KanbanBoard } from '../components/organisms/KanbanBoard'
import { PendingOrderAlerts } from '../components/organisms/PendingOrderAlerts'
import { ConnectionStatus } from '../components/molecules/ConnectionStatus'
import { Button } from '../components/atoms/Button'
import { Spinner } from '../components/atoms/Spinner'
import { useTenantStore } from '../store/tenantStore'
import { useTenantConfig } from '../hooks/useTenantConfig'
import { useOrderLines } from '../hooks/useOrderLines'
import { useUpdateLineState } from '../hooks/useUpdateLineState'
import { useKitchenSocket } from '../ws/useKitchenSocket'
import { useLogout } from '../hooks/useAuth'

export function BoardPage() {
  const navigate = useNavigate()
  const { companyId, companyName } = useTenantStore()
  const tenantConfig = useTenantConfig()
  const { status } = useKitchenSocket(companyId)
  const lines = useOrderLines(companyId, { polling: status === 'polling' })
  const updateState = useUpdateLineState(companyId)
  const logout = useLogout()

  return (
    <AppShell
      title={tenantConfig.data?.name ?? 'Kitchen Display'}
      logoUrl={tenantConfig.data?.logo_url}
      leftSlot={<span className="truncate text-sm text-brand-contrast/80">{companyName}</span>}
      rightSlot={
        <>
          <ConnectionStatus status={status} />
          <Button variant="ghost" onClick={() => navigate('/config')}>
            Settings
          </Button>
          <Button variant="ghost" onClick={() => navigate('/errors')}>
            Error Log
          </Button>
          <Button variant="ghost" onClick={() => logout.mutate()}>
            Log out
          </Button>
        </>
      }
    >
      {lines.isLoading ? (
        <div className="flex h-full items-center justify-center">
          <Spinner className="h-8 w-8 text-brand" />
        </div>
      ) : (
        <>
          {/* Mounted only once real data has loaded, so its first render
              establishes the true baseline — mounting it earlier (while
              lines.data is still undefined) would treat every already-
              pending seed order as "newly" pending the moment data arrives. */}
          <PendingOrderAlerts cards={lines.data ?? []} />
          <KanbanBoard
            cards={lines.data ?? []}
            onDrop={(lineId, kitchenState) => updateState.mutate({ lineId, kitchenState })}
          />
        </>
      )}
    </AppShell>
  )
}
