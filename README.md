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
  components/
    atoms/        Button, Input, Badge, Spinner, StatusDot
    molecules/     FormField, Select, ConnectionStatus, OrderMeta
    organisms/       LoginForm, ConfigForm, KanbanBoard, KanbanColumn, OrderCard
    templates/         AuthLayout, AppShell
  pages/          LoginPage, ConfigPage, BoardPage
  api/            REST client + endpoint functions, api/mocks/ = MSW handlers + fixtures
  ws/             WebSocket client (reconnect/backoff + polling fallback)
  store/          Zustand: auth tokens, selected company, and the local (non-API) theme color
  hooks/          React Query hooks wrapping the api/ layer
  types/          JSDoc typedefs shared across the app
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

## What's out of scope here

This repo is the frontend only. `docs/api-contract.md` spells out exactly what the backend team needs to build (a `kitchen_state` field on `sale.order`, the JWT auth endpoints, and a small WebSocket gateway in front of Odoo's bus) — none of that is implemented in this repo.
