import { useState } from 'react'
import { Button } from '../ui/Button'
import { centsToDisplay } from '../../lib/formatters'
import type { LineItemResponse } from '../../api/types'

export interface LineItemDraft {
  productId: string
  productName: string
  quantity: number
  unitPriceCents: number
  extendedPriceCents: number
}

interface LineItemEditorProps {
  initial?: LineItemResponse | null
  onSave: (draft: LineItemDraft) => void
  onCancel: () => void
  isLoading?: boolean
}

export function LineItemEditor({ initial, onSave, onCancel, isLoading }: LineItemEditorProps) {
  const [productId] = useState(initial?.productId ?? '')
  const [productName, setProductName] = useState(initial?.productName ?? '')
  const [quantityStr, setQuantityStr] = useState(String(initial?.quantity ?? ''))
  const [unitPriceStr, setUnitPriceStr] = useState(
    initial ? String(initial.unitPriceCents / 100) : '',
  )

  const quantity = parseInt(quantityStr, 10)
  const unitPriceCents = Math.round(parseFloat(unitPriceStr) * 100) || 0
  const extendedPriceCents = !isNaN(quantity) && quantity > 0 ? quantity * unitPriceCents : 0

  const isValid =
    productName.trim().length > 0 &&
    !isNaN(quantity) &&
    quantity >= 1 &&
    unitPriceCents >= 1

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isValid) return
    onSave({ productId: productId || crypto.randomUUID(), productName, quantity, unitPriceCents, extendedPriceCents })
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-md border border-gray-200 bg-gray-50 p-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-700" htmlFor="productName">
            Product Name
          </label>
          <input
            id="productName"
            type="text"
            className="mt-1 block w-full rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700" htmlFor="quantity">
            Quantity
          </label>
          <input
            id="quantity"
            type="number"
            min={1}
            step={1}
            aria-label="Quantity"
            className="mt-1 block w-full rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
            value={quantityStr}
            onChange={(e) => setQuantityStr(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700" htmlFor="unitPrice">
            Unit Price ($)
          </label>
          <input
            id="unitPrice"
            type="number"
            min={0.01}
            step={0.01}
            className="mt-1 block w-full rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
            value={unitPriceStr}
            onChange={(e) => setUnitPriceStr(e.target.value)}
            required
          />
        </div>
      </div>
      {extendedPriceCents > 0 && (
        <p className="mt-2 text-sm text-gray-600">
          Extended price: <span className="font-medium">{centsToDisplay(extendedPriceCents)}</span>
        </p>
      )}
      <div className="mt-3 flex justify-end gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={!isValid} isLoading={isLoading}>
          Save
        </Button>
      </div>
    </form>
  )
}
