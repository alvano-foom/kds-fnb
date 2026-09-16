# Technical Stack

- **Frontend**: React 19 + Vite + Tailwind CSS 4 (`@tailwindcss/vite`, no separate config file), atomic design folders under `src/components/`.
- **Server state**: `@tanstack/react-query` (fetch caching/dedup, optimistic mutations for drag-and-drop).
- **Client state**: `zustand` (+ `persist` middleware) — auth tokens and selected company/POS only; nothing else needed a global store.
- **Drag-and-drop**: `@dnd-kit/core` only (no `/sortable` — columns don't need in-column reordering, just a drop target per state).
- **Routing**: `react-router-dom`.
- **Mocking**: MSW (`msw/browser` in dev, `msw/node` in tests) implementing the exact contract in `docs/api-contract.md`. A hand-rolled `MockKitchenWebSocket` (`src/api/mocks/wsMock.js`) stands in for the realtime gateway.
- **Testing**: Vitest + React Testing Library. No e2e framework in the repo (Playwright was used ad hoc from outside the repo to smoke-test the build; add it properly once there's a real backend to point at).

## Backend (owned elsewhere, contract only)
- Odoo 18, `sale.order.line` extended with a `kitchen_state` field (see `business-rules.md`). `GET /order-lines` returns lines flattened with their parent order's `client_order_ref`/`name`/customer — the frontend never reconstructs a nested order.
- Custom JWT auth (not Odoo's native session cookie) — decided so the SPA works cross-origin across tenants.
- A dedicated WebSocket gateway in front of Odoo's `bus.bus`, since Odoo doesn't speak WebSocket natively.

## Env vars (the only things that change when the real backend ships)
- `VITE_API_BASE_URL`
- `VITE_WS_URL`
- `VITE_USE_MOCKS`
