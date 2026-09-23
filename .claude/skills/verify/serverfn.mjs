#!/usr/bin/env node
/**
 * Call a TanStack Start server function the way the browser does.
 *
 *   node .claude/skills/verify/serverfn.mjs <exportName> '<json payload>' [cookie]
 *
 * Everything an agency owner does in the app — create a brand, take a campaign
 * live, export the leads — goes through `src/server/functions.ts` over RPC, not
 * through a REST route. Driving that RPC is the only way to exercise the real
 * write path without a browser.
 *
 * Two wire details the app's own client handles for us and we have to redo:
 *   - the URL is /_serverFn/<base64url({file, export})>
 *   - the payload is seroval cross-JSON, not plain JSON
 *
 * ponytail: the seroval codec below covers JSON scalars, arrays and plain
 * objects, which is everything this app's functions take and return. If a
 * function ever takes a Date, Map or stream, import seroval properly instead of
 * extending this.
 */
import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";

const devVars = existsSync(".dev.vars") ? parseEnv(readFileSync(".dev.vars", "utf8")) : {};
const BASE = process.env.MIDWAY_URL ?? devVars.BETTER_AUTH_URL ?? "http://localhost:3200";
const SRC = "/src/server/functions.ts";

const url = (name) =>
  `${BASE}/_serverFn/` +
  Buffer.from(
    JSON.stringify({ file: `${SRC}?tss-serverfn-split`, export: `${name}_createServerFn_handler` }),
  ).toString("base64url");

// --- seroval cross-JSON ------------------------------------------------------
// Seroval escapes its string payloads rather than leaning on JSON's own escaping,
// so a string node has to be escaped on the way out and unescaped on the way back.
// Skipping this silently corrupts anything with a newline or a quote in it — the
// CSV export, for one, comes back with literal `\r\n` instead of line breaks.
const ESCAPES = {
  "\\": "\\\\", '"': '\\"', "\n": "\\n", "\r": "\\r", "\t": "\\t",
  "\b": "\\b", "\f": "\\f", "<": "\\x3C", "\u2028": "\\u2028", "\u2029": "\\u2029",
};
const UNESCAPES = { n: "\n", r: "\r", t: "\t", b: "\b", f: "\f" };

const esc = (s) => s.replace(/[\\"\n\r\t\b\f<\u2028\u2029]/g, (c) => ESCAPES[c]);
const unesc = (s) =>
  s.replace(/\\(x[0-9a-fA-F]{2}|u[0-9a-fA-F]{4}|[\s\S])/g, (_, e) =>
    e[0] === "x" || e[0] === "u"
      ? String.fromCharCode(parseInt(e.slice(1), 16))
      : (UNESCAPES[e] ?? e),
  );

// t:0 number · t:1 string · t:2 constant (0 null, 1 undefined, 2 true, 3 false)
// t:5 Date · t:9 array · t:10 object · t:11 null-prototype object · t:4 back-ref.
// `i` is a pre-order node id; `o` is a flags field.
function encode(value) {
  let i = 0;
  const walk = (v) => {
    if (v === null) return { t: 2, s: 0 };
    if (v === undefined) return { t: 2, s: 1 };
    if (v === true) return { t: 2, s: 2 };
    if (v === false) return { t: 2, s: 3 };
    if (typeof v === "number") return { t: 0, s: v };
    if (typeof v === "string") return { t: 1, s: esc(v) };
    if (Array.isArray(v)) return { t: 9, i: i++, a: v.map(walk), o: 0 };
    if (typeof v === "object") {
      const k = Object.keys(v);
      return { t: 10, i: i++, p: { k, v: k.map((key) => walk(v[key])) }, o: 0 };
    }
    throw new Error(`serverfn.mjs cannot encode ${typeof v}`);
  };
  // Seroval's own toJSON wraps the node tree: `f` is its feature bitmask and
  // `m` the marked-reference list. The server's fromJSON expects that wrapper.
  return { t: walk(value), f: 127, m: [] };
}

function decode(node, refs = new Map()) {
  if (node == null) return node;
  switch (node.t) {
    case 0:
      return node.s;
    case 1:
      return unesc(node.s);
    case 2:
      return [null, undefined, true, false][node.s];
    case 5:
      return node.s;
    case 9: {
      const arr = node.a.map((n) => decode(n, refs));
      refs.set(node.i, arr);
      return arr;
    }
    case 10:
    case 11: {
      const obj = {};
      refs.set(node.i, obj);
      node.p.k.forEach((k, idx) => (obj[k] = decode(node.p.v[idx], refs)));
      return obj;
    }
    // A reference back to an already-decoded node.
    case 4:
      return refs.get(node.i);
    default:
      return node;
  }
}

// --- call --------------------------------------------------------------------
const [name, rawPayload = "null", cookie = ""] = process.argv.slice(2);
if (!name) {
  console.error("usage: serverfn.mjs <exportName> '<json>' [cookie]");
  process.exit(2);
}

const data = JSON.parse(rawPayload);
// The app's client omits `data` entirely for a no-argument function.
const body = JSON.stringify(encode(data === null ? {} : { data }));
// Origin is required: without it the server function handler answers 403.
const headers = { Origin: BASE, "x-tsr-serverFn": "true", ...(cookie ? { Cookie: cookie } : {}) };

// GET functions take the payload in the query string, POST ones in the body.
let res = await fetch(`${url(name)}?payload=${encodeURIComponent(body)}`, {
  headers,
  redirect: "manual",
});
if (res.status === 405) {
  res = await fetch(url(name), {
    method: "POST",
    headers: { ...headers, "content-type": "application/json" },
    body,
    redirect: "manual",
  });
}

const text = await res.text();
let out;
try {
  out = decode(JSON.parse(text));
} catch {
  out = text;
}

// The handler answers `{result, context}`; only the result is worth asserting on.
if (out && typeof out === "object" && "result" in out) out = out.result;

console.log(JSON.stringify({ status: res.status, location: res.headers.get("location"), result: out }, null, 2));
process.exit(res.ok ? 0 : 1);
