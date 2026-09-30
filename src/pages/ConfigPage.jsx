import { useNavigate } from 'react-router-dom'
import { AppShell } from '../components/templates/AppShell'
import { ConfigForm } from '../components/organisms/ConfigForm'
import { TextToSpeech } from '../components/organisms/TextToSpeech'
import { PrinterConfig } from '../components/organisms/PrinterConfig'
import { Button } from '../components/atoms/Button'
import { useLogout } from '../hooks/useAuth'
import { useTenantConfig } from '../hooks/useTenantConfig'
import { useTenantStore } from '../store/tenantStore'
import { useKitchenSessionStore } from '../store/kitchenSessionStore'

export function ConfigPage() {
  const navigate = useNavigate()
  const logout = useLogout()
  const tenantConfig = useTenantConfig()

  // Kode Absensi is the LAST gate before the working screens, per the
  // decision made with the user — but if this device already has that
  // company's kitchen open (someone just tweaked a printer setting and
  // hit Save again, nothing about the company changed), there's no
  // reason to make them re-identify themselves. Only skip straight past
  // the gate when both match; anything else — a different company, no
  // session yet — still goes through it.
  function goToWorkingScreen() {
    const { companyId } = useTenantStore.getState()
    const { session, companyId: sessionCompanyId } = useKitchenSessionStore.getState()
    if (session?.state === 'open' && sessionCompanyId === companyId) {
      navigate('/production', { replace: true })
    } else {
      navigate('/kitchen-session', { replace: true })
    }
  }

  return (
    <AppShell
      title={tenantConfig.data?.name ?? 'Kitchen Display'}
      logoUrl={tenantConfig.data?.logo_url}
      rightSlot={
        <>
          <Button variant="ghost" onClick={() => navigate('/errors')}>
            Error Log
          </Button>
          <Button variant="ghost" onClick={() => logout.mutate()}>
            Log out
          </Button>
        </>
      }
    >
      <div className="mx-auto max-w-md">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Kitchen Configuration</h2>
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <ConfigForm onSaved={goToWorkingScreen} />
        </div>

        <h2 className="mb-4 mt-8 text-lg font-semibold text-gray-900">Voice Announcements</h2>
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <TextToSpeech />
        </div>

        <h2 className="mb-4 mt-8 text-lg font-semibold text-gray-900">Receipt Printer</h2>
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <PrinterConfig />
        </div>
      </div>
    </AppShell>
  )
}
