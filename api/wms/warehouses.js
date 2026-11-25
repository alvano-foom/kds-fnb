// Vercel Function. The logic lives in server/handlers.js (shared with server/index.js).
import { handleWarehouses } from '../../server/handlers.js'

export function GET(request) {
  return handleWarehouses(request, process.env)
}
