import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/atoms/Button'
import { TenantShell } from '@/components/templates/TenantShell'
import { KitchenSessionBadge } from '@/components/organisms/KitchenSessionBadge'
import { ShiftChecklistPanel } from '@/components/organisms/ShiftChecklistPanel'

export function ShiftChecklistPage() {
  const navigate = useNavigate()

  return (
    <TenantShell
      leftSlot={<KitchenSessionBadge />}
      actions={
        <>
          <Button variant="ghost" onClick={() => navigate('/board')}>
            Order Board
          </Button>
          <Button variant="ghost" onClick={() => navigate('/production')}>
            Production
          </Button>
        </>
      }
    >
      <div className="mx-auto max-w-lg">
        <ShiftChecklistPanel />
      </div>
    </TenantShell>
  )
}
