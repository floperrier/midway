import { drizzle } from "drizzle-orm/d1";
import { env } from "cloudflare:workers";
import * as schema from "./schema";

/** Per-request Drizzle client. Never hoist this to module scope — `env` is
 *  only bound inside a request. */
export function getDb() {
  return drizzle(env.DB, { schema });
}
