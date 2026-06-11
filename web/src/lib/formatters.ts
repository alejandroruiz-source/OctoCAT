const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

export function centsToDisplay(cents: number): string {
  return currencyFormatter.format(cents / 100)
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function relativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`
  const diffHrs = Math.floor(diffMin / 60)
  if (diffHrs < 24) return `${diffHrs} hour${diffHrs === 1 ? '' : 's'} ago`
  const diffDays = Math.floor(diffHrs / 24)
  return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`
}

export function lockExpiresAt(lockedAt: string): Date {
  return new Date(new Date(lockedAt).getTime() + 30 * 60 * 1000)
}

export function timeUntilExpiry(expiresAt: Date): string {
  const diffMs = expiresAt.getTime() - Date.now()
  if (diffMs <= 0) return 'expired'
  const diffMin = Math.ceil(diffMs / 60_000)
  return `${diffMin} minute${diffMin === 1 ? '' : 's'}`
}
