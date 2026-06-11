import { http, HttpResponse } from 'msw'

const API_BASE = 'http://localhost:3000/api/v1'

export const handlers = [
  // Default handlers — override in individual test files via server.use(...)
  http.get(`${API_BASE}/purchase-orders`, () => {
    return HttpResponse.json({ items: [], total: 0, page: 1, limit: 20 })
  }),
]
