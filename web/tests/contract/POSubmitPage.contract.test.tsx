import { http, HttpResponse } from 'msw'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { server } from '../mocks/server'
import { renderWithProviders } from '../test-utils'
import { POSubmitPage } from '../../src/pages/buyer/POSubmitPage'

const API_BASE = 'http://localhost:3000/api/v1'

function makePO(totalCents: number) {
  return {
    id: 'po-001',
    poNumber: 'PO-2026-001',
    status: 'DRAFT',
    buyerId: 'test-buyer-001',
    branchId: 'branch-001',
    supplierId: 'supplier-001',
    expectedDeliveryDate: null,
    totalCents,
    notes: null,
    lockedBy: null,
    lockedAt: null,
    approvalDeadline: null,
    createdAt: '2026-06-10T10:00:00Z',
    updatedAt: '2026-06-10T10:00:00Z',
    submittedAt: null,
    approvedAt: null,
    fulfilledAt: null,
    lineItems: [
      {
        id: 'li-001',
        purchaseOrderId: 'po-001',
        lineNumber: 1,
        productId: 'prod-001',
        productName: 'Test Item',
        quantity: 1,
        unitPriceCents: totalCents,
        extendedPriceCents: totalCents,
      },
    ],
    statusHistory: [],
  }
}

describe('POSubmitPage', () => {
  it('blocks submit when delivery date is empty', async () => {
    server.use(
      http.get(`${API_BASE}/purchase-orders/po-001`, () => HttpResponse.json(makePO(50000))),
    )
    renderWithProviders(<POSubmitPage />, { path: '/buyer/po/po-001/submit', routePattern: '/buyer/po/:poId/submit' })
    await waitFor(() => expect(screen.getByRole('button', { name: /confirm submit/i })).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /confirm submit/i })).toBeDisabled()
  })

  it('enables submit button when delivery date is set', async () => {
    server.use(
      http.get(`${API_BASE}/purchase-orders/po-001`, () => HttpResponse.json(makePO(50000))),
    )
    renderWithProviders(<POSubmitPage />, { path: '/buyer/po/po-001/submit', routePattern: '/buyer/po/:poId/submit' })
    await waitFor(() => screen.getByLabelText(/expected delivery date/i))
    await userEvent.type(screen.getByLabelText(/expected delivery date/i), '2027-01-15')
    expect(screen.getByRole('button', { name: /confirm submit/i })).not.toBeDisabled()
  })

  it('shows approval threshold notice when total >= $10,000', async () => {
    server.use(
      http.get(`${API_BASE}/purchase-orders/po-001`, () => HttpResponse.json(makePO(1_000_000))),
    )
    renderWithProviders(<POSubmitPage />, { path: '/buyer/po/po-001/submit', routePattern: '/buyer/po/:poId/submit' })
    await waitFor(() => expect(screen.getByText(/requires.*approval/i)).toBeInTheDocument())
  })

  it('does NOT show approval notice when total < $10,000', async () => {
    server.use(
      http.get(`${API_BASE}/purchase-orders/po-001`, () => HttpResponse.json(makePO(999_999))),
    )
    renderWithProviders(<POSubmitPage />, { path: '/buyer/po/po-001/submit', routePattern: '/buyer/po/:poId/submit' })
    await waitFor(() => screen.getByRole('button', { name: /confirm submit/i }))
    expect(screen.queryByText(/requires.*approval/i)).not.toBeInTheDocument()
  })

  it('calls submit API and navigates on success', async () => {
    let submitted = false
    const submittedPO = { ...makePO(50000), status: 'SUBMITTED' }
    server.use(
      http.get(`${API_BASE}/purchase-orders/po-001`, () => HttpResponse.json(makePO(50000))),
      http.post(`${API_BASE}/purchase-orders/po-001/submit`, () => {
        submitted = true
        return HttpResponse.json(submittedPO)
      }),
    )
    renderWithProviders(<POSubmitPage />, { path: '/buyer/po/po-001/submit', routePattern: '/buyer/po/:poId/submit' })
    await waitFor(() => screen.getByLabelText(/expected delivery date/i))
    await userEvent.type(screen.getByLabelText(/expected delivery date/i), '2027-01-15')
    await userEvent.click(screen.getByRole('button', { name: /confirm submit/i }))
    await waitFor(() => expect(submitted).toBe(true))
  })
})
