import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { Calendar, dateFnsLocalizer } from 'react-big-calendar'
import type { View, SlotInfo, Messages } from 'react-big-calendar'
import { format, parse, startOfWeek, getDay } from 'date-fns'
import { enUS, hu, de } from 'date-fns/locale'
import { useTranslation } from 'react-i18next'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import { Plus } from 'lucide-react'
import { authClient } from '@/auth-client'
import { useProviders } from '@/hooks/useProviders'
import { useCalendarEvents, useCalendarEventsMulti, type CalendarItem } from '@/hooks/useCalendar'
import { isoToWall, rangeForView } from '@/lib/calendar-utils'
import { useDisplayName } from '@/lib/name'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { AppointmentModal } from './AppointmentModal'
import { EventEditorModal } from './EventEditorModal'

// All three locales registered; the active `culture` (below) selects which one
// react-big-calendar uses — including each locale's week-start (Mon for hu/de).
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales: { en: enUS, hu, de },
})

interface CalEvent {
  title: string
  start: Date
  end: Date
  allDay: boolean
  resource: CalendarItem
  resourceId?: string
}

type ModalState =
  | { type: 'view-appt'; item: CalendarItem; providerId: string }
  | { type: 'create-appt'; providerId: string; slotStart?: Date }
  | { type: 'create-event'; providerId: string; slotStart?: Date; slotEnd?: Date }
  | { type: 'edit-event'; item: CalendarItem; providerId: string }
  | null

/** Soft tonal event colors — calm pastels from the sage/blush palette, not saturated. */
const EVENT_COLORS = {
  confirmed: { bg: '#cfe0c0', fg: '#3e4a37' }, // soft sage
  completed: { bg: '#fed7d2', fg: '#7a5b58' }, // blush
  cancelled: { bg: '#ffdad6', fg: '#93000a' }, // soft error
  noShow: { bg: '#efe3cc', fg: '#6b5a2f' }, // soft sand
  available: { bg: '#e7f0d8', fg: '#3e4a37' }, // light mint
  blocked: { bg: '#e4e2df', fg: '#5d615a' }, // neutral
  vacation: { bg: '#fcdae5', fg: '#58404a' }, // soft pink
} as const

function eventPropGetter(event: CalEvent) {
  const it = event.resource
  const style: CSSProperties = {}
  let c: { bg: string; fg: string } = EVENT_COLORS.confirmed
  if (it.kind === 'appointment') {
    if (it.status === 'CANCELLED') {
      c = EVENT_COLORS.cancelled
      style.textDecoration = 'line-through'
    } else if (it.status === 'COMPLETED') c = EVENT_COLORS.completed
    else if (it.status === 'NO_SHOW') c = EVENT_COLORS.noShow
    else c = EVENT_COLORS.confirmed
  } else {
    if (it.eventType === 'BLOCKED') c = EVENT_COLORS.blocked
    else if (it.eventType === 'VACATION') c = EVENT_COLORS.vacation
    else c = EVENT_COLORS.available
  }
  style.backgroundColor = c.bg
  style.color = c.fg
  style.border = 'none'
  return { style }
}

function toRbc(item: CalendarItem, resourceId?: string): CalEvent {
  return {
    title: item.title,
    start: isoToWall(item.start),
    end: isoToWall(item.end),
    allDay: item.allDay,
    resource: item,
    resourceId,
  }
}

