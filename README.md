# Midway

Branded lead-capture games for DTC brands, sold through agencies.

An agency signs in, sets up a brand, builds a campaign around a game mechanic,
and takes it live. The hosted game trades a scaling discount for an email
address; Midway keeps the list and hands it back as CSV or, later, straight into
Klaviyo, Postscript or Attentive.

## Stack

TanStack Start v1 (SSR, file routing, server functions) on Cloudflare Workers ·
React 19 · Tailwind v4 + shadcn/ui · D1 + Drizzle · better-auth.

## Running it

```bash
pnpm install
cp .dev.vars.example .dev.vars   # then put a real secret in it
pnpm db:migrate:local
pnpm dev                 # http://localhost:3200
```

Port 3200 is pinned with `strictPort`. `BETTER_AUTH_SECRET` and
`BETTER_AUTH_URL` are required — `getAuth()` throws when either is missing,
because better-auth otherwise falls back to a published default secret that
would let anyone forge a session. `BETTER_AUTH_URL` must match the dev URL
exactly.

| Command | What it does |
|---|---|
| `pnpm dev` | Dev server with local D1 |
| `pnpm build` | Build client + SSR bundles |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | oxlint, warnings are errors |
| `pnpm test` | Prize-draw unit check |
| `pnpm verify` | Integration check against a running dev server |
| `pnpm db:generate` | Generate a migration from the schema |
| `pnpm db:migrate:local` / `:remote` | Apply migrations |
| `pnpm deploy` | Build and ship to Workers |

## How it's put together

**Tenancy.** An agency owner (`user`) owns many `brand` rows — their
sub-clients. Every domain read and write in `src/server/functions.ts` goes
through `requireBrand` or `requireCampaign`, which resolve an id *and* the
ownership check together. There is deliberately no other way to get at a brand
or campaign, so a new query cannot forget to scope itself. Seats within a single
agency are not modelled yet.

**The public game.** `src/routes/play.$brandSlug.$campaignSlug.tsx` is a working
reference booth, not the product — bespoke campaign builds replace it. What they
share is the contract:

```
POST /api/play/:brandSlug/:campaignSlug
content-type: text/plain          # CORS-simple: no preflight

{"action":"play"}                            -> {"ok":true}
{"action":"capture","email":"…","phone":"…"} -> {"ok":true,"prizeLabel":"10% off",
                                                 "discountCode":"MUD10","repeat":false}
```

Three properties this endpoint holds, all covered by `pnpm verify`:

- **Codes never reach the browser before capture.** The play page is sent prize
  *labels* only; the code is minted server-side once an email is in hand, so a
  tampered client cannot award itself the best discount.
- **Replays are idempotent.** A second capture on the same email returns the
  original prize instead of minting another or erroring on the unique index.
  Dedupe is case-insensitive.
- **Only `live` campaigns are reachable.** Draft and ended campaigns 404
  identically to campaigns that never existed.

**Plays vs leads.** `playCount` increments on an explicit play action, not a page
view, so the signup rate has an honest denominator and isn't diluted by crawlers
and prefetch.

## Seeding a demo campaign

`pnpm verify`'s capture checks need a live campaign at
`/play/mudwtr/black-friday-drop`; they skip cleanly without one.

```bash
UID=$(npx wrangler d1 execute midway-db --local --json \
  --command "SELECT id FROM user LIMIT 1" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s)[0].results[0].id))')

npx wrangler d1 execute midway-db --local --command "
INSERT INTO brand (id,owner_id,name,slug,primary_color,accent_color,esp_provider,created_at,updated_at)
VALUES ('b1','$UID','MUD\\WTR','mudwtr','#2d1b12','#e8c39e','klaviyo',1758556800000,1758556800000);
INSERT INTO campaign (id,brand_id,name,slug,mechanic,tier,status,prizes,play_count,created_at,updated_at)
VALUES ('c1','b1','Black Friday drop','black-friday-drop','flick','custom','live',
  '[{\"label\":\"10% off\",\"code\":\"MUD10\",\"weight\":60},{\"label\":\"20% off\",\"code\":\"MUD20\",\"weight\":30},{\"label\":\"Free tin\",\"code\":\"MUDTIN\",\"weight\":10}]',
  0,1758556800000,1758556800000);
"
```

## Deploying

```bash
openssl rand -hex 32 | npx wrangler secret put BETTER_AUTH_SECRET
echo "https://midway.<subdomain>.workers.dev" | npx wrangler secret put BETTER_AUTH_URL
echo "https://midway.<subdomain>.workers.dev" | npx wrangler secret put TRUSTED_ORIGINS
pnpm db:migrate:remote
pnpm deploy
```

`BETTER_AUTH_URL` must equal the live origin exactly — no trailing slash.
`wrangler secret put` does not redeploy on its own. A deploy missing either
secret fails loudly on the first request rather than serving forgeable
sessions.

### Google OAuth

Optional and inert until configured. Add `GOOGLE_CLIENT_ID` and
`GOOGLE_CLIENT_SECRET` (to `.dev.vars` locally, `wrangler secret put` in
production) and register the redirect URI
`<origin>/api/auth/callback/google` in the Google Cloud console.

## Known gaps

- **No rate limiting on the capture endpoint.** It is public by nature, but a
  script can still pad a list. Put Turnstile or a KV-backed per-IP counter in
  front before running a campaign worth spamming.
- **ESP export is not wired.** `espProvider` is stored and leads carry an
  `exportedAt` column, but nothing pushes to Klaviyo/Postscript/Attentive yet.
  CSV export works today.
- **One owner per brand.** Agency seats need an `agency` + `membership` table.
- **Dependencies are pinned exactly** to satisfy a `minimumReleaseAge`
  supply-chain policy. Bump them deliberately rather than with a blanket update.
