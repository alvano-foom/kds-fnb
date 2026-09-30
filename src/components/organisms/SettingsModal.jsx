import { useState } from 'react'
import { useConfigStore } from '../../store/configStore'
import { MOCK_API_KEY } from '../../api/mocks/constants'
import { Button } from '../atoms/Button'
import { Input } from '../atoms/Input'

/**
 * Per-device configuration, reachable any time from the top bar's gear icon
 * — including before signing in, so a kiosk can be pointed at the right
 * backend/company before anyone tries to use it. Nothing here is sent
 * anywhere except as headers/params on this device's own API calls.
 */
export function SettingsModal({ onClose }) {
  const config = useConfigStore()
  const [apiBaseUrl, setApiBaseUrl] = useState(config.apiBaseUrl)
  const [apiKey, setApiKey] = useState(config.apiKey)
  const [companyId, setCompanyId] = useState(config.companyId)
  const [shift, setShift] = useState(config.shift)

  function handleSave(e) {
    e.preventDefault()
    config.setConfig({ apiBaseUrl: apiBaseUrl.trim(), apiKey: apiKey.trim(), companyId: companyId.trim(), shift: shift.trim() })
    onClose()
  }

  function fillDemoValues() {
    setApiBaseUrl('/api/kds')
    setApiKey(MOCK_API_KEY)
    setCompanyId('1')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Device Settings</h2>
          <button type="button" onClick={onClose} className="text-sm text-gray-400 hover:text-gray-600">
            ✕
          </button>
        </div>
        <p className="mt-1 text-xs text-gray-500">
          Points this device at a specific backend and outlet (company). Different kitchens/tablets can each
          have their own values.
        </p>

        <form onSubmit={handleSave} className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700" htmlFor="cfg-base-url">
              API Base URL
            </label>
            <Input
              id="cfg-base-url"
              value={apiBaseUrl}
              onChange={(e) => setApiBaseUrl(e.target.value)}
              placeholder="https://odoo-staging.foomid.id/api/kds"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700" htmlFor="cfg-api-key">
              API Key
            </label>
            <Input
              id="cfg-api-key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="from Settings ▸ Technical ▸ System Parameters"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700" htmlFor="cfg-company-id">
              Company ID
            </label>
            <Input
              id="cfg-company-id"
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              placeholder="e.g. 1"
            />
            <p className="mt-1 text-[11px] text-gray-400">
              The numeric ID of this outlet's company record in Odoo (Settings ▸ Companies).
            </p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700" htmlFor="cfg-shift">
              Default shift label (optional)
            </label>
            <Input id="cfg-shift" value={shift} onChange={(e) => setShift(e.target.value)} placeholder="e.g. Shift 1" />
          </div>

          <div className="flex items-center justify-between pt-1">
            <button type="button" onClick={fillDemoValues} className="text-xs font-medium text-brand underline">
              Use demo/mock values
            </button>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={!apiBaseUrl.trim() || !apiKey.trim() || !companyId.trim()}>
                Save
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
