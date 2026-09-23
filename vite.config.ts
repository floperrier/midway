import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { defineConfig } from "vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";

// BETTER_AUTH_URL is the one place a checkout's origin lives; the port follows it
// so a worktree on another port cannot drift from what better-auth trusts.
const authUrl = existsSync(".dev.vars")
  ? parseEnv(readFileSync(".dev.vars", "utf8")).BETTER_AUTH_URL
  : undefined;
const port = authUrl ? Number(new URL(authUrl).port) : 3200;

export default defineConfig({
  server: { port, strictPort: true },
  resolve: { tsconfigPaths: true },
  plugins: [
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    tailwindcss(),
    tanstackStart(),
    // react's vite plugin must come after start's vite plugin
    viteReact(),
  ],
});
