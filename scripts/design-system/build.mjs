import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";
import tailwind from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";

const ARTIFACT = "https://claude.ai/artifact/JYAAnQhhKBJVQza4FwUEhP";
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "../..");
const OUT = join(HERE, "out");
const read = (f) => JSON.parse(readFileSync(f, "utf8"));
const git = (...args) => execFileSync("git", args, { cwd: REPO, encoding: "utf8" }).trim();
const PAGE = process.argv[2] ? read(process.argv[2]) : null;

function cut(css, re) {
  const m = re.exec(css);
  if (!m) throw new Error(`app.css no longer has ${re}`);
  const vars = Object.fromEntries([...m[1].matchAll(/--([\w-]+):\s*([^;]+);/g)].map(([, k, v]) => [k, v.trim().toLowerCase()]));
  return [vars, css.slice(0, m.index) + css.slice(m.index + m[0].length)];
}
const [LIGHT, withoutLight] = cut(readFileSync(join(REPO, "src/styles/app.css"), "utf8"), /^:root \{([\s\S]*?)^\}\n/m);
const [DARK, appCss] = cut(withoutLight, /^\.dark \{([\s\S]*?)^\}\n/m);

const USAGE = read(join(HERE, "usage.json"));
const colorNames = Object.keys(LIGHT).filter((k) => k !== "radius");
const missing = colorNames.filter((k) => !USAGE[k] || !DARK[k]);
if (missing.length) throw new Error(`no usage note or dark value for: ${missing.join(", ")}`);

const rgb = (h) => {
  h = h.replace("#", "");
  if (h.length === 3) h = [...h].map((c) => c + c).join("");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
};
const lin = (c) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
function paint(stack, pal) {
  return [...stack].reverse().reduce((under, expr) => {
    const [name, pct] = expr.split("/");
    const hex = name.startsWith("#") ? name : pal[name];
    if (!hex) throw new Error(`pairs.json: no colour named ${name}`);
    if (!under && pct) throw new Error(`pairs.json: ${expr} is see-through, but the last layer of a stack is its opaque ground`);
    const c = rgb(hex);
    const a = pct ? Number(pct) / 100 : 1;
    return under ? c.map((v, i) => v * a + under[i] * (1 - a)) : c;
  }, null);
}
const PAIRS = read(join(HERE, "pairs.json"));
const report = [];
let failures = 0;
function check(pal, theme, pairs) {
  for (const [fg, ground, min, where, only] of pairs) {
    if (only && only !== theme) continue;
    const r = ratio(paint([fg, ...ground], pal), paint(ground, pal));
    const ok = min === 0 || r >= min;
    if (!ok) failures++;
    report.push(`${theme.padEnd(14)} ${r.toFixed(2).padStart(6)}  ${min ? (ok ? "ok  " : "FAIL") : "info"} ${String(min || "").padEnd(4)} ${fg} on ${ground.join(" over ")}  (${where})`);
  }
}
check(LIGHT, "light", PAIRS.themed);
check(DARK, "dark", PAIRS.themed);
for (const [name, pal] of Object.entries(PAIRS.booths)) check(pal, `booth:${name}`, PAIRS.booth);
mkdirSync(join(OUT, "project"), { recursive: true });
writeFileSync(join(OUT, "contrast.txt"), report.join("\n") + "\n");
console.log(`${report.length} pairs checked, ${failures} under their floor (kept exact, flagged in their notes): out/contrast.txt`);

