import { cn } from '../../utils'

/*
 * The visual half of a button.
 *
 * This lives apart from `Button.tsx` for a specific reason rather than for tidiness.
 * A module that exports a component and a plain function at the same time cannot
 * support React Fast Refresh: the rule only applies to modules that export
 * components and nothing else, so editing this file would remount every button
 * on the page and throw away its state. Keeping the class-name builder here lets
 * `Button.tsx` export only components, and the button and the link still share
 * one definition so their appearance cannot drift apart.
 */

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost'
export type ButtonSize = 'sm' | 'md' | 'lg'

const baseStyles =
  'inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-dark-950 disabled:opacity-50 disabled:cursor-not-allowed'

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white shadow-glow',
  secondary: 'bg-dark-800 hover:bg-dark-700 active:bg-dark-600 text-dark-100 border border-dark-600',
  outline: 'border-2 border-primary-500 text-primary-500 hover:bg-primary-500 hover:text-white',
  ghost: 'text-dark-400 hover:text-dark-100 hover:bg-dark-800',
}

const sizes: Record<ButtonSize, string> = {
  sm: 'px-4 py-2 text-sm',
  md: 'px-6 py-3 text-base',
  lg: 'px-8 py-4 text-lg',
}

export function buttonClassName({
  variant = 'primary',
  size = 'md',
  className,
}: {
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
} = {}) {
  return cn(baseStyles, variants[variant], sizes[size], className)
}
