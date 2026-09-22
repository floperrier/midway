import { createServerFn } from "@tanstack/react-start";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { brand, campaign } from "@/db/schema";

// Public surface: no session. Only `live` campaigns are reachable, and a
// campaign's discount codes are never sent to the browser until a lead has
// actually been captured.

const locator = z.object({
  brandSlug: z.string().max(60),
  campaignSlug: z.string().max(60),
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

/** Brand art and the prize *labels* only — codes stay on the server. */
export const getPublicCampaign = createServerFn({ method: "GET" })
  .validator(locator)
  .handler(async ({ data }) => {
    const row = await findLive(data.brandSlug, data.campaignSlug);
    if (!row) return null;
    return {
      name: row.campaign.name,
      mechanic: row.campaign.mechanic,
      brandName: row.brand.name,
      logoUrl: row.brand.logoUrl,
      primaryColor: row.brand.primaryColor,
      accentColor: row.brand.accentColor,
      prizeLabels: row.campaign.prizes.map((p) => p.label),
    };
  });
