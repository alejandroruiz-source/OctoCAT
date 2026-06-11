import { http, HttpResponse } from 'msw'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { server } from '../mocks/server'
import { renderWithProviders } from '../test-utils'
import { POListPage } from '../../src/pages/buyer/POListPage'

const API_BASE = 'http://localhost:3000/api/v1'

const SAMPLE_PO = {
  id: 'po-001',
  poNumber: 'PO-2026-001',
  status: 'DRAFT',
  buyerId: 'test-buyer-001',
  branchId: 'branch-001',
  supplierId: 'supplier-001',
  expectedDeliveryDate: null,
  totalCents: 25000,
  notes: null,
  lockedBy: null,
  lockedAt: null,
  approvalDeadline: null,
  createdAt: '2026-06-10T10:00:00Z',
  updatedAt: '2026-06-10T10:00:00Z',
  submittedAt: null,
  approvedAt: null,
  fulfilledAt: null,
}

describe('POListPage', () => {
  it('renders "No purchase orders" when API returns empty list', async () => {
    server.use(
      http.get(`${API_BASE}/purchase-orders`, () =>
        HttpResponse.json({ items: [], total: 0, page: 1, limit: 20 }),
      ),
    )
    renderWithProviders(<POListPage />)
    await waitFor(() => expect(screen.getByText(/no purchase orders/i)).toBeInTheDocument())
  })

  it('renders PO rows with status badge, PO number, and total', async () => {
    server.use(
      http.get(`${API_BASE}/purchase-orders`, () =>
        HttpResponse.json({ items: [SAMPLE_PO], total: 1, page: 1, limit: 20 }),
      ),
    )
    renderWithProviders(<POListPage />)
    await waitFor(() => expect(screen.getByText('PO-2026-001')).toBeInTheDocument())
    // Badge renders as a <span>; use selector to avoid matching the status filter <option>
    expect(screen.getByText('Draft', { selector: 'span' })).toBeInTheDocument()
    expect(screen.getByText('$250.00')).toBeInTheDocument()
  })

  it('shows "New Purchase Order" button', async () => {
    server.use(
      http.get(`${API_BASE}/purchase-orders`, () =>
        HttpResponse.json({ items: [], total: 0, page: 1, limit: 20 }),
      ),
    )
    renderWithProviders(<POListPage />)
    await waitFor(() => expect(screen.getByRole('button', { name: /new purchase order/i })).toBeInTheDocument())
  })

  it('shows pagination controls when total > limit', async () => {
    const items = Array.from({ length: 20 }, (_, i) => ({
      ...SAMPLE_PO,
      id: `po-${i}`,
      poNumber: `PO-2026-${String(i).padStart(3, '0')}`,
    }))
    server.use(
      http.get(`${API_BASE}/purchase-orders`, () =>
        HttpResponse.json({ items, total: 50, page: 1, limit: 20 }),
      ),
    )
    renderWithProviders(<POListPage />)
    await waitFor(() => expect(screen.getByText(/page/i)).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument()
  })

  it('shows error banner when API returns 500', async () => {
    server.use(
      http.get(`${API_BASE}/purchase-orders`, () =>
        HttpResponse.json({ error: 'INTERNAL_ERROR', message: 'Server error' }, { status: 500 }),
      ),
    )
    renderWithProviders(<POListPage />)
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
  })

  it('re-queries when status filter changes', async () => {
    const requests: string[] = []
    server.use(
      http.get(`${API_BASE}/purchase-orders`, ({ request }) => {
        requests.push(request.url)
        return HttpResponse.json({ items: [], total: 0, page: 1, limit: 20 })
      }),
    )
    renderWithProviders(<POListPage />)
    await waitFor(() => expect(requests).toHaveLength(1))
    const select = screen.getByRole('combobox', { name: /status/i })
    await userEvent.selectOptions(select, 'SUBMITTED')
    await waitFor(() => expect(requests).toHaveLength(2))
    expect(requests[1]).toContain('status')
  })
})
