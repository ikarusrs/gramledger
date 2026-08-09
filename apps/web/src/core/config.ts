/**
 * Runtime config. The API is same-origin by default (Vite dev proxies /health
 * and /v1 to the local Worker); set `VITE_API_BASE_URL` to point elsewhere.
 *
 * Mocks: enabled by default in development so the UI is usable before the /v1
 * endpoints land. Set `VITE_USE_MOCKS=false` to call the real API, or
 * `VITE_FORCE_MOCKS=true` to never hit the network.
 */
export const config = {
  apiBaseUrl: (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '',
  allowMocks:
    import.meta.env.VITE_FORCE_MOCKS === 'true' ||
    (import.meta.env.VITE_USE_MOCKS !== 'false' && import.meta.env.DEV),
} as const;
