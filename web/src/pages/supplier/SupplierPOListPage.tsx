import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePoList } from '../../hooks/usePurchaseOrders'
import { useFulfillPo } from '../../hooks/usePurchaseOrders'
import { POStatusBadge } from '../../components/po/POStatusBadge'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { ErrorBanner } from '../../components/ui/ErrorBanner'
import { centsToDisplay } from '../../lib/formatters'
import { ApiRequestError } from '../../api/client'
import type { PurchaseOrderStatus } from '../../api/types'

function canFulfill(status: PurchaseOrderStatus): boolean {
  return status === 'SUBMITTED' || status === 'APPROVED'
}

function FulfillButton({ poId, poNumber }: { poId: string; poNumber: string }) {
  const [showModal, setShowModal] = useState(false)
  const fulfill = useFulfillPo(poId)

  return (
    <>
      <Button size="sm" onClick={() => setShowModal(true)}>
        Fulfill
      </Button>
      <Modal
        isOpen={showModal}
        title="Fulfill Purchase Order"
        onClose={() => setShowModal(false)}
        actions={[
          { label: 'Cancel', variant: 'secondary', onClick: () => setShowModal(false) },
          {
            label: 'Confirm Fulfill',
            variant: 'primary',
            onClick: async () => { await fulfill.mutateAsync(); setShowModal(false) },
            isLoading: fulfill.isPending,
          },
        ]}
      >
        <p>Mark <strong>{poNumber}</strong> as fulfilled?</p>
      </Modal>
    </>
  )
}

export function SupplierPOListPage() {
  const navigate = useNavigate()
  const { data, isLoading, error } = usePoList({})

  if (isLoading) {
    return <div className="p-8 text-center text-gray-500">Loading...</div>
  }

  if (error) {
    const msg = error instanceof ApiRequestError ? error.message : 'Failed to load purchase orders'
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <ErrorBanner message={msg} />
      </div>
    )
  }

  const items = (data?.items ?? []).filter((po) => po.status !== 'DRAFT')

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Purchase Orders</h1>

      {items.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
          <p className="text-gray-500">No purchase orders</p>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">PO Number</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((po) => (
                <tr key={po.id} className="hover:bg-gray-50">
                  <td
                    className="px-4 py-3 text-sm font-medium text-blue-600 cursor-pointer"
                    onClick={() => navigate(`/supplier/po/${po.id}`)}
                  >
                    {po.poNumber}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                    {centsToDisplay(po.totalCents)}
                  </td>
                  <td className="px-4 py-3">
                    <POStatusBadge status={po.status} size="sm" />
                  </td>
                  <td className="px-4 py-3 text-right">
                    {canFulfill(po.status) && (
                      <FulfillButton poId={po.id} poNumber={po.poNumber} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
