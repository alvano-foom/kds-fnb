// Vercel Function. The logic lives in server/handlers.js (shared with server/index.js).
import { handleLocations } from '../../server/handlers.js'

export function GET(request) {
  return handleLocations(request, process.env)
}
