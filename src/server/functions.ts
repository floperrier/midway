import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { redirect } from "@tanstack/react-router";
import { and, count, desc, eq, sum } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { getAuth } from "@/lib/auth.server";
import { brand, campaign, lead } from "@/db/schema";
import {
  CAMPAIGN_STATUSES,
  ESP_PROVIDERS,
  MECHANICS,
  TIERS,
} from "@/lib/campaign-options";

// --- guards -----------------------------------------------------------------
// Every domain query goes through one of these. Adding a new query without an
// ownership check should be impossible, because there is no other way to get a
// brand or campaign id you are allowed to touch.

async function requireUser() {
  const session = await getAuth().api.getSession({
    headers: new Headers(getRequestHeaders() as HeadersInit),
  });
  if (!session) throw redirect({ to: "/login" });
  return session.user;
}

/** Resolve a brand the caller actually owns, or 404-as-redirect. */
async function requireBrand(brandId: string, ownerId: string) {
  const db = getDb();
  const row = await db
    .select()
    .from(brand)
    .where(and(eq(brand.id, brandId), eq(brand.ownerId, ownerId)))
    .get();
  if (!row) throw redirect({ to: "/brands" });
  return row;
}

/** Resolve a campaign whose brand the caller owns. */
async function requireCampaign(campaignId: string, ownerId: string) {
  const db = getDb();
  const row = await db
    .select({ campaign, brand })
    .from(campaign)
    .innerJoin(brand, eq(campaign.brandId, brand.id))
    .where(and(eq(campaign.id, campaignId), eq(brand.ownerId, ownerId)))
    .get();
  if (!row) throw redirect({ to: "/campaigns" });
  return row;
}

function slugify(s: string) {
  return (
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "untitled"
  );
}

// --- session ----------------------------------------------------------------

export const getSessionFn = createServerFn({ method: "GET" }).handler(
  async () => {
    const session = await getAuth().api.getSession({
      headers: new Headers(getRequestHeaders() as HeadersInit),
    });
    return session ? { user: session.user } : null;
  },
);

// --- dashboard --------------------------------------------------------------

export const getDashboard = createServerFn({ method: "GET" }).handler(
  async () => {
    const user = await requireUser();
    const db = getDb();

    const totals = await db
      .select({
        campaigns: count(campaign.id),
        plays: sum(campaign.playCount),
      })
      .from(campaign)
      .innerJoin(brand, eq(campaign.brandId, brand.id))
      .where(eq(brand.ownerId, user.id))
      .get();

    const live = await db
      .select({ n: count(campaign.id) })
      .from(campaign)
      .innerJoin(brand, eq(campaign.brandId, brand.id))
      .where(and(eq(brand.ownerId, user.id), eq(campaign.status, "live")))
      .get();

    const leads = await db
      .select({ n: count(lead.id) })
      .from(lead)
      .innerJoin(campaign, eq(lead.campaignId, campaign.id))
      .innerJoin(brand, eq(campaign.brandId, brand.id))
      .where(eq(brand.ownerId, user.id))
      .get();

    const brands = await db
      .select({ n: count(brand.id) })
      .from(brand)
      .where(eq(brand.ownerId, user.id))
      .get();

    const plays = Number(totals?.plays ?? 0);
    const leadCount = leads?.n ?? 0;

    return {
      brands: brands?.n ?? 0,
      campaigns: totals?.campaigns ?? 0,
      liveCampaigns: live?.n ?? 0,
      plays,
      leads: leadCount,
      // the number the whole pitch rests on — merchants report 5–14%
      signupRate: plays > 0 ? leadCount / plays : null,
    };
  },
);

// --- brands -----------------------------------------------------------------

export const listBrands = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireUser();
  const db = getDb();
  return db
    .select({
      brand,
      campaigns: count(campaign.id),
    })
    .from(brand)
    .leftJoin(campaign, eq(campaign.brandId, brand.id))
    .where(eq(brand.ownerId, user.id))
    .groupBy(brand.id)
    .orderBy(desc(brand.createdAt))
    .all();
});

const brandInput = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  logoUrl: z.url().max(500).or(z.literal("")).optional(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour"),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour"),
  espProvider: z.enum(ESP_PROVIDERS),
});

export const createBrand = createServerFn({ method: "POST" })
  .validator(brandInput)
  .handler(async ({ data }) => {
    const user = await requireUser();
    const db = getDb();
    const id = crypto.randomUUID();

    let slug = slugify(data.name);
    const taken = await db
      .select({ id: brand.id })
      .from(brand)
      .where(eq(brand.slug, slug))
      .get();
    if (taken) slug = `${slug}-${crypto.randomUUID().slice(0, 4)}`;

    await db.insert(brand).values({
      id,
      ownerId: user.id,
      name: data.name,
      slug,
      logoUrl: data.logoUrl || null,
      primaryColor: data.primaryColor,
      accentColor: data.accentColor,
      espProvider: data.espProvider,
    });
    return { id, slug };
  });

