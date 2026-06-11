import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { usePoDetail } from '../../hooks/usePurchaseOrders'
import { useApprovePo, useRejectPo } from '../../hooks/useApprovals'
import { POStatusBadge } from '../../components/po/POStatusBadge'
import { LineItemRow } from '../../components/po/LineItemRow'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { ErrorBanner } from '../../components/ui/ErrorBanner'
import { centsToDisplay, formatDate, formatDateTime } from '../../lib/formatters'
import { ApiRequestError } from '../../api/client'

export function ApprovalDetailPage() {
  const { poId } = useParams<{ poId: string }>()
  const navigate = useNavigate()

  const { data: po, isLoading, error } = usePoDetail(poId!)
  const approvePo = useApprovePo(poId!)
  const rejectPo = useRejectPo(poId!)

  const [showApproveModal, setShowApproveModal] = useState(false)
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  if (isLoading) {
    return <div className="p-8 text-center text-gray-500">Loading...</div>
  }

  if (error || !po) {
    const msg = error instanceof ApiRequestError ? error.message : 'Purchase order not found'
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <ErrorBanner message={msg} />
      </div>
    )
  }

  const approveError = approvePo.error instanceof ApiRequestError ? approvePo.error.message : approvePo.error ? 'Failed to approve' : undefined
  const rejectError = rejectPo.error instanceof ApiRequestError ? rejectPo.error.message : rejectPo.error ? 'Failed to reject' : undefined

  async function handleApprove() {
    await approvePo.mutateAsync()
    setShowApproveModal(false)
    navigate('/approver/queue')
  }

  async function handleReject() {
    if (!rejectReason.trim()) return
    await rejectPo.mutateAsync(rejectReason.trim())
    navigate('/approver/queue')
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-4 flex items-center gap-4">
        <button
          type="button"
          onClick={() => navigate('/approver/queue')}
          className="text-sm text-blue-600 hover:underline"
        >
          ← Back to Queue
        </button>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-gray-100 p-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{po.poNumber}</h1>
            <p className="mt-1 text-sm text-gray-500">Submitted {formatDateTime(po.updatedAt)}</p>
          </div>
          <POStatusBadge status={po.status} />
        </div>

        <div className="p-6 space-y-6">
          {/* PO metadata */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 rounded-md bg-gray-50 p-4">
            <div>
              <p className="text-xs text-gray-500">Buyer</p>
              <p className="text-sm font-medium text-gray-900">{po.buyerId}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Supplier</p>
              <p className="text-sm font-medium text-gray-900">{po.supplierId}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Expected Delivery</p>
              <p className="text-sm font-medium text-gray-900">
                {po.expectedDeliveryDate ? formatDate(po.expectedDeliveryDate) : '—'}
              </p>
            </div>
            {po.approvalDeadline && (
              <div>
                <p className="text-xs text-gray-500">Approval Deadline</p>
                <p className={`text-sm font-medium ${new Date(po.approvalDeadline) < new Date() ? 'text-red-600' : 'text-gray-900'}`}>
                  {formatDate(po.approvalDeadline)}
                </p>
              </div>
            )}
          </div>

          {/* Line items */}
          {(po.lineItems ?? []).length > 0 && (
            <div>
              <h2 className="mb-2 text-base font-semibold text-gray-900">Line Items</h2>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 text-xs text-gray-500">
                    <th className="pb-2 text-left font-medium">Product</th>
                    <th className="pb-2 text-right font-medium">Qty</th>
                    <th className="pb-2 text-right font-medium">Unit Price</th>
                    <th className="pb-2 text-right font-medium">Extended</th>
                  </tr>
                </thead>
                <tbody>
                  {(po.lineItems ?? []).map((item) => (
                    <LineItemRow key={item.id} item={item} editable={false} onEdit={() => {}} onDelete={() => {}} />
                  ))}
                </tbody>
              </table>
              <div className="mt-3 flex justify-end">
                <p className="text-base font-semibold text-gray-900">
                  Total: {centsToDisplay(po.totalCents)}
                </p>
              </div>
            </div>
          )}

          {(approveError || rejectError) && (
            <ErrorBanner message={approveError ?? rejectError ?? ''} />
          )}

          {/* Reject inline form */}
          {showRejectForm && (
            <div className="rounded-md border border-red-200 bg-red-50 p-4 space-y-3">
              <label className="block text-sm font-medium text-red-800" htmlFor="rejectReason">
                Rejection Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                id="rejectReason"
                aria-label="Rejection reason"
                rows={3}
                className="block w-full rounded border border-red-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none"
                placeholder="Explain why this PO is being rejected..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
              <div className="flex gap-2 justify-end">
                <Button variant="secondary" size="sm" onClick={() => { setShowRejectForm(false); setRejectReason('') }}>
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  disabled={!rejectReason.trim()}
                  isLoading={rejectPo.isPending}
                  onClick={handleReject}
                >
                  Confirm Reject
                </Button>
              </div>
            </div>
          )}

          {/* Action buttons */}
          {po.status === 'AWAITING_APPROVAL' && !showRejectForm && (
            <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
              <Button
                variant="danger"
                onClick={() => setShowRejectForm(true)}
              >
                Reject
              </Button>
              <Button onClick={() => setShowApproveModal(true)}>
                Approve
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Approve confirmation modal */}
      <Modal
        isOpen={showApproveModal}
        title="Approve Purchase Order"
        onClose={() => setShowApproveModal(false)}
        actions={[
          { label: 'Cancel', variant: 'secondary', onClick: () => setShowApproveModal(false) },
          { label: 'Confirm Approve', variant: 'primary', onClick: handleApprove, isLoading: approvePo.isPending },
        ]}
      >
        <p>
          Approve <strong>{po.poNumber}</strong> for{' '}
          <strong>{centsToDisplay(po.totalCents)}</strong>?
        </p>
      </Modal>
    </div>
  )
}
