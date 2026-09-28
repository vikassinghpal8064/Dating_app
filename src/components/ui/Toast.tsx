import { useCallback, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react'
import { createPortal } from 'react-dom'
import { cn } from '../../utils'
import { ToastContext } from './toastContext'
import type { Toast } from './toastContext'

const toastIcons = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
}

const toastColors = {
  success: 'border-accent-emerald/50 bg-accent-emerald/10 text-accent-emerald',
  error: 'border-red-500/50 bg-red-500/10 text-red-400',
  warning: 'border-accent-gold/50 bg-accent-gold/10 text-accent-gold',
  info: 'border-primary-500/50 bg-primary-500/10 text-primary-400',
}

const DEFAULT_DURATION_MS = 5000

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const Icon = toastIcons[toast.type]

  return (
    <motion.div
      initial={{ opacity: 0, x: 300, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 300, scale: 0.9 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className={cn(
        'glass-strong flex min-w-0 max-w-[calc(100vw-2rem)] items-start gap-3 rounded-xl border p-4 shadow-lg sm:min-w-[320px] sm:max-w-md',
        toastColors[toast.type]
      )}
      role="alert"
      aria-live="polite"
    >
      <div className="mt-0.5 shrink-0">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-dark-50">{toast.title}</p>
        {toast.description && (
          <p className="mt-1 text-sm text-dark-400">{toast.description}</p>
        )}
        {toast.action && (
          <button
            type="button"
            onClick={toast.action.onClick}
            className="mt-2 text-sm font-medium underline hover:no-underline"
          >
            {toast.action.label}
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={onClose}
        className="shrink-0 rounded-lg p-1 text-dark-400 transition-colors hover:bg-white/5 hover:text-dark-100"
        aria-label="Dismiss notification"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </motion.div>
  )
}

function ToastContainer({ toasts, onClose }: { toasts: Toast[]; onClose: (id: string) => void }) {
  if (toasts.length === 0) return null

  return createPortal(
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
      <AnimatePresence>
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <ToastItem toast={toast} onClose={() => onClose(toast.id)} />
          </div>
        ))}
      </AnimatePresence>
    </div>,
    document.body
  )
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  /* Timers for toasts that are still on screen are cleared on unmount, so a
     timer can never fire into an unmounted provider. */
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>())

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  const addToast = useCallback(
    (toast: Omit<Toast, 'id'>) => {
      const id = crypto.randomUUID()
      setToasts((prev) => [...prev, { ...toast, id }])

      // `duration: 0` means the toast stays until it is dismissed.
      if (toast.duration !== 0) {
        const timer = setTimeout(() => {
          timers.current.delete(timer)
          removeToast(id)
        }, toast.duration ?? DEFAULT_DURATION_MS)
        timers.current.add(timer)
      }

      return id
    },
    [removeToast]
  )

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </ToastContext.Provider>
  )
}
