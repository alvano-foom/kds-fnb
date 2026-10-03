import { useNavigate } from 'react-router-dom'
import { AppShell } from '../components/templates/AppShell'
import { KitchenSessionBadge } from '../components/molecules/KitchenSessionBadge'
import { ShiftChecklistPanel } from '../components/organisms/ShiftChecklistPanel'
import { Button } from '../components/atoms/Button'
import { useTenantConfig } from '../hooks/useTenantConfig'
import { useLogout } from '../hooks/useAuth'

export function ShiftChecklistPage() {
  const navigate = useNavigate()
  const tenantConfig = useTenantConfig()
  const logout = useLogout()

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
          <Button variant="ghost" onClick={() => navigate('/production')}>
            Production
          </Button>
          <Button variant="ghost" onClick={() => logout.mutate()}>
            Log out
          </Button>
        </>
      }
    >
      <div className="mx-auto max-w-lg">
        <ShiftChecklistPanel />
      </div>
    </AppShell>
  )
}
