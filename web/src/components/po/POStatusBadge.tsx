import { Badge } from '../ui/Badge'
import { STATUS_LABELS, STATUS_COLORS } from '../../lib/constants'
import type { PurchaseOrderStatus } from '../../api/types'

interface POStatusBadgeProps {
  status: PurchaseOrderStatus
  size?: 'sm' | 'md'
}

export function POStatusBadge({ status, size = 'md' }: POStatusBadgeProps) {
  return (
    <Badge color={STATUS_COLORS[status]} size={size}>
      {STATUS_LABELS[status]}
    </Badge>
  )
}
