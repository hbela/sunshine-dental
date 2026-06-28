import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { authClient } from '@/auth-client'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { useRole } from '@/hooks/useRole'
import { useOwnProviderId, useProvider, useUpdateMyProvider } from '@/hooks/useProfile'
import { DelegationsSection } from '@/components/settings/DelegationsSection'
import { apiErrorMessage } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

function SettingsCard({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border bg-card p-6">
      <h2 className="text-lg font-medium text-foreground">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      <div className="mt-4">{children}</div>
    </div>
  )
}

function AccountSection() {
  const { t } = useTranslation('settings')
  const { t: tc } = useTranslation('common')
  const { data: session } = authClient.useSession()
  const [name, setName] = useState('')
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (session?.user?.name) setName(session.user.name)
  }, [session?.user?.name])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setStatus('saving')
    const { error } = await authClient.updateUser({ name })
    if (error) {
      setError(error.message ?? tc('error'))
      setStatus('idle')
    } else {
      setStatus('saved')
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="acc-name">{t('account.name')}</Label>
        <Input
          id="acc-name"
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            setStatus('idle')
          }}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="acc-email">{t('account.email')}</Label>
        <Input id="acc-email" value={session?.user?.email ?? ''} disabled />
        <p className="text-xs text-muted-foreground">{t('account.emailReadonly')}</p>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex items-center gap-3">
        <Button type="submit" variant="gradient" disabled={status === 'saving' || !name.trim()}>
          {status === 'saving' ? tc('saving') : tc('save')}
        </Button>
        {status === 'saved' && <Badge variant="secondary">{t('saved')}</Badge>}
      </div>
    </form>
  )
}

function PasswordSection() {
  const { t } = useTranslation('settings')
  const { t: tc } = useTranslation('common')
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (next.length < 8) {
      setError(t('password.tooShort'))
      return
    }
    setStatus('saving')
    const { error } = await authClient.changePassword({
      currentPassword: current,
      newPassword: next,
      revokeOtherSessions: true,
    })
    if (error) {
      setError(error.message ?? tc('error'))
      setStatus('idle')
    } else {
      setStatus('saved')
      setCurrent('')
      setNext('')
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="pw-current">{t('password.current')}</Label>
        <Input
          id="pw-current"
          type="password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="pw-new">{t('password.new')}</Label>
        <Input id="pw-new" type="password" value={next} onChange={(e) => setNext(e.target.value)} />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex items-center gap-3">
        <Button type="submit" variant="gradient" disabled={status === 'saving' || !current || !next}>
          {status === 'saving' ? tc('saving') : t('password.change')}
        </Button>
        {status === 'saved' && <Badge variant="secondary">{t('saved')}</Badge>}
      </div>
    </form>
  )
}

function ProviderProfileSection() {
  const { t } = useTranslation('settings')
  const { t: tc } = useTranslation('common')
  const providerId = useOwnProviderId()
  const { data: provider } = useProvider(providerId)
  const update = useUpdateMyProvider()

  const [specialty, setSpecialty] = useState('')
  const [phone, setPhone] = useState('')
  const [bio, setBio] = useState('')
  const [status, setStatus] = useState<'idle' | 'saved'>('idle')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!provider) return
    setSpecialty(provider.specialty ?? '')
    setPhone(provider.phone ?? '')
    setBio(provider.bio ?? '')
  }, [provider])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      await update.mutateAsync({
        specialty: specialty || undefined,
        phone: phone || undefined,
        bio: bio || undefined,
      })
      setStatus('saved')
    } catch (err) {
      setError(apiErrorMessage(err))
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="pr-specialty">{t('provider.specialty')}</Label>
        <Input
          id="pr-specialty"
          value={specialty}
          onChange={(e) => {
            setSpecialty(e.target.value)
            setStatus('idle')
          }}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="pr-phone">{t('provider.phone')}</Label>
        <Input
          id="pr-phone"
          value={phone}
          onChange={(e) => {
            setPhone(e.target.value)
            setStatus('idle')
          }}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="pr-bio">{t('provider.bio')}</Label>
        <Textarea
          id="pr-bio"
          value={bio}
          onChange={(e) => {
            setBio(e.target.value)
            setStatus('idle')
          }}
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex items-center gap-3">
        <Button type="submit" variant="gradient" disabled={update.isPending}>
          {update.isPending ? tc('saving') : tc('save')}
        </Button>
        {status === 'saved' && <Badge variant="secondary">{t('saved')}</Badge>}
      </div>
    </form>
  )
}

function SettingsPage() {
  const { t } = useTranslation('settings')
  const { t: td } = useTranslation('delegations')
  const { isProvider, isAdmin } = useRole()

  return (
    <section className="max-w-2xl space-y-4">
      <SettingsCard title={t('account.title')} description={t('account.description')}>
        <AccountSection />
      </SettingsCard>

      <SettingsCard title={t('password.title')} description={t('password.description')}>
        <PasswordSection />
      </SettingsCard>

      {isProvider && (
        <SettingsCard title={t('provider.title')} description={t('provider.description')}>
          <ProviderProfileSection />
        </SettingsCard>
      )}

      {(isProvider || isAdmin) && (
        <SettingsCard title={td('title')} description={td('description')}>
          <DelegationsSection />
        </SettingsCard>
      )}

      <SettingsCard title={t('language')} description={t('languageDescription')}>
        <LanguageSwitcher />
      </SettingsCard>
    </section>
  )
}

export const Route = createFileRoute('/_auth/settings')({
  component: SettingsPage,
})
