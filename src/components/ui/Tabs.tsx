import { useRef } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { cn } from '../../utils'

export interface TabItem {
  value: string
  label: string
  icon?: ReactNode
  disabled?: boolean
  badge?: string | number
}

export interface TabsProps {
  tabs: TabItem[]
  value: string
  onChange: (value: string) => void
  variant?: 'default' | 'underline' | 'pills'
  /** Accessible name for the tab list, e.g. "Admin sections". */
  label?: string
  className?: string
}

const listStyles = {
  default: 'bg-dark-800 rounded-xl p-1',
  underline: 'border-b border-dark-800',
  pills: '',
}

/**
 * A controlled tab list. It renders the tab bar only — the panel content
 * belongs to the caller, which owns the active value and decides what to show
 * for `value`. Rendering content here duplicated every tab label on the page.
 */
export function Tabs({
  tabs,
  value,
  onChange,
  variant = 'default',
  label = 'Tabs',
  className,
}: TabsProps) {
  const listRef = useRef<HTMLDivElement>(null)

  const enabled = tabs.filter((tab) => !tab.disabled)
  const activeIndex = tabs.findIndex((tab) => tab.value === value)

  /** WAI-ARIA: Left/Right (and Up/Down) move between tabs, Home/End jump. */
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const keys = ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End']
    if (!keys.includes(event.key) || enabled.length === 0) return

    const activeTab = tabs[activeIndex]
    const current = activeTab ? enabled.findIndex((t) => t.value === activeTab.value) : 0
    if (current === -1) return

    let next: number
    switch (event.key) {
      case 'Home':
        next = 0
        break
      case 'End':
        next = enabled.length - 1
        break
      case 'ArrowRight':
      case 'ArrowDown':
        next = (current + 1) % enabled.length
        break
      default:
        next = (current - 1 + enabled.length) % enabled.length
    }

    const target = enabled[next]
    if (!target) return

    event.preventDefault()
    onChange(target.value)
    listRef.current
      ?.querySelector<HTMLButtonElement>(`#tab-${CSS.escape(target.value)}`)
      ?.focus()
  }

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={label}
      onKeyDown={handleKeyDown}
      className={cn('flex gap-1 overflow-x-auto', listStyles[variant], className)}
    >
      {tabs.map((tab) => {
        const isActive = value === tab.value

        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            id={`tab-${tab.value}`}
            aria-selected={isActive}
            aria-controls={`panel-${tab.value}`}
            tabIndex={isActive ? 0 : -1}
            disabled={tab.disabled}
            data-state={isActive ? 'active' : 'inactive'}
            onClick={() => {
              if (!tab.disabled) onChange(tab.value)
            }}
            className={cn(
              'flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-medium transition-colors duration-200',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-dark-950',
              'disabled:cursor-not-allowed disabled:opacity-50',
              variant === 'underline' && '-mb-px border-b-2 border-transparent',
              isActive
                ? cn(
                    'text-white',
                    variant === 'underline'
                      ? 'border-primary-500'
                      : 'bg-primary-600 shadow-glow'
                  )
                : 'text-dark-400 hover:bg-dark-700/60 hover:text-dark-100'
            )}
          >
            {tab.icon && (
              <span className="flex shrink-0 items-center" aria-hidden="true">
                {tab.icon}
              </span>
            )}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-xs font-medium',
                  isActive ? 'bg-white/20 text-white' : 'bg-dark-700 text-dark-400'
                )}
              >
                {tab.badge}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
