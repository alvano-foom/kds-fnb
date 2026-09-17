// Kitchen ticket printing — one small popup window per card, styled for a
// narrow receipt-printer width, using the browser's own print dialog.
// No PDF library needed: window.print() on a purpose-built document does
// the job a kitchen printer actually needs.

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
}

/** @param {import('../types').OrderLineCard} card */
export function printReceipt(card) {
  const win = window.open('', '_blank', 'width=380,height=600')
  if (!win) return false // popup blocked — nothing more we can do here

  const printedAt = new Date().toLocaleString()
  win.document.write(`<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeHtml(card.order_name)} ticket</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Courier New', Courier, monospace; width: 280px; margin: 0 auto; padding: 16px 12px; color: #000; }
  h1 { font-size: 18px; text-align: center; margin: 0 0 2px; letter-spacing: 0.02em; }
  .table { text-align: center; font-size: 15px; margin-bottom: 10px; }
  hr { border: none; border-top: 1px dashed #000; margin: 10px 0; }
  .line { display: flex; justify-content: space-between; gap: 12px; font-size: 15px; margin: 6px 0; }
  .qty { font-weight: bold; white-space: nowrap; }
  .meta { font-size: 11px; color: #333; margin-top: 4px; }
  @media print { body { padding: 4px; } }
</style>
</head>
<body>
  <h1>${escapeHtml(card.order_name)}</h1>
  <div class="table">TABLE ${escapeHtml(card.table_number ?? '-')}</div>
  <hr />
  <div class="line"><span class="qty">${escapeHtml(card.qty)}×</span><span>${escapeHtml(card.product_name)}</span></div>
  ${card.note ? `<div class="meta">Note: ${escapeHtml(card.note)}</div>` : ''}
  <hr />
  <div class="meta">Customer: ${escapeHtml(card.customer_name ?? '-')}</div>
  <div class="meta">Status: ${escapeHtml(card.kitchen_state)}</div>
  <div class="meta">Printed: ${escapeHtml(printedAt)}</div>
</body>
</html>`)
  win.document.close()
  win.onafterprint = () => win.close()
  // A brief delay lets the popup finish laying out the document before the
  // print dialog opens — calling print() synchronously right after
  // document.close() is unreliable in some browsers.
  setTimeout(() => {
    win.focus()
    win.print()
  }, 150)
  return true
}
