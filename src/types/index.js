/**
 * Shared shape definitions, kept as JSDoc typedefs so plain .jsx files get
 * editor autocomplete without introducing TypeScript build tooling.
 */

/** @typedef {'pending'|'cooking'|'ready'|'served'} KitchenState */

/**
 * @typedef {Object} User
 * @property {string} id
 * @property {string} email
 * @property {string} name
 */

/**
 * @typedef {Object} Company
 * @property {string} id
 * @property {string} name
 * @property {string} [logo_url]
 */

/**
 * Kitchen state lives on the sale order LINE, not the order — a single
 * order can have some lines still cooking while others are already
 * served. One board card = one order line. `table_number` is the
 * parent sale.order's `client_order_ref` field, used as a table tag.
 *
 * @typedef {Object} OrderLineCard
 * @property {string} id             // sale.order.line id
 * @property {string} order_id
 * @property {string} order_name     // e.g. "SO0231"
 * @property {string} [table_number] // sale.order.client_order_ref
 * @property {string} [customer_name]
 * @property {string} product_name
 * @property {number} qty
 * @property {string} [note]
 * @property {KitchenState} kitchen_state
 * @property {string} created_at // ISO timestamp
 * @property {string} updated_at // ISO timestamp
 */

/**
 * Configurable per outlet — never hardcoded in the frontend, both come
 * from GET /tenant/config.
 *
 * @typedef {Object} TenantConfig
 * @property {string} name       // outlet/store name, e.g. "FOOM Outlet"
 * @property {string} [logo_url] // shown on login + header when present
 */

/**
 * Brand colors are NOT part of TenantConfig / the API — this is a
 * frontend-only preference persisted to localStorage (see
 * src/store/themeStore.js), the same way a browser remembers a light/dark
 * theme choice.
 *
 * @typedef {Object} ThemeColors
 * @property {string} primaryColor   // hex, e.g. "#9333ea"
 * @property {string} secondaryColor // hex, e.g. "#f97316"
 */

export const KITCHEN_STATES = /** @type {const} */ (['pending', 'cooking', 'ready', 'served'])

export const KITCHEN_STATE_LABELS = {
  pending: 'Pending',
  cooking: 'Cooking',
  ready: 'Ready',
  served: 'Served',
}
