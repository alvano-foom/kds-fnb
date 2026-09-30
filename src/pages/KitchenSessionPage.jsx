import { AppShell } from '../components/templates/AppShell'
import { KodeAbsensiGate } from '../components/organisms/KodeAbsensiGate'
import { useTenantConfig } from '../hooks/useTenantConfig'

export function KitchenSessionPage() {
  const tenantConfig = useTenantConfig()

  return (
    <AppShell title={tenantConfig.data?.name ?? 'Kitchen Display'} logoUrl={tenantConfig.data?.logo_url}>
      <div className="mx-auto max-w-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Open Kitchen Session</h2>
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <KodeAbsensiGate />
        </div>
      </div>
    </AppShell>
  )
}
