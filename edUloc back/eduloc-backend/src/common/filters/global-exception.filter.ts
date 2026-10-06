import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { DomainError } from '../errors/domain-errors';

interface Problem {
  status: number;
  code: string;
  title: string;
  detail?: string;
  fields?: string[];
}

/** Extrait le SQLSTATE PostgreSQL d'une erreur Prisma (forme variable selon versions). */
function extractPgCode(e: unknown): string | null {
  const meta = (e as { meta?: { code?: string } })?.meta;
  if (meta?.code) return meta.code;
  const msg = e instanceof Error ? e.message : String(e);
  const m = msg.match(/code:\s*["']?(\d{5})["']?/);
  return m ? m[1] : null;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request & { id?: string }>();
    const res = ctx.getResponse<Response>();
    const traceId = req.id ?? randomUUID();
    const problem = this.toProblem(exception);

    if (problem.status >= 500) {
      this.logger.error(
        `${req.method} ${req.url} → ${problem.code}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    res.status(problem.status).type('application/problem+json').json({
      type: `https://api.eduloc.mg/errors/${problem.code.toLowerCase().replace(/_/g, '-')}`,
      title: problem.title,
      status: problem.status,
      code: problem.code,
      detail: problem.status >= 500 ? 'Une erreur interne est survenue.' : problem.detail,
      fields: problem.fields,
      instance: req.originalUrl,
      traceId,
    });
  }

  private toProblem(e: unknown): Problem {
    if (e instanceof DomainError) {
      return { status: e.status, code: e.code, title: e.code, detail: e.message, fields: e.fields };
    }

    if (e instanceof HttpException) {
      const body = e.getResponse();
      const detail = typeof body === 'string' ? body : Array.isArray((body as { message?: unknown }).message)
        ? ((body as { message: string[] }).message.join('; '))
        : (body as { message?: string })?.message ?? e.message;
      const status = e.getStatus();
      const code = status === 400 ? 'VALIDATION_FAILED' : 'HTTP_ERROR';
      return { status, code, title: e.name, detail };
    }

    const known = e as { code?: string; meta?: { target?: string[] } };
    if (known?.code) {
      switch (known.code) {
        case 'P2002':
          return {
            status: 409, code: 'UNIQUE_VIOLATION', title: 'Conflit',
            detail: 'Cette ressource existe déjà.', fields: known.meta?.target ?? [],
          };
        case 'P2025':
          return { status: 404, code: 'RESOURCE_NOT_FOUND', title: 'Introuvable', detail: 'Ressource introuvable.' };
        case 'P2003':
          return { status: 409, code: 'FOREIGN_KEY_VIOLATION', title: 'Conflit', detail: 'Ressource liée invalide.' };
        case 'P2000':
          return { status: 400, code: 'VALUE_TOO_LONG', title: 'Donnée invalide', detail: 'Valeur trop longue.' };
        case 'P2034':
          return { status: 409, code: 'TRANSACTION_CONFLICT', title: 'Conflit', detail: 'Conflit d’écriture, réessayez.' };
        case 'P2024':
          return { status: 503, code: 'DATABASE_BUSY', title: 'Service indisponible', detail: 'Base saturée, réessayez.' };
      }
    }

    const pgCode = extractPgCode(e);
    if (pgCode === '23P01') {
      return { status: 409, code: 'SLOT_UNAVAILABLE', title: 'Créneau indisponible', detail: 'Ce créneau vient d’être réservé.' };
    }
    if (pgCode === '23514') {
      return { status: 422, code: 'CHECK_VIOLATION', title: 'Donnée refusée', detail: 'Règle métier non respectée.' };
    }

    return { status: 500, code: 'INTERNAL_ERROR', title: 'Erreur interne' };
  }
}
