/* Shared vocabulary for campaigns. Kept free of Drizzle so route components can
   import it without dragging the database schema into the browser bundle. */

export const MECHANICS = ["spin", "scratch", "flick", "drag", "shoot"] as const;
export const TIERS = ["starter", "custom", "seasonal"] as const;
export const CAMPAIGN_STATUSES = ["draft", "live", "ended"] as const;
export const ESP_PROVIDERS = [
  "none",
  "klaviyo",
  "postscript",
  "attentive",
] as const;

export type Mechanic = (typeof MECHANICS)[number];
export type Tier = (typeof TIERS)[number];
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];
export type EspProvider = (typeof ESP_PROVIDERS)[number];

export type Prize = { label: string; code: string; weight: number };

export const MECHANIC_LABEL: Record<Mechanic, string> = {
  spin: "Spin wheel",
  scratch: "Scratch card",
  flick: "Flick",
  drag: "Drag",
  shoot: "Shoot",
};

export const TIER_LABEL: Record<Tier, string> = {
  starter: "Starter — reskin",
  custom: "Custom mechanic",
  seasonal: "Seasonal retainer",
};

export const ESP_LABEL: Record<EspProvider, string> = {
  none: "Not connected",
  klaviyo: "Klaviyo",
  postscript: "Postscript",
  attentive: "Attentive",
};
