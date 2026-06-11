import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePoList } from '../../hooks/usePurchaseOrders'
import { POStatusBadge } from '../../components/po/POStatusBadge'
import { Table, TablePagination } from '../../components/ui/Table'
import { Button } from '../../components/ui/Button'
import { ErrorBanner } from '../../components/ui/ErrorBanner'
import { centsToDisplay, formatDate } from '../../lib/formatters'
import type { PurchaseOrderResponse, PurchaseOrderStatus } from '../../api/types'
import { ApiRequestError } from '../../api/client'

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'AWAITING_APPROVAL', label: 'Awaiting Approval' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REVISION_REQUIRED', label: 'Revision Required' },
  { value: 'FULFILLED', label: 'Fulfilled' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

const LIMIT = 20

export function POListPage() {
  const navigate = useNavigate()
  const [statusFilter, setStatusFilter] = useState<PurchaseOrderStatus | ''>('')
  const [page, setPage] = useState(1)

  const params = {
    ...(statusFilter ? { status: [statusFilter] } : {}),
    page,
    limit: LIMIT,
  }

  const { data, isLoading, error, refetch } = usePoList(params)

  const totalPages = data ? Math.ceil(data.total / LIMIT) : 0

  const columns = [
    {
      key: 'poNumber',
      header: 'PO Number',
      render: (po: PurchaseOrderResponse) => (
        <span className="font-medium text-blue-600">{po.poNumber}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (po: PurchaseOrderResponse) => <POStatusBadge status={po.status} />,
    },
    {
      key: 'total',
      header: 'Total',
      render: (po: PurchaseOrderResponse) => centsToDisplay(po.totalCents),
      className: 'text-right',
    },
    {
      key: 'updatedAt',
      header: 'Last Updated',
      render: (po: PurchaseOrderResponse) => formatDate(po.updatedAt),
    },
  ]

  const errorMessage =
    error instanceof ApiRequestError
      ? error.message
      : error
      ? 'Failed to load purchase orders'
      : undefined

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Purchase Orders</h1>
        <Button onClick={() => navigate('/buyer/po/new')}>New Purchase Order</Button>
      </div>

      <div className="mb-4 flex items-center gap-4">
        <label htmlFor="status-filter" className="text-sm font-medium text-gray-700">
          Status
        </label>
        <select
          id="status-filter"
          aria-label="Status"
          className="rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as PurchaseOrderStatus | '')
            setPage(1)
          }}
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {errorMessage && (
        <div className="mb-4">
          <ErrorBanner message={errorMessage} onRetry={refetch} />
        </div>
      )}

      <Table
        columns={columns}
        data={data?.items ?? []}
        keyExtractor={(po) => po.id}
        emptyMessage="No purchase orders found"
        isLoading={isLoading}
        onRowClick={(po) => navigate(`/buyer/po/${po.id}`)}
      />

      {totalPages > 1 && (
        <TablePagination page={page} totalPages={totalPages} onPageChange={setPage} />
      )}
    </div>
  )
}
