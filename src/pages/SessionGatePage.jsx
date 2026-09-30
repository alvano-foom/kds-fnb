import { KioskLayout } from '../components/templates/KioskLayout'
import { OpenSessionForm } from '../components/organisms/OpenSessionForm'

export function SessionGatePage() {
  return (
    <KioskLayout title="Kitchen Production Session" subtitle="Enter your Kode Absensi to open a session.">
      <OpenSessionForm />
    </KioskLayout>
  )
}
