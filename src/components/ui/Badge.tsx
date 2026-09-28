import React from 'react'
import { cn } from '../../utils'
import { CheckCircle2, Award } from 'lucide-react'

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'verified' | 'premium' | 'new' | 'online' | 'success' | 'warning'
  size?: 'sm' | 'md' | 'lg'
  icon?: React.ReactNode
}

export function Badge({ 
  className, 
  variant = 'default', 
  size = 'md', 
  icon, 
  children, 
  ...props 
}: BadgeProps) {
  const variants = {
    default: 'bg-dark-800 border border-dark-700 text-dark-300',
    verified: 'bg-primary-600/20 border-primary-500/30 text-primary-400',
    premium: 'bg-accent-gold/20 border-accent-gold/30 text-accent-gold',
    new: 'bg-accent-emerald/20 border-accent-emerald/30 text-accent-emerald',
    online: 'bg-accent-emerald/20 border-accent-emerald/30 text-accent-emerald',
    success: 'bg-accent-emerald/20 border-accent-emerald/30 text-accent-emerald',
    warning: 'bg-accent-gold/20 border-accent-gold/30 text-accent-gold',
  }

  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
    lg: 'px-3 py-1.5 text-base',
  }

  const defaultIcons = {
    verified: <CheckCircle2 className="w-3 h-3" />,
    premium: <Award className="w-3 h-3" />,
    online: <span className="w-1.5 h-1.5 rounded-full bg-accent-emerald animate-pulse-soft" />,
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-medium rounded-full',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {icon || defaultIcons[variant as keyof typeof defaultIcons] || null}
      {children}
    </span>
  )
}