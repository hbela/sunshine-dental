import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2 } from 'lucide-react'
import { useRole } from '@/hooks/useRole'
import { useProviders } from '@/hooks/useProviders'
import { useOwnProviderId } from '@/hooks/useProfile'
import { useUsersDirectory } from '@/hooks/useUsers'
import {
  useMyDelegations,
  useCreateDelegation,
  useUpdateDelegation,
  useDeleteDelegation,
  type Delegation,
} from '@/hooks/useDelegations'
import { useFormat } from '@/i18n/useFormat'
import { apiErrorMessage } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'

/** Calendar-delegation management — grant/edit/revoke assistant access. */
export function DelegationsSection() {
  const { t } = useTranslation('delegations')
  const { t: tc } = useTranslation('common')
  const { isAdmin } = useRole()
  const { formatDate } = useFormat()

  const { data, isLoading } = useMyDelegations()
  const { data: providers } = useProviders()
  const { data: assistants } = useUsersDirectory('ASSISTANT')
  const ownProviderId = useOwnProviderId()
  const del = useDeleteDelegation()
  const [showGrant, setShowGrant] = useState(false)

  const providerName = (providerId: string) =>
    providers?.find((p) => p.id === providerId)?.name ?? providerId
  const assistantName = (userId: string) =>
    assistants?.find((a) => a.id === userId)?.name ?? userId

  const owned = data?.owned ?? []
  const received = data?.received ?? []

  return (
    <div className="space-y-6">
      {/* Granted by me (PROVIDER owns; ADMIN can grant on behalf of providers) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">{t('owned')}</h3>
          <Button size="sm" variant="outline" onClick={() => setShowGrant((v) => !v)}>
            <Plus className="size-4" />
            {t('grant')}
          </Button>
        </div>

        {showGrant && (
          <GrantForm
            isAdmin={isAdmin}
            ownProviderId={ownProviderId}
            onDone={() => setShowGrant(false)}
          />
        )}

        {isLoading ? (
          <p className="text-sm text-muted-foreground">{tc('loading')}</p>
        ) : owned.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('noOwned')}</p>
        ) : (
          <ul className="space-y-2">
            {owned.map((d) => (
              <DelegationRow
                key={d.id}
                delegation={d}
                title={assistantName(d.delegateId)}
                editable
                onRevoke={() => del.mutate(d.id)}
              />
            ))}
          </ul>
        )}
      </div>

      {/* Granted to me */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">{t('received')}</h3>
        {received.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('noReceived')}</p>
        ) : (
          <ul className="space-y-2">
            {received.map((d) => (
              <li key={d.id} className="rounded-xl bg-muted/40 p-3 text-sm">
                <div className="font-medium text-foreground">{providerName(d.ownerId)}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {[d.canView && t('perms.view'), d.canEdit && t('perms.edit'), d.canBook && t('perms.book')]
                    .filter(Boolean)
                    .join(' · ')}
                  {(d.validFrom || d.validUntil) && (
                    <>
                      {' · '}
                      {d.validFrom ? formatDate(new Date(`${d.validFrom}T00:00:00`), 'PP') : '…'}
                      {' – '}
                      {d.validUntil ? formatDate(new Date(`${d.validUntil}T00:00:00`), 'PP') : '…'}
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function DelegationRow({
  delegation: d,
  title,
  editable,
  onRevoke,
}: {
  delegation: Delegation
  title: string
  editable?: boolean
  onRevoke: () => void
}) {
  const { t } = useTranslation('delegations')
  const { formatDate } = useFormat()
  const update = useUpdateDelegation()

  const toggle = (key: 'canView' | 'canEdit' | 'canBook') =>
    update.mutate({ id: d.id, [key]: !d[key] })

  return (
    <li className="rounded-xl bg-muted/40 p-3 text-sm">
      <div className="flex items-center justify-between">
        <span className="font-medium text-foreground">{title}</span>
        <Button variant="ghost" size="sm" onClick={onRevoke} aria-label={t('revoke')}>
          <Trash2 className="size-4 text-destructive" />
        </Button>
      </div>
      <div className="mt-2 flex flex-wrap gap-4">
        {(['canView', 'canEdit', 'canBook'] as const).map((key) => (
          <label key={key} className="flex items-center gap-1.5 text-xs">
            <input
              type="checkbox"
              className="size-3.5"
              checked={d[key]}
              disabled={!editable || update.isPending}
              onChange={() => toggle(key)}
            />
            {t(`perms.${key === 'canView' ? 'view' : key === 'canEdit' ? 'edit' : 'book'}`)}
          </label>
        ))}
      </div>
      {(d.validFrom || d.validUntil) && (
        <div className="mt-1 text-xs text-muted-foreground">
          {d.validFrom ? formatDate(new Date(`${d.validFrom}T00:00:00`), 'PP') : '…'}
          {' – '}
          {d.validUntil ? formatDate(new Date(`${d.validUntil}T00:00:00`), 'PP') : '…'}
        </div>
      )}
    </li>
  )
}

function GrantForm({
  isAdmin,
  ownProviderId,
  onDone,
}: {
  isAdmin: boolean
  ownProviderId: string | undefined
  onDone: () => void
}) {
  const { t } = useTranslation('delegations')
  const { t: tc } = useTranslation('common')
  const { data: providers } = useProviders()
  const { data: assistants } = useUsersDirectory('ASSISTANT')
  const create = useCreateDelegation()

  const [ownerId, setOwnerId] = useState(ownProviderId ?? '')
  const [delegateId, setDelegateId] = useState('')
  const [canView, setCanView] = useState(true)
  const [canEdit, setCanEdit] = useState(false)
  const [canBook, setCanBook] = useState(false)
  const [validFrom, setValidFrom] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [error, setError] = useState<string | null>(null)

  const resolvedOwner = isAdmin ? ownerId : ownProviderId ?? ''

  const canSubmit = useMemo(
    () => !!resolvedOwner && !!delegateId,
    [resolvedOwner, delegateId],
  )

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      await create.mutateAsync({
        ownerId: resolvedOwner,
        delegateId,
        canView,
        canEdit,
        canBook,
        validFrom: validFrom || undefined,
        validUntil: validUntil || undefined,
      })
      onDone()
    } catch (err) {
      setError(apiErrorMessage(err))
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-2xl bg-muted/50 p-4">
      {isAdmin && (
        <div className="space-y-1">
          <Label htmlFor="g-owner">{t('owner')}</Label>
          <Select id="g-owner" value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
            <option value="">{t('selectProvider')}</option>
            {(providers ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>
      )}
      <div className="space-y-1">
        <Label htmlFor="g-delegate">{t('delegate')}</Label>
        <Select id="g-delegate" value={delegateId} onChange={(e) => setDelegateId(e.target.value)}>
          <option value="">{t('selectAssistant')}</option>
          {(assistants ?? []).map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-1.5 text-sm">
          <input type="checkbox" className="size-4" checked={canView} onChange={(e) => setCanView(e.target.checked)} />
          {t('perms.view')}
        </label>
        <label className="flex items-center gap-1.5 text-sm">
          <input type="checkbox" className="size-4" checked={canEdit} onChange={(e) => setCanEdit(e.target.checked)} />
          {t('perms.edit')}
        </label>
        <label className="flex items-center gap-1.5 text-sm">
          <input type="checkbox" className="size-4" checked={canBook} onChange={(e) => setCanBook(e.target.checked)} />
          {t('perms.book')}
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="g-from">{t('validFrom')}</Label>
          <Input id="g-from" type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="g-until">{t('validUntil')}</Label>
          <Input id="g-until" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onDone}>
          {tc('cancel')}
        </Button>
        <Button type="submit" variant="gradient" size="sm" disabled={!canSubmit || create.isPending}>
          {create.isPending ? tc('saving') : t('grant')}
        </Button>
      </div>
    </form>
  )
}
