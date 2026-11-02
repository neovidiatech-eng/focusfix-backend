import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/**
 * Turns any thrown value into a safe { status, message } pair.
 * Prisma / Zod internals (file paths, SQL) are never sent to the client.
 */
export function toHttpError(error: unknown, fallback = 'حدث خطأ غير متوقع'): { status: number; message: string } {
  if (error instanceof HttpError) return { status: error.status, message: error.message };

  if (error instanceof ZodError) {
    const first = error.issues[0];
    return { status: 400, message: first ? `بيانات غير صالحة: ${first.path.join('.') || 'body'}` : 'بيانات غير صالحة' };
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002':
        return { status: 409, message: 'هذه القيمة مستخدمة بالفعل (مثل الرابط/slug أو البريد)' };
      case 'P2003':
      case 'P2014':
        return { status: 409, message: 'لا يمكن الحذف لأن هذا العنصر مرتبط بحجوزات أو بيانات أخرى' };
      case 'P2025':
        return { status: 404, message: 'العنصر غير موجود' };
      default:
        return { status: 400, message: fallback };
    }
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return { status: 400, message: 'بيانات غير صالحة' };
  }

  // Plain Errors thrown by services carry user-facing messages
  if (error instanceof Error && error.message && !error.message.includes('\n')) {
    return { status: 400, message: error.message };
  }

  return { status: 500, message: fallback };
}

/** Sends a safe error response. `status` overrides the code for plain service errors (e.g. "not found" → 404). */
export function sendError(res: { status(code: number): { json(body: unknown): unknown } }, error: unknown, fallback: string, status?: number) {
  const e = toHttpError(error, fallback);
  const isPlain = error instanceof Error && !(error instanceof HttpError) && !(error as any).code && !(error instanceof ZodError);
  res.status(status && isPlain && e.status === 400 ? status : e.status).json({ error: e.message });
}
