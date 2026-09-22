# Midway verification map

This directory is the maintained source for verifying Midway's user-facing
behavior. Read this index before driving the app, then use the matching feature
file as the recipe.

## Features

| File | Feature | Surface |
|---|---|---|
| `authentication.md` | Open an agency account, sign in and out | Public web |
| `protected-routes.md` | Keep signed-out and cross-agency visitors out | Web + RPC |
| `brands.md` | Add, edit and delete the brands an agency manages | Dashboard |
| `campaigns.md` | Build a campaign, set its prize ladder, take it live | Dashboard |
| `hosted-game.md` | Play the booth and trade an email for a discount code | Public web + API |
| `leads.md` | Read the captured list and export it as CSV | Dashboard |

## Baseline preconditions

- A Midway dev server answers `http://localhost:3200`. Reuse the one already
  running; the port is pinned with `strictPort`, and a second instance would
  share the same local D1 anyway.
- `.dev.vars` exists with a real `BETTER_AUTH_SECRET`, and `BETTER_AUTH_URL` and
  `TRUSTED_ORIGINS` both exactly `http://localhost:3200`.
- `npx wrangler d1 migrations list midway-db --local` reports nothing to apply.
- `node` and `npx wrangler` are on `PATH`; run every command from the repo root.
- Run the Doctor section of `../SKILL.md` and require all four checks to pass.
- Never drive a deployed Worker. These recipes write data.

## Driving conventions

- Every agency account and every captured lead uses an `@verify.test` address.
  Cleanup keys off that domain; anything else is left behind in the user's data.
- Create state through the app, never with an `INSERT`. Read state back with
  `wrangler d1 execute`.
- Pass every command literally. Keep quoted names, colours and slugs unchanged.
- Dashboard actions go through `node ../serverfn.mjs <exportName> '<json>' "$COOKIE"`.
- Public game actions and page reads go through `curl`.
- Read the slug back from a create response. Slugs are derived and may carry a
  collision suffix.
- Search page HTML with `grep -a`. Without it, `grep` calls the SSR stream binary
  and prints nothing, so the check passes either way.

## Proof and skip reporting

- Capture the user action and the resulting state, not only the final response.
- Page proof is the SSR HTML with the expected strings matched by `grep -a`, plus
  one string that proves the page rendered at all.
- RPC proof is the full `{status, location, result}` object.
- Mutation proof adds a read-only second view: the D1 row, or the page that now
  lists it.
- Absence proof (no discount code before capture) must show in the same fetch
  that the page did render.
- Record which entry point was used with every artifact; the dashboard and the
  public API reach the same data by different paths and fail independently.
- Report an unreachable path with the attempted command and the unmet
  precondition. Do not report a skipped entry point as verified through another.

## Feature entry contract

Each feature file starts with an H1 title and one paragraph describing the
user-visible behavior, then uses exactly four H2 sections in this order.

1. `Sub-features` lists short IDs with one line for each behavior.
2. `How to get to it (user POV)` lists every user entry point.
3. `Driving it with curl and serverfn.mjs` starts with `Preconditions:` and uses
   labeled bullets pairing each user action with an exact command and an
   observable result.
4. `Gotchas` lists traps that can waste or invalidate a verification run.
