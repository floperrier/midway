# Leads and CSV export

The list is the product. Every capture lands on the campaign page as a row —
email, phone, prize, code, date — and the agency hands it to the brand as a CSV.
The dashboard rolls the same rows up into a lead count and a signup rate. ESP
push is not wired yet: `espProvider` and `lead.exportedAt` are stored but nothing
reads them.

## Sub-features

- `leads-empty` shows `Nothing captured yet` on a campaign with no leads. **Unreachable — see Gotchas.**
- `leads-table` lists captured leads newest-first with prize and code. **Unreachable — see Gotchas.**
- `leads-count` shows the lead count next to the `Leads` heading and in the campaign list.
- `leads-export` produces a CSV of every lead with a campaign-named filename.
- `leads-export-escaping` quotes values containing a comma, quote or newline.
- `leads-export-guarded` refuses an export aimed at another agency's campaign.
- `leads-signup-rate` reports leads over plays on the dashboard and campaign page.
- `leads-esp-unwired` stores an ESP provider but pushes nothing (known gap).

## How to get to it (user POV)

- Open `/campaigns/$id` and read the `Leads` table at the bottom. **Currently
  unreachable** — that URL renders the campaigns list; see Gotchas.
- Choose `Export CSV` on that page — the browser downloads
  `<campaign-slug>-leads.csv`. **Currently unreachable** for the same reason;
  `exportLeadsCsv` itself works and is verified below.
- Read `Leads captured` and `Signup rate` on `/dashboard` — this page renders.

## Driving it with curl and serverfn.mjs

Preconditions:

- Doctor passes and `BASE=http://localhost:3200` is set.
- A live campaign is in `$CID` with slug `verify-drop` under `$BSLUG`, and its
  agency session is in `$COOKIE` (see `campaigns.md`).
- A second agency session is in `$RIVAL` (see `authentication.md`).

- **The page entry points are unreachable.** Run
  `curl -s -H "Cookie: $COOKIE" $BASE/campaigns/$CID | grep -ac 'Nothing captured yet\|Export CSV\|Leads'`.
  It is `0`, because `/campaigns/$id` serves the campaigns list. Report
  `leads-empty` and `leads-table` as failing against that route, then verify the
  data through the server functions below. Do not report them as verified.
- **Capture two leads.** Follow `hosted-game.md`'s capture step twice with
  `P1="lead-a-$(openssl rand -hex 3)@verify.test"` and `P2` — give `P2` a phone.
  Keep both responses.
- **The count is right.** Run
  `node .claude/skills/verify/serverfn.mjs getCampaign "{\"id\":\"$CID\"}" "$COOKIE"`.
  `result.leads` has two entries, newest first. `listCampaigns` reports `leads: 2`
  for this campaign.
- **Export the CSV.** Choose `Export CSV`. Run
  `node .claude/skills/verify/serverfn.mjs exportLeadsCsv "{\"campaignId\":\"$CID\"}" "$COOKIE"`.
  `result.filename` is `verify-drop-leads.csv`. `result.csv` starts with
  `email,phone,prize,discount_code,captured_at`, has CRLF line endings, and its two
  data rows carry the same codes the capture responses returned.
- **Escaping holds.** Capture a lead whose phone contains a comma, e.g.
  `"phone":"+33 6, ext 12"`, then export again. That cell is wrapped in double
  quotes and the row still has five fields. Run
  `node .claude/skills/verify/serverfn.mjs exportLeadsCsv "{\"campaignId\":\"$CID\"}" "$COOKIE" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const csv=JSON.parse(s).result.csv;console.log(csv.split("\r\n").map(l=>l).join("\n"))})'`
  and read the quoted cell.
- **Export is tenancy-guarded.** Run
  `node .claude/skills/verify/serverfn.mjs exportLeadsCsv "{\"campaignId\":\"$CID\"}" "$RIVAL"`.
  `location` is `/campaigns`, `result.isSerializedRedirect` is `true`, and no email
  address appears in the output.
- **Signup rate is honest.** Record a known number of plays and captures: three
  `{"action":"play"}` posts and one capture on a campaign starting from zero. Run
  `node .claude/skills/verify/serverfn.mjs getDashboard null "$COOKIE"`.
  `plays` is `3`, `leads` is `1`, `signupRate` is `0.333…`. With zero plays,
  `signupRate` is `null` and the page shows `—`, not `0%`.
- **ESP push is unwired.** Run
  `npx wrangler d1 execute midway-db --local --json --command "SELECT count(*) n FROM lead WHERE exported_at IS NOT NULL"`.
  It is `0` after every export. Report `leads-esp-unwired` as a known gap, not a
  failure — CSV is the only export path today.
- **Proof.** Save the `getCampaign` result listing both leads, the full
  `exportLeadsCsv` result including the escaped row, the refused export, and the
  before/after `getDashboard` objects to
  `.claude/skills/verify/artifacts/$RUN/leads/`.

## Gotchas

- **The campaign detail page does not render, so the lead table and the
  `Export CSV` button cannot be driven through the UI.** `/campaigns/$id` serves
  the campaigns list; see `campaigns.md` Gotchas for the cause. A grep for a lead's
  email on that URL can still match — the address appears in the page's hydration
  payload — so a check written against the page HTML passes while the table is not
  on screen. Match on rendered markup only, or verify through `getCampaign`.
- **`exportLeadsCsv` returns the CSV as a string; it does not download a file.**
  The browser builds the blob client-side. There is no file on disk to check —
  assert on `result.csv`.
- The CSV uses CRLF (`\r\n`) line endings per RFC 4180. Splitting on `\n` leaves a
  trailing `\r` on every field and makes a correct export look broken.
- `Export CSV` only renders when the campaign has at least one lead. Its absence on
  an empty campaign is correct.
- The campaign page loads at most 200 leads; the CSV export has no limit. A count
  mismatch above 200 is the page's cap, not lost data.
- A capture with no prizes configured stores `NULL` for prize and code, which the
  CSV renders as empty fields and the table as `—`. That is valid, not a bug.
- `signupRate` is `null`, not `0`, when no play has been recorded. Asserting
  `signupRate === 0` fails on a healthy new campaign.
- Deleting the campaign or its brand deletes the leads. Export before any delete
  step in the same run, or the proof disappears with the data.
