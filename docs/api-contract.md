# KDS API Contract — for the backend team

This is the contract the frontend is built and mocked against (see
`src/api/mocks/`, which implements every endpoint below in-browser with MSW).
Once the real API exists, the frontend changes **two environment variables**
(`VITE_API_BASE_URL`, `VITE_WS_URL` in `.env`) and nothing else.

Formal spec: [`openapi.yaml`](./openapi.yaml) (import into Postman/Swagger UI).
Realtime spec: [`websocket-events.md`](./websocket-events.md).

> **v4 change:** brand color is out of the API entirely. `/tenant/config`
> now returns only `name` and `logo_url` — color (primary + secondary) is
> a frontend-only setting the browser stores in `localStorage`, picked on
> the Config screen, same way a browser remembers a light/dark theme. The
> backend does not need to store, validate, or serve color in any form.
>
> **v3 change:** Point of Sale scoping is gone — the board is scoped by
> `company_id` only. Tenant branding collapsed to one `color` field (was
> primary/secondary) — that field is now removed too, see v4 above.
>
> **v2 change:** kitchen state lives on `sale.order.line`, not `sale.order`.
> An order can have some lines cooking while others are already served, so
> the board's unit of work — and the API's — is the order **line**, not the
> whole order. Each line is tagged with a table number taken from its
> parent order's `client_order_ref`.

## Endpoints at a glance

| Method | Path                          | Auth | Purpose |
|--------|-------------------------------|------|---------|
| POST   | `/auth/login`                 | no   | email+password → JWT access+refresh pair |
| POST   | `/auth/refresh`               | no   | refresh_token → new pair |
| POST   | `/auth/logout`                | yes  | revoke a refresh_token |
| GET    | `/tenant/config`               | no   | public branding — outlet name and logo, both configurable (color is frontend-only, not in this response) |
| GET    | `/companies`                   | yes  | companies the logged-in user may access |
| GET    | `/order-lines`                 | yes  | open order lines for `?company_id`, optional `?since=` |
| PATCH  | `/order-lines/{id}/state`      | yes  | set `kitchen_state` on one line, drives the drag-and-drop |

All authenticated requests send `Authorization: Bearer <access_token>`.
Errors are `{ "error": { "code": "...", "message": "..." } }`.

## The `OrderLineCard` shape

`GET /order-lines` and every WebSocket order-line event return this same
flat shape — one entry per `sale.order.line`, pre-joined with the fields
the board needs from its parent `sale.order`:

```json
{
  "id": "l4",
  "order_id": "so3",
  "order_name": "SO0229",
  "table_number": "12",
  "customer_name": "Claire",
  "product_name": "Chicken Satay",
  "qty": 3,
  "kitchen_state": "cooking",
  "created_at": "2026-09-16T09:00:00Z",
  "updated_at": "2026-09-16T09:06:00Z"
}
```

`table_number` is `sale.order.client_order_ref` — an existing generic text
field on the order, repurposed here to tag which table a line belongs to.
The frontend does not compute or validate it; whatever's in `client_order_ref` is shown as-is.

## Backend work this implies (out of scope for this repo, flagged for sign-off)

1. **New `kitchen_state` field on `sale.order.line`** — selection `pending | cooking | ready | served`, default `pending`. A small Odoo 18 addon.
2. **`GET /order-lines` should query `sale.order.line` directly**, joined to `sale.order` for `company_id`, `client_order_ref`, `name`, and customer — not fetch whole orders and flatten client-side. No Point of Sale filtering — company is the only scope.
3. **JWT auth endpoints** — custom, not Odoo's native session cookie (decided with the product owner: SPA-friendly, works cross-origin for the multi-tenant setup). Access token short-lived (suggest 15 min), refresh token longer-lived and revocable.
4. **Company scoping** — `GET /companies` must filter by `res.users.company_ids` for the authenticated user server-side. Every other endpoint that takes a `company_id` must re-check that ID is in that same set — never trust it just because the frontend only shows allowed companies in its UI.
5. **`GET /order-lines` "open" filter** — needs a decision on which lines/orders count as "open" for kitchen purposes. Frontend does not filter this client-side; whatever the endpoint returns is shown.
6. **State-transition validation** — the frontend lets a line be dropped on any of the 4 columns; if certain transitions should be blocked (e.g. `served → pending`), enforce that server-side and return `409` with a message — the frontend already handles `409` by rolling back the card with a toast.
7. **WebSocket gateway** — Odoo 18 doesn't speak WebSocket natively (it uses `bus.bus` long-polling). A small gateway service is needed that listens to Odoo's bus (or is triggered directly by writes to `sale.order.line.kitchen_state` / new lines) and fans out `order_line.created` / `order_line.updated` / `order_line.removed` to connected clients scoped by `company_id`. Full event contract in `websocket-events.md`.
8. **`/tenant/config`** — needs a way to resolve "which tenant" from the request (subdomain, header, or query param — backend's choice, frontend just calls the endpoint with whatever the deployment convention is and renders what comes back). This is also where the outlet **name** and **logo** come from — the frontend has no hardcoded outlet name or logo anywhere; whatever this endpoint returns is what's shown. **Brand color is intentionally not part of this endpoint** — it's a frontend-only setting stored in the browser's `localStorage` (picked via color inputs on the Config screen), so there is nothing for the backend to build for color.

## Local development without the backend

```bash
npm install
npm run dev        # VITE_USE_MOCKS=true by default — MSW intercepts every call above
```

`src/api/mocks/fixtures.js` seeds 2 companies and ~8 orders (several with multiple lines split across different kitchen states) spread across all 4 columns, plus a fake WebSocket (`src/api/mocks/wsMock.js`) that emits a random `order_line.updated`/`order_line.created` every few seconds so the realtime behavior is visible without any backend running.

## Cutting over to the real backend

```bash
# .env
VITE_API_BASE_URL=https://kds-api.yourdomain.com
VITE_WS_URL=wss://kds-ws.yourdomain.com/ws
VITE_USE_MOCKS=false
```

No code changes required if the backend matches this contract. If a field name or status code needs to differ, update `openapi.yaml` first, then the two files it mirrors (`src/api/*.js` request/response mapping) so mocks, docs, and real calls never drift apart.
