import { describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '../test/server'
import { attendanceLogin, listAttendanceShifts, AttendanceError } from './attendance'

describe('foom_attendance API', () => {
  it('logs in with code + PIN and reads shifts with the token (body, not header)', async () => {
    const { token, employee } = await attendanceLogin({ code: 'F102345', pin: '482913' })
    expect(employee.code).toBe('F102345')
    const { timezone, shifts } = await listAttendanceShifts({ token })
    expect(timezone).toBe('Asia/Jakarta')
    expect(shifts.map((s) => s.name)).toEqual(['Pagi', 'Siang', 'Malam'])
  })

  it('normalises to the app shape: string ids, start/end time, crosses_midnight, ordered tasks', async () => {
    const { token } = await attendanceLogin({ code: 'F102345', pin: '482913' })
    const { shifts } = await listAttendanceShifts({ token })
    const malam = shifts.find((s) => s.name === 'Malam')
    expect(malam).toMatchObject({ id: '3', start_time: '22:00', end_time: '06:00', crosses_midnight: true })
    const pagi = shifts.find((s) => s.name === 'Pagi')
    expect(pagi.is_default).toBe(true)
    expect(pagi.tasks.map((t) => t.sequence)).toEqual([1, 2, 3, 4, 5])
    expect(typeof pagi.tasks[0].id).toBe('string')
    expect(pagi.tasks[0].description).toMatch(/chiller/i)
    expect(pagi.tasks[1].description).toBeUndefined() // "" → undefined
  })

  it('scopes shifts to the token owner\'s company (never a client-supplied one)', async () => {
    const { token } = await attendanceLogin({ code: 'F200560', pin: '482913' }) // company c2
    const { shifts } = await listAttendanceShifts({ token })
    expect(shifts).toHaveLength(1)
    expect(shifts[0]).toMatchObject({ start_time: '07:00', end_time: '15:00' })
  })

  it('throws AttendanceError with the server code on a wrong PIN or a bad token', async () => {
    await expect(attendanceLogin({ code: 'F102345', pin: '1' })).rejects.toMatchObject({ code: 'invalid_credentials', status: 401 })
    await expect(listAttendanceShifts({ token: 'nope' })).rejects.toBeInstanceOf(AttendanceError)
    await expect(listAttendanceShifts({ token: 'nope' })).rejects.toMatchObject({ code: 'unauthorized' })
  })

  it('branches on ok:false even when the HTTP status is 200 (the `disabled` case)', async () => {
    server.use(
      http.post('/foom/attendance/api/shifts', () =>
        HttpResponse.json({ ok: false, error: 'disabled', message: 'Absensi publik dimatikan.' }, { status: 200 }),
      ),
    )
    await expect(listAttendanceShifts({ token: 'x' })).rejects.toMatchObject({ code: 'disabled', message: 'Absensi publik dimatikan.' })
  })

  it('treats a network failure as an AttendanceError, not a crash', async () => {
    server.use(http.post('/foom/attendance/api/login', () => HttpResponse.error()))
    await expect(attendanceLogin({ code: 'F102345', pin: '482913' })).rejects.toMatchObject({ code: 'network_error' })
  })
})
