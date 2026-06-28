import { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Trash2 } from 'lucide-react'
import { requireRole } from '@/lib/route-guards'
import {
  useAdminUsers,
  useCreateUser,
  useUpdateUserRole,
  useDeleteUser,
  type AdminUser,
} from '@/hooks/useAdminUsers'
import type { Role } from '@/hooks/useRole'
import { useEnum } from '@/i18n/useEnum'
import { useFormat } from '@/i18n/useFormat'
import { apiErrorMessage } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

const ALL_ROLES: Role[] = ['PROVIDER', 'ASSISTANT', 'ADMIN']

function UsersPage() {
  const { t } = useTranslation('admin')
  const { t: tc } = useTranslation('common')
  const { tEnum } = useEnum()
  const { formatDate } = useFormat()

  const [roleFilter, setRoleFilter] = useState<Role | ''>('')
  const [creating, setCreating] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null)

  const { data: users, isLoading, isError } = useAdminUsers(roleFilter)
  const updateRole = useUpdateUserRole()
  const rows = users ?? []

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold text-foreground">{t('title')}</h1>
        <Button variant="gradient" onClick={() => setCreating(true)}>
          <Plus className="size-4" />
          {t('createUser')}
        </Button>
      </div>

      <div className="max-w-xs space-y-1">
        <Label htmlFor="f-role">{t('filterByRole')}</Label>
        <Select
          id="f-role"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as Role | '')}
        >
          <option value="">{t('allRoles')}</option>
          {ALL_ROLES.map((r) => (
            <option key={r} value={r}>
              {tEnum('role', r)}
            </option>
          ))}
        </Select>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border/60 bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">{t('columns.name')}</th>
              <th className="px-4 py-3 font-medium">{t('columns.email')}</th>
              <th className="px-4 py-3 font-medium">{t('columns.role')}</th>
              <th className="px-4 py-3 font-medium">{t('columns.created')}</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  {tc('loading')}
                </td>
              </tr>
            )}
            {isError && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-destructive">
                  {tc('error')}
                </td>
              </tr>
            )}
            {!isLoading && !isError && rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  {t('empty')}
                </td>
              </tr>
            )}
            {rows.map((u) => (
              <tr key={u.id} className="transition-colors even:bg-muted/20 hover:bg-primary-fixed/30">
                <td className="px-4 py-3 font-medium text-foreground">{u.name}</td>
                <td className="px-4 py-3">{u.email}</td>
                <td className="px-4 py-3">
                  <Select
                    className="h-9 w-40"
                    value={u.role}
                    disabled={updateRole.isPending}
                    onChange={(e) =>
                      updateRole.mutate({ id: u.id, role: e.target.value as Role })
                    }
                  >
                    {ALL_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {tEnum('role', r)}
                      </option>
                    ))}
                  </Select>
                </td>
                <td className="px-4 py-3">{formatDate(new Date(u.createdAt), 'PP')}</td>
                <td className="px-4 py-3 text-right">
                  <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(u)}>
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {creating && <CreateUserModal onClose={() => setCreating(false)} />}
      {deleteTarget && (
        <DeleteUserModal user={deleteTarget} onClose={() => setDeleteTarget(null)} />
      )}
    </section>
  )
}

type CreateValues = {
  name: string
  email: string
  password: string
  role: 'PROVIDER' | 'ASSISTANT'
  specialty?: string
  phone?: string
  bio?: string
}

function CreateUserModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('admin')
  const { t: tc } = useTranslation('common')
  const { tEnum } = useEnum()
  const [error, setError] = useState<string | null>(null)
  const [createdPassword, setCreatedPassword] = useState<string | null>(null)
  const create = useCreateUser()

  const schema = useMemo(
    () =>
      z.object({
        name: z.string().min(1, t('validation.nameRequired')),
        email: z.string().email(t('validation.invalidEmail')),
        password: z.string().min(8, t('validation.passwordMin')),
        role: z.enum(['PROVIDER', 'ASSISTANT']),
        specialty: z.string().optional(),
        phone: z.string().optional(),
        bio: z.string().optional(),
      }),
    [t],
  )

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<CreateValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', password: '', role: 'ASSISTANT' },
  })

  const role = watch('role')

  const onSubmit = async (values: CreateValues) => {
    setError(null)
    try {
      const result = await create.mutateAsync({
        name: values.name,
        email: values.email,
        password: values.password,
        role: values.role,
        specialty: values.role === 'PROVIDER' ? values.specialty || undefined : undefined,
        phone: values.role === 'PROVIDER' ? values.phone || undefined : undefined,
        bio: values.role === 'PROVIDER' ? values.bio || undefined : undefined,
      })
      setCreatedPassword(result.temporaryPassword)
    } catch (err) {
      setError(apiErrorMessage(err))
    }
  }

  if (createdPassword) {
    return (
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogHeader>
          <DialogTitle>{t('createdTitle')}</DialogTitle>
          <DialogDescription>{t('createdDescription')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label>{t('temporaryPassword')}</Label>
          <div className="flex gap-2">
            <Input readOnly value={createdPassword} className="font-mono" />
            <Button
              type="button"
              variant="outline"
              onClick={() => navigator.clipboard?.writeText(createdPassword)}
            >
              {t('copy')}
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onClose}>{tc('close')}</Button>
        </DialogFooter>
      </Dialog>
    )
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogHeader>
        <DialogTitle>{t('createUser')}</DialogTitle>
        <DialogDescription>{t('createDescription')}</DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="u-name">{t('columns.name')}</Label>
          <Input id="u-name" {...register('name')} />
          {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="u-email">{t('columns.email')}</Label>
          <Input id="u-email" type="email" {...register('email')} />
          {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="u-password">{t('password')}</Label>
            <Input id="u-password" {...register('password')} />
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="u-role">{t('columns.role')}</Label>
            <Select id="u-role" {...register('role')}>
              <option value="ASSISTANT">{tEnum('role', 'ASSISTANT')}</option>
              <option value="PROVIDER">{tEnum('role', 'PROVIDER')}</option>
            </Select>
          </div>
        </div>

        {role === 'PROVIDER' && (
          <div className="space-y-4 rounded-2xl bg-muted/50 p-4">
            <div className="space-y-2">
              <Label htmlFor="u-specialty">{t('provider.specialty')}</Label>
              <Input id="u-specialty" {...register('specialty')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="u-phone">{t('provider.phone')}</Label>
              <Input id="u-phone" {...register('phone')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="u-bio">{t('provider.bio')}</Label>
              <Textarea id="u-bio" {...register('bio')} />
            </div>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {tc('cancel')}
          </Button>
          <Button type="submit" variant="gradient" disabled={create.isPending}>
            {create.isPending ? t('creating') : t('createUser')}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}

function DeleteUserModal({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const { t } = useTranslation('admin')
  const { t: tc } = useTranslation('common')
  const [error, setError] = useState<string | null>(null)
  const del = useDeleteUser()

  const onConfirm = async () => {
    setError(null)
    try {
      await del.mutateAsync(user.id)
      onClose()
    } catch (err) {
      setError(apiErrorMessage(err))
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogHeader>
        <DialogTitle>{t('deleteTitle')}</DialogTitle>
        <DialogDescription>{t('deleteConfirm', { name: user.name })}</DialogDescription>
      </DialogHeader>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          {tc('cancel')}
        </Button>
        <Button variant="destructive" disabled={del.isPending} onClick={onConfirm}>
          {del.isPending ? tc('deleting') : tc('delete')}
        </Button>
      </DialogFooter>
    </Dialog>
  )
}

export const Route = createFileRoute('/_auth/admin/users')({
  beforeLoad: () => requireRole(['ADMIN']),
  component: UsersPage,
})
