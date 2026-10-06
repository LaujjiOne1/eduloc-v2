export abstract class DomainError extends Error {
  abstract readonly status: number;
  constructor(
    public readonly code: string,
    message?: string,
    public readonly fields?: string[],
  ) {
    super(message ?? code);
    this.name = this.constructor.name;
  }
}

export class ValidationDomainError extends DomainError { readonly status = 400; }
export class ForbiddenError extends DomainError { readonly status = 403; }
export class NotFoundError extends DomainError { readonly status = 404; }
export class ConflictError extends DomainError { readonly status = 409; }
export class UnprocessableError extends DomainError { readonly status = 422; }

export class InvalidTransitionError extends ConflictError {
  constructor(from: string, to: string) {
    super('INVALID_TRANSITION', `${from} → ${to} est une transition interdite.`);
  }
}

export class ForbiddenTransitionError extends ForbiddenError {
  constructor(from: string, to: string, actor: string) {
    super('TRANSITION_NOT_ALLOWED_FOR_ACTOR', `${actor} ne peut pas effectuer ${from} → ${to}.`);
  }
}
