import { useState } from 'react'
import { useConfigStore, useIsConfigured } from '../store/configStore'
import { useOperatorStore } from '../store/operatorStore'
import { useOpenKitchenSession } from '../hooks/useKitchenSession'
import { KioskLayout } from '../components/templates/KioskLayout'
import { SettingsGate } from '../components/organisms/SettingsGate'
import { SignInForm } from '../components/organisms/SignInForm'
import { OpenKitchenPanel } from '../components/organisms/OpenKitchenPanel'
import { KitchenStatusCard } from '../components/organisms/KitchenStatusCard'
import { ProductionForm } from '../components/organisms/ProductionForm'
import { ProductionList } from '../components/organisms/ProductionList'
import { CloseKitchenPanel } from '../components/organisms/CloseKitchenPanel'

/**
 * One continuous kiosk flow rather than routed pages — there's really only
 * ever one thing to do next: configure this device, sign in, open the
 * kitchen, work, or close it. A step indicator would just repeat what's
 * already visible.
 */
export function HomePage({ onOpenSettings }) {
  const isConfigured = useIsConfigured()
  const companyId = useConfigStore((s) => s.companyId)
  const employee = useOperatorStore((s) => s.employee)
  const { data: session, isLoading } = useOpenKitchenSession(companyId)
  const [mode, setMode] = useState('working') // 'working' | 'closing'

  if (!isConfigured) return <SettingsGate onOpenSettings={onOpenSettings} />

  if (!employee) {
    return (
      <KioskLayout title="Kitchen Production Session" subtitle="Enter your Kode Absensi to sign in.">
        <SignInForm />
      </KioskLayout>
    )
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-sm text-gray-400">Checking kitchen status…</p>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="mx-auto max-w-lg p-4">
        <OpenKitchenPanel />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg space-y-4 p-4">
      <KitchenStatusCard session={session} showCloseButton={mode === 'working'} onCloseClick={() => setMode('closing')} />

      <div className="rounded-2xl bg-white p-4 shadow-sm">
        {mode === 'closing' ? (
          <CloseKitchenPanel session={session} onCancel={() => setMode('working')} onClosed={() => setMode('working')} />
        ) : (
          <div className="space-y-4">
            <ProductionForm />
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                This Session's Manufacturing Orders
              </p>
              <ProductionList productions={session.productions} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
