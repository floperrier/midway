CREATE TABLE `brand` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`logo_url` text,
	`primary_color` text DEFAULT '#111111' NOT NULL,
	`accent_color` text DEFAULT '#f5f5f5' NOT NULL,
	`esp_provider` text DEFAULT 'none' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `brand_slug_unique` ON `brand` (`slug`);--> statement-breakpoint
CREATE INDEX `brand_owner_id_idx` ON `brand` (`owner_id`);--> statement-breakpoint
CREATE TABLE `campaign` (
	`id` text PRIMARY KEY NOT NULL,
	`brand_id` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`mechanic` text NOT NULL,
	`tier` text DEFAULT 'starter' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`prizes` text DEFAULT '[]' NOT NULL,
	`play_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`brand_id`) REFERENCES `brand`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `campaign_brand_id_idx` ON `campaign` (`brand_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `campaign_brand_slug_idx` ON `campaign` (`brand_id`,`slug`);--> statement-breakpoint
CREATE TABLE `lead` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`email` text NOT NULL,
	`phone` text,
	`prize_label` text,
	`discount_code` text,
	`exported_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaign`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `lead_campaign_id_idx` ON `lead` (`campaign_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `lead_campaign_email_idx` ON `lead` (`campaign_id`,`email`);