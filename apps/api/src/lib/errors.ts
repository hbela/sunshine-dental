/** Error carrying an HTTP status code, thrown by services and mapped by routes. */
export class HttpError extends Error {
  statusCode: number;
  /** Machine-readable code (e.g. 'ENCRYPTION_LOCKED') for clients like the web app and n8n. */
  code?: string;
  constructor(statusCode: number, message: string, code?: string) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

/**
 * Send a service error as an HTTP response. If it carries a statusCode use it,
 * otherwise treat as a 500.
 */
export function sendError(reply: any, err: any) {
  const statusCode = typeof err?.statusCode === 'number' ? err.statusCode : 500;
  const message = statusCode === 500 ? 'Internal server error' : err.message;
  const code = typeof err?.code === 'string' ? err.code : undefined;
  return reply.status(statusCode).send(code ? { error: message, code } : { error: message });
}
