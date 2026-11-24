import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/atoms/Button'
import { useKitchenSessionStore } from '@/store/kitchenSessionStore'
import { TextToSpeech } from '@/components/organisms/TextToSpeech'
import { PrinterConfig } from '@/components/organisms/PrinterConfig'
import { OrderViewConfig } from '@/components/organisms/OrderViewConfig'
import { ConfigForm } from '@/components/organisms/ConfigForm'
import { TenantShell } from '@/components/templates/TenantShell'
import { useTenantStore } from '@/store/tenantStore'

function SettingsSection({ title, first = false, children }) {
  return (
    <>
      <h2 className={`mb-4 ${first ? '' : 'mt-8 '}text-lg font-semibold text-gray-900`}>{title}</h2>
      <div className="rounded-2xl bg-white p-6 shadow-sm">{children}</div>
    </>
  )
}

export function ConfigPage() {
  const navigate = useNavigate()

  // Skip the Attendance Code gate only when this device already has this company's kitchen open.
  function goToWorkingScreen() {
    const { companyId } = useTenantStore.getState()
    const { session, companyId: sessionCompanyId } = useKitchenSessionStore.getState()
    const resume = session?.state === 'open' && sessionCompanyId === companyId
    navigate(resume ? '/production' : '/kitchen-session', { replace: true })
  }

  return (
    <TenantShell
      actions={
        <Button variant="ghost" onClick={() => navigate('/errors')}>
          Error Log
        </Button>
      }
    >
      <div className="mx-auto max-w-md">
        <SettingsSection title="Kitchen Configuration" first>
          <ConfigForm onSaved={goToWorkingScreen} />
        </SettingsSection>
        <SettingsSection title="Voice Announcements">
          <TextToSpeech />
        </SettingsSection>
        <SettingsSection title="Board & Print">
          <OrderViewConfig />
        </SettingsSection>
        <SettingsSection title="Receipt Printer">
          <PrinterConfig />
        </SettingsSection>
      </div>
    </TenantShell>
  )
}
