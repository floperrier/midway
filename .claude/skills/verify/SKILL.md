---
name: verify
description: Drive Midway — the branded lead-capture game app (TanStack Start on Cloudflare Workers, D1, better-auth) — the way a real agency owner and a real game player do, and capture proof. Use it to prove a change works before calling it done, whenever the change touches auth, protected routes, the D1 schema or migrations, the server functions in src/server/functions.ts, the public capture endpoint, the SSR pages, or the deploy config.
---

# Verify Midway

Midway has two user surfaces and they fail in different ways:

- **The agency dashboard** (`/dashboard`, `/brands`, `/campaigns`) — signed-in,
  SSR'd, and driven entirely by TanStack Start **server functions** over RPC,
  not REST. Every read and write is tenancy-scoped.
- **The hosted game** (`/play/:brandSlug/:campaignSlug` and
  `POST /api/play/:brandSlug/:campaignSlug`) — anonymous, cross-origin, and the
  contract bespoke campaign builds code against.

A proof that only exercises one of them has not verified the app.

There is no browser driver in this repo and none is needed: every page is
server-rendered, so the HTML that `curl` returns is the HTML a user sees, and
every mutation is an HTTP call the browser also makes. Drive it with `curl`,
`serverfn.mjs`, and `wrangler d1`.

## Launch

The app needs a local D1 and two auth secrets; `getAuth()` throws rather than
fall back to better-auth's published default key.

```bash
cd /Users/f.perrier/projects/midway
pnpm install                              # first run only
[ -f .dev.vars ] || cp .dev.vars.example .dev.vars   # then put a real secret in it
pnpm db:migrate:local
pnpm dev                                  # http://localhost:3200
```

**Reuse the server that is already running.** The port is pinned with
`strictPort: true`, so a second `pnpm dev` dies instead of picking another port,
and a run started with `--port 3399` still shares `.wrangler/state`, so its D1
is the same database. Check before starting anything:

```bash
lsof -i :3200 -sTCP:LISTEN
```

Ready when `/login` answers 200 (cold start compiles for a few seconds):

```bash
until curl -sf -o /dev/null http://localhost:3200/login; do sleep 1; done
```

**Teardown.** Only if *this run* started the server. Record the PID at launch
and kill that PID — never `pkill vite`, which takes down the server the user is
working in.

```bash
pnpm dev > /tmp/midway-verify.log 2>&1 & MIDWAY_PID=$!
# ... later ...
kill $MIDWAY_PID
```

## Doctor

Read-only. Run it first whenever anything looks off; all four must pass before
a drive is worth anything.

```bash
BASE=http://localhost:3200

# 1. It's up, and it's Midway.
curl -s $BASE/login | grep -aq 'Open a booth\|Sign in' && echo "OK  serving Midway"

# 2. The auth guard is wired: anonymous /dashboard bounces to /login.
curl -s -o /dev/null -w 'redirect: %{http_code} -> %{redirect_url}\n' $BASE/dashboard

# 3. The local D1 is migrated.
npx wrangler d1 migrations list midway-db --local     # "No migrations to apply!"

# 4. The schema matches the migrations on disk (no uncommitted drift).
npx drizzle-kit generate                              # "No schema changes, nothing to migrate"
git status --porcelain drizzle/                       # must be empty
```

If (2) returns 200 instead of a 307 to `/login`, stop: the protected-route guard
is broken and every other result is suspect.

## Drive

`BASE=http://localhost:3200` throughout. Sign-up doubles as the session factory —
better-auth returns a session cookie straight from `/api/auth/sign-up/email`, so
no sign-in round trip is needed to get an authenticated agent.

**Open an agency and keep its cookie.** Use an `@verify.test` address; cleanup
keys off that domain.

```bash
EMAIL="verify-$(openssl rand -hex 4)@verify.test"
COOKIE=$(curl -s -D- -o /dev/null -X POST $BASE/api/auth/sign-up/email \
  -H 'content-type: application/json' -H "Origin: $BASE" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"verify-password-123\",\"name\":\"Verify\"}" \
  | grep -i '^set-cookie:' | sed 's/^[Ss]et-[Cc]ookie: //' | cut -d';' -f1)
```

