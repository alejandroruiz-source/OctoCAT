import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { usePoDetail, useCancelPo } from '../../hooks/usePurchaseOrders'
import { useAddLineItem, useUpdateLineItem, useRemoveLineItem } from '../../hooks/useLineItems'
import { POStatusBadge } from '../../components/po/POStatusBadge'
import { LockWarning } from '../../components/po/LockWarning'
import { LineItemRow } from '../../components/po/LineItemRow'
import { LineItemEditor, type LineItemDraft } from '../../components/po/LineItemEditor'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { ErrorBanner } from '../../components/ui/ErrorBanner'
import { centsToDisplay, formatDateTime, lockExpiresAt } from '../../lib/formatters'
import { isEditable } from '../../lib/constants'
import type { LineItemResponse } from '../../api/types'
import { ApiRequestError } from '../../api/client'

export function PODetailPage() {
  const { poId } = useParams<{ poId: string }>()
  const navigate = useNavigate()

  const { data: po, isLoading, error } = usePoDetail(poId!)
  const addLineItem = useAddLineItem(poId!)
  const updateLineItem = useUpdateLineItem(poId!)
  const removeLineItem = useRemoveLineItem(poId!)
  const cancelPo = useCancelPo(poId!)

  const [showAddEditor, setShowAddEditor] = useState(false)
  const [editingItem, setEditingItem] = useState<LineItemResponse | null>(null)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

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

  const editable = isEditable(po.status)
  const locked = po.lockedBy !== null
  const lockExpiry = po.lockedAt ? lockExpiresAt(po.lockedAt) : null
  const isActiveLock = locked && lockExpiry && lockExpiry > new Date()

  const rejectionReason =
    po.status === 'REVISION_REQUIRED'
      ? [...(po.statusHistory ?? [])]
          .reverse()
          .find((h) => h.toStatus === 'REVISION_REQUIRED')?.note ?? null
      : null

  async function handleAdd(draft: LineItemDraft) {
    await addLineItem.mutateAsync(draft)
    setShowAddEditor(false)
  }

  async function handleUpdate(draft: LineItemDraft) {
    if (!editingItem) return
    await updateLineItem.mutateAsync({
      lineItemId: editingItem.id,
      input: { quantity: draft.quantity, unitPriceCents: draft.unitPriceCents },
    })
    setEditingItem(null)
  }

  async function handleDelete(lineItemId: string) {
    setDeletingId(lineItemId)
    await removeLineItem.mutateAsync(lineItemId)
    setDeletingId(null)
  }

  async function handleCancel() {
    await cancelPo.mutateAsync()
    setShowCancelModal(false)
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-4 flex items-center gap-4">
        <button
          type="button"
          onClick={() => navigate('/buyer/po')}
          className="text-sm text-blue-600 hover:underline"
        >
          ← Back to POs
        </button>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-gray-100 p-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{po.poNumber}</h1>
            <p className="mt-1 text-sm text-gray-500">
              Last updated {formatDateTime(po.updatedAt)}
            </p>
          </div>
          <POStatusBadge status={po.status} />
        </div>

        <div className="p-6 space-y-6">
          {/* Lock warning */}
          {isActiveLock && po.lockedBy && lockExpiry && (
            <LockWarning lockedBy={po.lockedBy} lockExpiresAt={lockExpiry} />
          )}

          {/* Rejection reason for REVISION_REQUIRED */}
          {rejectionReason && (
            <div className="rounded-md border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-medium text-red-800">Rejection reason:</p>
              <p className="mt-1 text-sm text-red-700">{rejectionReason}</p>
            </div>
          )}

          {/* Line items */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">Line Items</h2>
              {editable && !isActiveLock && (
                <Button size="sm" onClick={() => setShowAddEditor(true)}>
                  Add Line Item
                </Button>
              )}
            </div>

            {showAddEditor && (
              <div className="mb-3">
                <LineItemEditor
                  onSave={handleAdd}
                  onCancel={() => setShowAddEditor(false)}
                  isLoading={addLineItem.isPending}
                />
              </div>
            )}

            {editingItem && (
              <div className="mb-3">
                <LineItemEditor
                  initial={editingItem}
                  onSave={handleUpdate}
                  onCancel={() => setEditingItem(null)}
                  isLoading={updateLineItem.isPending}
                />
              </div>
            )}

            {(po.lineItems ?? []).length === 0 ? (
              <p className="text-sm text-gray-400 italic">No line items yet</p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 text-xs text-gray-500">
                    <th className="pb-2 text-left font-medium">Product</th>
                    <th className="pb-2 text-right font-medium">Qty</th>
                    <th className="pb-2 text-right font-medium">Unit Price</th>
                    <th className="pb-2 text-right font-medium">Extended</th>
                    {editable && <th className="pb-2" />}
                  </tr>
                </thead>
                <tbody>
                  {(po.lineItems ?? []).map((item) => (
                    <LineItemRow
                      key={item.id}
                      item={item}
                      editable={editable && !isActiveLock}
                      onEdit={setEditingItem}
                      onDelete={handleDelete}
                      isDeleting={deletingId === item.id}
                    />
                  ))}
                </tbody>
              </table>
            )}

            <div className="mt-3 flex justify-end">
              <p className="text-base font-semibold text-gray-900">
                Total: {centsToDisplay(po.totalCents)}
              </p>
            </div>
          </div>

          {/* Actions */}
          {editable && (
            <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
              {po.status !== 'CANCELLED' && (
                <Button
                  variant="secondary"
                  onClick={() => setShowCancelModal(true)}
                  aria-label="Cancel PO"
                >
                  Cancel PO
                </Button>
              )}
              <Button onClick={() => navigate(`/buyer/po/${po.id}/submit`)}>
                Submit
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Cancel confirmation modal */}
      <Modal
        isOpen={showCancelModal}
        title="Cancel Purchase Order"
        onClose={() => setShowCancelModal(false)}
        actions={[
          {
            label: 'Keep PO',
            variant: 'secondary',
            onClick: () => setShowCancelModal(false),
          },
          {
            label: 'Cancel PO',
            variant: 'danger',
            onClick: handleCancel,
            isLoading: cancelPo.isPending,
          },
        ]}
      >
        <p>Are you sure you want to cancel <strong>{po.poNumber}</strong>? This action cannot be undone.</p>
      </Modal>
    </div>
  )
}
