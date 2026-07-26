import { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ChevronLeft, ChevronRight, Check } from 'lucide-react'
import { requireRole } from '@/lib/route-guards'
import { isValidPhoneNumber } from '@repo/shared'
import { usePatients, usePatient, useUpdatePatient, type Patient } from '@/hooks/usePatients'
import { useEnum } from '@/i18n/useEnum'
import { useServiceLabel } from '@/i18n/useServiceLabel'
import { useFormat } from '@/i18n/useFormat'
import { apiErrorMessage } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
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

const PAGE_SIZE = 25
const PREFERRED_TIMES = ['morning', 'afternoon', 'evening'] as const

function PatientsPage() {
  const { t } = useTranslation('patients')
  const { t: tc } = useTranslation('common')
  const { formatDate } = useFormat()

  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const filters = useMemo(
    () => ({ search: search || undefined, page, limit: PAGE_SIZE }),
    [search, page],
  )
  const { data: patients, isLoading, isError } = usePatients(filters)
  const rows = patients ?? []

  return (
    <section className="space-y-4">
      <div className="max-w-sm">
        <Input
          value={search}
          placeholder={t('searchPlaceholder')}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
        />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border/60 bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">{t('columns.name')}</th>
              <th className="px-4 py-3 font-medium">{t('columns.phone')}</th>
              <th className="px-4 py-3 font-medium">{t('columns.email')}</th>
              <th className="px-4 py-3 font-medium">{t('columns.flags')}</th>
              <th className="px-4 py-3 font-medium">{t('columns.created')}</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  {tc('loading')}
                </td>
              </tr>
            )}
            {isError && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-destructive">
                  {tc('error')}
                </td>
              </tr>
            )}
            {!isLoading && !isError && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  {t('empty')}
                </td>
              </tr>
            )}
            {rows.map((p) => (
              <tr key={p.id} className="transition-colors even:bg-muted/20 hover:bg-primary-fixed/30">
                <td className="px-4 py-3 font-medium text-foreground">{p.name}</td>
                <td className="px-4 py-3">{p.phone ?? '—'}</td>
                <td className="px-4 py-3">{p.email ?? '—'}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {p.isNewPatient && <Badge variant="secondary">{t('flags.new')}</Badge>}
                    {p.callbackRequested && <Badge variant="outline">{t('flags.callback')}</Badge>}
                  </div>
                </td>
                <td className="px-4 py-3">{formatDate(new Date(p.createdAt), 'PP')}</td>
                <td className="px-4 py-3 text-right">
                  <Button variant="outline" size="sm" onClick={() => setSelectedId(p.id)}>
                    {t('view')}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-end gap-2">
        <span className="text-sm text-muted-foreground">{t('page', { page })}</span>
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          <ChevronLeft className="size-4" />
          {t('prev')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={rows.length < PAGE_SIZE}
          onClick={() => setPage((p) => p + 1)}
        >
          {t('next')}
          <ChevronRight className="size-4" />
        </Button>
      </div>

      {selectedId && <PatientDetail id={selectedId} onClose={() => setSelectedId(null)} />}
    </section>
  )
}

type EditValues = {
  name: string
  phone?: string
  email?: string
  reason?: string
  preferred_time?: string
  notes?: string
  is_new_patient: boolean
  callback_requested: boolean
}

function PatientDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const { t } = useTranslation('patients')
  const { t: tc } = useTranslation('common')
  const { tEnum } = useEnum()
  const { tService } = useServiceLabel()
  const { formatDate } = useFormat()
  const { data: patient, isLoading } = usePatient(id)
  const [editing, setEditing] = useState(false)

  return (
    <Dialog open variant="sheet" onOpenChange={(o) => !o && onClose()}>
      <DialogHeader>
        <DialogTitle>{patient?.name ?? tc('loading')}</DialogTitle>
        <DialogDescription>{t('detailSubtitle')}</DialogDescription>
      </DialogHeader>

      {isLoading || !patient ? (
        <p className="text-sm text-muted-foreground">{tc('loading')}</p>
      ) : editing ? (
        <PatientEditForm patient={patient} onDone={() => setEditing(false)} onCancel={() => setEditing(false)} />
      ) : (
        <div className="space-y-4">
          <div className="space-y-2 text-sm">
            {patient.phone && <Row label={t('columns.phone')} value={patient.phone} />}
            {patient.email && <Row label={t('columns.email')} value={patient.email} />}
            {patient.reason && <Row label={t('reason')} value={patient.reason} />}
            {patient.preferredTime && (
              <Row
                label={t('preferredTime')}
                value={t(`preferredTimes.${patient.preferredTime}`, {
                  defaultValue: patient.preferredTime,
                })}
              />
            )}
            <Row label={t('flags.new')} value={patient.isNewPatient ? t('yes') : t('no')} />
            <Row label={t('flags.callback')} value={patient.callbackRequested ? t('yes') : t('no')} />
            {patient.notes && <Row label={t('notes')} value={patient.notes} />}
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-foreground">{t('history')}</h3>
            {patient.appointments.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('noHistory')}</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {patient.appointments.map((a) => (
                  <li
                    key={a.id}
                    className="flex justify-between gap-3 rounded-lg px-2 py-1.5 even:bg-muted/30"
                  >
                    <span>
                      {formatDate(new Date(`${a.date}T00:00:00`), 'PP')} · {a.startTime}
                    </span>
                    <span className="text-muted-foreground">
                      {tService(a.appointmentType)} ·{' '}
                      {tEnum('appointmentStatus', a.status)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              {tc('close')}
            </Button>
            <Button onClick={() => setEditing(true)}>{tc('edit')}</Button>
          </DialogFooter>
        </div>
      )}
    </Dialog>
  )
}

function PatientEditForm({
  patient,
  onDone,
  onCancel,
}: {
  patient: Patient
  onDone: () => void
  onCancel: () => void
}) {
  const { t } = useTranslation('patients')
  const { t: tc } = useTranslation('common')
  const [error, setError] = useState<string | null>(null)
  const update = useUpdatePatient()

  const schema = useMemo(
    () =>
      z.object({
        name: z.string().min(1, t('nameRequired')),
        phone: z
          .string()
          .optional()
          .refine((v) => !v || isValidPhoneNumber(v), t('invalidPhone')),
        email: z.string().email(t('invalidEmail')).optional().or(z.literal('')),
        reason: z.string().optional(),
        preferred_time: z.string().optional(),
        notes: z.string().optional(),
        is_new_patient: z.boolean(),
        callback_requested: z.boolean(),
      }),
    [t],
  )

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EditValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: patient.name,
      phone: patient.phone ?? '',
      email: patient.email ?? '',
      reason: patient.reason ?? '',
      preferred_time: patient.preferredTime ?? '',
      notes: patient.notes ?? '',
      is_new_patient: patient.isNewPatient,
      callback_requested: patient.callbackRequested,
    },
  })

  const onSubmit = async (values: EditValues) => {
    setError(null)
    try {
      await update.mutateAsync({
        id: patient.id,
        name: values.name,
        phone: values.phone || undefined,
        email: values.email || undefined,
        reason: values.reason || undefined,
        preferred_time: values.preferred_time || undefined,
        notes: values.notes || undefined,
        is_new_patient: values.is_new_patient,
        callback_requested: values.callback_requested,
      })
      onDone()
    } catch (err) {
      setError(apiErrorMessage(err))
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="p-name">{t('columns.name')}</Label>
        <Input id="p-name" {...register('name')} />
        {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="p-phone">{t('columns.phone')}</Label>
          <Input id="p-phone" {...register('phone')} />
          {errors.phone && <p className="text-sm text-destructive">{errors.phone.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="p-email">{t('columns.email')}</Label>
          <Input id="p-email" type="email" {...register('email')} />
          {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="p-reason">{t('reason')}</Label>
        <Input id="p-reason" {...register('reason')} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="p-preferred">{t('preferredTime')}</Label>
        <Select id="p-preferred" {...register('preferred_time')}>
          <option value="">—</option>
          {PREFERRED_TIMES.map((pt) => (
            <option key={pt} value={pt}>
              {t(`preferredTimes.${pt}`)}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex gap-6">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4" {...register('is_new_patient')} />
          {t('flags.new')}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4" {...register('callback_requested')} />
          {t('flags.callback')}
        </label>
      </div>
      <div className="space-y-2">
        <Label htmlFor="p-notes">{t('notes')}</Label>
        <Textarea id="p-notes" {...register('notes')} />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          {tc('cancel')}
        </Button>
        <Button type="submit" variant="gradient" disabled={update.isPending}>
          <Check className="size-4" />
          {update.isPending ? tc('saving') : tc('save')}
        </Button>
      </DialogFooter>
    </form>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </div>
  )
}

export const Route = createFileRoute('/_auth/patients')({
  beforeLoad: () => requireRole(['ASSISTANT', 'ADMIN']),
  component: PatientsPage,
})
