import { createFileRoute } from "@tanstack/react-router";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { brand, campaign, lead } from "@/db/schema";
import { drawPrize } from "@/lib/draw";

/**
 * Public capture endpoint for hosted games.
 *
 * Bespoke campaign builds are separate artefacts served from the brand's own
 * domain, so they talk to Midway over plain HTTP rather than the app's own RPC.
 * This is the contract they code against.
 *
 * Games are hosted on the brand's own domain, so this is always a cross-origin
 * call. Posting JSON under `content-type: text/plain` keeps it a CORS-simple
 * request and skips the preflight entirely, which is the recommended path — the
 * body is parsed from text, so the content-type header is not enforced. An
 * `application/json` post still works wherever the OPTIONS handler below is
 * reachable (it is not under `vite dev`, which answers preflights itself).
 *
 * ponytail: no rate limiting. The endpoint is inherently public — anyone who
 * can open the game can post to it — but a determined script can still pad a
 * list. Put Turnstile or a KV-backed per-IP counter in front before a client
 * runs a campaign worth spamming.
 */

const body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("play") }),
  z.object({
    action: z.literal("capture"),
    email: z.email().max(200),
    phone: z.string().trim().max(40).optional(),
  }),
]);

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
} as const;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", ...CORS },
  });

async function findLive(brandSlug: string, campaignSlug: string) {
  return getDb()
    .select({ campaign, brand })
    .from(campaign)
    .innerJoin(brand, eq(campaign.brandId, brand.id))
    .where(
      and(
        eq(brand.slug, brandSlug),
        eq(campaign.slug, campaignSlug),
        eq(campaign.status, "live"),
      ),
    )
    .get();
}

export const Route = createFileRoute("/api/play/$brandSlug/$campaignSlug")({
  server: {
    handlers: {
      // A 204/null-body response loses its headers downstream, and a
      // preflight without the CORS headers fails the check, so answer 200.
      OPTIONS: () => new Response("", { status: 200, headers: CORS }),

      POST: async ({ request, params }) => {
        // Parsed from text so the caller can use a CORS-safelisted
        // content-type and avoid a preflight.
        const raw = await request.text().catch(() => "");
        const parsed = body.safeParse(
          ((): unknown => {
            try {
              return JSON.parse(raw);
            } catch {
              return null;
            }
          })(),
        );
        if (!parsed.success) {
          return json({ error: "Malformed request." }, 400);
        }

        const row = await findLive(params.brandSlug, params.campaignSlug);
        // A closed campaign is indistinguishable from one that never existed,
        // so slug guessing reveals nothing about a brand's roadmap.
        if (!row) return json({ error: "This game is not running." }, 404);

        const db = getDb();

        if (parsed.data.action === "play") {
          await db
            .update(campaign)
            .set({ playCount: sql`${campaign.playCount} + 1` })
            .where(eq(campaign.id, row.campaign.id));
          return json({ ok: true });
        }

        const email = parsed.data.email.trim().toLowerCase();

        // Replaying hands back the original prize instead of minting a second
        // one or blowing up on the unique index.
        const existing = await db
          .select()
          .from(lead)
          .where(
            and(eq(lead.campaignId, row.campaign.id), eq(lead.email, email)),
          )
          .get();
        if (existing) {
          return json({
            ok: true,
            repeat: true,
            prizeLabel: existing.prizeLabel,
            discountCode: existing.discountCode,
          });
        }

        // Drawn server-side, after the email is in hand: the browser never gets
        // to pick its own discount.
        const prize = drawPrize(row.campaign.prizes);

        await db.insert(lead).values({
          id: crypto.randomUUID(),
          campaignId: row.campaign.id,
          email,
          phone: parsed.data.phone?.trim() || null,
          prizeLabel: prize?.label ?? null,
          discountCode: prize?.code ?? null,
        });

        return json({
          ok: true,
          repeat: false,
          prizeLabel: prize?.label ?? null,
          discountCode: prize?.code ?? null,
        });
      },
    },
  },
});
