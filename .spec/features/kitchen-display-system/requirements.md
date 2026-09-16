# Kitchen Display System (KDS) — Requirements

## Environment (Step 0)
- Odoo version: 18.0 (backend, out of scope here — contract only)
- This repo: standalone frontend SPA, no existing Odoo addon tree present
- Decisions locked in with the user before writing this doc:
  - Multi-tenant **SaaS** product (not the Sass CSS preprocessor)
  - Kitchen state is a **new `kitchen_state` field** on `sale.order`, added by a small backend addon (not built here)
  - Auth is a **custom JWT** API (not Odoo's native session cookie)
  - Realtime is a **dedicated WebSocket gateway** in front of Odoo, with polling fallback

## Context
Multi-tenant Kitchen Display frontend. Each tenant is one Odoo company (an "outlet"). Reference screenshots (provided by user) show an existing Bahasa Indonesia app — "Outlet - Kawah Putih" / econique branding — with:
- a config screen: Company selector, Point Of Sale selector, active-session indicator, save button
- a 4-column board: Pesanan Masuk (Pending) / Pesanan Diproses (Cooking) / Pesanan Siap Diantar (Ready) / Pesanan Selesai (Served)

This project reproduces that pattern generically, per tenant, backed by Odoo 18 `sale.order`.

## User stories
1. As outlet staff, I log in with my Odoo email/password so I can access my outlet's kitchen display.
2. As outlet staff, I only see companies I'm assigned to in Odoo, so I can't see or operate another tenant's orders.
3. As kitchen staff, I see sale orders grouped into Pending / Cooking / Ready / Served columns, to track progress at a glance.
4. As kitchen staff, I drag an order card between columns to update its state without extra clicks.
5. As kitchen staff, the board updates automatically on new orders or state changes made elsewhere (e.g. POS), without a manual refresh.
6. As an outlet manager, my company/POS configuration persists per device, so the display doesn't need reconfiguring every shift.

## Acceptance criteria (EARS)
- WHEN a user submits valid Odoo email/password THEN the system SHALL authenticate and receive a JWT access+refresh token pair.
- WHEN authentication fails THEN the system SHALL show one generic inline error (not revealing whether email or password was wrong).
- WHEN a user is authenticated THEN the system SHALL fetch only the companies the user may access, for the config screen.
- WHEN a user selects a company THEN the system SHALL fetch that company's Points of Sale and let them pick one.
- WHEN configuration is saved THEN the system SHALL persist company+POS locally (tenant-scoped) and load the board for that scope on next launch.
- WHEN the board loads THEN the system SHALL fetch open `sale.order` records for the selected company/POS, grouped by `kitchen_state` into 4 fixed columns.
- WHEN a user drags a card to another column THEN the system SHALL optimistically move it, PATCH the new state to the API, and roll back with a toast on failure.
- WHEN the backend emits an order create/update event over WebSocket THEN the board SHALL reflect it within ~1s, no manual refresh.
- IF the WebSocket drops THEN the system SHALL fall back to interval polling and reconnect with exponential backoff, and SHALL show a subtle connection-status indicator.
- WHEN the access token expires THEN the system SHALL silently refresh via the refresh token; IF refresh fails THEN the system SHALL sign out and return to login.
- WHEN a user logs out THEN the system SHALL clear tokens and cached config for that tenant only (other cached tenants on a shared device are unaffected).

## Frontend scope (built in this repo)
- React (latest 19.x) + Vite (latest) + Tailwind CSS (latest), atomic design folders (atoms/molecules/organisms/templates/pages)
- Login page, Config page (company → POS cascade, session status), Kitchen board page (4-column DnD kanban)
- API client against a documented contract (`api-contract.md`), fully mocked via MSW so the team can build/demo with zero backend
- WebSocket client (reconnect/backoff + polling fallback) against a documented event contract
- Multi-tenant aware: per-tenant branding (logo/name from `/config`), per-tenant local storage keys, single `VITE_API_BASE_URL` / `VITE_WS_URL` env vars are the *only* things that change when the real backend ships

## Out of scope (backend team owns, contract documents the shape only)
- Odoo addon adding `kitchen_state` to `sale.order`, its selection values, and any `ir.model.access.csv` / record rules
- JWT auth endpoints, refresh/rotation, and the WebSocket gateway implementation
- POS→company resolution logic (contract treats a POS as an opaque `{id, name, company_id}` resource)

## Open assumptions (flagged in the contract doc for backend sign-off)
- `kitchen_state` values: `pending | cooking | ready | served`, extendable later
- Only orders not yet cancelled/fully closed are surfaced ("open" orders); exact `state` filter is a backend decision, documented as a query param
- One WebSocket channel per (company, pos) scope; gateway is responsible for fan-out from Odoo's own bus

## Revision 2 (2026-09-16) — kitchen_state moves to the order line

The user reviewed a real Odoo quotation form screenshot and corrected the data model:

- `kitchen_state` lives on **`sale.order.line`**, not `sale.order`. A single order can have some lines cooking while others are already served — the board's unit of work is the line, not the whole order.
- Each line card must show a **table number tag**, sourced from the parent order's existing `client_order_ref` field (visible in Odoo's quotation form as "Customer Reference" — repurposed here for table tagging, not created new).
- Outlet **name** and **primary/secondary brand colors** must be fully configurable via `/tenant/config`, never hardcoded — `secondary_color` was added to `TenantConfig` and is now actually applied at runtime (previously only `primary_color` was wired up).
- All UI wording changed from Indonesian to English (the reference screenshots were Indonesian; the product itself is English-first).

Everything else in this document (auth, company/POS scoping, WebSocket realtime, multi-tenant SaaS shape) is unchanged — see `design.md`'s revision note for the resulting API/data-model changes.

## Revision 3 (2026-09-16) — drop Point of Sale, simplify branding to one color

The user simplified scope after reviewing the running app:

- **Point of Sale removed entirely.** The board is scoped by `company_id` only — no POS selector, no POS concept anywhere in the data model or config screen.
- **Branding simplified to one configurable color** (was primary + secondary). `TenantConfig` is now `{name, logo_url, color}` — all three configurable, none hardcoded.
- **Logo is now actually rendered** (previously only the type field existed) — shown on the login screen and in the app header when `logo_url` is set, falling back to a plain color block when it isn't.
- **New defaults**: outlet name defaults to "FOOM Outlet", brand color defaults to purple (`#9333ea`).

See `design.md`'s revision note for the resulting file-level changes.

## Revision 4 (2026-09-16) — brand color moves out of the API entirely

The user decided color shouldn't be a backend concern at all:

- **`primary_color`/`secondary_color` removed from `/tenant/config`** (and from `TenantConfig` — the single `color` field from Revision 3 is also gone). `/tenant/config` now returns only `name` and `logo_url`.
- **Color is a frontend-only preference.** The browser persists it to `localStorage` — the same pattern as remembering a light/dark theme — set via primary/secondary color pickers added to the Config screen, never fetched from or sent to any endpoint.
- **Back to two colors** (primary + secondary), not one — matching the shape from before Revision 3, but now entirely client-side. Secondary color is visibly wired to the table-number badge on each card so both configured colors are actually used, not just stored.
- **New local defaults**: primary purple (`#9333ea`, unchanged), secondary orange (`#f97316`) — used only until the browser's saved choice hydrates from `localStorage`.

See `design.md`'s revision note for the resulting file-level changes.
