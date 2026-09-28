import type { ReactNode } from 'react'
import { cn } from '../../utils'

export interface PageContainerProps {
  children: ReactNode
  className?: string
  variant?: 'default' | 'narrow' | 'wide' | 'full'
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl'
}

const variantClasses = {
  default: 'max-w-7xl',
  narrow: 'max-w-3xl',
  wide: 'max-w-[90rem]',
  full: 'max-w-full',
}

const paddingClasses = {
  none: '',
  sm: 'px-4 sm:px-6',
  md: 'px-4 sm:px-6 lg:px-8',
  lg: 'px-4 sm:px-6 lg:px-8 xl:px-12',
  xl: 'px-4 sm:px-6 lg:px-8 xl:px-16',
}

export function PageContainer({ 
  children, 
  className, 
  variant = 'default', 
  padding = 'md',
  ...props 
}: PageContainerProps) {
  return (
    <div
      className={cn(
        'mx-auto w-full',
        variantClasses[variant],
        paddingClasses[padding],
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function Section({ 
  children, 
  className, 
  padding = 'md',
  ...props 
}: { 
  children: ReactNode
  className?: string
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl'
}) {
  const paddingClasses = {
    none: '',
    sm: 'py-8',
    md: 'py-12 lg:py-16',
    lg: 'py-16 lg:py-24',
    xl: 'py-20 lg:py-32',
  }

  return (
    <section className={cn(paddingClasses[padding], className)} {...props}>
      {children}
    </section>
  )
}

export function PageHeader({ 
  title, 
  subtitle, 
  action, 
  className 
}: { 
  title: string
  subtitle?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8', className)}>
      <div>
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-dark-50 mb-2">{title}</h1>
        {subtitle && <p className="text-dark-400 text-lg">{subtitle}</p>}
      </div>
      {action && <div className="flex-shrink-0 mt-4 sm:mt-0">{action}</div>}
    </div>
  )
}