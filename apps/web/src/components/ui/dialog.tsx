import * as React from 'react'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
  /** 'center' = modal dialog (forms); 'sheet' = right-anchored glass side-sheet (detail views). */
  variant?: 'center' | 'sheet'
}

export function Dialog({ open, onOpenChange, children, variant = 'center' }: DialogProps) {
  const { t } = useTranslation('common')
  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onOpenChange])

  if (!open) return null

  const closeButton = (
    <button
      type="button"
      aria-label={t('close')}
      className="absolute right-4 top-4 z-10 flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      onClick={() => onOpenChange(false)}
    >
      <X className="size-4" />
    </button>
  )

  if (variant === 'sheet') {
    return (
      <div className="fixed inset-0 z-50 flex justify-end">
        <div
          className="animate-scrim-in fixed inset-0 bg-foreground/20 backdrop-blur-[2px]"
          onClick={() => onOpenChange(false)}
        />
        <div className="animate-sheet-in relative z-10 flex h-full w-full max-w-md flex-col overflow-y-auto rounded-l-3xl bg-card/95 p-7 shadow-2xl backdrop-blur-xl">
          {closeButton}
          {children}
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="animate-scrim-in fixed inset-0 bg-foreground/20 backdrop-blur-[2px]"
        onClick={() => onOpenChange(false)}
      />
      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-border/60 bg-card p-6 shadow-2xl">
        {closeButton}
        {children}
      </div>
    </div>
  )
}

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mb-4 flex flex-col space-y-1.5 pr-6', className)} {...props} />
}

export function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn('text-lg font-semibold leading-none tracking-tight', className)} {...props} />
}

export function DialogDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-sm text-muted-foreground', className)} {...props} />
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
      {...props}
    />
  )
}
