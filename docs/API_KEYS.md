# API Keys

The browser never receives these keys. The web app calls the GramLedger Worker, which calls the providers server-side.

## Local development

Create `apps/api/.dev.vars` (this file is gitignored):

```text
GROQ_API_KEY=your-groq-api-key
YOUTUBE_API_KEY=your-google-cloud-youtube-data-api-key
DATA_GOV_API_KEY=your-data-gov-api-key
DATA_GOV_MARKET_RESOURCE=your-agmarknet-resource-id
RESEND_API_KEY=your-resend-api-key
AUTH_FROM_EMAIL=GramLedger <auth@example.com>
JWT_SECRET=long-random-signing-secret
```

Then run `npm run dev`. Groq keys are available from [Groq Console](https://console.groq.com/keys). Resend sends OTP emails; verify the sender domain before production use. YouTube requires YouTube Data API v3 with the key restricted to that API. `DATA_GOV_MARKET_RESOURCE` is the resource UUID for the chosen Agmarknet dataset. Do not put keys in `apps/web`, Vite environment variables, committed files, or URLs.

## Production

From the repository root, add Worker secrets with Wrangler:

```bash
npx wrangler secret put GROQ_API_KEY --config apps/api/wrangler.toml
npx wrangler secret put YOUTUBE_API_KEY --config apps/api/wrangler.toml
npx wrangler secret put DATA_GOV_API_KEY --config apps/api/wrangler.toml
npx wrangler secret put RESEND_API_KEY --config apps/api/wrangler.toml
npx wrangler secret put JWT_SECRET --config apps/api/wrangler.toml
```

The pages are available at `/advisor`, `/videos`, and `/account`. Account sign-in is intentionally a local MVP profile until the planned OTP/JWT auth backend is implemented; it does not claim to authenticate a user.