**Read an SSR page as that user.** This is the real rendered output, not a shell.

```bash
curl -s -H "Cookie: $COOKIE" $BASE/dashboard | grep -ao 'No campaigns yet\|Leads captured'
```

**Call a server function** — every dashboard mutation. `serverfn.mjs` takes the
export name from `src/server/functions.ts`, a JSON argument (`null` for the
no-argument ones), and the cookie:

```bash
node .claude/skills/verify/serverfn.mjs createBrand \
  '{"name":"Verify Co","logoUrl":"","primaryColor":"#2d1b12","accentColor":"#e8c39e","espProvider":"klaviyo"}' \
  "$COOKIE"
# {"status":200,"location":null,"result":{"id":"…","slug":"verify-co"}}
```

Available: `getSessionFn`, `getDashboard`, `listBrands`, `createBrand`,
`updateBrand`, `deleteBrand`, `listCampaigns`, `getCampaign`, `createCampaign`,
`updateCampaign`, `deleteCampaign`, `exportLeadsCsv`.

**Play the hosted game** — anonymous, `content-type: text/plain` so the
cross-origin call stays CORS-simple and skips the preflight:

```bash
curl -s -X POST $BASE/api/play/verify-co/verify-drop \
  -H 'content-type: text/plain' -d '{"action":"play"}'
curl -s -X POST $BASE/api/play/verify-co/verify-drop \
  -H 'content-type: text/plain' -d '{"action":"capture","email":"player-1@verify.test"}'
# {"ok":true,"repeat":false,"prizeLabel":"10% off","discountCode":"VFY10"}
```

**Read the database** for the side effect a response does not show:

```bash
npx wrangler d1 execute midway-db --local --json \
  --command "SELECT email, prize_label, discount_code FROM lead ORDER BY created_at DESC LIMIT 5"
```

**Read the server's own logs and traces.** The Cloudflare vite plugin exposes a
read-only SQL view of every request the Worker handled — this is how you catch a
200 that swallowed an exception:

```bash
curl -s -X POST $BASE/cdn-cgi/local/explorer/api/local/observability/query \
  -H 'content-type: application/json' \
  -d '{"sql":"SELECT level, message FROM logs ORDER BY rowid DESC LIMIT 20"}'
```

### Gotchas

- **`grep` needs `-a` on any Midway page.** The SSR stream contains NUL bytes, so
  plain `grep -o` prints `Binary file … matches` and silently shows you nothing.
  A check written without `-a` passes whether or not the string is there.
- **Server functions need an `Origin` header.** Without it the handler answers
  `403 Forbidden` before it ever reaches your code. `serverfn.mjs` sends it.
- **A denied server function returns HTTP 200.** `requireUser` / `requireBrand` /
  `requireCampaign` throw a *redirect*, which serializes into the body. Assert on
  `location` or `result.isSerializedRedirect`, never on the status code:
  ```json
  {"status":200,"location":"/campaigns","result":{"isSerializedRedirect":true,"to":"/campaigns"}}
  ```
- **A 404 from the play endpoint is deliberate and ambiguous.** Draft, ended and
  nonexistent campaigns all answer `404 {"error":"This game is not running."}`.
  Confirm the campaign's `status` in D1 before blaming routing.
- **`/campaigns/$id` renders the campaigns list, not the campaign** — a known
  app bug (`campaigns.tsx` is the parent route and has no `<Outlet />`). The
  child's loader still runs, so its data sits in the page's hydration payload
  while the wrong screen is on display. Grepping that page for campaign or lead
  content therefore proves nothing either way. Drive the campaign through the
  server functions and see `features/campaigns.md` for the full note.
- **Slugs are derived, not chosen.** `createBrand` and `createCampaign` slugify
  the name and append a 4-char suffix on collision. Read the slug back from the
  response; do not assume `slugify(name)`.
- **`@verify.test` leads land in the user's own dev data.** There is one local D1
  and everything shares it. Always use that domain so cleanup can find them.

## Evidence

Write proof to `.claude/skills/verify/artifacts/<run-id>/` and keep it there —
cleanup must not touch this directory.

