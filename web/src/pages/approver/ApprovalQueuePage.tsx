import { useNavigate } from 'react-router-dom'
import { useApprovalQueue } from '../../hooks/useApprovals'
import { POStatusBadge } from '../../components/po/POStatusBadge'
import { ErrorBanner } from '../../components/ui/ErrorBanner'
import { centsToDisplay, formatDate } from '../../lib/formatters'
import { ApiRequestError } from '../../api/client'

export function ApprovalQueuePage() {
  const navigate = useNavigate()
  const { data, isLoading, error } = useApprovalQueue()

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-bold text-gray-900">Approval Queue</h1>
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded bg-gray-200" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    const msg = error instanceof ApiRequestError ? error.message : 'Failed to load approval queue'
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <ErrorBanner message={msg} />
      </div>
    )
  }

  const items = data?.items ?? []

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Approval Queue</h1>

      {items.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
          <p className="text-gray-500">No POs awaiting approval</p>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">PO Number</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Buyer</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Deadline</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((po) => {
                const isOverdue = po.approvalDeadline
                  ? new Date(po.approvalDeadline) < new Date()
                  : false
                return (
                  <tr
                    key={po.id}
                    onClick={() => navigate(`/approver/queue/${po.id}`)}
                    className={`cursor-pointer hover:bg-gray-50 transition-colors ${isOverdue ? 'bg-amber-50' : ''}`}
                  >
                    <td className="px-4 py-3 text-sm font-medium text-blue-600">{po.poNumber}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{po.buyerId}</td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                      {centsToDisplay(po.totalCents)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {po.approvalDeadline ? (
                        <span className={isOverdue ? 'text-red-600 font-semibold' : ''}>
                          {isOverdue && <span className="mr-1 rounded bg-red-100 px-1 py-0.5 text-xs text-red-700">Overdue</span>}
                          {formatDate(po.approvalDeadline)}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <POStatusBadge status={po.status} size="sm" />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
