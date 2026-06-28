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
  buildRrule,
  parseRrule,
  WEEKDAY_CODES,
  type RecurrenceFreq,
} from '@/lib/recurrence'
import {
  useCreateEvent,
  useUpdateEvent,
  useDeleteEvent,
  type CalendarItem,
} from '@/hooks/useCalendar'

const EVENT_TYPES = ['AVAILABLE', 'BLOCKED', 'VACATION'] as const
const WEEKDAY_INDICES = [1, 2, 3, 4, 5, 6, 0] as const // Mon-first display order

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
    watch,
    formState: { errors },
  } = useForm<EventValues>({
    resolver: zodResolver(eventSchema),
    defaultValues: isEdit
      ? {
          title: item!.title,
          type: item!.eventType ?? 'AVAILABLE',
          // Recurring events edit the whole series, so prefill from the series base.
          start: wallToInputValue(isoToWall(item!.seriesStart ?? item!.start)),
          end: wallToInputValue(isoToWall(item!.seriesEnd ?? item!.end)),
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

  const initialRec = isEdit ? parseRrule(item!.recurrence) : { freq: 'none' as RecurrenceFreq, byday: [], until: '' }
  const [freq, setFreq] = useState<RecurrenceFreq>(initialRec.freq)
  const [byday, setByday] = useState<number[]>(initialRec.byday)
  const [until, setUntil] = useState(initialRec.until)
  const startVal = watch('start')

  const onFreqChange = (f: RecurrenceFreq) => {
    setFreq(f)
    if (f === 'weekly' && byday.length === 0) {
      const s = startVal ? inputValueToWall(startVal) : new Date()
      setByday([s.getDay()])
    }
  }

  const toggleDay = (d: number) =>
    setByday((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]))

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
      recurrence: buildRrule({ freq, byday, until }),
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
          <Label htmlFor="repeat">{t('event.repeat')}</Label>
          <Select
            id="repeat"
            value={freq}
            onChange={(e) => onFreqChange(e.target.value as RecurrenceFreq)}
          >
            <option value="none">{t('event.repeatNone')}</option>
            <option value="daily">{t('event.repeatDaily')}</option>
            <option value="weekly">{t('event.repeatWeekly')}</option>
          </Select>

          {freq === 'weekly' && (
            <div className="space-y-1.5 pt-1">
              <span className="text-sm text-muted-foreground">{t('event.repeatOn')}</span>
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAY_INDICES.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDay(d)}
                    className={
                      'rounded-lg border border-transparent px-2.5 py-1 text-xs font-medium transition-colors ' +
                      (byday.includes(d)
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground')
                    }
                  >
                    {t(`event.weekdays.${WEEKDAY_CODES[d]}`)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {freq !== 'none' && (
            <div className="space-y-1 pt-1">
              <Label htmlFor="until">{t('event.repeatUntil')}</Label>
              <Input
                id="until"
                type="date"
                value={until}
                onChange={(e) => setUntil(e.target.value)}
              />
            </div>
          )}
        </div>

        {isEdit && item!.recurrence && (
          <p className="text-xs text-muted-foreground">{t('event.recurringNote')}</p>
        )}

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
          <Button type="submit" variant="gradient" disabled={saving}>
            {saving ? tc('saving') : tc('save')}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}
