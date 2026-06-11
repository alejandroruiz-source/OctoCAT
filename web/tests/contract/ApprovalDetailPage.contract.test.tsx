import { http, HttpResponse } from 'msw'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { server } from '../mocks/server'
import { renderWithProviders, DEFAULT_USER } from '../test-utils'
import { ApprovalDetailPage } from '../../src/pages/approver/ApprovalDetailPage'

const API_BASE = 'http://localhost:3000/api/v1'

const APPROVER_USER = {
  ...DEFAULT_USER,
  user: { userId: 'test-approver-001', role: 'APPROVER' as const, displayName: 'Test Approver', email: 'approver@test.local' },
}

function makePO(overrides: Record<string, unknown> = {}) {
  return {
    id: 'po-001',
    poNumber: 'PO-2026-001',
    status: 'AWAITING_APPROVAL',
    buyerId: 'buyer-001',
    branchId: 'branch-001',
    supplierId: 'supplier-001',
    expectedDeliveryDate: '2026-08-01',
    totalCents: 1_500_000,
    notes: null,
    lockedBy: null,
    lockedAt: null,
    approvalDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    createdAt: '2026-06-10T10:00:00Z',
    updatedAt: '2026-06-10T10:00:00Z',
    submittedAt: '2026-06-10T10:00:00Z',
    approvedAt: null,
    fulfilledAt: null,
    lineItems: [
      {
        id: 'li-001',
        purchaseOrderId: 'po-001',
        lineNumber: 1,
        productId: 'prod-001',
        productName: 'Industrial Widget',
        quantity: 10,
        unitPriceCents: 150_000,
        extendedPriceCents: 1_500_000,
      },
    ],
    statusHistory: [],
    ...overrides,
  }
}

describe('ApprovalDetailPage', () => {
  it('renders Approve and Reject buttons for AWAITING_APPROVAL PO', async () => {
    server.use(
      http.get(`${API_BASE}/purchase-orders/po-001`, () => HttpResponse.json(makePO())),
    )
    renderWithProviders(<ApprovalDetailPage />, {
      user: APPROVER_USER,
      path: '/approver/queue/po-001',
      routePattern: '/approver/queue/:poId',
    })
    await waitFor(() => expect(screen.getByRole('button', { name: /approve/i })).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /reject/i })).toBeInTheDocument()
  })

  it('Reject button reveals reason textarea', async () => {
    server.use(
      http.get(`${API_BASE}/purchase-orders/po-001`, () => HttpResponse.json(makePO())),
    )
    renderWithProviders(<ApprovalDetailPage />, {
      user: APPROVER_USER,
      path: '/approver/queue/po-001',
      routePattern: '/approver/queue/:poId',
    })
    await waitFor(() => screen.getByRole('button', { name: /reject/i }))
    await userEvent.click(screen.getByRole('button', { name: /reject/i }))
    expect(screen.getByRole('textbox', { name: /rejection reason/i })).toBeInTheDocument()
  })

  it('Confirm Reject is disabled when reason is empty', async () => {
    server.use(
      http.get(`${API_BASE}/purchase-orders/po-001`, () => HttpResponse.json(makePO())),
    )
    renderWithProviders(<ApprovalDetailPage />, {
      user: APPROVER_USER,
      path: '/approver/queue/po-001',
      routePattern: '/approver/queue/:poId',
    })
    await waitFor(() => screen.getByRole('button', { name: /reject/i }))
    await userEvent.click(screen.getByRole('button', { name: /reject/i }))
    expect(screen.getByRole('button', { name: /confirm reject/i })).toBeDisabled()
  })

  it('Approve button opens confirmation modal', async () => {
    server.use(
      http.get(`${API_BASE}/purchase-orders/po-001`, () => HttpResponse.json(makePO())),
    )
    renderWithProviders(<ApprovalDetailPage />, {
      user: APPROVER_USER,
      path: '/approver/queue/po-001',
      routePattern: '/approver/queue/:poId',
    })
    await waitFor(() => screen.getByRole('button', { name: /approve/i }))
    await userEvent.click(screen.getByRole('button', { name: /approve/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
