export class ApiError extends Error {
  constructor(message: string, public readonly paths: string[] = []) { super(message); }
}
export async function api(path: string, options?: RequestInit): Promise<unknown> {
  const response = await fetch(path, options);
  const body = await response.json() as { error?: { message?: string; paths?: string[] } };
  if (!response.ok) throw new ApiError(body.error?.message ?? 'Request failed. Please retry.', body.error?.paths ?? []);
  return body;
}
export type Mutate = (path: string, body?: object, method?: 'POST' | 'PATCH') => Promise<void>;
export type ScopeStatus = { status: 'NOT_READY' | 'READY_FOR_REVIEW' | 'APPROVED'; blockers: string[]; warnings: string[]; eligibility: { eligible: boolean; reasons: string[] } };
