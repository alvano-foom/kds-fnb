# Kitchen Display System (KDS)

Multi-tenant kitchen display for Odoo 18 `sale.order.line`s: log in, pick a company, and manage order lines on a 4-column Kanban board (Pending → Cooking → Ready → Served) with drag-and-drop and realtime updates. Kitchen state lives on the order **line**, not the whole order, so one order can straddle several columns at once. Each card is tagged with a table number (the order's `client_order_ref`). Outlet name and logo come from `/tenant/config` — nothing is hardcoded. Brand color (primary + secondary) is a **frontend-only** setting: pick it on the Config screen and the browser remembers it in `localStorage`, the same way it'd remember a light/dark theme — it's never sent to or fetched from the API.

Built with React 19, Vite, Tailwind CSS 4, `@dnd-kit`, TanStack Query, Zustand, and mocked end-to-end with MSW so the whole app runs with **zero backend**.

## Quick start

```bash
npm install
npm run dev
```

Open the printed localhost URL and sign in with the seeded demo account:

- **Email:** `staff@kawahputih.test`
- **Password:** `password123`

This user has access to two companies (`Kawah Putih`, `Ciwidey Valley`) — a third, `Not Mine Corp`, exists in the fixtures specifically to prove the company list is scoped to the user, not a hardcoded dropdown. The board seeds ~8 orders (some with multiple lines split across different kitchen states) across all four columns, and a fake WebSocket nudges a random line forward every few seconds so realtime updates are visible without touching anything.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server (mocks on by default) |
| `npm run build` | Production build |
| `npm run test` | Run the Vitest suite once |
| `npm run test:watch` | Run tests in watch mode |
| `npm run lint` | Oxlint |

## Project layout (atomic design)

```
src/
  main.jsx, App.jsx, queryClient.js   Entry (starts MSW when VITE_USE_MOCKS=true), providers, React Query client
  routes/         AppRouter + route guards (auth → company → open kitchen session)
  components/
    atoms/        Button, Input, Badge, Spinner, StatusDot (pure, no data)
    molecules/    FormField, Select, ConnectionStatus, OrderMeta, BomChecklist, ShiftTaskList (presentational)
    organisms/    Data-connected blocks: LoginForm, KanbanBoard, OrderCard, ProductionForm, PrinterConfig, ...
    templates/    AppShell, AuthLayout, TenantShell (outlet-branded header + Log out)
  pages/          One per route; compose templates + organisms
  api/            client.js (apiFetch, deduped silent refresh) + one file per backend area
  hooks/          React Query hooks wrapping api/
  store/          Zustand stores (auth, company, kitchen session, printer, theme, TTS, ...)
  lib/            Pure logic: order grouping, BoM, shifts, ESC/POS printing, speech
  ws/             WebSocket client (reconnect/backoff + polling fallback)
  types/          JSDoc typedefs + kitchen state constants
  mocks/          MSW handlers, fixtures, fake websocket
  test/           Vitest setup + MSW server
```

Rules: atoms and molecules take props only (no stores, hooks or API calls); anything that reads a store or query is an organism. Imports from the same folder are relative (`./Button`); everything else uses the `@/` alias. Tests sit next to the file they test.

Tests read `.env.test`, so they always run against the MSW mocks regardless of what `.env` points at.

```
docs/
  api-contract.md      Start here — the contract for the backend team
  openapi.yaml         Formal OpenAPI 3.1 spec
  websocket-events.md   Realtime event schema
.spec/features/kitchen-display-system/
  requirements.md, design.md, tasks.md   The spec this was built from
```

## Cutting over to the real backend

Everything talks to the contract in [`docs/api-contract.md`](./docs/api-contract.md), mocked in the browser by MSW. Once the backend team ships it, change two lines in `.env` — nothing else:

```bash
VITE_API_BASE_URL=https://your-real-api.example.com
VITE_WS_URL=wss://your-real-ws-gateway.example.com/ws
VITE_USE_MOCKS=false
```

If a response shape ever needs to differ from the contract, update `docs/openapi.yaml` first, then the matching function in `src/api/`, so the contract, the mocks, and reality never drift apart.

### Warehouse, location and Store Connect

Settings asks for company, warehouse and location before any kitchen screen opens. The Order Board's stock check (`/api/kds/stock/check`) reads stock from that location only; Odoo rejects it without `location_id`. Warehouses and locations come from `foom_wms_api` (`/api/wms/v1`); after each prep (manufacturing order done) the product's on-hand at that location is pushed to Store Connect's KDM stock webhook. Failures land in the Error Log.

Both upstreams need secrets, so the browser never calls them. It calls this app's own backend instead, which holds the secrets:

| Route | Does |
|---|---|
| `GET /api/wms/warehouses?company_id=` | Checks the user's KDS login + company access with Odoo, then lists warehouses with the WMS key |
| `GET /api/wms/locations?company_id=&warehouse_id=` | Same, for internal locations |
| `POST /api/store-stock` `{company_id, warehouse_id, location_id, barcode}` | Reads on-hand from Odoo as the user (the browser never sends the qty), then pushes it to Store Connect with the secret, retrying 5xx |

The logic is in `server/handlers.js` (plain `Request -> Response`), with one adapter per place it runs:

| Where | How |
|---|---|
| `npm run dev`, `dev:staging`, `preview` | Vite middleware (`vite.config.js`), env from `.env.local` / `.env.[mode].local` |
| Vercel | `api/` functions; set env in the Vercel project settings |
| Your own server | `npm run build:staging && npm start` (`server/index.js` serves `dist/` + `/api`, `PORT` default 3000); env from the process, e.g. `node --env-file=.env.server server/index.js` |

### Server-side env

No `VITE_` prefix, so Vite never puts them in the bundle:

```bash
WMS_API_KEY=<odoo user api key with a WMS role>
STORE_CONNECT_URL=https://<store-connect-host>   # empty = sync off
STORE_CONNECT_SECRET=<KDM_WEBHOOK_SECRET>
# optional
KDS_API_BASE_URL=https://<odoo-domain>/api/kds   # defaults to VITE_API_BASE_URL
WMS_API_URL=https://<odoo-domain>/api/wms/v1     # defaults to the KDS API host + /api/wms/v1
```

On your own server, the `VITE_` values (`VITE_API_BASE_URL`, `VITE_WS_URL`, `VITE_USE_MOCKS`) are still needed at build time, and `KDS_API_BASE_URL` is needed at run time unless `VITE_API_BASE_URL` is also in the process env.

## What's out of scope here

This repo is the frontend only. `docs/api-contract.md` spells out exactly what the backend team needs to build (a `kitchen_state` field on `sale.order`, the JWT auth endpoints, and a small WebSocket gateway in front of Odoo's bus) — none of that is implemented in this repo.
