# Kitchen — BoM preview, MO scrap, shifts & shift tasks: integration notes

Status (2026-10-04): **integrated in KDS v13 against the backend dev's real endpoints**, tested against mocks that mirror their docs. **Not yet verified live on staging.** This replaces the earlier *proposed* contract (`GET /kitchen/shifts`, `shift_id` on kitchen sessions, a `foom.attendance.shift.task` model) — shifts and tasks turned out to live in the `foom_attendance` module with its own API, and BoM/scrap shipped in `foom_fnb_api`.

## What KDS now calls

| Endpoint | Module | Used for |
|---|---|---|
| `GET /api/kds/kitchen/boms` | foom_fnb_api | Pre-create BoM preview + ingredient checklist |
| `GET /api/kds/kitchen/productions/{id}/components` | foom_fnb_api | Ingredients of a done MO (Close Kitchen) |
| `POST /api/kds/kitchen/productions/{id}/scraps` | foom_fnb_api | Record scrap per ingredient |
| `GET /api/kds/kitchen/productions/{id}/scraps` | foom_fnb_api | Client function exists; UI uses the session's `scraps[]` |
| `POST /foom/attendance/api/login` | foom_attendance | Employee token (Kode Absensi + **PIN**) |
| `POST /foom/attendance/api/shifts` | foom_attendance | Shift list incl. each shift's `tasks[]` |

Auth: KDS keeps sending its JWT bearer token to `/api/kds/*` (the docs say `X-API-Key`; bearer has been accepted wherever the key is). The attendance API is separate: token in the **body**, never a header/URL.

## 1. BoM preview — `GET /kitchen/boms`

