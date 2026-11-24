import { TenantShell } from '@/components/templates/TenantShell'
import { KodeAbsensiGate } from '@/components/organisms/KodeAbsensiGate'

export function KitchenSessionPage() {
  return (
    <TenantShell showLogout={false}>
      <div className="mx-auto max-w-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Open Kitchen Session</h2>
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <KodeAbsensiGate />
        </div>
      </div>
    </TenantShell>
  )
}