const px = (rem) => `${rem * 16}px`;
const tokens = {
  name: "Midway",
  version: 1,
  meta: {
    source: "github",
    repo: "floperrier/midway",
    ref: `${git("rev-parse", "--abbrev-ref", "HEAD")}@${git("rev-parse", "--short", "HEAD")}`,
    package: ".",
    paths: {
      tokens: ["src/styles/app.css", "node_modules/tailwindcss/theme.css (the scales the classes use)"],
      fonts: ["src/routes/__root.tsx"],
      assets: [],
      docs: ["README.md", "CLAUDE.md", "src/components", "src/routes"],
    },
    components: {
      Button: "src/components/ui/button.tsx",
      Input: "src/components/ui/input.tsx",
      Field: "src/components/form.tsx",
      StatusChip: "src/components/status-chip.tsx",
      ScoreStrip: "src/components/score-strip.tsx",
      AuthShell: "src/components/auth-shell.tsx",
      Sheet: "src/components/ui/sheet.tsx",
      Toaster: "src/components/ui/sonner.tsx",
    },
    synced: new Date().toISOString().slice(0, 10),
  },
  color: {
    themes: [
      { id: "light", name: "Light" },
      { id: "dark", name: "Dark" },
    ],
    tokens: colorNames.map((name) => ({ name, value: { light: LIGHT[name], dark: DARK[name] }, usage: USAGE[name] })),
  },
  type: {
    fonts: [],
    families: {
      display: '"Anton", "Archivo", sans-serif',
      sans: '"Archivo", ui-sans-serif, system-ui, sans-serif',
      mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    },
    groups: read(join(HERE, "type.json")),
  },
  spacing: {
    note: "Tailwind's 0.25rem step (--spacing), listed at the steps the code actually uses.",
    tokens: [
      [0.5, "Between sidebar nav links (gap-0.5)."],
      [1, "Label to its line of detail: list meta, prize intro (mt-1)."],
      [1.5, "Inside a Field: label, hint, control, error (gap-1.5); icon to label in small buttons."],
      [2, "Icon to label in default buttons (gap-2); nav link padding (py-2)."],
      [2.5, "Nav icon to label (gap-2.5); booth input padding (py-2.5)."],
      [3, "Control side padding (px-3); list row gaps; intro under a title (mt-3)."],
      [4, "List row height padding (py-4); page gutter below md (px-4)."],
      [5, "List rows, score cells and form panels (px-5, p-5); form field gap (gap-5)."],
      [6, "Score cell height (py-6); AuthShell and empty-state side padding (px-6)."],
      [8, "Between a page header and its first block (mt-8); page gutter at md (px-8)."],
      [10, "AuthShell panel rhythm (gap-10); page top padding at md (py-10); booth title to Play (mt-10)."],
      [12, "Between page sections (mt-12); empty-state height (py-12)."],
      [16, "Before the leads section, the last on a campaign page (mt-16)."],
    ].map(([step, usage]) => ({ name: `space-${step}`, value: px(step * 0.25), usage })),
  },
  radius: {
    note: "Everything derives from --radius. Tight on purpose: enamel plates, not pills.",
    tokens: [
      { name: "radius", value: LIGHT.radius, usage: "The base (--radius); radius-sm, -lg and -xl are calc() offsets from it." },
      { name: "radius-sm", value: "2px", usage: "calc(var(--radius) - 2px). StatusChip, the booth's buttons, inputs and code ticket, the brand swatch (rounded-sm)." },
      { name: "radius-md", value: "4px", usage: "var(--radius). Buttons, inputs, selects, every hairline panel and list (rounded-md)." },
      { name: "radius-lg", value: "6px", usage: "calc(var(--radius) + 2px). Defined, unused by the app today." },
      { name: "radius-xl", value: "10px", usage: "calc(var(--radius) + 6px). Only the unused Card primitive; don't reach for it." },
    ],
  },
  shadow: {
    note: "Enamel signage is painted flat: app.css strips the Card shadow globally. Two stock shadcn shadows survive.",
    tokens: [
      { name: "shadow-xs", value: "0 1px 2px 0 rgb(0 0 0 / 0.05)", usage: "The hairline lift shadcn keeps on Input, native selects and the outline Button. Nothing else gets a shadow." },
      { name: "shadow-lg", value: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)", usage: "Sheet only: the mobile menu is the one surface that floats over the page." },
    ],
  },
  size: {
    note: "Layout widths the routes repeat.",
    tokens: [
      { name: "content-max", value: "64rem", usage: "Every console page's column (max-w-5xl), centred." },
      { name: "sidebar-width", value: "15rem", usage: "Console sidebar from md up (md:grid-cols-[15rem_1fr])." },
      { name: "sheet-width", value: "16rem", usage: "The mobile menu sheet (w-64)." },
      { name: "auth-panel-max", value: "26rem", usage: "AuthShell's enamel panel from md up (minmax(0,26rem))." },
      { name: "form-max", value: "24rem", usage: "AuthShell's form column (max-w-sm)." },
      { name: "booth-column", value: "28rem", usage: "The booth's centred column (max-w-md)." },
      { name: "control-height", value: "2.25rem", usage: "Inputs, selects and default buttons (h-9); sm buttons are 2rem, lg 2.5rem." },
      { name: "booth-logo-height", value: "2.5rem", usage: "The brand logo box on the booth: 160 x 40 reserved, width auto (h-10)." },
      { name: "measure-intro", value: "60ch", usage: "Page intros and section explanations (max-w-[60ch])." },
      { name: "measure-note", value: "46ch", usage: "Empty-state explanations and AuthShell's small print (max-w-[46ch])." },
      { name: "measure-promise", value: "34ch", usage: "AuthShell's promise line (max-w-[34ch])." },
    ],
  },
};

