/**
 * Report operational database failure classifications without disclosing
 * SQL parameters, access tokens, credentials or connection strings.
 * These messages are written only to server-side container logs.
 */
type ErrorLike = {
  code?: unknown;
  name?: unknown;
  cause?: unknown;
};

function safeDiagnostic(value: unknown): string {
  if (typeof value !== 'string') return 'unavailable';
  return /^[A-Za-z0-9_-]{1,48}$/.test(value) ? value : 'redacted';
}

export function logProjectDatabaseFailure(operation: string, error: unknown): void {
  const failure = error && typeof error === 'object' ? error as ErrorLike : {};
  const cause = failure.cause && typeof failure.cause === 'object'
    ? failure.cause as ErrorLike : {};
  console.error('[SYNAPSE_PROJECT_DB]', {
    operation: safeDiagnostic(operation),
    code: safeDiagnostic(failure.code),
    type: safeDiagnostic(failure.name),
    causeCode: safeDiagnostic(cause.code),
    causeType: safeDiagnostic(cause.name),
  });
}
