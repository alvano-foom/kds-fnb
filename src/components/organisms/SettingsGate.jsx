import { KioskLayout } from '../templates/KioskLayout'
import { Button } from '../atoms/Button'

export function SettingsGate({ onOpenSettings }) {
  return (
    <KioskLayout title="Set up this device" subtitle="This kiosk hasn't been pointed at a backend yet.">
      <p className="mb-3 text-sm text-gray-600">
        Add the API Base URL, API Key, and Company ID for this outlet before anyone can sign in.
      </p>
      <Button type="button" className="w-full" onClick={onOpenSettings}>
        Open Device Settings
      </Button>
    </KioskLayout>
  )
}
