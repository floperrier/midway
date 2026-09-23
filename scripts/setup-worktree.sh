#!/usr/bin/env bash
# Prepare a git worktree to run `pnpm dev` and `pnpm verify` beside other
# checkouts: its own port, its own origin in .dev.vars, its own seeded D1.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

git_dir=$(cd "$(git rev-parse --absolute-git-dir)" && pwd -P)
common_dir=$(cd "$(git rev-parse --git-common-dir)" && pwd -P)
if [ "$git_dir" = "$common_dir" ]; then
  echo "setup:worktree: refusing to run in the main checkout, which keeps its own .dev.vars on port 3200." >&2
  exit 1
fi

pnpm install --frozen-lockfile

if [ ! -f .dev.vars ]; then
  # Hashing the path keeps a worktree on the same port across reruns.
  port=$((3201 + $(printf %s "$PWD" | cksum | cut -d' ' -f1) % 799))
  while lsof -i ":$port" -sTCP:LISTEN >/dev/null 2>&1; do
    port=$((port >= 3999 ? 3201 : port + 1))
  done
  url="http://localhost:$port"

  rewrite=(-e "s|^BETTER_AUTH_URL=.*|BETTER_AUTH_URL=$url|" -e "s|^TRUSTED_ORIGINS=.*|TRUSTED_ORIGINS=$url|")
  src="$(dirname "$common_dir")/.dev.vars"
  if [ ! -f "$src" ]; then
    src=.dev.vars.example
    rewrite+=(-e "s|^BETTER_AUTH_SECRET=.*|BETTER_AUTH_SECRET=$(openssl rand -hex 32)|")
  fi
  sed "${rewrite[@]}" "$src" > .dev.vars.tmp
  mv .dev.vars.tmp .dev.vars
fi

pnpm db:migrate:local
pnpm exec wrangler d1 execute midway-db --local --file scripts/seed.sql

grep '^BETTER_AUTH_URL=' .dev.vars | cut -d= -f2
