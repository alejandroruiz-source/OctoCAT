import { POStatusBadge } from './POStatusBadge'
import { formatDateTime } from '../../lib/formatters'
import type { StatusHistoryEntry, PurchaseOrderStatus } from '../../api/types'

interface StatusHistoryProps {
  entries: StatusHistoryEntry[]
}

export function StatusHistory({ entries }: StatusHistoryProps) {
  if (entries.length === 0) {
    return (
      <div className="text-sm text-gray-400 italic">No status history yet</div>
    )
  }

  const sorted = [...entries].sort(
    (a, b) => new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime(),
  )

  return (
    <ol className="space-y-3">
      {sorted.map((entry) => (
        <li key={entry.id} className="flex gap-3 text-sm">
          <div className="flex-shrink-0 mt-0.5">
            <div className="h-2 w-2 rounded-full bg-gray-400 mt-1.5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {entry.fromStatus ? (
                <>
                  <POStatusBadge status={entry.fromStatus as PurchaseOrderStatus} size="sm" />
                  <span className="text-gray-400">→</span>
                </>
              ) : (
                <span className="text-gray-400 text-xs">—</span>
              )}
              <POStatusBadge status={entry.toStatus as PurchaseOrderStatus} size="sm" />
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {entry.changedById} · {formatDateTime(entry.changedAt)}
            </p>
            {entry.note && (
              <p className="mt-1 text-xs text-gray-700 rounded bg-gray-50 px-2 py-1 border border-gray-100">
                {entry.note}
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}
