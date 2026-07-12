import { prisma } from '../lib/prisma.js';
import { HttpError } from '../lib/errors.js';
import { assertUnlocked } from '../lib/crypto.js';
import { decryptRow, decryptRows, encryptRow } from '../lib/crypto-fields.js';

function serialize(c: any) {
  return {
    id: c.id,
    callId: c.callId,
    agentId: c.agentId,
    patientId: c.patientId,
    fromNumber: c.fromNumber,
    toNumber: c.toNumber,
    direction: c.direction,
    durationSeconds: c.durationSeconds,
    status: c.status,
    disconnectionReason: c.disconnectionReason,
    transcript: c.transcript,
    summary: c.summary,
    sentiment: c.sentiment,
    successful: c.successful,
    startTime: c.startTime ? c.startTime.toISOString() : null,
    endTime: c.endTime ? c.endTime.toISOString() : null,
    createdAt: c.createdAt.toISOString(),
  };
}

export interface CreateCallLogInput {
  call_id: string;
  agent_id?: string;
  patient_id?: string;
  from_number?: string;
  to_number?: string;
  direction?: string;
  duration_seconds?: number;
  status?: string;
  disconnection_reason?: string;
  transcript?: string;
  summary?: string;
  sentiment?: string;
  successful?: boolean;
  start_time?: string;
  end_time?: string;
}

export class CallLogService {
  /** Upsert on callId so the post-call webhook is idempotent. */
  static async create(input: CreateCallLogInput) {
    assertUnlocked();
    const data = encryptRow('callLog', {
      agentId: input.agent_id ?? null,
      patientId: input.patient_id ?? null,
      fromNumber: input.from_number ?? null,
      toNumber: input.to_number ?? null,
      direction: input.direction ?? 'inbound',
      durationSeconds: input.duration_seconds ?? 0,
      status: input.status ?? null,
      disconnectionReason: input.disconnection_reason ?? null,
      transcript: input.transcript ?? null,
      summary: input.summary ?? null,
      sentiment: input.sentiment ?? null,
      successful: input.successful ?? null,
      startTime: input.start_time ? new Date(input.start_time) : null,
      endTime: input.end_time ? new Date(input.end_time) : null,
    });

    const callLog = await prisma.callLog.upsert({
      where: { callId: input.call_id },
      create: { callId: input.call_id, ...data },
      update: data,
    });

    return serialize(decryptRow('callLog', callLog));
  }

  static async list(filters: {
    from?: string;
    to?: string;
    sentiment?: string;
    successful?: boolean;
    page?: number;
    limit?: number;
  }) {
    assertUnlocked();
    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const limit = filters.limit && filters.limit > 0 ? filters.limit : 50;

    const where: any = {};
    if (filters.from || filters.to) {
      where.createdAt = {};
      if (filters.from) where.createdAt.gte = new Date(filters.from);
      if (filters.to) where.createdAt.lte = new Date(filters.to);
    }
    if (filters.sentiment) where.sentiment = filters.sentiment;
    if (filters.successful !== undefined) where.successful = filters.successful;

    const callLogs = await prisma.callLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return decryptRows('callLog', callLogs).map(serialize);
  }

  static async findByCallId(callId: string) {
    assertUnlocked();
    const callLog = await prisma.callLog.findUnique({ where: { callId } });
    if (!callLog) throw new HttpError(404, 'Call log not found');
    return serialize(decryptRow('callLog', callLog));
  }

  static async stats() {
    const now = new Date();
    const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setUTCDate(startOfWeek.getUTCDate() - startOfToday.getUTCDay()); // Sunday

    const [
      totalCalls,
      successful,
      positive,
      neutral,
      negative,
      durationAgg,
      callsToday,
      callsThisWeek,
    ] = await Promise.all([
      prisma.callLog.count(),
      prisma.callLog.count({ where: { successful: true } }),
      prisma.callLog.count({ where: { sentiment: 'Positive' } }),
      prisma.callLog.count({ where: { sentiment: 'Neutral' } }),
      prisma.callLog.count({ where: { sentiment: 'Negative' } }),
      prisma.callLog.aggregate({ _avg: { durationSeconds: true } }),
      prisma.callLog.count({ where: { createdAt: { gte: startOfToday } } }),
      prisma.callLog.count({ where: { createdAt: { gte: startOfWeek } } }),
    ]);

    return {
      totalCalls,
      successful,
      bySentiment: { positive, neutral, negative },
      avgDurationSeconds: Math.round(durationAgg._avg.durationSeconds ?? 0),
      callsToday,
      callsThisWeek,
    };
  }
}
