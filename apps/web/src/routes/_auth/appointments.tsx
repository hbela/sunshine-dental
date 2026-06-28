import { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { AppointmentTypeSchema, AppointmentStatusSchema } from '@repo/shared'
import { requireRole } from '@/lib/route-guards'
import { useRole } from '@/hooks/useRole'
import { useProviders } from '@/hooks/useProviders'
import {
  useAppointments,
  useCancelAppointmentById,
  useCompleteAppointmentById,
  type Appointment,
} from '@/hooks/useAppointments'
import { useEnum } from '@/i18n/useEnum'
import { useFormat } from '@/i18n/useFormat'
import { apiErrorMessage } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

const PAGE_SIZE = 25
const STATUSES = AppointmentStatusSchema.options
const TYPES = AppointmentTypeSchema.options

/** Parse a `YYYY-MM-DD` date string to a local Date for display formatting. */
function parseDate(d: string) {
  return new Date(`${d}T00:00:00`)
}

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline'

function statusVariant(status: string): BadgeVariant {
  switch (status) {
    case 'CONFIRMED':
      return 'default'
    case 'COMPLETED':
      return 'secondary'
    case 'CANCELLED':
    case 'NO_SHOW':
      return 'destructive'
    default:
      return 'outline'
  }
}

function AppointmentsPage() {
  const { t } = useTranslation('appointments')
  const { t: tc } = useTranslation('common')
  const { tEnum } = useEnum()
  const { formatDate } = useFormat()
  const { canManageAppointments } = useRole()
  const { data: providers } = useProviders()

  const [providerId, setProviderId] = useState('')
  const [status, setStatus] = useState('')
  const [date, setDate] = useState('')
  const [patientName, setPatientName] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Appointment | null>(null)

  const filters = useMemo(
    () => ({
      provider_id: providerId || undefined,
      status: status || undefined,
      date: date || undefined,
      patient_name: patientName || undefined,
      page,
      limit: PAGE_SIZE,
    }),
    [providerId, status, date, patientName, page],
  )

  const { data: appointments, isLoading, isError } = useAppointments(filters)
  const rows = appointments ?? []
  const resetPage = () => setPage(1)

  return (
    <section className="space-y-4">
      {/* Filters */}
      <div className="grid grid-cols-1 gap-3 rounded-2xl bg-muted/50 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1">
          <Label htmlFor="f-provider">{t('filters.provider')}</Label>
          <Select
            id="f-provider"
            value={providerId}
            onChange={(e) => {
              setProviderId(e.target.value)
              resetPage()
            }}
          >
            <option value="">{t('filters.allProviders')}</option>
            {(providers ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="f-status">{t('filters.status')}</Label>
          <Select
            id="f-status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value)
              resetPage()
            }}
          >
            <option value="">{t('filters.allStatuses')}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {tEnum('appointmentStatus', s)}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="f-date">{t('filters.date')}</Label>
          <Input
            id="f-date"
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value)
              resetPage()
            }}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="f-patient">{t('filters.patient')}</Label>
          <Input
            id="f-patient"
            value={patientName}
            placeholder={t('filters.patientPlaceholder')}
            onChange={(e) => {
              setPatientName(e.target.value)
              resetPage()
            }}
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-border/60 bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">{t('columns.date')}</th>
              <th className="px-4 py-3 font-medium">{t('columns.time')}</th>
              <th className="px-4 py-3 font-medium">{t('columns.patient')}</th>
              <th className="px-4 py-3 font-medium">{t('columns.provider')}</th>
              <th className="px-4 py-3 font-medium">{t('columns.type')}</th>
              <th className="px-4 py-3 font-medium">{t('columns.status')}</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  {tc('loading')}
                </td>
              </tr>
            )}
            {isError && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-destructive">
                  {tc('error')}
                </td>
              </tr>
            )}
            {!isLoading && !isError && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  {t('empty')}
                </td>
              </tr>
            )}
            {rows.map((a) => (
              <tr key={a.id} className="transition-colors even:bg-muted/20 hover:bg-primary-fixed/30">
                <td className="px-4 py-3">{formatDate(parseDate(a.date), 'PP')}</td>
                <td className="px-4 py-3">
                  {a.startTime}–{a.endTime}
                </td>
                <td className="px-4 py-3 font-medium text-foreground">{a.patientName}</td>
                <td className="px-4 py-3">{a.providerName}</td>
                <td className="px-4 py-3">{tEnum('appointmentType', a.appointmentType)}</td>
                <td className="px-4 py-3">
                  <Badge variant={statusVariant(a.status)}>
                    {tEnum('appointmentStatus', a.status)}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  <Button variant="outline" size="sm" onClick={() => setSelected(a)}>
                    {t('view')}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
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

      {selected && (
        <AppointmentDetail
          appointment={selected}
          canManage={canManageAppointments}
          onClose={() => setSelected(null)}
        />
      )}
    </section>
  )
}

function AppointmentDetail({
  appointment,
  canManage,
  onClose,
}: {
  appointment: Appointment
  canManage: boolean
  onClose: () => void
}) {
  const { t } = useTranslation('appointments')
  const { t: tc } = useTranslation('common')
  const { tEnum } = useEnum()
  const { formatDate } = useFormat()
  const [error, setError] = useState<string | null>(null)
  const cancel = useCancelAppointmentById()
  const complete = useCompleteAppointmentById()

  const isConfirmed = appointment.status === 'CONFIRMED'

  const run = async (fn: () => Promise<unknown>) => {
    setError(null)
    try {
      await fn()
      onClose()
    } catch (err) {
      setError(apiErrorMessage(err))
    }
  }

  return (
    <Dialog open variant="sheet" onOpenChange={(o) => !o && onClose()}>
      <DialogHeader>
        <DialogTitle>{appointment.patientName}</DialogTitle>
        <DialogDescription>
          {tEnum('appointmentType', appointment.appointmentType)} ·{' '}
          {tEnum('appointmentStatus', appointment.status)}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-2 text-sm">
        <Row label={t('columns.date')} value={formatDate(parseDate(appointment.date), 'PP')} />
        <Row
          label={t('columns.time')}
          value={`${appointment.startTime}–${appointment.endTime}`}
        />
        <Row label={t('columns.provider')} value={appointment.providerName} />
        {appointment.patientPhone && <Row label={t('phone')} value={appointment.patientPhone} />}
        {appointment.patientEmail && <Row label={t('email')} value={appointment.patientEmail} />}
        {appointment.notes && <Row label={t('notes')} value={appointment.notes} />}
      </div>

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          {tc('close')}
        </Button>
        {isConfirmed && (
          <Button
            variant="destructive"
            disabled={cancel.isPending}
            onClick={() => run(() => cancel.mutateAsync(appointment.id))}
          >
            {cancel.isPending ? t('cancelling') : t('cancelAppointment')}
          </Button>
        )}
        {isConfirmed && canManage && (
          <Button
            disabled={complete.isPending}
            onClick={() => run(() => complete.mutateAsync(appointment.id))}
          >
            {complete.isPending ? t('completing') : t('markCompleted')}
          </Button>
        )}
      </DialogFooter>
    </Dialog>
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

export const Route = createFileRoute('/_auth/appointments')({
  beforeLoad: () => requireRole(['PROVIDER', 'ASSISTANT', 'ADMIN']),
  component: AppointmentsPage,
})
