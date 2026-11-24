/** Shared JSDoc typedefs (editor autocomplete without TypeScript). */

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
 * One sale.order.line; kitchen state lives on the line, not the order.
 *
 * @typedef {Object} OrderLineCard
 * @property {string} id             // sale.order.line id
 * @property {string} order_id
 * @property {string} order_name     // e.g. "SO0231"
 * @property {string} [table_number] // sale.order.client_order_ref
 * @property {string} [customer_name]
 * @property {string} product_name
 * @property {string} [product_id]   // used for /stock/check when barcode is missing
 * @property {string} [barcode]      // product barcode, sent to /stock/check
 * @property {number} qty
 * @property {string} [note]
 * @property {KitchenState} kitchen_state
 * @property {string} created_at // ISO timestamp
 * @property {string} updated_at // ISO timestamp
 */

/**
 * From GET /tenant/config.
 *
 * @typedef {Object} TenantConfig
 * @property {string} name       // outlet/store name, e.g. "FOOM Outlet"
 * @property {string} [logo_url] // shown on login + header when present
 */

/**
 * Frontend-only, persisted in localStorage (themeStore).
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
