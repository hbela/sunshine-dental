import * as React from 'react'
import { cn } from '@/lib/utils'

/** Lightweight styled native <select>. */
export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        'flex h-10 w-full rounded-xl border border-transparent bg-muted px-3.5 py-2 text-sm transition-colors focus-visible:border-transparent focus-visible:bg-primary-fixed focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
)
Select.displayName = 'Select'
