import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
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
import { useEnum } from '@/i18n/useEnum'
import { isoToWall, wallToInputValue, inputValueToWall, wallToIso } from '@/lib/calendar-utils'
import {
  useCreateEvent,
  useUpdateEvent,
  useDeleteEvent,
  type CalendarItem,
} from '@/hooks/useCalendar'

const EVENT_TYPES = ['AVAILABLE', 'BLOCKED', 'VACATION'] as const

type EventValues = {
  title: string
  type: (typeof EVENT_TYPES)[number]
  start: string
  end: string
  allDay: boolean
  notes?: string
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  providerId: string
  slotStart?: Date
  slotEnd?: Date
  item?: CalendarItem
}

export function EventEditorModal({ open, onOpenChange, providerId, slotStart, slotEnd, item }: Props) {
  const { t } = useTranslation('calendar')
  const { t: tc } = useTranslation('common')
  const { tEnum } = useEnum()
  const [error, setError] = useState<string | null>(null)
  const create = useCreateEvent()
  const update = useUpdateEvent()
  const remove = useDeleteEvent()

  const isEdit = !!item && item.kind === 'availability'

  const eventSchema = useMemo(
    () =>
      z
        .object({
          title: z.string().min(1, t('event.titleRequired')),
          type: z.enum(EVENT_TYPES),
          start: z.string().min(1, t('event.startRequired')),
          end: z.string().min(1, t('event.endRequired')),
          allDay: z.boolean(),
          notes: z.string().optional(),
        })
        .refine((v) => inputValueToWall(v.end) > inputValueToWall(v.start), {
          message: t('event.endAfterStart'),
          path: ['end'],
        }),
    [t],
  )

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
          title: t('event.defaultTitle'),
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
        <DialogTitle>{isEdit ? t('event.editTitle') : t('event.addTitle')}</DialogTitle>
        <DialogDescription>{t('event.description')}</DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="title">{t('event.titleLabel')}</Label>
          <Input id="title" {...register('title')} />
          {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="type">{t('event.type')}</Label>
          <Select id="type" {...register('type')}>
            {EVENT_TYPES.map((code) => (
              <option key={code} value={code}>
                {tEnum('calendarEventType', code)}
              </option>
            ))}
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="start">{t('event.start')}</Label>
            <Input id="start" type="datetime-local" {...register('start')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="end">{t('event.end')}</Label>
            <Input id="end" type="datetime-local" {...register('end')} />
            {errors.end && <p className="text-sm text-destructive">{errors.end.message}</p>}
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-foreground">
          <input type="checkbox" className="size-4" {...register('allDay')} />
          {t('event.allDay')}
        </label>

        <div className="space-y-2">
          <Label htmlFor="notes">{t('event.notes')}</Label>
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
              {remove.isPending ? tc('deleting') : tc('delete')}
            </Button>
          )}
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {tc('cancel')}
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? tc('saving') : tc('save')}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}
