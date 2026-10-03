# Kitchen — Shift master data & BoM preview: API contract (PROPOSED)

Status: **proposed — not implemented in `foom_fnb_api` yet.** A search of the addon found no shift or BoM endpoints. The KDS frontend (v10) is already built against this contract using MSW mocks and degrades gracefully if the endpoints are missing (see "Fallback behaviour").

Base: `/api/kds`, JWT bearer (same as the rest of `/kitchen/*`). Errors use the existing `{ "error": "<code>", "message": "..." }` envelope.

---

## 1. `GET /kitchen/shifts`

Shift master data from Odoo model **`foom.attendance.shift`** (Attendances → Configuration → Shift). Read-only; the KDS never creates or edits shifts.

Query: `company_id` (required — shifts are company-scoped).

Response `200`:

```json
{
  "company_id": "1",
  "shifts": [
    { "id": "3", "name": "Pagi", "code": "PAGI", "start_time": "08:00", "end_time": "17:00",
      "crosses_midnight": false, "duration_hours": 9,
      "tasks": [
        { "id": "11", "name": "Check fridge & freezer temperature, log it", "description": "Chiller 0–4 °C, freezer ≤ −18 °C", "sequence": 1 },
        { "id": "12", "name": "Prep base sauces and marinades", "sequence": 2 }
      ] },
    { "id": "5", "name": "Malam", "code": "MALAM", "start_time": "22:00", "end_time": "06:00",
      "crosses_midnight": true, "duration_hours": 8, "tasks": [] }
  ]
}
```

Field mapping (Odoo form label → field):

| Odoo (form label)  | JSON field         | Notes |
|--------------------|--------------------|-------|
| Name               | `name`             | e.g. "Pagi" (screenshot shows "Pagi (08:00–17:00)" — that is the display name; send the plain name, the app adds the window itself) |
| Code               | `code`             | optional |
| Jam Masuk          | `start_time`       | float hours → `"HH:MM"` 24h |
| Jam Pulang         | `end_time`         | float hours → `"HH:MM"` 24h |
| Lintas Hari        | `crosses_midnight` | boolean |
| Durasi             | `duration_hours`   | optional number |
| Tasks (new, see below) | `tasks[]`      | Reminder checklist for the kitchen operator; `[]` when none |
| Company            | (filter)           | only return shifts for `company_id` (+ shifts with no company, if the model allows that) |

Rules: only active shifts; ordered by `start_time`; `id` is a string; no pagination (a company has a handful).
Errors: `400 bad_request` (missing `company_id`), `401`, `403` (no access to the company).

### Shift tasks (reminder checklist)

When an operator picks a shift on the Open Kitchen page, KDS lists "what you actually have to do this shift", and keeps that list as a tickable reminder on its own Shift Checklist page (`/shift-checklist`, separate from Production) for the whole session. The tasks are defined per shift in Odoo, so `foom.attendance.shift` needs a new child model (proposed name `foom.attendance.shift.task`, One2many `task_ids` on the shift):

| Field | JSON | Notes |
|-------|------|-------|
| `name` (Char, required) | `name` | e.g. "Check fridge & freezer temperature, log it" |
| `description` (Text) | `description` | optional hint line |
| `sequence` (Integer) | `sequence` | display order, ascending |
| `active` (Boolean) | — | inactive tasks are not returned |