```bash
RUN=$(date +%Y%m%d-%H%M%S); mkdir -p .claude/skills/verify/artifacts/$RUN
```

Save the command, its full response, and the side effect it claims to have had:
`curl ... | tee artifacts/$RUN/capture.json`, the matching
`wrangler d1 execute` row dump, and the SSR HTML of the page that should now
show it.

Proof standards for this app:

- **Exercise the real path.** A lead is proven by `POST /api/play/...`, not by an
  `INSERT` into `lead`. A brand is proven by `createBrand`, not by seeding a row.
  Direct D1 writes are for *reading* state back, not for creating it.
- **Capture the action and the resulting state.** The capture response alone does
  not prove the row persisted, and the row alone does not prove the endpoint
  minted it. Take both.
- **Verify the side effect.** A campaign taken live must actually be reachable at
  `/play/:brandSlug/:campaignSlug`; a lead captured must appear in the campaign's
  SSR lead table and in `exportLeadsCsv`.
- **Prove absence where the contract is about absence.** The discount-code
  guarantee is that codes are *not* in the pre-capture HTML — so fetch the play
  page and show the codes are missing (`grep -a`, and confirm the page really
  rendered by matching the campaign name in the same fetch; a blank page would
  otherwise "pass").
- **Do not mock.** Everything here is local: D1 is a real SQLite file, better-auth
  is real, the Worker is real. There is no external system to stand in for. Google
  OAuth is the one boundary that is inert unless `GOOGLE_CLIENT_ID`/`SECRET` are
  set — say it was skipped rather than claiming it works.

### Checks that need no running server

Run these directly; they are the CI gate (`.github/workflows/ci.yml`) plus the
deploy config.

```bash
pnpm lint          # oxlint, warnings are errors
pnpm typecheck     # tsc --noEmit
pnpm test          # prize-draw unit check
pnpm build         # client + SSR bundles
pnpm verify        # integration check; needs a server on :3200
npx wrangler deploy --dry-run   # config + bindings valid, prints env.DB (midway-db)
```

Deploy config is verified by three facts, not by deploying:

1. `wrangler deploy --dry-run` completes and lists the `env.DB (midway-db)` binding.
2. Every secret the code reads is declared in `.dev.vars.example`:
   ```bash
   diff <(grep -rho 'env\.[A-Z_]*' src | sed 's/env\.//' | grep -v '^DB$' | sort -u) \
        <(grep -o '^[A-Z_]*' .dev.vars.example | grep . | sort -u)
   ```
3. `npx wrangler d1 migrations list midway-db --remote` reports nothing pending
   *before* `pnpm deploy`. Skip and say so if the account is not authenticated.

## Cleanup

Remove only what the run created. Deleting a user cascades to its brands,
campaigns and leads; the second statement catches players captured on campaigns
the run did not own.

```bash
npx wrangler d1 execute midway-db --local --command \
  "DELETE FROM user WHERE email LIKE '%@verify.test';
   DELETE FROM lead WHERE email LIKE '%@verify.test';"
kill $MIDWAY_PID   # only if this run started it
```

This leaves the user's seeded fixtures (the `mudwtr` / `black-friday-drop` demo)
and everything under `artifacts/` intact. Confirm:

```bash
npx wrangler d1 execute midway-db --local --json --command \
  "SELECT (SELECT count(*) FROM user WHERE email LIKE '%@verify.test') leftover"
ls .claude/skills/verify/artifacts/$RUN
```

## Helpers

- `serverfn.mjs` — calls one TanStack Start server function.
  ```
  node .claude/skills/verify/serverfn.mjs <exportName> '<json|null>' [cookie]
  ```
  It builds the `/_serverFn/<id>` URL, encodes the argument as seroval
  cross-JSON, tries GET and falls back to POST on a 405, and prints
  `{status, location, result}`. Honours `MIDWAY_URL` (default
  `http://localhost:3200`). Exits non-zero on a non-2xx status — note that a
  denied call is a 2xx, so check `location` too.

## Feature map

`features/` is the maintained list of what this app does and how to drive each
piece. Read `features/README.md` before a run; a proof that drives one
convenient entry point is incomplete when the map lists others.
