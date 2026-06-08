/** Error carrying an HTTP status code, thrown by services and mapped by routes. */
export class HttpError extends Error {
  statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
  }
}

/**
 * Send a service error as an HTTP response. If it carries a statusCode use it,
 * otherwise treat as a 500.
 */
export function sendError(reply: any, err: any) {
  const statusCode = typeof err?.statusCode === 'number' ? err.statusCode : 500;
  const message = statusCode === 500 ? 'Internal server error' : err.message;
  return reply.status(statusCode).send({ error: message });
}
