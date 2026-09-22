export class DomainError extends Error {
  constructor(
    message: string,
    readonly code: string
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export class SlotTakenError extends DomainError {
  constructor() {
    super("Слот уже занят", "SLOT_TAKEN");
  }
}

export class NotFoundError extends DomainError {
  constructor(entity: string) {
    super(`${entity} не найден`, "NOT_FOUND");
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = "Доступ запрещён") {
    super(message, "FORBIDDEN");
  }
}

export class ValidationError extends DomainError {
  constructor(message: string) {
    super(message, "VALIDATION");
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message = "Не авторизован") {
    super(message, "UNAUTHORIZED");
  }
}

/** Maps domain codes to HTTP so the Mini App can branch on status, not text. */
export function httpStatusForDomainError(error: DomainError): number {
  switch (error.code) {
    case "UNAUTHORIZED":
      return 401;
    case "FORBIDDEN":
      return 403;
    case "NOT_FOUND":
      return 404;
    case "SLOT_TAKEN":
      return 409;
    default:
      return 400;
  }
}
