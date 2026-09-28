import { forwardRef } from 'react'
import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from 'react'
import { Link } from 'react-router-dom'
import type { LinkProps } from 'react-router-dom'
import { buttonClassName } from './buttonStyles'
import type { ButtonSize, ButtonVariant } from './buttonStyles'

/*
 * This module exports components and nothing else. The class-name builder and
 * the variant and size types live in ./buttonStyles, because a file that mixes
 * components with plain functions cannot support React Fast Refresh and eslint
 * refuses to let it. Re-exported as types only, which costs nothing at runtime.
 */
export type { ButtonSize, ButtonVariant } from './buttonStyles'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      className={buttonClassName({ variant, size, className })}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg
          className="animate-spin h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      )}
      {children}
    </button>
  )
)

Button.displayName = 'Button'

export interface LinkButtonProps
  extends Omit<LinkProps, 'className'>,
    Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'className'> {
  variant?: ButtonVariant
  size?: ButtonSize
  /*
   * Re-declared on purpose. Both parents are omitted above so that a caller's
   * className cannot silently replace the variant styles, but the component
   * still reads one and merges it through buttonClassName, which is how a
   * caller adds a margin without restating the button's appearance.
   */
  className?: string
}

/**
 * A navigation action that looks like a button.
 *
 * The obvious alternative — wrapping a `Button` in a `Link` — produces a
 * `<button>` inside an `<a>`: invalid HTML, and a link containing a button in
 * the accessibility tree, which is announced as two controls and stops twice
 * in the tab order. This renders one `<a>` instead.
 */
export const LinkButton = forwardRef<HTMLAnchorElement, LinkButtonProps>(
  ({ className, variant, size, children, ...props }, ref) => (
    <Link ref={ref} className={buttonClassName({ variant, size, className })} {...props}>
      {children}
    </Link>
  )
)

LinkButton.displayName = 'LinkButton'
