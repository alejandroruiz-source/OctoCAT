import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCreatePo } from '../../hooks/usePurchaseOrders'
import { Button } from '../../components/ui/Button'
import { ErrorBanner } from '../../components/ui/ErrorBanner'
import { ApiRequestError } from '../../api/client'

export function POCreatePage() {
  const navigate = useNavigate()
  const { mutateAsync, isPending, error } = useCreatePo()

  const [supplierId, setSupplierId] = useState('')
  const [branchId, setBranchId] = useState('')
  const [notes, setNotes] = useState('')

  const errorMessage =
    error instanceof ApiRequestError ? error.message : error ? 'Failed to create purchase order' : undefined

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!supplierId.trim() || !branchId.trim()) return
    const po = await mutateAsync({ supplierId, branchId, notes: notes || null })
    navigate(`/buyer/po/${po.id}`)
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center gap-4">
        <button
          type="button"
          onClick={() => navigate('/buyer/po')}
          className="text-sm text-blue-600 hover:underline"
        >
          ← Back to POs
        </button>
        <h1 className="text-2xl font-bold text-gray-900">New Purchase Order</h1>
      </div>

      {errorMessage && <div className="mb-4"><ErrorBanner message={errorMessage} /></div>}

      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div>
          <label className="block text-sm font-medium text-gray-700" htmlFor="supplierId">
            Supplier ID
          </label>
          <input
            id="supplierId"
            type="text"
            required
            placeholder="Enter supplier UUID"
            className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700" htmlFor="branchId">
            Branch ID
          </label>
          <input
            id="branchId"
            type="text"
            required
            placeholder="Enter branch UUID"
            className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700" htmlFor="notes">
            Notes <span className="font-normal text-gray-400">(optional)</span>
          </label>
          <textarea
            id="notes"
            rows={3}
            className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => navigate('/buyer/po')}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isPending}>
            Create Purchase Order
          </Button>
        </div>
      </form>
    </div>
  )
}
