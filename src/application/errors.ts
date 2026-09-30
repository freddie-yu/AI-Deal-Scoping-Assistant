export class ApplicationError extends Error {
  constructor(public readonly code: string, message: string, public readonly status: number, public readonly paths: string[] = []) { super(message); this.name = this.constructor.name; }
}
export class ValidationError extends ApplicationError { constructor(message = 'Invalid input. Check the indicated fields.', paths: string[] = []) { super('VALIDATION_ERROR', message, 400, paths); } }
export class NotFoundError extends ApplicationError { constructor() { super('NOT_FOUND', 'Session not found.', 404); } }
export class ConflictError extends ApplicationError { constructor() { super('CONFLICT', 'The session has changed. Reload before retrying; your current draft has not been saved.', 409); } }
export class PersistenceError extends ApplicationError { constructor(message = 'Local session storage failed. The last valid snapshot has not been replaced.') { super('PERSISTENCE_ERROR', message, 500); } }
export class ProviderError extends ApplicationError { constructor(message = 'The requested MOCK fixture is unavailable. Use a supported seed and variant.') { super('PROVIDER_ERROR', message, 422); } }
