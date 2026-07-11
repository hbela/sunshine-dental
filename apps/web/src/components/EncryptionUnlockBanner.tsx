import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Lock, LockOpen } from 'lucide-react'
import { useEncryptionStatus, useUnlockEncryption } from '@/hooks/useEncryptionStatus'
import { useRole } from '@/hooks/useRole'
import { apiErrorMessage } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

/**
 * Amber banner shown while patient-data encryption is locked (after every API
 * restart). ADMINs get an inline key input to unlock; other staff are told to
 * ask an administrator. Hidden entirely once unlocked.
 */
export function EncryptionUnlockBanner() {
  const { t } = useTranslation('common')
  const status = useEncryptionStatus()
  const { isAdmin } = useRole()
  const unlock = useUnlockEncryption()
  const [key, setKey] = useState('')

  if (status !== 'locked') return null

  const submit = () => {
    const trimmed = key.trim()
    if (!trimmed) return
    unlock.mutate(trimmed, { onSuccess: () => setKey('') })
  }

  return (
    <div className="border-b border-amber-500/30 bg-amber-500/10 px-6 py-3 text-sm text-amber-900 dark:text-amber-200">
      <div className="flex flex-wrap items-center gap-3">
        <Lock className="size-4 shrink-0" strokeWidth={1.75} />
        <span className="font-medium">
          {isAdmin ? t('encryption.lockedAdmin') : t('encryption.lockedStaff')}
        </span>
        {isAdmin && (
          <div className="flex flex-1 items-center justify-end gap-2">
            <Input
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder={t('encryption.keyPlaceholder')}
              autoComplete="off"
              className="max-w-sm font-mono"
              aria-label={t('encryption.keyPlaceholder')}
            />
            <Button size="sm" onClick={submit} disabled={!key.trim() || unlock.isPending}>
              <LockOpen className="size-4" />
              {unlock.isPending ? t('encryption.unlocking') : t('encryption.unlock')}
            </Button>
          </div>
        )}
      </div>
      {unlock.isError && (
        <p className="mt-1.5 pl-7 text-xs text-destructive">
          {apiErrorMessage(unlock.error, t('error'))}
        </p>
      )}
    </div>
  )
}
