# Kitchen Display System (KDS) — Tasks

- [x] 1. Scaffold Vite + React + Tailwind project, base tooling
      - Files: `package.json`, `vite.config.js`, `tailwind.config.js`, `postcss.config.js`, `index.html`, `src/main.jsx`, `src/App.jsx`, `.env.example`, `.gitignore`
      - Covers: frontend scope (stack)
      - Done when: `npm run dev` serves a blank app

- [x] 2. Atomic design folder skeleton + shared types
      - Files: `src/components/{atoms,molecules,organisms,templates}/`, `src/types/index.js` (JSDoc typedefs: Order, Company, Pos, User)
      - Covers: frontend scope (structure)
      - Done when: folders exist with an `index.js` barrel-free export per component (no barrel files — bundle-barrel-imports)

- [x] 3. API contract documents for backend team
      - Files: `docs/api-contract.md`, `docs/openapi.yaml`, `docs/websocket-events.md`
      - Covers: REQ auth/companies/orders/state-update/tenant-config, WS event schema
      - Done when: every frontend API call in tasks 5-9 has a matching documented endpoint

- [x] 4. Mock layer (MSW) matching the contract exactly
      - Files: `src/api/mocks/fixtures.js`, `src/api/mocks/handlers.js`, `src/api/mocks/browser.js`, wired in `src/main.jsx` behind `VITE_USE_MOCKS`
      - Covers: same endpoints as task 3
      - Done when: app runs fully offline against mocks, seeded with 2 tenants, 3 POS, ~8 orders spread across the 4 states

- [x] 5. Auth: login page + token store
      - Files: `src/store/authStore.js`, `src/api/auth.js`, `src/hooks/useAuth.js`, `src/components/organisms/LoginForm.jsx`, `src/pages/LoginPage.jsx`
      - Covers: login/logout/refresh acceptance criteria
      - Done when: valid mock creds route to `/config`, invalid creds show one generic error, token refresh is exercised by a short mock token TTL

- [x] 6. Company/POS config: cascading selects + persistence
      - Files: `src/api/companies.js`, `src/hooks/useCompanies.js`, `src/hooks/usePointsOfSale.js`, `src/store/tenantStore.js`, `src/components/organisms/ConfigForm.jsx`, `src/pages/ConfigPage.jsx`
      - Covers: company/POS acceptance criteria
      - Done when: only the mock user's companies list, POS list depends on chosen company, saved config restores on reload

- [x] 7. Kanban board: columns, cards, DnD
      - Files: `src/api/orders.js`, `src/hooks/useOrders.js`, `src/hooks/useUpdateOrderState.js`, `src/components/organisms/{KanbanBoard,KanbanColumn,OrderCard}.jsx`, `src/pages/BoardPage.jsx`
      - Covers: board load + drag-to-update acceptance criteria
      - Done when: dragging a card between all 4 columns updates it optimistically and persists (against mocks), with rollback on a forced-error mock order

- [x] 8. WebSocket client + realtime board updates
      - Files: `src/ws/kitchenSocket.js`, `src/ws/useKitchenSocket.js`, `src/components/molecules/ConnectionStatus.jsx`, mock WS server in `src/api/mocks/wsMock.js`
      - Covers: realtime + fallback acceptance criteria
      - Done when: a simulated mock event moves a card without user action; forcing the mock socket closed flips the board to polling mode and back

- [x] 9. App shell, routing, tenant branding
      - Files: `src/components/templates/AppShell.jsx`, `src/routes/AppRouter.jsx`, `src/api/tenant.js`, `src/hooks/useTenantConfig.js`
      - Covers: multi-tenant branding, logout, route guards (login → config → board)
      - Done when: unauthenticated users are redirected to `/login`, authenticated-but-unconfigured users to `/config`, header shows mock tenant name/logo

- [x] 10. Tests + smoke pass
      - Files: `src/**/*.test.jsx`, `vitest.config.js`
      - Covers: testing strategy in design.md
      - Done when: `npm run test` passes for LoginForm validation, ConfigForm cascade, and one DnD state-change test

