import { http, HttpResponse } from 'msw'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { server } from '../mocks/server'
import { renderWithProviders, DEFAULT_USER } from '../test-utils'
import { SupplierPOListPage } from '../../src/pages/supplier/SupplierPOListPage'

const API_BASE = 'http://localhost:3000/api/v1'

const SUPPLIER_USER = {
  ...DEFAULT_USER,
  user: { userId: 'test-supplier-001', role: 'SUPPLIER' as const, displayName: 'Test Supplier', email: 'supplier@test.local' },
}

function makePO(status: string, id = 'po-001') {
  return {
    id,
    poNumber: `PO-2026-${id}`,
    status,
    buyerId: 'buyer-001',
    branchId: 'branch-001',
    supplierId: 'supplier-001',
    expectedDeliveryDate: null,
    totalCents: 50_000,
    notes: null,
    lockedBy: null,
    lockedAt: null,
    approvalDeadline: null,
    createdAt: '2026-06-10T10:00:00Z',
    updatedAt: '2026-06-10T10:00:00Z',
    submittedAt: '2026-06-10T10:00:00Z',
    approvedAt: null,
    fulfilledAt: null,
    lineItems: [],
    statusHistory: [],
  }
}

describe('SupplierPOListPage', () => {
  it('renders non-DRAFT POs for the supplier', async () => {
    server.use(
      http.get(`${API_BASE}/purchase-orders`, () =>
        HttpResponse.json({ items: [makePO('SUBMITTED')], total: 1, page: 1, limit: 20 }),
      ),
    )
    renderWithProviders(<SupplierPOListPage />, { user: SUPPLIER_USER })
    await waitFor(() => expect(screen.getByText('PO-2026-po-001')).toBeInTheDocument())
    expect(screen.getByText('Submitted', { selector: 'span' })).toBeInTheDocument()
  })

  it('shows Fulfill button only for SUBMITTED and APPROVED rows', async () => {
    server.use(
      http.get(`${API_BASE}/purchase-orders`, () =>
        HttpResponse.json({
          items: [makePO('SUBMITTED', 'po-001'), makePO('APPROVED', 'po-002')],
          total: 2, page: 1, limit: 20,
        }),
      ),
    )
    renderWithProviders(<SupplierPOListPage />, { user: SUPPLIER_USER })
    await waitFor(() => screen.getByText('PO-2026-po-001'))
    const fulfillButtons = screen.getAllByRole('button', { name: /fulfill/i })
    expect(fulfillButtons).toHaveLength(2)
  })

  it('does NOT show Fulfill button on FULFILLED or CANCELLED rows', async () => {
    server.use(
      http.get(`${API_BASE}/purchase-orders`, () =>
        HttpResponse.json({
          items: [makePO('FULFILLED', 'po-001'), makePO('CANCELLED', 'po-002')],
          total: 2, page: 1, limit: 20,
        }),
      ),
    )
    renderWithProviders(<SupplierPOListPage />, { user: SUPPLIER_USER })
    await waitFor(() => screen.getByText('PO-2026-po-001'))
    expect(screen.queryByRole('button', { name: /fulfill/i })).not.toBeInTheDocument()
  })

  it('Fulfill button opens confirmation modal', async () => {
    server.use(
      http.get(`${API_BASE}/purchase-orders`, () =>
        HttpResponse.json({ items: [makePO('SUBMITTED')], total: 1, page: 1, limit: 20 }),
      ),
    )
    renderWithProviders(<SupplierPOListPage />, { user: SUPPLIER_USER })
    await waitFor(() => screen.getByRole('button', { name: /fulfill/i }))
    await userEvent.click(screen.getByRole('button', { name: /fulfill/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
