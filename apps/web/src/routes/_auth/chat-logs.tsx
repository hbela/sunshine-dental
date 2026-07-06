import { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { requireRole } from '@/lib/route-guards'
import { useChatLogs, useChatStats, useChatLog } from '@/hooks/useChatLogs'
import { useFormat } from '@/i18n/useFormat'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Dialog, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 25
const LANGUAGES = ['en', 'hu', 'de'] as const

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline'

function sentimentVariant(sentiment: string | null): BadgeVariant {
  switch (sentiment) {
    case 'Positive':
      return 'default'
    case 'Negative':
      return 'destructive'
    default:
      return 'secondary'
  }
}

function ChatLogsPage() {
  const { t } = useTranslation('chatLogs')
  const { t: tc } = useTranslation('common')
  const { formatDateTime } = useFormat()

  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [language, setLanguage] = useState('')
  const [successful, setSuccessful] = useState<'' | 'true' | 'false'>('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<string | null>(null)

  const { data: stats } = useChatStats()

  const filters = useMemo(
    () => ({
      from: from || undefined,
      to: to || undefined,
      language: language || undefined,
      successful: successful || undefined,
      page,
      limit: PAGE_SIZE,
    }),
    [from, to, language, successful, page],
  )
  const { data: logs, isLoading, isError } = useChatLogs(filters)
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
      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label={t('stats.total')} value={stats?.totalChats} />
        <Stat label={t('stats.successful')} value={stats?.successful} />
        <Stat label={t('stats.today')} value={stats?.chatsToday} />
        <Stat label={t('stats.sentimentScore')} value={sentimentScore} />
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 gap-3 rounded-2xl bg-muted/50 p-4 sm:grid-cols-2 lg:grid-cols-4">
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
          <Label htmlFor="f-language">{t('filters.language')}</Label>
          <Select
            id="f-language"
            value={language}
            onChange={(e) => {
              setLanguage(e.target.value)
              resetPage()
            }}
          >
            <option value="">{t('filters.allLanguages')}</option>
            {LANGUAGES.map((l) => (
              <option key={l} value={l}>
                {l.toUpperCase()}
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
      <div className="overflow-x-auto rounded-2xl border border-border/60 bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">{t('columns.time')}</th>
              <th className="px-4 py-3 font-medium">{t('columns.language')}</th>
              <th className="px-4 py-3 font-medium">{t('columns.messages')}</th>
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
              <tr key={c.id} className="transition-colors even:bg-muted/20 hover:bg-primary-fixed/30">
                <td className="px-4 py-3">{formatDateTime(new Date(c.createdAt))}</td>
                <td className="px-4 py-3 uppercase">{c.language}</td>
                <td className="px-4 py-3">{c.messageCount}</td>
                <td className="px-4 py-3">
                  {c.sentiment ? (
                    <Badge variant={sentimentVariant(c.sentiment)}>
                      {t(`sentiment.${c.sentiment}`, { defaultValue: c.sentiment })}
                    </Badge>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-4 py-3">
                  {c.successful === null
                    ? c.status === 'ACTIVE'
                      ? t('active')
                      : '—'
                    : c.successful
                      ? t('outcome.success')
                      : t('outcome.failed')}
                </td>
                <td className="px-4 py-3 text-right">
                  <Button variant="outline" size="sm" onClick={() => setSelected(c.id)}>
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

      {selected && <ChatLogDetail id={selected} onClose={() => setSelected(null)} />}
    </section>
  )
}

function Stat({ label, value }: { label: string; value: number | string | null | undefined }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
      <h3 className="text-xs font-medium text-muted-foreground">{label}</h3>
      <p className="mt-1 font-display text-2xl font-bold text-primary">{value ?? '—'}</p>
    </div>
  )
}

function ChatLogDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const { t } = useTranslation('chatLogs')
  const { t: tc } = useTranslation('common')
  const { formatDateTime } = useFormat()
  const { data: log, isLoading } = useChatLog(id)

  return (
    <Dialog open variant="sheet" onOpenChange={(o) => !o && onClose()}>
      <DialogHeader>
        <DialogTitle>{t('detailTitle')}</DialogTitle>
        <DialogDescription>{log ? formatDateTime(new Date(log.createdAt)) : ''}</DialogDescription>
      </DialogHeader>

      {isLoading || !log ? (
        <p className="text-sm text-muted-foreground">{tc('loading')}</p>
      ) : (
        <div className="max-h-[70vh] space-y-4 overflow-y-auto text-sm">
          {log.summary && (
            <div>
              <h3 className="mb-1 text-sm font-semibold text-foreground">{t('summary')}</h3>
              <p className="text-muted-foreground">{log.summary}</p>
            </div>
          )}

          <div>
            <h3 className="mb-2 text-sm font-semibold text-foreground">{t('transcript')}</h3>
            <div className="space-y-3">
              {log.messages
                .filter((m) => m.role !== 'TOOL')
                .map((m) => (
                  <div
                    key={m.id}
                    className={cn('flex', m.role === 'USER' ? 'justify-end' : 'justify-start')}
                  >
                    <div
                      className={cn(
                        'max-w-[85%] rounded-2xl px-3.5 py-2',
                        m.role === 'USER'
                          ? 'rounded-br-sm bg-primary text-primary-foreground'
                          : 'rounded-bl-sm bg-muted text-foreground',
                      )}
                    >
                      <p className="mb-0.5 text-[10px] font-medium opacity-70">
                        {t(`roles.${m.role}`, { defaultValue: m.role })}
                      </p>
                      <p className="whitespace-pre-wrap">{m.content}</p>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </Dialog>
  )
}

export const Route = createFileRoute('/_auth/chat-logs')({
  beforeLoad: () => requireRole(['ASSISTANT', 'ADMIN']),
  component: ChatLogsPage,
})
