# Campaigns

A campaign is one game for one brand: a mechanic, a commercial tier, a prize
ladder of weighted discount codes, and a status. It is invisible to the public
while `draft`, reachable at `/play/:brandSlug/:campaignSlug` while `live`, and
gone again once `ended`. `/campaigns` creates them; `/campaigns/$id` is where the
prize ladder and the status actually get set.

## Sub-features

- `campaign-empty` shows an agency with no campaigns the `No campaigns yet` state.
- `campaign-create` creates a campaign against a brand and derives its slug.
- `campaign-slug-scope` allows the same slug under two different brands.
- `campaign-list` lists the agency's campaigns with brand name and lead count.
- `campaign-detail` shows one campaign's setup, prize ladder and lead table. **Known failing — see Gotchas.**
- `campaign-prizes` saves a weighted prize ladder of up to 12 entries.
- `campaign-status` moves a campaign between `draft`, `live` and `ended`, and the public URL follows.
- `campaign-validate` refuses an empty name, an unknown mechanic/tier/status, and a malformed prize.
- `campaign-delete` removes a campaign and its captured leads.
- `campaign-dashboard-stats` feeds the dashboard's lead, signup-rate, live-campaign and brand counters.

## How to get to it (user POV)

- Choose `Campaigns` in the dashboard sidebar.
- On `/campaigns`, pick a brand, name the campaign, pick a mechanic and tier, and choose `Create campaign`.
- Choose a listed campaign, or a campaign on the dashboard's `Recent campaigns`
  list, to open `/campaigns/$id`. **This entry point is currently broken** — see
  Gotchas. Drive the campaign through `getCampaign` / `updateCampaign` instead,
  and report `campaign-detail` as failing rather than skipped.
- On `/campaigns/$id`, edit the setup, choose `Add prize`, then `Save changes`.
- Choose `Delete campaign` and confirm.

## Driving it with curl and serverfn.mjs

Preconditions:

- Doctor passes and `BASE=http://localhost:3200` is set.
- An agency session is in `$COOKIE` and one of its brands is in `$BID` / `$BSLUG`
  (see `brands.md`).
- Valid values: mechanic `spin|scratch|flick|drag|shoot`, tier
  `starter|custom|seasonal`, status `draft|live|ended`.

- **Empty state.** Open `/campaigns`. Run
  `curl -s -H "Cookie: $COOKIE" $BASE/campaigns | grep -ao 'No campaigns yet'`. It matches.
- **Create it as a draft.** Fill the form and choose `Create campaign`. Run
  `node .claude/skills/verify/serverfn.mjs createCampaign "{\"brandId\":\"$BID\",\"name\":\"Verify Drop\",\"mechanic\":\"flick\",\"tier\":\"custom\",\"status\":\"draft\",\"prizes\":[]}" "$COOKIE"`.
  `status` is `200`; keep `CID=result.id`.
- **A draft is not public.** Run
  `curl -s -o /dev/null -w '%{http_code}\n' -X POST $BASE/api/play/$BSLUG/verify-drop -H 'content-type: text/plain' -d '{"action":"play"}'`.
  It is `404`. The page at `/play/$BSLUG/verify-drop` shows `This booth is closed`.
- **Set the prize ladder and take it live.** Choose `Add prize` three times, fill
  each row, set `Status` to `Live`, choose `Save changes`. Run
  `node .claude/skills/verify/serverfn.mjs updateCampaign "{\"id\":\"$CID\",\"name\":\"Verify Drop\",\"mechanic\":\"flick\",\"tier\":\"custom\",\"status\":\"live\",\"prizes\":[{\"label\":\"10% off\",\"code\":\"VFY10\",\"weight\":60},{\"label\":\"20% off\",\"code\":\"VFY20\",\"weight\":30},{\"label\":\"Free tin\",\"code\":\"VFYTIN\",\"weight\":10}]}" "$COOKIE"`.
- **It persisted as JSON, not a string.** Run
  `node .claude/skills/verify/serverfn.mjs getCampaign "{\"id\":\"$CID\"}" "$COOKIE"`.
  `result.campaign.status` is `live` and `result.campaign.prizes` is an array of
  three objects with numeric `weight`.
- **The public URL followed the status.** Run
  `curl -s $BASE/play/$BSLUG/verify-drop | grep -ao 'Verify Drop\|10% off\|Free tin'`.
  All three match. This is the check that proves `live` actually opened the booth.
