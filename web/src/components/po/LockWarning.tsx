import { timeUntilExpiry } from '../../lib/formatters'

interface LockWarningProps {
  lockedBy: string
  lockExpiresAt: Date
}

export function LockWarning({ lockedBy, lockExpiresAt }: LockWarningProps) {
  const expiry = timeUntilExpiry(lockExpiresAt)
  const isExpired = expiry === 'expired'

  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
      <p className="font-medium text-amber-800">
        {isExpired ? 'Lock expired' : 'This PO is currently locked'}
      </p>
      <p className="mt-1 text-amber-700">
        Locked by <span className="font-medium">{lockedBy}</span>
        {!isExpired && <> — expires in {expiry}</>}
      </p>
    </div>
  )
}