Query used: `company_id`, `product_id` (barcode also supported), `qty`, `warehouse_id` (the open session's warehouse). Read-only, reserves nothing.

- Response: `bom_id, bom_code, bom_qty, bom_uom, qty, uom, factor, ok, components[]`; each component `product_id, barcode, name, uom, qty_per_bom, required_qty, available_qty, shortage_qty, ok`.
- KDS shows `required_qty` as "Consumed" per ingredient (server-computed with Odoo's `bom.explode`, so it equals what the MO will consume — no client-side scaling any more) and an amber "Short — only N on hand (missing M)" hint when `shortage_qty > 0`. Hint only; `409 done_failed` stays the authority.
- Request is keyed by qty, so editing the qty = a new cheap request.
- Errors surfaced: `409 no_bom`, `404 not_found`, `400 bad_request` / `bom_mismatch`.
- Checklist ticks are UI-only: never sent to or validated by the backend; they just keep "Create Manufacturing Order / Prep Meal" disabled until 100%.

## 2. Close Kitchen — MO list → ingredients → scrap

1. Close Kitchen lists this session's **done** manufacturing orders / prep meals, collapsed, each with a status chip: *Needs review* / *Scrap recorded* / *No scrap*.
2. Tapping one loads `GET /productions/{id}/components` and shows each ingredient: name, "To consume X", "already scrapped Y", scrap qty + reason inputs. The finished good is never offered (the endpoint doesn't list it).
3. **Record scrap** posts `items:[{product_id, qty, reason?}]` to `POST /productions/{id}/scraps` immediately — Odoo creates and validates the scrap; KDS refreshes components + session detail. All-or-nothing per request.
4. **No scrap for this one** marks the MO reviewed client-side (nothing sent).
5. Client-side policy kept: every done MO must be reviewed (scrap recorded, or "No scrap") before **Confirm & Close Kitchen** enables. Close then sends `scraps: []` (already recorded) plus the existing `cancel_pending` / `force` options.
6. Errors shown inline: `400 not_a_component`, `409 scrap_failed` (e.g. not enough stock at that location), `401 invalid_employee_code`.

## 3. Shifts and shift tasks — `foom_attendance`

- `POST /login {code, pin}` → `token` (12h) → `POST /shifts {token}` → `{timezone, shifts[]}`; each shift has `time_from/time_to`, `is_overnight`, `is_default`, `tasks[] {id, sequence, name, description}`. Company comes from the token's employee; tasks are display-only (no "mark done" endpoint — ticks stay on the tablet).
- KDS maps it to its internal shape (string ids; `start_time/end_time/crosses_midnight`) in `src/lib/shifts.js`.
- Base URL: `VITE_ATTENDANCE_API_URL`, else the KDS API's host + `/foom/attendance/api`.
- **PIN requirement.** The shift API needs the employee's PIN, but KDS identifies people by Kode Absensi alone. So the Open Kitchen form has an *optional* "PIN Absensi" field next to the Kode:
  - With PIN → one login + one `/shifts` call, then a Shift dropdown (pre-selects the shift running now, else the employee's default), a read-only preview of that shift's tasks, and the checklist after opening. The PIN is cleared from component state right after the request; the token is never stored.
  - Without PIN, or if it fails → the old free-text Shift field; nothing is blocked.
  - Joining a kitchen opened by someone else: with a PIN the matching shift (by name) is remembered for this tablet's checklist; without one the checklist page says there are no tasks.
- The kitchen session itself still takes **free-text `shift`** (the chosen shift's name). No `shift_id` is sent — the kitchen API has none.
- Shift Checklist page (`/shift-checklist`): tickable tasks + progress, stored per kitchen session on the tablet (persisted; next session starts clean). Header button on Board/Production shows done/total, hidden when no tasks.

## 4. Not used by KDS (noted from the same release)

- `POST /orders/{no}/deliver` / removed `POST /orders/{no}/pay` (410), `GET /orders/fields` + `custom_fields` snake_case keys — KDS never calls these (it only moves order lines through kitchen states). Relevant to the external ordering app.
- `GET /stock` / `POST /stock/check` `location_id` — KDS doesn't pass a location yet; add it if a kitchen should show per-shelf availability.
- Deploy notes from the backend dev (module upgrade `-u foom_fnb_api`, chatter silenced for API traffic) are server-side only.

## Open questions / todo

### Needs a decision
- [ ] **PIN on the kitchen gate.** Is typing the attendance PIN at the kitchen tablet acceptable? Alternative: backend adds a shift+tasks endpoint under `/api/kds` that works with the existing JWT (then no PIN field). Until decided, PIN stays optional.
- [ ] Should the kitchen session store the chosen shift (e.g. `shift_id` on `POST /kitchen/sessions`)? Today it is only the free-text name, so a second tablet joining the session can only show the checklist if it also enters a PIN.

### Backend / ops
- [ ] CORS for the KDS origin on `/foom/attendance/api/*` (KDS calls it from the browser).
- [ ] Confirm `foom_attendance` ≥ 18.0.1.1.0 is installed on staging and "Absensi Publik" is enabled; tasks filled under Absensi Publik ▸ Shift ▸ Task List.
- [ ] Confirm `Authorization: Bearer` is accepted on the new `/kitchen/boms`, `/components`, `/scraps` endpoints (docs list `X-API-Key`).

### Frontend (KDS v13) — done
- [x] BoM preview on the new contract (server `required_qty` / `shortage_qty`, qty + warehouse passed), checklist gating, wording.
- [x] Close Kitchen: MO list → expandable ingredients → per-ingredient scrap via the new endpoints; review policy; inline errors.
- [x] Shift picker + task preview from `foom_attendance` (PIN optional, free-text fallback); Shift Checklist page; header button.
- [x] MSW mocks mirroring the real shapes (incl. integer ids, `ok:false` envelope, `not_a_component`, `scrap_failed`); 168 tests.

### QA after staging is reachable
- [ ] Q1 BoM preview for 2–3 real products (different `bom_qty`, UoM g↔kg): `required_qty` equals the MO's `move_raw_ids` after creating it.
- [ ] Q2 Scrap a component on a done MO: Odoo shows a raw-material scrap (`raw_material_production_id`), location = MO source location; "already scrapped" updates.
- [ ] Q3 Try scrapping more than on hand → `scrap_failed` message is readable.
- [ ] Q4 Shifts: correct PIN lists the right shifts + tasks; wrong PIN / attendance disabled → free-text fallback with a clear message.
- [ ] Q5 Overnight shift pre-selection at 23:30 and 02:00; employee default shift pre-selected outside any window.
- [ ] Q6 Close Kitchen end to end with one MO scrapped and one "No scrap".