- **Slug is scoped to the brand.** Create a campaign with the same name under a
  *second* brand. Run `createCampaign` with `$BID2` and `"name":"Verify Drop"`.
  It succeeds and `SELECT slug FROM campaign WHERE id IN (…)` shows both as
  `verify-drop` — the unique index is `(brand_id, slug)`, not `slug`. Creating a
  second `Verify Drop` under the *same* brand instead yields a suffixed slug.
- **The detail page does not render (known failure).** Run
  `curl -s -H "Cookie: $COOKIE" $BASE/campaigns/$CID | grep -ac 'One game per campaign'`.
  It is `1` — the URL serves the *campaigns list*, not the campaign. Confirm the
  detail is genuinely absent with
  `curl -s -H "Cookie: $COOKIE" $BASE/campaigns/$CID | grep -ac 'Save changes\|Export CSV\|Delete campaign'`,
  which is `0`, and that the loader nonetheless ran with
  `curl -s -H "Cookie: $COOKIE" $BASE/campaigns/$CID | grep -ac 'leads:\$R'`, which
  is `1`. Record this; do not report the feature as verified.
- **It appears in the list with its brand.** Run
  `node .claude/skills/verify/serverfn.mjs listCampaigns null "$COOKIE"`. The entry
  carries `brandName`, `brandSlug` and a `leads` count.
- **Reject bad input.** Run `updateCampaign` four times, each with one defect:
  `"name":"  "`, `"mechanic":"bounce"`, `"status":"paused"`, and
  `"prizes":[{"label":"x","code":"y","weight":0}]`. Each is refused, and
  `getCampaign` still returns the last good values.
- **End it.** Set `Status` to `Ended`. Run `updateCampaign` with `"status":"ended"`.
  The play endpoint returns `404` again and the page reads `This booth is closed` —
  identical to a campaign that never existed.
- **Dashboard counters move.** Run
  `node .claude/skills/verify/serverfn.mjs getDashboard null "$COOKIE"` before and
  after taking a campaign live. `liveCampaigns` changes by one, and `brands` and
  `campaigns` match the rows in D1 for this owner only.
- **Delete it.** Run
  `node .claude/skills/verify/serverfn.mjs deleteCampaign "{\"id\":\"$CID\"}" "$COOKIE"`
  then
  `npx wrangler d1 execute midway-db --local --json --command "SELECT (SELECT count(*) FROM campaign WHERE id='$CID') c, (SELECT count(*) FROM lead WHERE campaign_id='$CID') l"`.
  Both are `0`.
- **Proof.** Save the create response, the `getCampaign` result after going live,
  the play-page HTML that proves the booth opened, the four rejections, and the
  before/after `getDashboard` objects to
  `.claude/skills/verify/artifacts/$RUN/campaigns/`.

## Gotchas

- **`/campaigns/$id` renders the campaigns list, not the campaign.**
  `src/routes/_authed/campaigns.tsx` became a parent route the moment
  `campaigns.$id.tsx` appeared beside it, but it renders no `<Outlet />`, so the
  child component never mounts. The child's loader still runs — its data is in the
  page's hydration payload — which makes the page look alive while showing the
  wrong screen. Everything the detail page offers (prize ladder, status, delete,
  CSV export) is therefore reachable only through the server functions today.
  Verify those through `serverfn.mjs` and report `campaign-detail` as a failure.
  The fix is an `<Outlet />` in `campaigns.tsx` (or moving the list to
  `campaigns.index.tsx`); until it lands, any check that greps this page for
  campaign content passes vacuously.
- **`updateCampaign` is a full replace, not a patch.** It takes `name`,
  `mechanic`, `tier`, `status` and `prizes` together. Sending only `status` wipes
  the prize ladder and renames the campaign. Read the campaign first and resend
  every field.
- **`updateCampaign` takes no `brandId`.** A campaign cannot be moved between
  brands; including the key fails validation.
- `createCampaign` accepts a `status` directly, so a campaign can be born `live`.
  A recipe that assumes new campaigns are drafts will silently expose a booth.
- Draft, ended and nonexistent campaigns all answer `404` with the same body. The
  404 alone never tells you which; read `status` from D1 or `getCampaign`.
- Campaign slugs are unique per brand, so the same slug under two brands is
  correct behaviour, not a leak.
- `prizes` is a JSON column. If a read ever hands back a string instead of an
  array, the column was written outside Drizzle — do not "fix" it by parsing in
  the caller.
- A prize weight must be an integer from 1 to 100 and the ladder caps at 12
  entries. A `weight` of `0` is rejected, not treated as "never draw".
- Prize rows whose label or code is empty are dropped by the page before saving.
  Driving the RPC directly does **not** drop them — it rejects them. The two paths
  disagree on purpose; verify through the RPC and report what it does.
