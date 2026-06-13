import { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { requireRole } from '@/lib/route-guards'
import {
  useCallLogs,
  useCallLogStats,
  useCallLog,
  type CallLog,
} from '@/hooks/useCallLogs'
import { useFormat } from '@/i18n/useFormat'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Dialog, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'

const PAGE_SIZE = 25
const SENTIMENTS = ['Positive', 'Neutral', 'Negative'] as const

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function sentimentClasses(sentiment: string | null) {
  switch (sentiment) {
    case 'Positive':
      return 'bg-green-100 text-green-800'
    case 'Negative':
      return 'bg-red-100 text-red-800'
    case 'Neutral':
      return 'bg-gray-100 text-gray-800'
    default:
      return 'bg-muted text-muted-foreground'
  }
}

function CallLogsPage() {
  const { t } = useTranslation('callLogs')
  const { t: tc } = useTranslation('common')
  const { formatDateTime } = useFormat()

  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [sentiment, setSentiment] = useState('')
  const [successful, setSuccessful] = useState<'' | 'true' | 'false'>('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<string | null>(null)

  const { data: stats } = useCallLogStats()

  const filters = useMemo(
    () => ({
      from: from || undefined,
      to: to || undefined,
      sentiment: sentiment || undefined,
      successful: successful || undefined,
      page,
      limit: PAGE_SIZE,
    }),
    [from, to, sentiment, successful, page],
  )
  const { data: logs, isLoading, isError } = useCallLogs(filters)
  const rows = logs ?? []
  const resetPage = () => setPage(1)

  const sentimentScore = (() => {
    if (!stats) return undefined
    const { positive, neutral, negative } = stats.bySentiment
    const n = positive + neutral + negative
    return n > 0 ? `${Math.round((positive / n) * 100)}%` : '—'
  })()

  return (
    <section className="space-y-4">
      <h1 className="text-3xl font-semibold text-foreground">{t('title')}</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label={t('stats.total')} value={stats?.totalCalls} />
        <Stat label={t('stats.successful')} value={stats?.successful} />
        <Stat
          label={t('stats.avgDuration')}
          value={stats ? formatDuration(stats.avgDurationSeconds) : undefined}
        />
        <Stat label={t('stats.sentimentScore')} value={sentimentScore} />
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1">
          <Label htmlFor="f-from">{t('filters.from')}</Label>
          <Input
            id="f-from"
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value)
              resetPage()
            }}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="f-to">{t('filters.to')}</Label>
          <Input
            id="f-to"
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value)
              resetPage()
            }}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="f-sentiment">{t('filters.sentiment')}</Label>
          <Select
            id="f-sentiment"
            value={sentiment}
            onChange={(e) => {
              setSentiment(e.target.value)
              resetPage()
            }}
          >
            <option value="">{t('filters.allSentiments')}</option>
            {SENTIMENTS.map((s) => (
              <option key={s} value={s}>
                {t(`sentiment.${s}`)}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="f-success">{t('filters.outcome')}</Label>
          <Select
            id="f-success"
            value={successful}
            onChange={(e) => {
              setSuccessful(e.target.value as '' | 'true' | 'false')
              resetPage()
            }}
          >
            <option value="">{t('filters.allOutcomes')}</option>
            <option value="true">{t('filters.successOnly')}</option>
            <option value="false">{t('filters.failedOnly')}</option>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">{t('columns.time')}</th>
              <th className="px-4 py-3 font-medium">{t('columns.from')}</th>
              <th className="px-4 py-3 font-medium">{t('columns.duration')}</th>
              <th className="px-4 py-3 font-medium">{t('columns.sentiment')}</th>
              <th className="px-4 py-3 font-medium">{t('columns.outcome')}</th>
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
            {rows.map((c) => (
              <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="px-4 py-3">{formatDateTime(new Date(c.createdAt))}</td>
                <td className="px-4 py-3">{c.fromNumber ?? '—'}</td>
                <td className="px-4 py-3">{formatDuration(c.durationSeconds)}</td>
                <td className="px-4 py-3">
                  {c.sentiment ? (
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${sentimentClasses(c.sentiment)}`}
                    >
                      {t(`sentiment.${c.sentiment}`, { defaultValue: c.sentiment })}
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-4 py-3">
                  {c.successful === null
                    ? '—'
                    : c.successful
                      ? t('outcome.success')
                      : t('outcome.failed')}
                </td>
                <td className="px-4 py-3 text-right">
                  <Button variant="outline" size="sm" onClick={() => setSelected(c.callId)}>
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

      {selected && <CallLogDetail callId={selected} onClose={() => setSelected(null)} />}
    </section>
  )
}

function Stat({ label, value }: { label: string; value: number | string | null | undefined }) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <h3 className="text-xs font-medium text-muted-foreground">{label}</h3>
      <p className="mt-1 text-xl font-bold text-foreground">{value ?? '—'}</p>
    </div>
  )
}

function CallLogDetail({ callId, onClose }: { callId: string; onClose: () => void }) {
  const { t } = useTranslation('callLogs')
  const { t: tc } = useTranslation('common')
  const { formatDateTime } = useFormat()
  const { data: log, isLoading } = useCallLog(callId)

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogHeader>
        <DialogTitle>{t('detailTitle')}</DialogTitle>
        <DialogDescription>{log ? formatDateTime(new Date(log.createdAt)) : ''}</DialogDescription>
      </DialogHeader>

      {isLoading || !log ? (
        <p className="text-sm text-muted-foreground">{tc('loading')}</p>
      ) : (
        <div className="max-h-[70vh] space-y-4 overflow-y-auto text-sm">
          <div className="space-y-2">
            <Row label={t('columns.from')} value={log.fromNumber ?? '—'} />
            <Row label={t('columns.to')} value={log.toNumber ?? '—'} />
            <Row label={t('columns.duration')} value={formatDuration(log.durationSeconds)} />
            {log.sentiment && (
              <Row
                label={t('columns.sentiment')}
                value={t(`sentiment.${log.sentiment}`, { defaultValue: log.sentiment })}
              />
            )}
            {log.disconnectionReason && (
              <Row label={t('disconnectionReason')} value={log.disconnectionReason} />
            )}
          </div>

          {log.summary && (
            <div>
              <h3 className="mb-1 text-sm font-semibold text-foreground">{t('summary')}</h3>
              <p className="text-muted-foreground">{log.summary}</p>
            </div>
          )}

          <div>
            <h3 className="mb-1 text-sm font-semibold text-foreground">{t('transcript')}</h3>
            {log.transcript ? (
              <pre className="whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-xs text-foreground">
                {log.transcript}
              </pre>
            ) : (
              <p className="text-muted-foreground">{t('noTranscript')}</p>
            )}
          </div>
        </div>
      )}
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

export const Route = createFileRoute('/_auth/call-logs')({
  beforeLoad: () => requireRole(['ASSISTANT', 'ADMIN']),
  component: CallLogsPage,
})
