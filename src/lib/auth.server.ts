import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { env } from "cloudflare:workers";
import { getDb } from "@/db";

/** Build the auth instance per request — `env` is request-scoped on Workers. */
export function getAuth() {
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
