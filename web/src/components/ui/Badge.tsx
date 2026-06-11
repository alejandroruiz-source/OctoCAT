import type { StatusColor } from '../../lib/constants'

interface BadgeProps {
  color: StatusColor
  size?: 'sm' | 'md'
  children: React.ReactNode
}

const colorClasses: Record<StatusColor, string> = {
  gray: 'bg-gray-100 text-gray-700',
  'gray-muted': 'bg-gray-50 text-gray-400',
  blue: 'bg-blue-100 text-blue-700',
  amber: 'bg-amber-100 text-amber-700',
  green: 'bg-green-100 text-green-700',
  red: 'bg-red-100 text-red-700',
  purple: 'bg-purple-100 text-purple-700',
}

const sizeClasses = {
  sm: 'px-1.5 py-0.5 text-xs',
  md: 'px-2.5 py-0.5 text-xs',
}

export function Badge({ color, size = 'md', children }: BadgeProps) {
  return (
    <span className={`inline-flex items-center rounded-full font-medium ${colorClasses[color]} ${sizeClasses[size]}`}>
      {children}
    </span>
  )
}
