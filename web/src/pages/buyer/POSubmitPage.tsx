import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { usePoDetail, useSubmitPo } from '../../hooks/usePurchaseOrders'
import { POStatusBadge } from '../../components/po/POStatusBadge'
import { Button } from '../../components/ui/Button'
import { ErrorBanner } from '../../components/ui/ErrorBanner'
import { centsToDisplay } from '../../lib/formatters'
import { requiresApproval } from '../../lib/constants'
import { ApiRequestError } from '../../api/client'

export function POSubmitPage() {
  const { poId } = useParams<{ poId: string }>()
  const navigate = useNavigate()

  const { data: po, isLoading } = usePoDetail(poId!)
  const submitPo = useSubmitPo(poId!)

  const [deliveryDate, setDeliveryDate] = useState('')

  const needsApproval = po ? requiresApproval(po.totalCents) : false
  const canSubmit = deliveryDate.length > 0

  const errorMessage =
    submitPo.error instanceof ApiRequestError
      ? submitPo.error.message
      : submitPo.error
      ? 'Failed to submit purchase order'
      : undefined

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    await submitPo.mutateAsync(deliveryDate)
    navigate(`/buyer/po/${poId}`)
  }

  if (isLoading || !po) {
    return <div className="p-8 text-center text-gray-500">Loading...</div>
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-4 flex items-center gap-4">
        <button
          type="button"
          onClick={() => navigate(`/buyer/po/${poId}`)}
          className="text-sm text-blue-600 hover:underline"
        >
          ← Back to PO
        </button>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 p-6">
          <h1 className="text-xl font-bold text-gray-900">Submit {po.poNumber}</h1>
          <POStatusBadge status={po.status} />
        </div>

        <div className="p-6 space-y-5">
          <div className="flex items-center justify-between rounded-md bg-gray-50 p-4">
            <span className="text-sm font-medium text-gray-700">Order Total</span>
            <span className="text-lg font-bold text-gray-900">{centsToDisplay(po.totalCents)}</span>
          </div>

          {needsApproval && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-800">
                This PO requires manager approval
              </p>
              <p className="mt-1 text-sm text-amber-700">
                Because the total is ${(po.totalCents / 100).toLocaleString()} or more, this PO
                will be routed to a manager for approval before proceeding to the supplier.
              </p>
            </div>
          )}

          {errorMessage && <ErrorBanner message={errorMessage} />}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700" htmlFor="deliveryDate">
                Expected Delivery Date <span className="text-red-500">*</span>
              </label>
              <input
                id="deliveryDate"
                type="date"
                required
                aria-label="Expected delivery date"
                className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                value={deliveryDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => setDeliveryDate(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => navigate(`/buyer/po/${poId}`)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!canSubmit}
                isLoading={submitPo.isPending}
              >
                Confirm Submit
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
