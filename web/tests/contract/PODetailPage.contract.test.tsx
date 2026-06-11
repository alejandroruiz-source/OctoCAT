import { http, HttpResponse } from 'msw'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { server } from '../mocks/server'
import { renderWithProviders } from '../test-utils'
import { PODetailPage } from '../../src/pages/buyer/PODetailPage'

const API_BASE = 'http://localhost:3000/api/v1'

const LINE_ITEM = {
  id: 'li-001',
  purchaseOrderId: 'po-001',
  lineNumber: 1,
  productId: 'prod-001',
  productName: 'Widgets',
  quantity: 5,
  unitPriceCents: 1000,
  extendedPriceCents: 5000,
}

const STATUS_HISTORY = [
  {
    id: 'hist-001',
    purchaseOrderId: 'po-001',
    fromStatus: null,
    toStatus: 'DRAFT',
    changedById: 'test-buyer-001',
    changedAt: '2026-06-10T10:00:00Z',
    note: null,
  },
]

function makePO(status: string, overrides: Record<string, unknown> = {}) {
  return {
    id: 'po-001',
    poNumber: 'PO-2026-001',
    status,
    buyerId: 'test-buyer-001',
    branchId: 'branch-001',
    supplierId: 'supplier-001',
    expectedDeliveryDate: null,
    totalCents: 5000,
    notes: null,
    lockedBy: null,
    lockedAt: null,
    approvalDeadline: null,
    createdAt: '2026-06-10T10:00:00Z',
    updatedAt: '2026-06-10T10:00:00Z',
    submittedAt: null,
    approvedAt: null,
    fulfilledAt: null,
    lineItems: [LINE_ITEM],
    statusHistory: STATUS_HISTORY,
    ...overrides,
  }
}

function setupPOHandler(po: ReturnType<typeof makePO>) {
  server.use(
    http.get(`${API_BASE}/purchase-orders/po-001`, () => HttpResponse.json(po)),
  )
}

describe('PODetailPage', () => {
  it('shows edit controls and Add Line Item button for DRAFT status', async () => {
    setupPOHandler(makePO('DRAFT'))
    renderWithProviders(<PODetailPage />, { path: '/buyer/po/po-001', routePattern: '/buyer/po/:poId' })
    await waitFor(() => expect(screen.getByText('PO-2026-001')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /add line item/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
  })

  it('hides edit controls for SUBMITTED status', async () => {
    setupPOHandler(makePO('SUBMITTED'))
    renderWithProviders(<PODetailPage />, { path: '/buyer/po/po-001', routePattern: '/buyer/po/:poId' })
    await waitFor(() => expect(screen.getByText('PO-2026-001')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: /add line item/i })).not.toBeInTheDocument()
  })

  it('renders LineItemRow with editable controls for DRAFT', async () => {
    setupPOHandler(makePO('DRAFT'))
    renderWithProviders(<PODetailPage />, { path: '/buyer/po/po-001', routePattern: '/buyer/po/:poId' })
    await waitFor(() => expect(screen.getByText('Widgets')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument()
  })

  it('renders LockWarning when PO is locked by another user', async () => {
    const future = new Date(Date.now() + 20 * 60 * 1000).toISOString()
    setupPOHandler(makePO('DRAFT', { lockedBy: 'other-user-002', lockedAt: future }))
    renderWithProviders(<PODetailPage />, { path: '/buyer/po/po-001', routePattern: '/buyer/po/:poId' })
    await waitFor(() => expect(screen.getByText(/currently locked/i)).toBeInTheDocument())
    expect(screen.getByText(/other-user-002/i)).toBeInTheDocument()
  })

  it('shows Cancel PO confirmation modal when Cancel button clicked', async () => {
    setupPOHandler(makePO('DRAFT'))
    renderWithProviders(<PODetailPage />, { path: '/buyer/po/po-001', routePattern: '/buyer/po/:poId' })
    await waitFor(() => screen.getByRole('button', { name: /cancel/i }))
    await userEvent.click(screen.getByRole('button', { name: /cancel po/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('renders Submit button for DRAFT status', async () => {
    setupPOHandler(makePO('DRAFT'))
    renderWithProviders(<PODetailPage />, { path: '/buyer/po/po-001', routePattern: '/buyer/po/:poId' })
    await waitFor(() => expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument())
  })
})

describe('StatusHistory', () => {
  const HISTORY = [
    {
      id: 'hist-001',
      purchaseOrderId: 'po-001',
      fromStatus: null,
      toStatus: 'DRAFT',
      changedById: 'buyer-001',
      changedAt: '2026-06-10T09:00:00Z',
      note: null,
    },
    {
      id: 'hist-002',
      purchaseOrderId: 'po-001',
      fromStatus: 'DRAFT',
      toStatus: 'SUBMITTED',
      changedById: 'buyer-001',
      changedAt: '2026-06-10T10:00:00Z',
      note: null,
    },
    {
      id: 'hist-003',
      purchaseOrderId: 'po-001',
      fromStatus: 'SUBMITTED',
      toStatus: 'REVISION_REQUIRED',
      changedById: 'approver-001',
      changedAt: '2026-06-10T11:00:00Z',
      note: 'Budget not authorized',
    },
  ]

  it('renders history entries oldest-first', async () => {
    setupPOHandler(makePO('REVISION_REQUIRED', { statusHistory: HISTORY }))
    renderWithProviders(<PODetailPage />, { path: '/buyer/po/po-001', routePattern: '/buyer/po/:poId' })
    await waitFor(() => expect(screen.getAllByText(/buyer-001/).length).toBeGreaterThan(0))
    const actors = screen.getAllByText(/buyer-001|approver-001/)
    expect(actors[0]).toHaveTextContent('buyer-001')
  })

  it('displays note when non-null', async () => {
    // Use SUBMITTED status to avoid the rejection banner also showing the note
    setupPOHandler(makePO('SUBMITTED', { statusHistory: HISTORY }))
    renderWithProviders(<PODetailPage />, { path: '/buyer/po/po-001', routePattern: '/buyer/po/:poId' })
    await waitFor(() => expect(screen.getByText('Budget not authorized')).toBeInTheDocument())
  })

  it('shows "No status history yet" when entries is empty', async () => {
    setupPOHandler(makePO('DRAFT', { statusHistory: [] }))
    renderWithProviders(<PODetailPage />, { path: '/buyer/po/po-001', routePattern: '/buyer/po/:poId' })
    await waitFor(() => expect(screen.getByText(/no status history yet/i)).toBeInTheDocument())
  })
})
