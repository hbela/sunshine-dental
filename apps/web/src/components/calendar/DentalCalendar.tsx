import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { Calendar, dateFnsLocalizer } from 'react-big-calendar'
import type { View, SlotInfo } from 'react-big-calendar'
import { format, parse, startOfWeek, getDay } from 'date-fns'
import { enUS } from 'date-fns/locale'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import { Plus } from 'lucide-react'
import { authClient } from '@/auth-client'
import { useProviders } from '@/hooks/useProviders'
import { useCalendarEvents, useCalendarEventsMulti, type CalendarItem } from '@/hooks/useCalendar'
import { isoToWall, rangeForView } from '@/lib/calendar-utils'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { AppointmentModal } from './AppointmentModal'
import { EventEditorModal } from './EventEditorModal'

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales: { 'en-US': enUS },
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

function eventPropGetter(event: CalEvent) {
  const it = event.resource
  const style: CSSProperties = {}
  let bg = '#3b82f6'
  if (it.kind === 'appointment') {
    if (it.status === 'CANCELLED') {
      bg = '#ef4444'
      style.textDecoration = 'line-through'
    } else if (it.status === 'COMPLETED') bg = '#22c55e'
    else if (it.status === 'NO_SHOW') bg = '#f59e0b'
    else bg = '#3b82f6'
    style.color = '#ffffff'
  } else {
    if (it.eventType === 'BLOCKED') bg = '#9ca3af'
    else if (it.eventType === 'VACATION') bg = '#fca5a5'
    else bg = '#86efac'
    style.color = '#14532d'
  }
  style.backgroundColor = bg
  style.borderColor = bg
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
    allProviders && providers ? providers.map((p) => ({ id: p.id, title: p.name })) : undefined

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
            All providers
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
                {p.name}
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
            Add event
          </Button>
          <Button
            size="sm"
            disabled={!activeProviderId}
            onClick={() =>
              activeProviderId &&
              setModal({ type: 'create-appt', providerId: activeProviderId })
            }
          >
            <Plus className="size-4" />
            Book appointment
          </Button>
        </div>
      </div>

      <Legend />

      <div className="h-[calc(100vh-260px)] rounded-lg border bg-card p-2">
        <Calendar
          localizer={localizer}
          events={events}
          date={date}
          view={view}
          views={availableViews}
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
  const items: { color: string; label: string }[] = [
    { color: '#3b82f6', label: 'Confirmed' },
    { color: '#22c55e', label: 'Completed' },
    { color: '#ef4444', label: 'Cancelled' },
    { color: '#86efac', label: 'Available' },
    { color: '#9ca3af', label: 'Blocked' },
    { color: '#fca5a5', label: 'Vacation' },
  ]
  return (
    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          <span className="inline-block size-3 rounded-sm" style={{ backgroundColor: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  )
}