export const updateBrand = createServerFn({ method: "POST" })
  .validator(brandInput.extend({ id: z.string() }))
  .handler(async ({ data }) => {
    const user = await requireUser();
    await requireBrand(data.id, user.id);
    const { id, logoUrl, ...rest } = data;
    await getDb()
      .update(brand)
      .set({ ...rest, logoUrl: logoUrl || null })
      .where(eq(brand.id, id));
    return { id };
  });

export const deleteBrand = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const user = await requireUser();
    await requireBrand(data.id, user.id);
    // campaigns and their leads cascade
    await getDb().delete(brand).where(eq(brand.id, data.id));
    return { ok: true };
  });

// --- campaigns --------------------------------------------------------------

export const listCampaigns = createServerFn({ method: "GET" }).handler(
  async () => {
    const user = await requireUser();
    const db = getDb();
    return db
      .select({
        campaign,
        brandName: brand.name,
        brandSlug: brand.slug,
        leads: count(lead.id),
      })
      .from(campaign)
      .innerJoin(brand, eq(campaign.brandId, brand.id))
      .leftJoin(lead, eq(lead.campaignId, campaign.id))
      .where(eq(brand.ownerId, user.id))
      .groupBy(campaign.id)
      .orderBy(desc(campaign.createdAt))
      .all();
  },
);

export const getCampaign = createServerFn({ method: "GET" })
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const user = await requireUser();
    const { campaign: c, brand: b } = await requireCampaign(data.id, user.id);
    const leads = await getDb()
      .select()
      .from(lead)
      .where(eq(lead.campaignId, c.id))
      .orderBy(desc(lead.createdAt))
      .limit(200)
      .all();
    return { campaign: c, brand: b, leads };
  });

const prizeSchema = z.object({
  label: z.string().trim().min(1).max(40),
  code: z.string().trim().min(1).max(40),
  weight: z.number().int().min(1).max(100),
});

const campaignInput = z.object({
  brandId: z.string(),
  name: z.string().trim().min(1, "Name is required").max(80),
  mechanic: z.enum(MECHANICS),
  tier: z.enum(TIERS),
  status: z.enum(CAMPAIGN_STATUSES),
  prizes: z.array(prizeSchema).max(12),
});

export const createCampaign = createServerFn({ method: "POST" })
  .validator(campaignInput)
  .handler(async ({ data }) => {
    const user = await requireUser();
    await requireBrand(data.brandId, user.id);
    const db = getDb();
    const id = crypto.randomUUID();

    let slug = slugify(data.name);
    const taken = await db
      .select({ id: campaign.id })
      .from(campaign)
      .where(and(eq(campaign.brandId, data.brandId), eq(campaign.slug, slug)))
      .get();
    if (taken) slug = `${slug}-${crypto.randomUUID().slice(0, 4)}`;

    await db.insert(campaign).values({ id, slug, ...data });
    return { id };
  });

export const updateCampaign = createServerFn({ method: "POST" })
  .validator(campaignInput.omit({ brandId: true }).extend({ id: z.string() }))
  .handler(async ({ data }) => {
    const user = await requireUser();
    await requireCampaign(data.id, user.id);
    const { id, ...rest } = data;
    await getDb().update(campaign).set(rest).where(eq(campaign.id, id));
    return { id };
  });

export const deleteCampaign = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const user = await requireUser();
    await requireCampaign(data.id, user.id);
    await getDb().delete(campaign).where(eq(campaign.id, data.id));
    return { ok: true };
  });

// --- leads ------------------------------------------------------------------

/** CSV of every lead on a campaign — the artefact the agency actually hands to
 *  the brand when an ESP integration isn't wired up yet. */
export const exportLeadsCsv = createServerFn({ method: "POST" })
  .validator(z.object({ campaignId: z.string() }))
  .handler(async ({ data }) => {
    const user = await requireUser();
    const { campaign: c } = await requireCampaign(data.campaignId, user.id);
    const rows = await getDb()
      .select()
      .from(lead)
      .where(eq(lead.campaignId, c.id))
      .orderBy(desc(lead.createdAt))
      .all();

    const header = ["email", "phone", "prize", "discount_code", "captured_at"];
    const body = rows.map((r) => [
      r.email,
      r.phone ?? "",
      r.prizeLabel ?? "",
      r.discountCode ?? "",
      r.createdAt.toISOString(),
    ]);
    const csv = [header, ...body].map((cols) => cols.map(csvCell).join(",")).join("\r\n");
    return { filename: `${c.slug}-leads.csv`, csv };
  });

/** RFC 4180: quote when the value contains a comma, quote or newline, and
 *  escape embedded quotes by doubling them. A raw name like `O'Brien, Inc`
 *  otherwise shifts every later column in the brand's import. */
function csvCell(value: string) {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}
