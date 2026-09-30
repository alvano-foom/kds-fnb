import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWhoami, useOpenKitchenSession } from '../../hooks/useKitchenSession'
import { useKitchenSessionStore } from '../../store/kitchenSessionStore'
import { useTenantStore } from '../../store/tenantStore'
import { FormField } from '../molecules/FormField'
import { Input } from '../atoms/Input'
import { Button } from '../atoms/Button'
import { Spinner } from '../atoms/Spinner'

/**
 * The "lasting" gate between Settings and the working screens: identify
 * yourself with a Kode Absensi, then either open the kitchen (if it isn't
 * already) or continue into an already-open one — one kitchen session
 * covers the whole shift/company, not one per person, so this same flow
 * also serves as "switch operator" when someone else needs to be the one
 * attributed to what happens next, without closing and reopening.
 */
export function KodeAbsensiGate() {
  const navigate = useNavigate()
  const companyId = useTenantStore((s) => s.companyId)
  const setSession = useKitchenSessionStore((s) => s.setSession)

  const [code, setCode] = useState('')
  const [shift, setShift] = useState('')
  const [checked, setChecked] = useState(null) // whoami result once confirmed

  const whoami = useWhoami()
  const openSession = useOpenKitchenSession()

  function handleCheck(e) {
    e.preventDefault()
    setChecked(null)
    whoami.mutate(code.trim(), { onSuccess: setChecked })
  }

  function handleContinueExisting() {
    setSession({
      session: checked.open_session,
      employee: { ...checked.employee, code: code.trim() },
      companyId,
    })
    navigate('/production', { replace: true })
  }

  function handleOpen() {
    openSession.mutate(
      { employeeCode: code.trim(), shift: shift.trim() || undefined },
      {
        onSuccess: (session) => {
          setSession({ session, employee: { ...checked.employee, code: code.trim() }, companyId })
          navigate('/production', { replace: true })
        },
      },
    )
  }

  function handleChangeCode() {
    setChecked(null)
  }

  if (checked) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Hi <span className="font-semibold text-gray-900">{checked.employee.name}</span>
          {checked.employee.job_title ? ` · ${checked.employee.job_title}` : ''}.
        </p>

        {checked.open_session ? (
          <div className="space-y-3 rounded-xl bg-emerald-50 p-4">
            <p className="text-sm text-emerald-800">
              The kitchen is already open — <strong>{checked.open_session.name}</strong>
              {checked.open_session.shift ? ` (${checked.open_session.shift})` : ''}, opened by{' '}
              {checked.open_session.opened_by?.name}.
            </p>
            <Button type="button" onClick={handleContinueExisting} className="w-full">
              Continue as {checked.employee.name}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <FormField label="Shift (optional)" htmlFor="shift">
              <Input
                id="shift"
                value={shift}
                onChange={(e) => setShift(e.target.value)}
                placeholder="e.g. Shift 1"
              />
            </FormField>
            {openSession.isError && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {openSession.error?.message || 'Could not open the kitchen.'}
              </p>
            )}
            <Button type="button" onClick={handleOpen} disabled={openSession.isPending} className="w-full">
              {openSession.isPending && <Spinner className="h-4 w-4" />}
              Open Kitchen
            </Button>
          </div>
        )}

        <button type="button" onClick={handleChangeCode} className="text-sm font-medium text-gray-400 underline">
          Not you? Enter a different Kode Absensi
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleCheck} className="space-y-4">
      <FormField label="Kode Absensi" htmlFor="att-code">
        <Input
          id="att-code"
          autoFocus
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="e.g. F102345"
        />
      </FormField>

      {whoami.isError && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {whoami.error?.message || 'Kode absensi tidak dikenal.'}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={whoami.isPending || !code.trim()}>
        {whoami.isPending && <Spinner className="h-4 w-4" />}
        Continue
      </Button>
    </form>
  )
}