Returned inline in `shifts[].tasks` (no separate endpoint; a shift has a handful). `tasks` may be omitted or `[]`. Task ticks are **UI-only** (kitchen operator's reminder): never sent to or validated by the backend, stored on the tablet per kitchen session, so the next shift starts with a clean list.

## 2. `POST /kitchen/sessions` — accept `shift_id`

Add an optional `shift_id` to the existing body:

```json
{ "company_id": "1", "employee_code": "F102345", "shift_id": "3", "shift": "Pagi" }
```

- `shift_id` preferred. If present it must belong to `company_id` → otherwise `400 bad_request` ("unknown shift for this company").
- Legacy free-text `shift` is still accepted (older clients, companies with no shifts configured). If both are sent, `shift_id` wins.
- Store `shift_id` (Many2one `foom.attendance.shift`) on the kitchen session next to the existing text field.
- Session responses (`POST /kitchen/sessions`, `GET /kitchen/sessions/{id}`, `whoami.open_session`): keep `shift` as the **display name** (so existing UI keeps working) and add `shift_id` (string or `null`).

## 3. `GET /kitchen/boms`

Pre-create checklist: the default Bill of Materials for a finished product.

Query: `company_id` (required), `product_id` (required).

Response `200`:

```json
{
  "bom_id": "12", "bom_code": "BOM-NGS",
  "product_id": "41", "product_name": "Nasi Goreng Spesial", "uom": "Portion",
  "output_qty": 1,
  "components": [
    { "product_id": "7", "name": "Nasi Putih", "uom": "g", "qty": 200, "available_qty": 12000 }
  ]
}
```

- Source: the product's default `mrp.bom` for the company (type normal/manufacture), components = `bom_line_ids`.
- `qty` is **exactly as stored on the BoM line, per `output_qty`** (Odoo `product_qty`). The client computes consumed qty = `qty / output_qty × qty_requested`, so it follows the qty field live without refetching.
- `uom` = the line's UoM, not the product's default.
- `available_qty` (optional) = free qty of the component in the kitchen warehouse (same source as `GET /stock`). Used only for an amber "short" hint; never blocks.
- Nested/phantom BoMs: return the lines Odoo would actually consume (explode kits) — decide with backend, flag if not done.
- Errors: `409 no_bom` (product has no BoM), `400 bad_request`, `404 product not found`, `401`.
- `POST /kitchen/productions` already accepts `bom_id`; the client now always sends the `bom_id` it previewed.

## Checklist ticks are NOT part of the API

The operator's checkboxes are a UI-only todo. They are never sent to the backend and never validated by it; they only keep the "Create Manufacturing Order / Prep Meal" button disabled until 100% are ticked. The backend's authority on whether an MO can finish stays `409 done_failed`.

## Fallback behaviour (frontend)

- `/kitchen/shifts` errors or returns no shifts → the gate shows the old free-text "Shift (optional)" field. Opening the kitchen is never blocked by this.
- `/kitchen/boms` errors/`no_bom` → the review step shows the message and a "Pick a different product" link; Create stays disabled. **If the backend ships without `/kitchen/boms`, products cannot be created from KDS v10** — so ship it before (or together with) v10, or keep v9 until then.
- Default selected shift = the one whose window contains the current time (overnight-aware); the operator can change it or pick "No shift".

---

## Todo breakdown

### Backend (`foom_fnb_api`) — NOT started
- [ ] **S1** Controller `GET /kitchen/shifts`: company-scoped read of `foom.attendance.shift`, active only, float→"HH:MM", `crosses_midnight`, `duration_hours`. ACL: same group as other `/kitchen/*`.
- [ ] **S2** Add `shift_id` (Many2one `foom.attendance.shift`) to the kitchen session model; accept `shift_id` on `POST /kitchen/sessions` (validate company); keep text `shift` (fill with shift name when `shift_id` given); return both in session payloads and `whoami.open_session`.
- [ ] **S8** New model `foom.attendance.shift.task` (shift_id, name, description, sequence, active) + One2many `task_ids` on `foom.attendance.shift`, editable in the Shift form (a "Tasks" tab); include `tasks[]` in `GET /kitchen/shifts` ordered by `sequence`, active only.
- [ ] **S3** Confirm exact field names on `foom.attendance.shift` (names above are taken from the form labels: Name, Code, Jam Masuk, Jam Pulang, Lintas Hari, Durasi, Company) and handle shifts without a company.
- [ ] **B1** Controller `GET /kitchen/boms`: resolve default `mrp.bom` for product+company (`mrp.bom._bom_find`), serialize lines with line UoM; `output_qty` = `product_qty`.
- [ ] **B2** `available_qty` per component from the kitchen warehouse (reuse the `/stock` helper).
- [ ] **B3** Decide kit/phantom explosion and multi-BoM selection; `409 no_bom` when none.
- [ ] **B4** Verify `POST /kitchen/productions` with `bom_id` uses that BoM (and rejects a BoM that doesn't match the product).
- [ ] **D1** Document both endpoints + `shift_id` in the addon's API docs and OpenAPI; Postman/HTTP examples.
- [ ] **T1** Backend tests: company scoping, overnight shift serialization, unknown `shift_id`, `no_bom`, UoM conversion, access rights.

### Frontend (kds-frontend v10–v12) — DONE
- [x] Wording "Manufacturing Order / Prep Meal" across Production page, list, close panel.
- [x] Two-step create flow: "Process manufacture order" → BoM preview with consumed qty + per-ingredient checkbox + progress; Create disabled until 100% ticked; empty BoM counts as complete; fresh checklist per run.
- [x] `listShifts` / `getBomPreview` API + `useShifts` / `useBomPreview` hooks; `bom.js` / `shifts.js` helpers.
- [x] Gate: shift dropdown (name · window), current-shift default, "No shift", free-text fallback; sends `shift_id`.
- [x] Shift tasks: read-only preview under the dropdown on Open Kitchen (swaps when the shift changes).
- [x] Separate **Shift Checklist** page (`/shift-checklist`): tickable tasks + progress bar, kept per kitchen session on the tablet (reload-safe, fresh each new session); header button on Board and Production shows done/total and is hidden when the shift has no tasks; page explains when there is no shift / no tasks.
- [x] MSW mocks for both endpoints (company-scoped shifts, `no_bom`, unknown-shift 400).
- [x] Tests: 146 passing (lib unit tests, gate shift picker + fallback, full create flow incl. gating, no-BoM, shortage).

### Integration / QA — after backend ships
- [ ] **Q1** Point KDS at staging; check shifts list matches Odoo Shift form for each company.
- [ ] **Q2** Open a kitchen with a shift → confirm `shift_id` stored on the session in Odoo.
- [ ] **Q7** Add tasks to a shift in Odoo → they appear on Open Kitchen when that shift is picked and as the checklist on the Shift Checklist page; reorder via `sequence`; archived task disappears.
- [ ] **Q3** Overnight shift (Lintas Hari): default selection at 23:30 and 02:00.
- [ ] **Q4** BoM preview for products with different `output_qty` and UoMs; compare consumed qty with what Odoo actually consumes on the MO.
- [ ] **Q5** Product without BoM → clear message, Create stays disabled.
- [ ] **Q6** Shortage path still ends in `done_failed` with Retry/Cancel.
