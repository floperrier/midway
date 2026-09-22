# Protected routes and tenancy

Everything under `/dashboard`, `/brands` and `/campaigns` belongs to one agency.
A signed-out visitor is sent to the login page, and a signed-in agency cannot
read, change or delete another agency's brands, campaigns or leads — not through
a page, and not by guessing an id and calling the RPC directly.

## Sub-features

- `guard-anon-page` bounces a signed-out visitor from every `_authed` page to `/login`.
- `guard-anon-rpc` refuses an anonymous server-function call.
- `guard-cross-read` hides another agency's brand, campaign and leads.
- `guard-cross-write` refuses an update or delete aimed at another agency's row.
- `guard-empty-agency` shows a brand-new agency an empty dashboard, not someone else's data.
- `guard-public-open` leaves `/login`, `/register` and the play routes reachable without a session.

## How to get to it (user POV)

- Open `/dashboard`, `/brands`, `/campaigns` or `/campaigns/$id` with no session.
- Sign in as one agency and open a URL belonging to another agency's campaign.
- Open `/login`, `/register` or `/play/:brandSlug/:campaignSlug` with no session.

## Driving it with curl and serverfn.mjs

Preconditions:

- Doctor passes and `BASE=http://localhost:3200` is set.
- Two agency sessions exist. Follow `authentication.md` twice and keep both
  cookies as `$COOKIE` (the owner) and `$RIVAL`.
- The owner has one live campaign; follow `campaigns.md` and keep `$BID`, `$CID`
  and `$BSLUG`.

- **Anonymous pages bounce.** Open each protected page signed out. Run
  `for p in dashboard brands campaigns "campaigns/$CID"; do curl -s -o /dev/null -w "$p %{http_code} %{redirect_url}\n" $BASE/$p; done`.
  Every line is `307` to `…/login`.
- **Anonymous RPC is refused.** Run
  `node .claude/skills/verify/serverfn.mjs getDashboard null`.
  `location` is `/login` and `result.isSerializedRedirect` is `true`. No dashboard
  numbers appear in the output.
- **Public routes stay open.** Run
  `for p in login register "play/$BSLUG/verify-drop"; do curl -s -o /dev/null -w "$p %{http_code}\n" $BASE/$p; done`.
  Every line is `200`.
- **A new agency starts empty.** Run
  `curl -s -H "Cookie: $RIVAL" $BASE/dashboard | grep -ao 'No campaigns yet'` and
  `curl -s -H "Cookie: $RIVAL" $BASE/brands | grep -ao 'No brands yet'`.
  Both match.
- **Cross-agency lists are empty, not filtered-looking.** Run
  `node .claude/skills/verify/serverfn.mjs listBrands null "$RIVAL"` and
  `node .claude/skills/verify/serverfn.mjs listCampaigns null "$RIVAL"`.
  Both `result` arrays are `[]`.
- **Cross-agency read by id is refused.** Run
  `node .claude/skills/verify/serverfn.mjs getCampaign "{\"id\":\"$CID\"}" "$RIVAL"`.
  `location` is `/campaigns`, `result.isSerializedRedirect` is `true`, and no
  campaign name, prize label or lead email appears in the output.
- **Cross-agency page by id is refused.** Run
  `curl -s -H "Cookie: $RIVAL" $BASE/campaigns/$CID | grep -ac 'leads:\$R\|Verify Drop'`.
  It is `0`. Grep the hydration payload marker as well as the name: that route
  currently renders the campaigns list for everyone (see `campaigns.md` Gotchas),
  so a name-only grep returns `0` whether or not the guard works. The payload
  marker is what proves the child loader was refused.
- **Cross-agency write is refused.** Run
  `node .claude/skills/verify/serverfn.mjs deleteCampaign "{\"id\":\"$CID\"}" "$RIVAL"`
  and then `node .claude/skills/verify/serverfn.mjs updateBrand "{\"id\":\"$BID\",\"name\":\"Stolen\",\"logoUrl\":\"\",\"primaryColor\":\"#000000\",\"accentColor\":\"#ffffff\",\"espProvider\":\"none\"}" "$RIVAL"`.
  Both redirect instead of acting.
- **Prove nothing changed.** Run
  `node .claude/skills/verify/serverfn.mjs getCampaign "{\"id\":\"$CID\"}" "$COOKIE"`.
  The campaign still exists, still named `Verify Drop`, and its brand is still
  named `Verify Co`. This second view is the proof; the refusal alone is not.
- **Proof.** Save the anonymous redirect table, both refusal objects, and the
  owner's unchanged `getCampaign` result to
  `.claude/skills/verify/artifacts/$RUN/tenancy/`.

## Gotchas

- **A refusal is HTTP 200.** `requireUser`, `requireBrand` and `requireCampaign`
  throw a redirect that serializes into the response body. A check that asserts
  `status != 200` reports a passing guard as a failure, and a check that asserts
  `status == 200` reports a broken guard as a pass. Assert on `location` or
  `result.isSerializedRedirect`.
- A denied read and a missing row are indistinguishable by design — both redirect.
  Do not treat "redirected" as proof the row was deleted; read it back as the
  owner.
- `listBrands` and `listCampaigns` scope by owner in SQL, so a leak shows up as a
  non-empty array, not an error. Assert the array is empty, not that the call
  succeeded.
- Ownership is per brand, not per agency seat. There is no second user on a brand
  yet, so do not write a recipe that expects shared access to work.
- Search the cross-agency HTML with `grep -a`. Without it the count is
  meaninglessly `0` whether or not the data leaked.
