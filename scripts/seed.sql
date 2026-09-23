-- Demo fixtures for `pnpm verify`'s capture checks. Safe to reapply.
INSERT OR IGNORE INTO user (id,name,email,email_verified,created_at,updated_at)
VALUES ('seed-owner','Seed Owner','seed@midway.local',1,1758556800000,1758556800000);

INSERT OR IGNORE INTO brand (id,owner_id,name,slug,primary_color,accent_color,esp_provider,created_at,updated_at)
VALUES ('b1','seed-owner','MUD\WTR','mudwtr','#2d1b12','#e8c39e','klaviyo',1758556800000,1758556800000);

INSERT OR IGNORE INTO campaign (id,brand_id,name,slug,mechanic,tier,status,prizes,play_count,created_at,updated_at)
VALUES ('c1','b1','Black Friday drop','black-friday-drop','flick','custom','live',
  '[{"label":"10% off","code":"MUD10","weight":60},{"label":"20% off","code":"MUD20","weight":30},{"label":"Free tin","code":"MUDTIN","weight":10}]',
  0,1758556800000,1758556800000);
