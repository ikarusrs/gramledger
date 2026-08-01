# GramLedger — API (Cloudflare Worker, Hono)

The versioned REST API for GramLedger, deployed as a Cloudflare Worker. Thin,
stateless, and edge-cached by design (see [PLANNING.md](../../docs/PLANNING.md)).

## Structure

```
src/
├── index.ts                  # worker entry (default export)
├── app.ts                    # buildApp(): composes Hono app (testable)
├── config.ts                 # typed bindings + app config
├── lib/                      # logger, errors, request-id helpers
├── middleware/               # request-id, request-logger, error-handler
└── routes/
    ├── health.ts             # unversioned /health
    └── v1/                   # versioned namespace (feature endpoints land here)
test/                         # Vitest (drives the app via app.request)
```

## Commands

```bash
npm run dev:api        # wrangler dev -> http://localhost:8787/health
npm run typecheck      # tsc --noEmit
npm run test           # vitest
npm run lint           # eslint
```

## Configuration

- Non-secrets: `wrangler.toml` → `[vars]`.
- Local secrets: `.dev.vars` (gitignored; copy from `.dev.vars.example`).
- Production secrets: `wrangler secret put <KEY>`.

## Conventions

- All feature endpoints mount under `/v1`; never break the `/v1` contract.
- Errors are serialized as `{ "error": { "code", "message", "details?" } }`.
- Requires Node.js >= 20; wrangler is pinned to v3 (Node 20 compatible).
