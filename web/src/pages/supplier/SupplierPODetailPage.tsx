import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { usePoDetail, useFulfillPo } from '../../hooks/usePurchaseOrders'
import { POStatusBadge } from '../../components/po/POStatusBadge'
import { LineItemRow } from '../../components/po/LineItemRow'
import { StatusHistory } from '../../components/po/StatusHistory'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { ErrorBanner } from '../../components/ui/ErrorBanner'
import { centsToDisplay, formatDate, formatDateTime } from '../../lib/formatters'
import { ApiRequestError } from '../../api/client'

function canFulfill(status: string): boolean {
  return status === 'SUBMITTED' || status === 'APPROVED'
}

export function SupplierPODetailPage() {
  const { poId } = useParams<{ poId: string }>()
  const navigate = useNavigate()

  const { data: po, isLoading, error } = usePoDetail(poId!)
  const fulfillPo = useFulfillPo(poId!)

  const [showFulfillModal, setShowFulfillModal] = useState(false)

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

  async function handleFulfill() {
    await fulfillPo.mutateAsync()
    setShowFulfillModal(false)
    navigate('/supplier/po')
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-4 flex items-center gap-4">
        <button
          type="button"
          onClick={() => navigate('/supplier/po')}
          className="text-sm text-blue-600 hover:underline"
        >
          ← Back to POs
        </button>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
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
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 rounded-md bg-gray-50 p-4">
            <div>
              <p className="text-xs text-gray-500">Buyer</p>
              <p className="text-sm font-medium text-gray-900">{po.buyerId}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Branch</p>
              <p className="text-sm font-medium text-gray-900">{po.branchId}</p>
            </div>
            {po.expectedDeliveryDate && (
              <div>
                <p className="text-xs text-gray-500">Expected Delivery</p>
                <p className="text-sm font-medium text-gray-900">{formatDate(po.expectedDeliveryDate)}</p>
              </div>
            )}
          </div>

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

          {/* Status history */}
          <div>
            <h2 className="mb-3 text-base font-semibold text-gray-900">Status History</h2>
            <StatusHistory entries={po.statusHistory ?? []} />
          </div>

          {canFulfill(po.status) && (
            <div className="flex justify-end border-t border-gray-100 pt-4">
              <Button onClick={() => setShowFulfillModal(true)}>
                Fulfill
              </Button>
            </div>
          )}
        </div>
      </div>

      <Modal
        isOpen={showFulfillModal}
        title="Fulfill Purchase Order"
        onClose={() => setShowFulfillModal(false)}
        actions={[
          { label: 'Cancel', variant: 'secondary', onClick: () => setShowFulfillModal(false) },
          { label: 'Confirm Fulfill', variant: 'primary', onClick: handleFulfill, isLoading: fulfillPo.isPending },
        ]}
      >
        <p>Mark <strong>{po.poNumber}</strong> as fulfilled?</p>
      </Modal>
    </div>
  )
}