- [x] 11. README for the frontend + backend teams
      - Files: `README.md`
      - Covers: how to run against mocks, and the exact two env vars (`VITE_API_BASE_URL`, `VITE_WS_URL`) to flip once the real API exists
      - Done when: a new dev can `npm i && npm run dev` and see a working mocked KDS in under 2 minutes

## Revision 2 tasks (2026-09-16)

- [x] 12. Move kitchen_state to the order line
      - Files: `src/types/index.js`, `src/api/mocks/fixtures.js`, `src/api/mocks/handlers.js`, `src/api/mocks/wsMock.js`, `src/api/orders.js`, `src/hooks/useOrderLines.js` (was `useOrders.js`), `src/hooks/useUpdateLineState.js` (was `useUpdateOrderState.js`), `src/ws/useKitchenSocket.js`, `src/components/organisms/{OrderCard,KanbanColumn,KanbanBoard}.jsx`, `src/pages/BoardPage.jsx`, `docs/*`
      - Covers: revised requirements/design (Revision 2)
      - Done when: a card = one order line, tagged with its table number; two lines of the same order can sit in different columns

- [x] 13. Configurable primary/secondary color + outlet name, wired end-to-end
      - Files: `src/hooks/useApplyBranding.js`, `src/App.jsx`, `src/index.css`, `src/pages/LoginPage.jsx`
      - Covers: revised requirements (Revision 2)
      - Done when: `/tenant/config`'s `primary_color`/`secondary_color` visibly change the header and the drag-over highlight at runtime, and the outlet name (not a hardcoded string) shows on login/config/board

- [x] 14. Translate all UI wording to English
      - Files: all `src/components/**`, `src/pages/**`
      - Covers: revised requirements (Revision 2)
      - Done when: `grep` for Indonesian words across `src/` returns nothing outside sample business/company names

## Revision 3 tasks (2026-09-16)

- [x] 15. Remove Point of Sale scoping entirely
      - Files: `src/types/index.js`, `src/store/tenantStore.js`, `src/api/companies.js`, `src/api/orders.js`, `src/hooks/{useCompanies,useOrderLines,useUpdateLineState}.js`, `src/ws/{kitchenSocket,useKitchenSocket}.js`, `src/api/mocks/{fixtures,handlers,wsMock}.js`, `src/components/organisms/ConfigForm.jsx`, `src/routes/AppRouter.jsx`, `src/pages/BoardPage.jsx`, `docs/*`
      - Covers: Revision 3 requirements
      - Done when: the config screen has no POS field, `/order-lines` and the WebSocket connect with `company_id` only, and no `posId`/`pos_id` reference remains in `src/` or `docs/`

- [x] 16. Single configurable color + rendered logo + new defaults
      - Files: `src/hooks/useApplyBranding.js`, `src/index.css`, `src/components/organisms/KanbanColumn.jsx`, `src/components/templates/{AuthLayout,AppShell}.jsx`, `src/pages/{LoginPage,ConfigPage,BoardPage}.jsx`, `src/api/mocks/fixtures.js`
      - Covers: Revision 3 requirements
      - Done when: `/tenant/config`'s `color` drives the header/highlight at runtime, `logo_url` renders an image when set, and the seeded defaults are "FOOM Outlet" / purple

## Revision 4 tasks (2026-09-16)

- [x] 17. Remove color from the API, move it to a local theme store
      - Files: `src/store/themeStore.js` (new), `src/types/index.js`, `src/api/mocks/fixtures.js`, `src/hooks/useApplyBranding.js`, `src/index.css`, `docs/*`
      - Covers: Revision 4 requirements
      - Done when: `TenantConfig`/`/tenant/config` has no color field anywhere (types, mocks, openapi, contract doc), and `useThemeStore` persists `{primaryColor, secondaryColor}` to `localStorage` under `kds_theme`

- [x] 18. Color-picker UI + secondary color put to use
      - Files: `src/components/organisms/ConfigForm.jsx`, `src/components/organisms/ConfigForm.test.jsx`, `src/components/atoms/Badge.jsx`, `src/components/organisms/OrderCard.jsx`, `src/test/setup.js`
      - Covers: Revision 4 requirements
      - Done when: the Config screen has primary/secondary color pickers that update the board's colors immediately and survive a reload via `localStorage`, and the secondary color is visibly used (table-number badge), not just stored