export function DentalCalendar() {
  const { t, i18n } = useTranslation('calendar')
  const displayName = useDisplayName()
  const culture = i18n.language?.split('-')[0] ?? 'en'
  const messages: Messages = useMemo(
    () => ({
      today: t('rbc.today'),
      previous: t('rbc.previous'),
      next: t('rbc.next'),
      month: t('rbc.month'),
      week: t('rbc.week'),
      day: t('rbc.day'),
      agenda: t('rbc.agenda'),
      date: t('rbc.date'),
      time: t('rbc.time'),
      event: t('rbc.event'),
      allDay: t('rbc.allDay'),
      noEventsInRange: t('rbc.noEventsInRange'),
      showMore: (count: number) => t('rbc.showMore', { count }),
    }),
    [t],
  )

  const { data: session } = authClient.useSession()
  const role = (session?.user as { role?: string } | undefined)?.role
  const userId = session?.user?.id
  const canSeeAll = role === 'ASSISTANT' || role === 'ADMIN'

  const { data: providers } = useProviders()

  const [date, setDate] = useState(new Date())
  const [view, setView] = useState<View>('week')
  const [selectedProviderId, setSelectedProviderId] = useState<string | undefined>()
  const [allProviders, setAllProviders] = useState(false)
  const [modal, setModal] = useState<ModalState>(null)

  // Default provider: own profile for a PROVIDER, else the first provider.
  useEffect(() => {
    if (!providers || providers.length === 0 || selectedProviderId) return
    const own = providers.find((p) => p.userId === userId)
    setSelectedProviderId(role === 'PROVIDER' && own ? own.id : providers[0]!.id)
  }, [providers, selectedProviderId, role, userId])

  const { from, to } = useMemo(() => rangeForView(date, view), [date, view])

  const providerIds = allProviders && providers ? providers.map((p) => p.id) : []
  const single = useCalendarEvents(allProviders ? undefined : selectedProviderId, from, to)
  const multi = useCalendarEventsMulti(providerIds, from, to)

  const events: CalEvent[] = []
  if (allProviders) {
    multi.forEach((q, i) => {
      const pid = providerIds[i]
      ;(q.data ?? []).forEach((it) => events.push(toRbc(it, pid)))
    })
  } else {
    ;(single.data ?? []).forEach((it) => events.push(toRbc(it)))
  }

  const resources =
    allProviders && providers ? providers.map((p) => ({ id: p.id, title: displayName(p) })) : undefined

  const onSelectEvent = (event: CalEvent) => {
    const it = event.resource
    const pid = event.resourceId ?? selectedProviderId
    if (!pid) return
    if (it.kind === 'appointment') {
      setModal({ type: 'view-appt', item: it, providerId: pid })
    } else {
      setModal({ type: 'edit-event', item: it, providerId: pid })
    }
  }

  const onSelectSlot = (slot: SlotInfo) => {
    const pid = (slot as { resourceId?: string }).resourceId ?? selectedProviderId
    if (!pid) return
    setModal({ type: 'create-appt', providerId: pid, slotStart: slot.start })
  }

  const closeModal = () => setModal(null)
  const activeProviderId = selectedProviderId

  const availableViews: View[] = allProviders ? ['day', 'week'] : ['month', 'week', 'day', 'agenda']

  // Constrain the time-grid (week/day) to clinic hours: 8:00 AM – 8:00 PM.
  const minTime = useMemo(() => new Date(1970, 0, 1, 8, 0, 0), [])
  const maxTime = useMemo(() => new Date(1970, 0, 1, 20, 0, 0), [])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {canSeeAll && (
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              className="size-4"
              checked={allProviders}
              onChange={(e) => {
                setAllProviders(e.target.checked)
                if (e.target.checked && view !== 'day' && view !== 'week') setView('day')
              }}
            />
            {t('allProviders')}
          </label>
        )}

        {!allProviders && (
          <Select
            className="w-64"
            value={selectedProviderId ?? ''}
            onChange={(e) => setSelectedProviderId(e.target.value)}
            disabled={!canSeeAll && role === 'PROVIDER'}
          >
            {(providers ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {displayName(p)}
                {p.specialty ? ` · ${p.specialty}` : ''}
              </option>
            ))}
          </Select>
        )}

        <div className="ml-auto flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!activeProviderId}
            onClick={() =>
              activeProviderId &&
              setModal({ type: 'create-event', providerId: activeProviderId })
            }
          >
            <Plus className="size-4" />
            {t('addEvent')}
          </Button>
          <Button
            variant="gradient"
            size="sm"
            disabled={!activeProviderId}
            onClick={() =>
              activeProviderId &&
              setModal({ type: 'create-appt', providerId: activeProviderId })
            }
          >
            <Plus className="size-4" />
            {t('bookAppointment')}
          </Button>
        </div>
      </div>

      <Legend />

      <div className="h-[1280px] rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
        <Calendar
          localizer={localizer}
          culture={culture}
          messages={messages}
          events={events}
          date={date}
          view={view}
          views={availableViews}
          min={minTime}
          max={maxTime}
          onNavigate={setDate}
          onView={setView}
          selectable
          popup
          startAccessor="start"
          endAccessor="end"
          resources={resources}
          resourceIdAccessor="id"
          resourceTitleAccessor="title"
          eventPropGetter={eventPropGetter}
          onSelectEvent={onSelectEvent}
          onSelectSlot={onSelectSlot}
          style={{ height: '100%' }}
        />
      </div>

      {modal?.type === 'view-appt' && (
        <AppointmentModal
          open
          mode="view"
          providerId={modal.providerId}
          item={modal.item}
          onOpenChange={closeModal}
        />
      )}
      {modal?.type === 'create-appt' && (
        <AppointmentModal
          open
          mode="create"
          providerId={modal.providerId}
          slotStart={modal.slotStart}
          onOpenChange={closeModal}
        />
      )}
      {modal?.type === 'create-event' && (
        <EventEditorModal
          open
          providerId={modal.providerId}
          slotStart={modal.slotStart}
          slotEnd={modal.slotEnd}
          onOpenChange={closeModal}
        />
      )}
      {modal?.type === 'edit-event' && (
        <EventEditorModal
          open
          providerId={modal.providerId}
          item={modal.item}
          onOpenChange={closeModal}
        />
      )}
    </div>
  )
}

function Legend() {
  const { t } = useTranslation('calendar')
  const items: { color: string; key: string }[] = [
    { color: EVENT_COLORS.confirmed.bg, key: 'confirmed' },
    { color: EVENT_COLORS.completed.bg, key: 'completed' },
    { color: EVENT_COLORS.cancelled.bg, key: 'cancelled' },
    { color: EVENT_COLORS.available.bg, key: 'available' },
    { color: EVENT_COLORS.blocked.bg, key: 'blocked' },
    { color: EVENT_COLORS.vacation.bg, key: 'vacation' },
  ]
  return (
    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
      {items.map((i) => (
        <span key={i.key} className="flex items-center gap-1.5">
          <span className="inline-block size-3 rounded-md" style={{ backgroundColor: i.color }} />
          {t(`legend.${i.key}`)}
        </span>
      ))}
    </div>
  )
}
