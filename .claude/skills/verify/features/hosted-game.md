# Hosted game

The booth the shopper actually sees. `/play/:brandSlug/:campaignSlug` renders the
brand's colours, the campaign name and the prize *labels*; choosing `Play` records
a play and asks for an email; submitting it returns the discount code the server
drew. Bespoke campaign builds live on the brand's own domain and replace this page
— what they cannot replace is `POST /api/play/:brandSlug/:campaignSlug`, which is
the contract this feature really covers.

## Sub-features

- `game-render` paints the booth with the brand's colours, name, logo and prize labels.
- `game-closed` shows `This booth is closed` for a draft, ended or unknown campaign.
- `game-play` records a play without collecting anything.
- `game-capture` trades an email for a prize label and a discount code.
- `game-code-secrecy` keeps every discount code out of the page before capture.
- `game-idempotent` returns the original prize when the same email plays again.
- `game-case-insensitive` treats `A@x.com` and `a@x.com` as the same lead.
- `game-phone` stores an optional phone number alongside the email.
- `game-validate` refuses a malformed email and an unknown action.
- `game-cors` answers cross-origin without a preflight.
- `game-404-opaque` makes a closed campaign indistinguishable from one that never existed.

## How to get to it (user POV)

- Open `/play/:brandSlug/:campaignSlug` — the link the agency copies from the campaign page.
- Choose `Play`, then fill `Email` (and optionally `Phone`) and choose `Reveal my code`.
- A bespoke game on the brand's own domain posts to `/api/play/:brandSlug/:campaignSlug` directly.

## Driving it with curl and serverfn.mjs

Preconditions:

- Doctor passes and `BASE` is set as in `../SKILL.md` Drive.
- A **live** campaign exists with a three-prize ladder. Follow `campaigns.md` and
  keep `$BSLUG` and `$CID`; the URL below is `$BASE/play/$BSLUG/verify-drop`.
- `API=$BASE/api/play/$BSLUG/verify-drop`.

- **The booth renders.** Open the play URL. Run
  `curl -s $BASE/play/$BSLUG/verify-drop > /tmp/play.html; grep -ao 'Verify Drop\|Verify Co\|10% off\|20% off\|Free tin\|Play' /tmp/play.html | sort -u`.
  The campaign name, brand name, all three prize labels and the `Play` button are
  present.
- **Codes are not in the page.** Run `grep -ac 'VFY10\|VFY20\|VFYTIN' /tmp/play.html`.
  It is `0` — **and** the previous bullet matched, which is what makes this zero
  mean anything. A blank page scores `0` too.
- **Record a play.** Choose `Play`. Run
  `curl -s -X POST $API -H 'content-type: text/plain' -d '{"action":"play"}'`.
  Body is `{"ok":true}`, and
  `npx wrangler d1 execute midway-db --local --json --command "SELECT play_count FROM campaign WHERE id='$CID'"`
  went up by one. No `lead` row was created.
- **Capture an email.** Fill `Email` and choose `Reveal my code`. Run
  `P="player-$(openssl rand -hex 4)@verify.test"` then
  `curl -s -X POST $API -H 'content-type: text/plain' -d "{\"action\":\"capture\",\"email\":\"$P\"}"`.
  Body is `{"ok":true,"repeat":false,"prizeLabel":"…","discountCode":"…"}` and the
  code is one of `VFY10`, `VFY20`, `VFYTIN`.
- **The lead persisted.** Run
  `npx wrangler d1 execute midway-db --local --json --command "SELECT email, phone, prize_label, discount_code FROM lead WHERE email='$P'"`.
  One row, matching the response's label and code.
- **Replay is idempotent.** Submit the same email again. Run the capture command
  unchanged. Body has `"repeat":true` with the **same** `discountCode`, and
  `SELECT count(*) FROM lead WHERE email='$P'` is still `1`.
- **Case-insensitive dedupe.** Run the capture with the address uppercased
  (`${P:u}` in zsh, or `tr a-z A-Z`). Body has `"repeat":true` and the same code;
  still one row.
- **Phone is stored.** Capture a fresh address with
  `"phone":"+33 6 12 34 56 78"`. The `lead` row's `phone` column holds the trimmed
  value.
- **Malformed email is refused.** Run the capture with `"email":"nope"`.
  Status is `400` with `{"error":"Malformed request."}`, and no row is created.
- **Unknown action is refused.** Run with `'{"action":"bogus"}'`. Status is `400`.
- **Unparseable body is refused.** Run with `-d 'not json'`. Status is `400`.
- **Unknown campaign is opaque.** Run
  `curl -s -o /dev/null -w '%{http_code}\n' -X POST $BASE/api/play/no-such-brand/no-such-game -H 'content-type: text/plain' -d '{"action":"play"}'`.
  It is `404` with the same `{"error":"This game is not running."}` body a drafted
  campaign gives.
- **Cross-origin works without a preflight.** Run
  `curl -s -D- -o /dev/null -X POST $API -H 'content-type: text/plain' -H 'Origin: https://shop.example.com' -d '{"action":"play"}' | grep -i 'access-control-allow-origin'`.
  It is `*`. The request carries a CORS-safelisted content-type, so no `OPTIONS`
  is sent.
- **Proof.** Save `/tmp/play.html`, the capture response, the replay response, the
  matching D1 lead row, and the three rejections to
  `.claude/skills/verify/artifacts/$RUN/game/`.

## Gotchas

- **`content-type: text/plain` is deliberate.** The body is JSON but the header is
  not, so the cross-origin call stays CORS-simple and skips the preflight. The
  handler parses from text and does not enforce the header — posting
  `application/json` also works, but it is not what a real bespoke game sends.
- **The `OPTIONS` handler is unreachable under `vite dev`.** Vite answers
  preflights itself, so a preflight test here proves nothing about production.
  Verify the `OPTIONS` route against `wrangler dev` or a deploy, or skip it and
  say so.
- **Grep the page with `-a`.** The SSR stream contains NUL bytes; without `-a`
  every match silently returns nothing and the secrecy check passes vacuously.
- **Always pair an absence check with a presence check** in the same fetch. "No
  discount codes in the HTML" is true of an error page too.
- The prize is drawn by weight, so `prizeLabel` differs between runs. Assert the
  code is *one of* the ladder's codes; never assert a specific one.
- `playCount` increments on the explicit `play` action, not on a page view. A
  recipe that only loads the page and expects the counter to move is wrong.
- A capture never increments `playCount`. Signup rate is leads over plays, and
  driving capture alone produces a rate above 100%.
- The endpoint has no rate limiting. It is fine to drive it in a loop locally, but
  do not treat "the loop succeeded" as a finding — that gap is known and
  documented in the README.
- Email is trimmed and lowercased before storage, so the `lead` row will not match
  a mixed-case address literally. Query with `lower(email)`.
