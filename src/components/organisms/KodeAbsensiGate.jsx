import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWhoami, useOpenKitchenSession, useLoadShifts } from '../../hooks/useKitchenSession'
import { formatShiftWindow, pickInitialShift } from '../../lib/shifts'
import { useKitchenSessionStore } from '../../store/kitchenSessionStore'
import { useShiftChecklistStore } from '../../store/shiftChecklistStore'
import { useTenantStore } from '../../store/tenantStore'
import { ShiftTaskList } from '../molecules/ShiftTaskList'
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
  const setShiftSnapshot = useShiftChecklistStore((s) => s.setShift)

  const [code, setCode] = useState('')
  const [pin, setPin] = useState('') // only used to load shifts from foom_attendance; cleared right after
  const [shift, setShift] = useState('') // free text — only used when there are no shifts from Odoo
  const [shiftId, setShiftId] = useState(null) // null = not touched yet → follow the current-time default
  const [checked, setChecked] = useState(null) // whoami result once confirmed

  const whoami = useWhoami()
  const openSession = useOpenKitchenSession()

  // Shifts (and their task lists) come from foom_attendance, whose API needs
  // the employee's PIN as well as the Kode Absensi. The PIN is optional: with
  // it we offer a shift picker + task preview; without it (or if loading
  // fails) the form keeps its free-text Shift field and nothing is blocked.
  const loadShifts = useLoadShifts()
  const shifts = useMemo(() => loadShifts.data?.shifts ?? [], [loadShifts.data])
  const hasShifts = shifts.length > 0
  const defaultShift = useMemo(() => pickInitialShift(shifts), [shifts])
  const selectedShiftId = shiftId ?? defaultShift?.id ?? ''
  const pickedShift = hasShifts ? shifts.find((s) => s.id === selectedShiftId) ?? null : null

  function handleCheck(e) {
    e.preventDefault()
    setChecked(null)
    setShiftId(null)
    loadShifts.reset()
    const typedPin = pin.trim()
    whoami.mutate(code.trim(), {
      onSuccess: (result) => {
        setChecked(result)
        if (typedPin) loadShifts.mutate({ code: code.trim(), pin: typedPin })
      },
    })
    setPin('') // never keep the PIN in component state longer than the request needs it
  }

  function handleContinueExisting() {
    // Joining a kitchen someone else opened: if we know the shifts (PIN given), remember the matching one so this tablet can show its checklist too.
    const joined = checked.open_session
    const match = hasShifts ? shifts.find((x) => x.name.toLowerCase() === (joined.shift || '').toLowerCase()) : null
    if (match) setShiftSnapshot(joined.id, match)
    setSession({
      session: checked.open_session,
      employee: { ...checked.employee, code: code.trim() },
      companyId,
    })
    navigate('/production', { replace: true })
  }

  function handleOpen() {
    const picked = pickedShift
    openSession.mutate(
      { employeeCode: code.trim(), shift: (hasShifts ? picked?.name : shift.trim()) || undefined },
      {
        onSuccess: (session) => {
          if (picked) setShiftSnapshot(session.id, picked)
          setSession({ session, employee: { ...checked.employee, code: code.trim() }, companyId })
          navigate('/production', { replace: true })
        },
      },
    )
  }

  function handleLoadShifts(e) {
    e.preventDefault()
    const typedPin = pin.trim()
    if (!typedPin) return
    loadShifts.mutate({ code: code.trim(), pin: typedPin })
    setPin('') // same rule as the first form: the PIN never outlives the request
  }

  function handleChangeCode() {
    setChecked(null)
    setShiftId(null)
    loadShifts.reset()
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
            {hasShifts ? (
              <FormField label="Shift" htmlFor="shift">
                <select
                  id="shift"
                  value={selectedShiftId}
                  onChange={(e) => setShiftId(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                >
                  <option value="">No shift</option>
                  {shifts.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} · {formatShiftWindow(s)}
                    </option>
                  ))}
                </select>
              </FormField>
            ) : (
              <FormField label="Shift (optional)" htmlFor="shift">
                <Input
                  id="shift"
                  value={shift}
                  onChange={(e) => setShift(e.target.value)}
                  placeholder="e.g. Shift 1"
                />
              </FormField>
            )}
            {!hasShifts && !loadShifts.isPending && (
              <div className="space-y-1.5 rounded-lg bg-gray-50 p-3">
                <p className="text-xs text-gray-500">
                  Want to pick a shift and see its tasks? Enter your PIN Absensi.
                </p>
                <div className="flex gap-2">
                  <Input
                    id="att-pin-inline"
                    type="password"
                    inputMode="numeric"
                    autoComplete="off"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    placeholder="PIN Absensi"
                    aria-label="PIN Absensi"
                  />
                  <Button type="button" onClick={handleLoadShifts} disabled={!pin.trim()}>
                    Load shifts
                  </Button>
                </div>
              </div>
            )}
            {loadShifts.isPending && <p className="text-xs text-gray-400">Loading your shifts…</p>}
            {loadShifts.isError && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Couldn't load shifts: {(loadShifts.error?.message ?? '').replace(/\.$/, '')}. You can still type the shift name.
              </p>
            )}
            {hasShifts && pickedShift?.tasks?.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Your tasks this shift ({pickedShift.name})
                </p>
                <ShiftTaskList tasks={pickedShift.tasks} />
              </div>
            )}
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

      <FormField label="PIN Absensi (optional)" htmlFor="att-pin">
        <Input
          id="att-pin"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="Only needed to pick a shift and see its tasks"
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
