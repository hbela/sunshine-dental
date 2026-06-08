import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import { AppointmentTypeSchema } from '@repo/shared'
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { apiErrorMessage } from '@/lib/api'
import { isoToWall, wallToDateTimeParts } from '@/lib/calendar-utils'
import {
  useBookAppointment,
  useCancelAppointment,
  useCompleteAppointment,
  type CalendarItem,
} from '@/hooks/useCalendar'

const APPOINTMENT_TYPES = AppointmentTypeSchema.options

const bookSchema = z.object({
  patient_name: z.string().min(1, 'Patient name is required'),
  phone: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  appointment_type: z.string().min(1),
  date: z.string().min(1),
  time: z.string().min(1),
  notes: z.string().optional(),
})

type BookValues = z.infer<typeof bookSchema>

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'view' | 'create'
  providerId: string
  /** view mode: the appointment event that was clicked */
  item?: CalendarItem
  /** create mode: the slot start (wall-clock) */
  slotStart?: Date
}

export function AppointmentModal({ open, onOpenChange, mode, providerId, item, slotStart }: Props) {
  if (mode === 'view') {
    return <ViewAppointment open={open} onOpenChange={onOpenChange} item={item} />
  }
  return (
    <CreateAppointment
      open={open}
      onOpenChange={onOpenChange}
      providerId={providerId}
      slotStart={slotStart}
    />
  )
}

function ViewAppointment({
  open,
  onOpenChange,
  item,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  item?: CalendarItem
}) {
  const [error, setError] = useState<string | null>(null)
  const cancel = useCancelAppointment()
  const complete = useCompleteAppointment()

  if (!item || !item.appointmentId) return null

  const start = isoToWall(item.start)
  const end = isoToWall(item.end)
  const isConfirmed = item.status === 'CONFIRMED'

  const run = async (fn: () => Promise<unknown>) => {
    setError(null)
    try {
      await fn()
      onOpenChange(false)
    } catch (err) {
      setError(apiErrorMessage(err))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>{item.patientName}</DialogTitle>
        <DialogDescription>
          {item.appointmentType} · {item.status}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-2 text-sm">
        <Row label="Date" value={format(start, 'EEE, MMM d, yyyy')} />
        <Row label="Time" value={`${format(start, 'HH:mm')} – ${format(end, 'HH:mm')}`} />
        {item.patientPhone && <Row label="Phone" value={item.patientPhone} />}
        {item.notes && <Row label="Notes" value={item.notes} />}
      </div>

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Close
        </Button>
        {isConfirmed && (
          <>
            <Button
              variant="destructive"
              disabled={cancel.isPending}
              onClick={() => run(() => cancel.mutateAsync(item.appointmentId as string))}
            >
              {cancel.isPending ? 'Cancelling…' : 'Cancel appointment'}
            </Button>
            <Button
              disabled={complete.isPending}
              onClick={() => run(() => complete.mutateAsync(item.appointmentId as string))}
            >
              {complete.isPending ? 'Completing…' : 'Mark completed'}
            </Button>
          </>
        )}
      </DialogFooter>
    </Dialog>
  )
}

function CreateAppointment({
  open,
  onOpenChange,
  providerId,
  slotStart,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  providerId: string
  slotStart?: Date
}) {
  const [error, setError] = useState<string | null>(null)
  const book = useBookAppointment()
  const parts = slotStart ? wallToDateTimeParts(slotStart) : { date: '', time: '' }

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<BookValues>({
    resolver: zodResolver(bookSchema),
    defaultValues: {
      patient_name: '',
      phone: '',
      email: '',
      appointment_type: APPOINTMENT_TYPES[0],
      date: parts.date,
      time: parts.time,
      notes: '',
    },
  })

  const onSubmit = async (values: BookValues) => {
    setError(null)
    try {
      await book.mutateAsync({
        provider_id: providerId,
        patient_name: values.patient_name,
        phone: values.phone || undefined,
        email: values.email || undefined,
        appointment_type: values.appointment_type,
        date: values.date,
        time: values.time,
        notes: values.notes || undefined,
      })
      onOpenChange(false)
    } catch (err) {
      setError(apiErrorMessage(err))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>Book appointment</DialogTitle>
        <DialogDescription>Create a new appointment for this provider.</DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="patient_name">Patient name</Label>
          <Input id="patient_name" {...register('patient_name')} />
          {errors.patient_name && (
            <p className="text-sm text-destructive">{errors.patient_name.message}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" {...register('phone')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" {...register('email')} />
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="appointment_type">Type</Label>
          <Select id="appointment_type" {...register('appointment_type')}>
            {APPOINTMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, ' ')}
              </option>
            ))}
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <Input id="date" type="date" {...register('date')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="time">Time</Label>
            <Input id="time" type="time" {...register('time')} />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Notes</Label>
          <Textarea id="notes" {...register('notes')} />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" disabled={book.isPending}>
            {book.isPending ? 'Booking…' : 'Book'}
          </Button>
        </DialogFooter>
      </form>
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
