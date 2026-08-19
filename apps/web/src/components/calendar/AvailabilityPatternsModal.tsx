import { useEffect, useMemo, useState } from 'react'
import { Copy, Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { apiErrorMessage } from '@/lib/api'
import {
  useAvailabilityPatterns,
  useCreateAvailabilityPattern,
  useDeleteAvailabilityException,
  useDeleteAvailabilityPattern,
  useUpdateAvailabilityPattern,
  useUpsertAvailabilityException,
  type AvailabilityPattern,
  type AvailabilityRange,
} from '@/hooks/useCalendar'

interface Props {
  open: boolean
  providerId: string
  onOpenChange: (open: boolean) => void
}

type DayRanges = Record<number, AvailabilityRange[]>

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const
const EMPTY_PATTERNS: AvailabilityPattern[] = []
const blankDays = (): DayRanges =>
  Object.fromEntries(WEEKDAYS.map((day) => [day, []])) as DayRanges
const defaultDays = (): DayRanges => ({
  ...blankDays(),
  1: [{ start: '09:00', end: '17:00' }],
})
const today = () => {
  const value = new Date()
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function daysFromPattern(pattern: AvailabilityPattern): DayRanges {
  const days = blankDays()
  pattern.windows.forEach((day) => {
    days[day.weekday] = day.ranges.map((range) => ({ ...range }))
  })
  return days
}

export function AvailabilityPatternsModal({
  open,
  providerId,
  onOpenChange,
}: Props) {
  const { t } = useTranslation('calendar')
  const patternsQuery = useAvailabilityPatterns(open ? providerId : undefined)
  const patterns = patternsQuery.data ?? EMPTY_PATTERNS
  const isLoading = patternsQuery.isLoading
  const createPattern = useCreateAvailabilityPattern()
  const updatePattern = useUpdateAvailabilityPattern()
  const deletePattern = useDeleteAvailabilityPattern()
  const upsertException = useUpsertAvailabilityException()
  const deleteException = useDeleteAvailabilityException()

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = patterns.find((pattern) => pattern.id === selectedId)
  const [effectiveFrom, setEffectiveFrom] = useState(today())
  const [effectiveUntil, setEffectiveUntil] = useState('')
  const [days, setDays] = useState<DayRanges>(defaultDays)
  const [copySource, setCopySource] = useState(1)
  const [copyTargets, setCopyTargets] = useState<number[]>([])
  const [exceptionDate, setExceptionDate] = useState('')
  const [exceptionRanges, setExceptionRanges] = useState<AvailabilityRange[]>(
    [],
  )
  const [error, setError] = useState<string | null>(null)

  const loadPattern = (pattern: AvailabilityPattern | undefined) => {
    setSelectedId(pattern?.id ?? null)
    setEffectiveFrom(pattern?.effectiveFrom ?? today())
    setEffectiveUntil(pattern?.effectiveUntil ?? '')
    setDays(pattern ? daysFromPattern(pattern) : defaultDays())
    setExceptionDate('')
    setExceptionRanges([])
    setError(null)
  }

  useEffect(() => {
    if (!open) return
    if (selectedId && patterns.some((pattern) => pattern.id === selectedId))
      return
    // The server collection is external state; hydrate the editable draft when it arrives.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadPattern(patterns[0])
  }, [open, providerId, patterns, selectedId])

  const pending =
    createPattern.isPending ||
    updatePattern.isPending ||
    deletePattern.isPending
  const windows = useMemo(
    () =>
      WEEKDAYS.map((weekday) => ({
        weekday,
        ranges: days[weekday] ?? [],
      })).filter((day) => day.ranges.length > 0),
    [days],
  )

  const setRange = (
    day: number,
    index: number,
    field: keyof AvailabilityRange,
    value: string,
  ) => {
    setDays((current) => ({
      ...current,
      [day]: current[day]!.map((range, i) =>
        i === index ? { ...range, [field]: value } : range,
      ),
    }))
  }
  const addRange = (day: number) =>
    setDays((current) => ({
      ...current,
      [day]: [...current[day]!, { start: '09:00', end: '17:00' }],
    }))
  const removeRange = (day: number, index: number) =>
    setDays((current) => ({
      ...current,
      [day]: current[day]!.filter((_, i) => i !== index),
    }))

  const copyDay = () => {
    setDays((current) => {
      const next = { ...current }
      copyTargets.forEach((day) => {
        next[day] = current[copySource]!.map((range) => ({ ...range }))
      })
      return next
    })
  }

  const savePattern = async () => {
    setError(null)
    try {
      const input = {
        providerId,
        effectiveFrom,
        effectiveUntil: effectiveUntil || null,
        windows,
      }
      const saved = selected
        ? await updatePattern.mutateAsync({ id: selected.id, ...input })
        : await createPattern.mutateAsync(input)
      setSelectedId(saved.id)
    } catch (err) {
      setError(apiErrorMessage(err))
    }
  }

  const removePattern = async () => {
    if (!selected || !window.confirm(t('availability.confirmDelete'))) return
    setError(null)
    try {
      await deletePattern.mutateAsync({ id: selected.id, providerId })
      loadPattern(undefined)
    } catch (err) {
      setError(apiErrorMessage(err))
    }
  }

  const saveException = async () => {
    if (!selected || !exceptionDate) return
    setError(null)
    try {
      await upsertException.mutateAsync({
        patternId: selected.id,
        providerId,
        date: exceptionDate,
        windows: exceptionRanges,
      })
      setExceptionDate('')
      setExceptionRanges([])
    } catch (err) {
      setError(apiErrorMessage(err))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} variant="sheet">
      <DialogHeader>
        <DialogTitle>{t('availability.title')}</DialogTitle>
        <DialogDescription>{t('availability.description')}</DialogDescription>
      </DialogHeader>

      <div className="space-y-6">
        <div className="flex flex-wrap gap-2">
          {patterns.map((pattern, index) => (
            <Button
              key={pattern.id}
              type="button"
              size="sm"
              variant={selected?.id === pattern.id ? 'default' : 'outline'}
              onClick={() => loadPattern(pattern)}
            >
              {t('availability.patternNumber', { number: index + 1 })}
            </Button>
          ))}
          <Button
            type="button"
            size="sm"
            variant={!selected ? 'default' : 'outline'}
            onClick={() => loadPattern(undefined)}
          >
            <Plus className="size-4" /> {t('availability.newPattern')}
          </Button>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">
            {t('availability.loading')}
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="pattern-from">
                  {t('availability.effectiveFrom')}
                </Label>
                <Input
                  id="pattern-from"
                  type="date"
                  value={effectiveFrom}
                  onChange={(event) => setEffectiveFrom(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pattern-until">
                  {t('availability.effectiveUntil')}
                </Label>
                <Input
                  id="pattern-until"
                  type="date"
                  min={effectiveFrom}
                  value={effectiveUntil}
                  onChange={(event) => setEffectiveUntil(event.target.value)}
                />
              </div>
            </div>

            <div className="space-y-3">
              {WEEKDAYS.map((day) => (
                <div
                  key={day}
                  className="rounded-xl border border-border/60 p-3"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {t(`availability.weekdays.${day}`)}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => addRange(day)}
                    >
                      <Plus className="size-4" /> {t('availability.addRange')}
                    </Button>
                  </div>
                  {(days[day] ?? []).length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      {t('availability.unavailable')}
                    </p>
                  ) : (
                    (days[day] ?? []).map((range, index) => (
                      <div
                        key={index}
                        className="mb-2 flex items-center gap-2 last:mb-0"
                      >
                        <Input
                          aria-label={t('availability.start')}
                          type="time"
                          value={range.start}
                          onChange={(event) =>
                            setRange(day, index, 'start', event.target.value)
                          }
                        />
                        <span className="text-muted-foreground">–</span>
                        <Input
                          aria-label={t('availability.end')}
                          type="time"
                          value={range.end}
                          onChange={(event) =>
                            setRange(day, index, 'end', event.target.value)
                          }
                        />
                        <Button
                          aria-label={t('availability.removeRange')}
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeRange(day, index)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              ))}
            </div>

            <div className="rounded-xl bg-muted/50 p-3 space-y-2">
              <div className="flex gap-2">
                <Select
                  value={copySource}
                  onChange={(event) =>
                    setCopySource(Number(event.target.value))
                  }
                >
                  {WEEKDAYS.map((day) => (
                    <option key={day} value={day}>
                      {t(`availability.weekdays.${day}`)}
                    </option>
                  ))}
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  disabled={copyTargets.length === 0}
                  onClick={copyDay}
                >
                  <Copy className="size-4" /> {t('availability.copy')}
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {WEEKDAYS.filter((day) => day !== copySource).map((day) => (
                  <label key={day} className="flex items-center gap-1 text-xs">
                    <input
                      type="checkbox"
                      checked={copyTargets.includes(day)}
                      onChange={() =>
                        setCopyTargets((current) =>
                          current.includes(day)
                            ? current.filter((value) => value !== day)
                            : [...current, day],
                        )
                      }
                    />
                    {t(`availability.weekdays.${day}`)}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-between gap-2">
              {selected ? (
                <Button
                  type="button"
                  variant="destructive"
                  disabled={pending}
                  onClick={removePattern}
                >
                  {t('availability.deletePattern')}
                </Button>
              ) : (
                <span />
              )}
              <Button
                type="button"
                variant="gradient"
                disabled={pending || !effectiveFrom || windows.length === 0}
                onClick={savePattern}
              >
                {pending
                  ? t('availability.saving')
                  : t('availability.savePattern')}
              </Button>
            </div>

            {selected && (
              <section className="border-t border-border/60 pt-5 space-y-3">
                <div>
                  <h3 className="font-medium">
                    {t('availability.exceptions')}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {t('availability.exceptionsDescription')}
                  </p>
                </div>
                {selected.exceptions.map((exception) => (
                  <div
                    key={exception.id}
                    className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm"
                  >
                    <button
                      type="button"
                      className="text-left"
                      onClick={() => {
                        setExceptionDate(exception.date)
                        setExceptionRanges(
                          exception.windows.map((range) => ({ ...range })),
                        )
                      }}
                    >
                      <span className="font-medium">{exception.date}</span>
                      <span className="block text-xs text-muted-foreground">
                        {exception.windows.length
                          ? exception.windows
                              .map((range) => `${range.start}–${range.end}`)
                              .join(', ')
                          : t('availability.closed')}
                      </span>
                    </button>
                    <Button
                      aria-label={t('availability.deleteException')}
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        deleteException.mutate({
                          patternId: selected.id,
                          exceptionId: exception.id,
                          providerId,
                        })
                      }
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
                <div className="space-y-2 rounded-xl border border-border/60 p-3">
                  <Label htmlFor="exception-date">
                    {t('availability.exceptionDate')}
                  </Label>
                  <Input
                    id="exception-date"
                    type="date"
                    min={selected.effectiveFrom}
                    max={selected.effectiveUntil ?? undefined}
                    value={exceptionDate}
                    onChange={(event) => setExceptionDate(event.target.value)}
                  />
                  {exceptionRanges.map((range, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input
                        type="time"
                        value={range.start}
                        onChange={(event) =>
                          setExceptionRanges((current) =>
                            current.map((item, i) =>
                              i === index
                                ? { ...item, start: event.target.value }
                                : item,
                            ),
                          )
                        }
                      />
                      <span>–</span>
                      <Input
                        type="time"
                        value={range.end}
                        onChange={(event) =>
                          setExceptionRanges((current) =>
                            current.map((item, i) =>
                              i === index
                                ? { ...item, end: event.target.value }
                                : item,
                            ),
                          )
                        }
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setExceptionRanges((current) =>
                            current.filter((_, i) => i !== index),
                          )
                        }
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                  <div className="flex justify-between gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setExceptionRanges((current) => [
                          ...current,
                          { start: '09:00', end: '17:00' },
                        ])
                      }
                    >
                      <Plus className="size-4" /> {t('availability.addRange')}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={!exceptionDate || upsertException.isPending}
                      onClick={saveException}
                    >
                      {t('availability.saveException')}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('availability.emptyMeansClosed')}
                  </p>
                </div>
              </section>
            )}
          </>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={() => onOpenChange(false)}
        >
          {t('availability.done')}
        </Button>
      </DialogFooter>
    </Dialog>
  )
}
