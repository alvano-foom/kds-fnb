import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/atoms/Button'
import { Spinner } from '@/components/atoms/Spinner'
import { TenantShell } from '@/components/templates/TenantShell'
import { useTenantStore } from '@/store/tenantStore'
import { KitchenSessionBadge } from '@/components/organisms/KitchenSessionBadge'
import { ShiftChecklistLink } from '@/components/organisms/ShiftChecklistLink'
import { KanbanBoard } from '@/components/organisms/KanbanBoard'
import { PendingOrderAlerts } from '@/components/organisms/PendingOrderAlerts'
import { ConnectionStatus } from '@/components/molecules/ConnectionStatus'
import { useOrderLines } from '@/hooks/useOrderLines'
import { useUpdateLineState, useUpdateOrderState } from '@/hooks/useUpdateLineState'
import { useOrderViewStore } from '@/store/orderViewStore'
import { groupByOrder, planOrderMove } from '@/lib/orderGroups'
import { useKitchenSocket } from '@/ws/useKitchenSocket'

export function BoardPage() {
  const navigate = useNavigate()
  const { companyId, companyName } = useTenantStore()
  const { status } = useKitchenSocket(companyId)
  const lines = useOrderLines(companyId, { polling: status === 'polling' })
  const updateLine = useUpdateLineState(companyId)
  const updateOrder = useUpdateOrderState(companyId)
  const perTransaction = useOrderViewStore((s) => s.perTransaction)

  // The cache always holds one entry per order line; per-transaction mode only regroups for display.
  const cards = useMemo(
    () => (perTransaction ? groupByOrder(lines.data ?? []) : (lines.data ?? [])),
    [perTransaction, lines.data],
  )

  function handleDrop(cardId, kitchenState) {
    if (!perTransaction) {
      updateLine.mutate({ lineId: cardId, kitchenState })
      return
    }
    const card = cards.find((c) => c.id === cardId)
    const moves = card ? planOrderMove(card, kitchenState) : []
    if (moves.length) updateOrder.mutate({ moves })
  }

  return (
    <TenantShell
      leftSlot={
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm text-brand-contrast/80">{companyName}</span>
          <KitchenSessionBadge />
        </div>
      }
      actions={
        <>
          <ConnectionStatus status={status} />
          <ShiftChecklistLink />
          <Button variant="ghost" onClick={() => navigate('/production')}>
            Production
          </Button>
          <Button variant="ghost" onClick={() => navigate('/config')}>
            Settings
          </Button>
          <Button variant="ghost" onClick={() => navigate('/errors')}>
            Error Log
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
          {/* Mount only after data loads so its first render is the baseline, not "every order is new". */}
          <PendingOrderAlerts cards={lines.data ?? []} />
          <KanbanBoard cards={cards} onDrop={handleDrop} />
        </>
      )}
    </TenantShell>
  )
}
