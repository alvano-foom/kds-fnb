/**
 * @typedef {Object} BomComponent
 * @property {string} product_id
 * @property {string} name
 * @property {string} uom
 * @property {number} qty            Amount needed per `output_qty` of finished product.
 * @property {number} [available_qty] On-hand/free qty in the kitchen's warehouse, when the backend knows it.
 *
 * @typedef {Object} BomPreview
 * @property {string} bom_id
 * @property {string} [bom_code]
 * @property {string} product_id
 * @property {string} product_name
 * @property {string} uom
 * @property {number} output_qty     How much finished product one run of the BoM yields (Odoo's `product_qty`) — component `qty` values are per this much.
 * @property {BomComponent[]} components
 */

const DECIMALS = 3

/** Rounds away binary-float noise (0.1 * 3 → 0.30000000000000004) without hiding genuinely small quantities. */
function round(n) {
  const factor = 10 ** DECIMALS
  return Math.round((n + Number.EPSILON) * factor) / factor
}

/**
 * How much of one component a run of `qty` finished units will consume:
 * `component.qty / bom.output_qty * qty`. The backend sends the BoM line
 * exactly as Odoo stores it (per `output_qty`), so scaling is the
 * frontend's job — which also means it follows the qty field live with
 * no refetch.
 * @param {BomComponent} component
 * @param {number} outputQty
 * @param {number} qty
 */
export function consumedQty(component, outputQty, qty) {
  const perRun = Number(outputQty) > 0 ? Number(outputQty) : 1
  return round((Number(component.qty) / perRun) * Number(qty))
}

/** True when the kitchen doesn't have enough of this component on hand for the requested run — a hint only, the backend stays the authority (see done_failed). */
export function isShort(component, outputQty, qty) {
  if (component.available_qty == null) return false
  return consumedQty(component, outputQty, qty) > Number(component.available_qty)
}

/** Whole-number progress for the checklist header, e.g. { done: 2, total: 5, percent: 40 }. An empty list counts as complete — there is nothing to check. */
export function checklistProgress(total, done) {
  if (total === 0) return { done: 0, total: 0, percent: 100 }
  return { done, total, percent: Math.round((done / total) * 100) }
}