const notes = (t) => [
  ...Object.entries(t)
    .filter(([, family]) => family?.tokens)
    .flatMap(([key, family]) => [[`${key}.note`, family, "note"], ...family.tokens.map((x) => [x.name, x, "usage"])]),
  ...(t.type?.groups ?? []).flatMap((g) => [[`${g.name}.note`, g, "note"], ...g.styles.map((s) => [`${g.name}/${s.name}`, s, "usage"])]),
];
let kept = 0;
if (PAGE) {
  const edited = new Map(notes(PAGE).map(([key, owner, field]) => [key, owner[field]]));
  for (const [key, owner, field] of notes(tokens)) {
    if (!edited.get(key)) continue;
    owner[field] = edited.get(key);
    kept++;
  }
}
writeFileSync(join(OUT, "project/tokens.json"), JSON.stringify(tokens, null, 2) + "\n");
console.log(PAGE ? `kept ${kept} notes from ${process.argv[2]}` : "notes from usage.json, type.json and build.mjs; pass the published tokens.json to keep notes edited on the page");

function swap(css, re, rep) {
  if (!re.test(css)) throw new Error(`app.css changed shape: ${re}`);
  return css.replace(re, rep);
}
let css = appCss;
css = swap(css, /@import "tailwindcss";/, '@import "tailwindcss" source(none);');
css = swap(css, /^@source not .*\n/m, "");
css = swap(css, /@custom-variant dark \(.*\);/, '@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));');
css = swap(css, /^(\s+)\.dark \{/m, '$1[data-theme="dark"] {');
css += [join(REPO, "src/components"), join(REPO, "src/routes"), join(HERE, "components")].map((p) => `@source "${p}";`).join("\n") + "\n";
writeFileSync(join(OUT, "entry.css"), css);

const shim = (f) => join(HERE, "shims", f);
await build({
  configFile: false,
  root: HERE,
  logLevel: "warn",
  plugins: [tailwind(), react()],
  resolve: {
    alias: [
      { find: /^react\/jsx-(dev-)?runtime$/, replacement: shim("jsx-runtime.js") },
      { find: /^@tanstack\/react-router$/, replacement: shim("router.js") },
      { find: /^@\/lib\/theme$/, replacement: shim("theme.js") },
      { find: /^@\//, replacement: `${join(REPO, "src")}/` },
    ],
  },
  define: { "process.env.NODE_ENV": '"production"' },
  build: {
    outDir: join(OUT, "project/components"),
    emptyOutDir: true,
    copyPublicDir: false,
    minify: true,
    cssCodeSplit: false,
    lib: { entry: join(HERE, "entry.tsx"), formats: ["iife"], name: "Midway", fileName: () => "bundle.js", cssFileName: "bundle" },
    rolldownOptions: { external: ["react", "react-dom"], output: { globals: { react: "React", "react-dom": "ReactDOM" } } },
  },
});
cpSync(join(HERE, "components"), join(OUT, "project/components"), { recursive: true });

const CARDS = ["Button", "Input", "Field", "StatusChip", "ScoreStrip", "AuthShell", "Sheet", "Toaster"];
const header = `/* @ds-bundle: ${JSON.stringify({ format: 4, namespace: "Midway", components: CARDS.map((name) => ({ name })) })} */\n`;
const jsFile = join(OUT, "project/components/bundle.js");
const js = readFileSync(jsFile, "utf8");
if (/<\/script|<!--/i.test(js)) throw new Error("bundle.js holds </script or <!--, which would end an inline script");
if (!/\bvar Midway\s*=/.test(js)) throw new Error("bundle.js does not define Midway at top level");
writeFileSync(jsFile, header + js.trim() + "\nwindow.Midway = Midway;\n");

const FONTS = "https://fonts.googleapis.com/css2?family=Anton&family=Archivo:ital,wght@0,400..700;1,400..600&display=swap";
const cssFile = join(OUT, "project/components/bundle.css");
const bcss = readFileSync(cssFile, "utf8");
if (/<\/style/i.test(bcss)) throw new Error("bundle.css holds </style");
writeFileSync(cssFile, `@import url("${FONTS}");\n${bcss}`);

const kb = (f) => `${(readFileSync(join(OUT, "project", f)).length / 1024).toFixed(1)} KB`;
console.log(`tokens.json ${kb("tokens.json")}, bundle.js ${kb("components/bundle.js")}, bundle.css ${kb("components/bundle.css")}`);
console.log(`publish out/project to ${ARTIFACT} as its Design System type's SKILL.md says`);
