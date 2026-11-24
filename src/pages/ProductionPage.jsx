import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/atoms/Button'
import { TenantShell } from '@/components/templates/TenantShell'
import { ShiftChecklistLink } from '@/components/organisms/ShiftChecklistLink'
import { KitchenSessionBadge } from '@/components/organisms/KitchenSessionBadge'
import { ProductionForm } from '@/components/organisms/ProductionForm'
import { ProductionList } from '@/components/organisms/ProductionList'
import { CloseKitchenSessionPanel } from '@/components/organisms/CloseKitchenSessionPanel'

export function ProductionPage() {
  const navigate = useNavigate()
  const [closing, setClosing] = useState(false)

  return (
    <TenantShell
      leftSlot={<KitchenSessionBadge />}
      actions={
        <>
          <Button variant="ghost" onClick={() => navigate('/board')}>
            Order Board
          </Button>
          <ShiftChecklistLink />
          {!closing && (
            <Button variant="ghost" onClick={() => setClosing(true)}>
              Close Kitchen
            </Button>
          )}
          <Button variant="ghost" onClick={() => navigate('/errors')}>
            Error Log
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
                This Session's Manufacturing Orders / Prep Meals
              </p>
              <ProductionList />
            </div>
          </>
        )}
      </div>
    </TenantShell>
  )
}
