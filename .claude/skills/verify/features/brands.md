# Brands

A brand is one of the agency's sub-clients: a name, an optional logo, two colours
that reskin the hosted game, and the ESP its list will eventually be pushed to.
The agency adds brands on `/brands`, edits them in place, and deleting one takes
its campaigns and captured leads with it.

## Sub-features

- `brand-empty` shows a new agency the `No brands yet` state.
- `brand-create` adds a brand and derives its URL slug from the name.
- `brand-slug-collision` appends a suffix when the derived slug is already taken.
- `brand-list` lists the agency's brands with a campaign count.
- `brand-update` changes the name, logo, colours and ESP of an existing brand.
- `brand-validate` refuses an empty name, a non-hex colour and a malformed logo URL.
- `brand-delete` removes a brand and cascades to its campaigns and leads.
- `brand-colors-applied` paints the hosted game with the brand's two colours.

## How to get to it (user POV)

- Choose `Brands` in the dashboard sidebar.
- On `/brands`, fill the brand form and choose `Add brand`.
- Choose a listed brand to open its edit form, then `Save changes`.
- Choose `Delete` on a listed brand and confirm.

## Driving it with curl and serverfn.mjs

Preconditions:

- Doctor passes and `BASE=http://localhost:3200` is set.
- A fresh agency session is in `$COOKIE` (see `authentication.md`).

- **Empty state.** Open `/brands`. Run
  `curl -s -H "Cookie: $COOKIE" $BASE/brands | grep -ao 'No brands yet'`. It matches.
- **Add a brand.** Fill the form and choose `Add brand`. Run
  `node .claude/skills/verify/serverfn.mjs createBrand '{"name":"Verify Co","logoUrl":"","primaryColor":"#2d1b12","accentColor":"#e8c39e","espProvider":"klaviyo"}' "$COOKIE"`.
  `status` is `200` and `result` carries an `id` and `slug`. Capture both:
  `BID=…`, `BSLUG=…` — read the slug from the response, do not assume it.
- **It persisted.** Run
  `npx wrangler d1 execute midway-db --local --json --command "SELECT name, slug, primary_color, accent_color, esp_provider FROM brand WHERE id='$BID'"`.
  One row, `slug` equal to `$BSLUG`, colours `#2d1b12` / `#e8c39e`, ESP `klaviyo`.
- **It shows on the page.** Run
  `curl -s -H "Cookie: $COOKIE" $BASE/brands | grep -ao 'Verify Co\|No brands yet'`.
  `Verify Co` matches and `No brands yet` does not.
- **Slug collision.** Add a second brand with the same name. Run the same
  `createBrand` command unchanged. The new `result.slug` starts with `verify-co-`
  and differs from `$BSLUG`; both rows exist in `brand`.
- **Edit it.** Change the name and colours and choose `Save changes`. Run
  `node .claude/skills/verify/serverfn.mjs updateBrand "{\"id\":\"$BID\",\"name\":\"Verify Co Renamed\",\"logoUrl\":\"\",\"primaryColor\":\"#101010\",\"accentColor\":\"#fafafa\",\"espProvider\":\"postscript\"}" "$COOKIE"`,
  then re-read the row. Name, both colours and ESP are the new values; **`slug` is
  unchanged** — renaming does not move the public game URL.
- **Reject an empty name.** Run `createBrand` with `"name":"   "`. `status` is not
  `200`, the response carries the validation message, and `SELECT count(*) FROM brand`
  is unchanged.
- **Reject a bad colour.** Run `createBrand` with `"primaryColor":"red"`. Same:
  refused, no new row.
- **Reject a bad logo URL.** Run `createBrand` with `"logoUrl":"not-a-url"`. Same.
- **Colours reach the game.** With a live campaign on this brand (see
  `campaigns.md`), run
  `curl -s $BASE/play/$BSLUG/verify-drop | grep -ao 'background:#[0-9a-f]*;color:#[0-9a-f]*'`.
  It prints the brand's two colours.
- **Delete it.** Choose `Delete` and confirm. Run
  `node .claude/skills/verify/serverfn.mjs deleteBrand "{\"id\":\"$BID\"}" "$COOKIE"`,
  then
  `npx wrangler d1 execute midway-db --local --json --command "SELECT (SELECT count(*) FROM brand WHERE id='$BID') b, (SELECT count(*) FROM campaign WHERE brand_id='$BID') c, (SELECT count(*) FROM lead WHERE campaign_id IN (SELECT id FROM campaign WHERE brand_id='$BID')) l"`.
  All three counts are `0` — the cascade is the point of this check, not the brand row.
- **The game goes dark.** Run
  `curl -s $BASE/play/$BSLUG/verify-drop | grep -ao 'This booth is closed'`. It matches.
- **Proof.** Save the create response, the D1 row before and after the edit, the
  three rejections, and the post-delete cascade counts to
  `.claude/skills/verify/artifacts/$RUN/brands/`.

## Gotchas

- **The slug is derived, never supplied.** `slugify(name)` lowercases, strips
  accents and non-alphanumerics, truncates to 48 chars, and falls back to
  `untitled`. On collision a 4-char suffix is appended. Always read `result.slug`
  back — a recipe that hardcodes `verify-co` breaks on the second run against the
  same database.
- Brand slugs are globally unique, not per-agency, so a collision can be with
  *another* agency's brand you cannot see.
- Editing a brand never changes its slug. A campaign's public URL survives a
  rename; that is deliberate, not a bug to report.
- `logoUrl` is stored as `NULL` when the field is empty, but the RPC argument must
  still be the empty string `""` — omitting the key fails validation.
- Deleting a brand destroys captured leads with no confirmation beyond the browser
  `confirm()`. Never run `deleteBrand` against a brand this run did not create.
- The colours are inlined into the play page's `style` attribute, not a class.
  Match on `background:#…;color:#…`, not on a CSS file.
