/**
 * @typedef {Object} BomComponent
 * @property {string} product_id
 * @property {string} [barcode]
 * @property {string} name
 * @property {string} uom
 * @property {number} qty_per_bom     Amount per one batch (`bom_qty`) of finished product.
 * @property {number} required_qty    What will actually be consumed for the requested qty (server-computed with Odoo's bom.explode, so it matches the MO exactly).
 * @property {number|null} available_qty  Free qty in the warehouse/location, in this line's UoM; null for non-storable products.
 * @property {number} shortage_qty    How much is missing for the requested qty (0 when enough). A hint only — never blocks.
 * @property {boolean} ok
 *
 * @typedef {Object} BomPreview
 * @property {string} bom_id
 * @property {string} [bom_code]
 * @property {string} product_id
 * @property {string} product_name
 * @property {number} bom_qty         Batch size the BoM is defined for.
 * @property {string} bom_uom
 * @property {number} qty             The qty this preview was computed for.
 * @property {string} uom
 * @property {boolean} ok             false when any component is short.
 * @property {BomComponent[]} components
 */

/** Whole-number progress for the checklist header, e.g. { done: 2, total: 5, percent: 40 }. An empty list counts as complete — there is nothing to check. */
export function checklistProgress(total, done) {
  if (total === 0) return { done: 0, total: 0, percent: 100 }
  return { done, total, percent: Math.round((done / total) * 100) }
}
