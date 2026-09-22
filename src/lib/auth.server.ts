import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { env } from "cloudflare:workers";
import { getDb } from "@/db";

/** Build the auth instance per request — `env` is request-scoped on Workers. */
export function getAuth() {
  // Without a secret better-auth silently falls back to its published default
  // and signs every session with a key anyone can look up. Its own guard against
  // that only fires when NODE_ENV === "production", which workerd never sets, so
  // the check has to live here or a deploy that forgot `wrangler secret put`
  // comes up forgeable instead of broken.
  const missing = (["BETTER_AUTH_SECRET", "BETTER_AUTH_URL"] as const).filter(
    (key) => !env[key],
  );
  if (missing.length > 0) {
    throw new Error(`${missing.join(" and ")} not set — see "Deploying" in the README.`);
  }

  const google = env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET;

  return betterAuth({
    database: drizzleAdapter(getDb(), { provider: "sqlite" }),
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    trustedOrigins: env.TRUSTED_ORIGINS?.split(",").map((o) => o.trim()) ?? [],
    emailAndPassword: { enabled: true },
    socialProviders: google
      ? {
          google: {
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
          },
        }
      : {},
    // must stay last in the plugin list
    plugins: [tanstackStartCookies()],
  });
}
