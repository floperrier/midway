import {
  CAMPAIGN_STATUSES,
  ESP_PROVIDERS,
  MECHANICS,
  TIERS,
  type Prize,
} from "@/lib/campaign-options";
import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

// --- better-auth core tables (names must stay singular: the drizzle adapter
// looks models up by these exact export keys) ---

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" })
    .default(false)
    .notNull(),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date())
    .notNull(),
});

export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_user_id_idx").on(table.userId)],
);

export const account = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", {
      mode: "timestamp_ms",
    }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", {
      mode: "timestamp_ms",
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("account_user_id_idx").on(table.userId)],
);

export const verification = sqliteTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

// --- midway domain ---
//
// Tenancy: an agency owner (a `user`) owns many `brand` rows — their sub-clients.
// Every domain read/write is scoped through brand.ownerId. Seats *within* an
// agency are deliberately not modelled yet.
// ponytail: one owner per brand; add an `agency` + `membership` table when a
// second person at the same agency needs access.


export const brand = sqliteTable(
  "brand",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    // used in the public game URL: /play/:brandSlug/:campaignSlug
    slug: text("slug").notNull().unique(),
    logoUrl: text("logo_url"),
    // brand art direction, applied to the reskinned mechanic
    primaryColor: text("primary_color").notNull().default("#111111"),
    accentColor: text("accent_color").notNull().default("#f5f5f5"),
    espProvider: text("esp_provider", { enum: ESP_PROVIDERS })
      .notNull()
      .default("none"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("brand_owner_id_idx").on(table.ownerId)],
);

export const campaign = sqliteTable(
  "campaign",
  {
    id: text("id").primaryKey(),
    brandId: text("brand_id")
      .notNull()
      .references(() => brand.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    mechanic: text("mechanic", { enum: MECHANICS }).notNull(),
    tier: text("tier", { enum: TIERS }).notNull().default("starter"),
    status: text("status", { enum: CAMPAIGN_STATUSES })
      .notNull()
      .default("draft"),
    // scaling discount ladder, e.g. [{label:"10% off",code:"MID10",weight:60}]
    prizes: text("prizes", { mode: "json" })
      .$type<Array<Prize>>()
      .notNull()
      .default([]),
    // denormalised counter: signup rate is leads/plays, and a play is worth far
    // less than a row. ponytail: swap for a `play` table if per-play analytics
    // (drop-off, time-on-game) ever gets sold.
    playCount: integer("play_count").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("campaign_brand_id_idx").on(table.brandId),
    // public URL is /play/:brandSlug/:campaignSlug, so slug is unique per brand
    uniqueIndex("campaign_brand_slug_idx").on(table.brandId, table.slug),
  ],
);

export const lead = sqliteTable(
  "lead",
  {
    id: text("id").primaryKey(),
    campaignId: text("campaign_id")
      .notNull()
      .references(() => campaign.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    phone: text("phone"),
    prizeLabel: text("prize_label"),
    discountCode: text("discount_code"),
    // set once handed off to Klaviyo/Postscript/Attentive
    exportedAt: integer("exported_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("lead_campaign_id_idx").on(table.campaignId),
    // one capture per email per campaign — replays must not inflate the list
    uniqueIndex("lead_campaign_email_idx").on(table.campaignId, table.email),
  ],
);

export type Brand = typeof brand.$inferSelect;
export type Campaign = typeof campaign.$inferSelect;
