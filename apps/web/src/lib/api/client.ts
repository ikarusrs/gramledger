import { config } from '../../core/config';

interface ErrorEnvelope {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
}

/** Error thrown for non-2xx responses, carrying the API error envelope. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function resolveApiUrl(path: string): string {
  const base = config.apiBaseUrl;
  if (!base) return path;
  return `${base.replace(/\/+$/, '')}${path}`;
}

export const client = {
  async get<T = unknown>(path: string): Promise<T> {
    const res = await fetch(resolveApiUrl(path), {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as ErrorEnvelope | null;
      const err = body?.error;
      throw new ApiError(
        res.status,
        err?.code ?? 'HTTP_ERROR',
        err?.message ?? `Request failed (${res.status})`,
        err?.details,
      );
    }
    return (await res.json()) as T;
  },
};
