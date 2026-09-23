/**
 * Integration check against a running dev server.
 *
 *   pnpm dev          # in one terminal
 *   pnpm verify       # in another
 *
 * Covers the two things that break silently: tenancy isolation (one agency
 * seeing another's brands, campaigns or leads) and the public capture contract
 * that bespoke games code against.
 */
import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";

const devVars = existsSync(".dev.vars") ? parseEnv(readFileSync(".dev.vars", "utf8")) : {};
const BASE = process.env.MIDWAY_URL ?? devVars.BETTER_AUTH_URL ?? "http://localhost:3200";

const results = [];
const check = (name, pass, detail = "") => results.push({ name, pass, detail });
const rnd = () => Math.random().toString(36).slice(2, 10);

async function signUp(label) {
  const email = `${label}-${rnd()}@verify.test`;
  const password = `${label}-password-123`;
  const res = await fetch(`${BASE}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: BASE },
    body: JSON.stringify({ email, password, name: label }),
  });
  return { email, cookie: (res.headers.get("set-cookie") ?? "").split(";")[0], ok: res.status === 200 };
}

const page = async (path, cookie) =>
  (await fetch(BASE + path, { headers: cookie ? { Cookie: cookie } : {}, redirect: "manual" })).text();

const post = (path, body) =>
  fetch(BASE + path, {
    method: "POST",
    // text/plain keeps cross-origin calls CORS-simple, so no preflight.
    headers: { "content-type": "text/plain" },
    body: JSON.stringify(body),
  });

// --- auth ------------------------------------------------------------------
const owner = await signUp("owner");
check("agency owner can sign up", owner.ok && owner.cookie.length > 0);

const anon = await fetch(`${BASE}/dashboard`, { redirect: "manual" });
check(
  "anonymous dashboard redirects to login",
  anon.status >= 300 && anon.status < 400 && (anon.headers.get("location") ?? "").includes("/login"),
  `status ${anon.status}`,
);

// --- a fresh agency starts empty -------------------------------------------
check("new agency dashboard is empty", (await page("/dashboard", owner.cookie)).includes("No campaigns yet"));
check("new agency has no brands", (await page("/brands", owner.cookie)).includes("No brands yet"));

// --- tenancy ---------------------------------------------------------------
// Seeded fixtures belong to a different owner; nobody else may see them.
const rival = await signUp("rival");
const rivalBrands = await page("/brands", rival.cookie);
const rivalCampaigns = await page("/campaigns", rival.cookie);
check("a second agency sees no other agency's brands", !rivalBrands.includes("MUD"));
check("a second agency sees no other agency's campaigns", !rivalCampaigns.includes("Black Friday drop"));

// --- public capture contract -----------------------------------------------
// Requires a live campaign at /play/mudwtr/black-friday-drop (see README seed).
const API = "/api/play/mudwtr/black-friday-drop";
const live = (await post(API, { action: "play" })).status === 200;

if (!live) {
  check("SKIPPED capture contract (no live seeded campaign)", true, "see README");
} else {
  check("play action accepted", true);

  const email = `player-${rnd()}@verify.test`;
  const first = await (await post(API, { action: "capture", email })).json();
  check("capture issues a prize and code", !!first.prizeLabel && !!first.discountCode, String(first.discountCode));
  check("first capture is not a repeat", first.repeat === false);

  const again = await (await post(API, { action: "capture", email })).json();
  check("replay is idempotent", again.repeat === true && again.discountCode === first.discountCode);

  const cased = await (await post(API, { action: "capture", email: email.toUpperCase() })).json();
  check("email dedupe is case-insensitive", cased.repeat === true && cased.discountCode === first.discountCode);

  check("malformed email rejected", (await post(API, { action: "capture", email: "nope" })).status === 400);
  check("unknown action rejected", (await post(API, { action: "bogus" })).status === 400);
  check("unknown campaign is 404", (await post("/api/play/no/no", { action: "play" })).status === 404);

  const xo = await post(API, { action: "capture", email: `xo-${rnd()}@verify.test` });
  check("cross-origin allowed", xo.headers.get("access-control-allow-origin") === "*");

  const html = await page("/play/mudwtr/black-friday-drop");
  check(
    "discount codes are never sent to the browser",
    !/MUD10|MUD20|MUDTIN/.test(html),
    "play page HTML",
  );
}

let failed = 0;
console.log("");
for (const r of results) {
  if (!r.pass) failed++;
  console.log(`${r.pass ? "  PASS" : "  FAIL"}  ${r.name}${r.detail ? ` (${r.detail})` : ""}`);
}
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
