import { Button } from '../ui/Button'
import { centsToDisplay } from '../../lib/formatters'
import type { LineItemResponse } from '../../api/types'

interface LineItemRowProps {
  item: LineItemResponse
  editable: boolean
  onEdit?: (item: LineItemResponse) => void
  onDelete?: (lineItemId: string) => void
  isDeleting?: boolean
}

export function LineItemRow({ item, editable, onEdit, onDelete, isDeleting }: LineItemRowProps) {
  return (
    <tr className="border-b border-gray-100 last:border-0">
      <td className="py-2 pr-4 text-sm text-gray-900">{item.productName}</td>
      <td className="py-2 pr-4 text-sm text-right text-gray-700">{item.quantity}</td>
      <td className="py-2 pr-4 text-sm text-right text-gray-700">{centsToDisplay(item.unitPriceCents)}</td>
      <td className="py-2 pr-4 text-sm text-right font-medium text-gray-900">
        {centsToDisplay(item.extendedPriceCents)}
      </td>
      {editable && (
        <td className="py-2 text-right">
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              size="sm"
              data-testid={`edit-${item.id}`}
              aria-label="Edit"
              onClick={() => onEdit?.(item)}
            >
              Edit
            </Button>
            <Button
              variant="danger"
              size="sm"
              aria-label="Delete"
              isLoading={isDeleting}
              onClick={() => onDelete?.(item.id)}
            >
              Delete
            </Button>
          </div>
        </td>
      )}
    </tr>
  )
}
