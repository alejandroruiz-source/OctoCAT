import { type ReactNode, useEffect } from 'react'
import { Button } from './Button'

interface ModalAction {
  label: string
  onClick: () => void
  variant?: 'primary' | 'secondary' | 'danger'
  isLoading?: boolean
  disabled?: boolean
}

interface ModalProps {
  isOpen: boolean
  title: string
  children: ReactNode
  onClose: () => void
  actions?: ModalAction[]
}

export function Modal({ isOpen, title, children, onClose, actions }: ModalProps) {
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="relative z-10 w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
      >
        <h2 id="modal-title" className="mb-4 text-lg font-semibold text-gray-900">
          {title}
        </h2>
        <div className="text-sm text-gray-600">{children}</div>
        {actions && (
          <div className="mt-6 flex justify-end gap-3">
            {actions.map((action) => (
              <Button
                key={action.label}
                variant={action.variant ?? 'primary'}
                onClick={action.onClick}
                isLoading={action.isLoading}
                disabled={action.disabled}
              >
                {action.label}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
