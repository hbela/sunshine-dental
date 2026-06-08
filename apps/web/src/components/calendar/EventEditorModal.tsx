import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
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
import { isoToWall, wallToInputValue, inputValueToWall, wallToIso } from '@/lib/calendar-utils'
import {
  useCreateEvent,
  useUpdateEvent,
  useDeleteEvent,
  type CalendarItem,
} from '@/hooks/useCalendar'

const eventSchema = z
  .object({
    title: z.string().min(1, 'Title is required'),
    type: z.enum(['AVAILABLE', 'BLOCKED', 'VACATION']),
    start: z.string().min(1, 'Start is required'),
    end: z.string().min(1, 'End is required'),
    allDay: z.boolean(),
    notes: z.string().optional(),
  })
  .refine((v) => inputValueToWall(v.end) > inputValueToWall(v.start), {
    message: 'End must be after start',
    path: ['end'],
  })

type EventValues = z.infer<typeof eventSchema>

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  providerId: string
  slotStart?: Date
  slotEnd?: Date
  item?: CalendarItem
}

export function EventEditorModal({ open, onOpenChange, providerId, slotStart, slotEnd, item }: Props) {
  const [error, setError] = useState<string | null>(null)
  const create = useCreateEvent()
  const update = useUpdateEvent()
  const remove = useDeleteEvent()

  const isEdit = !!item && item.kind === 'availability'

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EventValues>({
    resolver: zodResolver(eventSchema),
    defaultValues: isEdit
      ? {
          title: item!.title,
          type: item!.eventType ?? 'AVAILABLE',
          start: wallToInputValue(isoToWall(item!.start)),
          end: wallToInputValue(isoToWall(item!.end)),
          allDay: item!.allDay,
          notes: item!.notes ?? '',
        }
      : {
          title: 'Availability',
          type: 'AVAILABLE',
          start: slotStart ? wallToInputValue(slotStart) : '',
          end: slotEnd ? wallToInputValue(slotEnd) : '',
          allDay: false,
          notes: '',
        },
  })

  const onSubmit = async (values: EventValues) => {
    setError(null)
    const payload = {
      providerId,
      title: values.title,
      type: values.type,
      start: wallToIso(inputValueToWall(values.start)),
      end: wallToIso(inputValueToWall(values.end)),
      allDay: values.allDay,
      notes: values.notes || undefined,
    }
    try {
      if (isEdit) {
        await update.mutateAsync({ id: item!.id, ...payload })
      } else {
        await create.mutateAsync(payload)
      }
      onOpenChange(false)
    } catch (err) {
      setError(apiErrorMessage(err))
    }
  }

  const onDelete = async () => {
    if (!isEdit) return
    setError(null)
    try {
      await remove.mutateAsync(item!.id)
      onOpenChange(false)
    } catch (err) {
      setError(apiErrorMessage(err))
    }
  }

  const saving = create.isPending || update.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>{isEdit ? 'Edit calendar event' : 'Add calendar event'}</DialogTitle>
        <DialogDescription>Availability, blocked time, or vacation.</DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input id="title" {...register('title')} />
          {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="type">Type</Label>
          <Select id="type" {...register('type')}>
            <option value="AVAILABLE">Available</option>
            <option value="BLOCKED">Blocked</option>
            <option value="VACATION">Vacation</option>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="start">Start</Label>
            <Input id="start" type="datetime-local" {...register('start')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="end">End</Label>
            <Input id="end" type="datetime-local" {...register('end')} />
            {errors.end && <p className="text-sm text-destructive">{errors.end.message}</p>}
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-foreground">
          <input type="checkbox" className="size-4" {...register('allDay')} />
          All day
        </label>

        <div className="space-y-2">
          <Label htmlFor="notes">Notes</Label>
          <Textarea id="notes" {...register('notes')} />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          {isEdit && (
            <Button
              type="button"
              variant="destructive"
              className="sm:mr-auto"
              disabled={remove.isPending}
              onClick={onDelete}
            >
              {remove.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          )}
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}
