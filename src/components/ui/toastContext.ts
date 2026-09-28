import { createContext, useContext } from 'react'

/**
 * The toast context lives in its own module so `Toast.tsx` can export only
 * components. Keeping `useToast` beside the provider breaks React Fast Refresh:
 * a module that exports both a component and a hook is re-executed on every
 * edit, which throws away the toast state.
 */
export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: string
  type: ToastType
  title: string
  description?: string
  duration?: number
  action?: { label: string; onClick: () => void }
}

export interface ToastContextValue {
  toasts: Toast[]
  addToast: (_toast: Omit<Toast, 'id'>) => string
  removeToast: (_id: string) => void
}

export const ToastContext = createContext<ToastContextValue | undefined>(undefined)

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)

  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }

  return context
}
