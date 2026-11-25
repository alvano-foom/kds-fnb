// Vercel Function. The logic lives in server/handlers.js (shared with server/index.js).
import { handleStoreStock } from '../server/handlers.js'

export function POST(request) {
  return handleStoreStock(request, process.env)
}
