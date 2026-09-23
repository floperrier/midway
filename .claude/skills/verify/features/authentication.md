# Authentication

An agency opens one account that runs every brand it manages. Registration takes
a name, email and password, signs the agency straight in, and lands it on the
dashboard; sign-in returns to the same place; sign-out drops the session and
sends the browser back to the login page.

## Sub-features

- `auth-register` creates an agency account and issues a session in one step.
- `auth-register-duplicate` refuses a second account on the same email.
- `auth-register-weak` refuses a password under 8 characters.
- `auth-signin` exchanges the right email and password for a session.
- `auth-signin-wrong` refuses a wrong password without revealing which half failed.
- `auth-session` reports the signed-in user to the app.
- `auth-signout` invalidates the session so protected pages bounce again.
- `auth-google` stays absent until `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set.
- `auth-secret-guard` refuses to serve at all when `BETTER_AUTH_SECRET` or `BETTER_AUTH_URL` is missing.

## How to get to it (user POV)

- Open `/register` and submit the `Open a booth` form.
- Open `/login` and submit the `Sign in` form.
- Open `/` while signed out — it redirects to `/login`; while signed in it goes to `/dashboard`.
- Choose `Sign out` in the dashboard sidebar.

## Driving it with curl and serverfn.mjs

Preconditions:

- Doctor passes and `BASE` is set as in `../SKILL.md` Drive.
- No account exists for the address this recipe generates.

- **Register.** Submit the `Open a booth` form.
  Run `EMAIL="verify-$(openssl rand -hex 4)@verify.test"` then
  `curl -s -D/tmp/h -o /tmp/b -w '%{http_code}\n' -X POST $BASE/api/auth/sign-up/email -H 'content-type: application/json' -H "Origin: $BASE" -d "{\"email\":\"$EMAIL\",\"password\":\"verify-password-123\",\"name\":\"Verify\"}"`.
  Status is `200` and `/tmp/h` carries a `set-cookie: better-auth.session_token=…`.
- **Keep the session.** Run
  `COOKIE=$(grep -i '^set-cookie:' /tmp/h | sed 's/^[Ss]et-[Cc]ookie: //' | cut -d';' -f1)`.
  `$COOKIE` is non-empty.
- **Duplicate email.** Register the same address again. Run the same sign-up
  command unchanged. Status is `422` and the body carries the
  code `USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL`; no second row appears in
  `npx wrangler d1 execute midway-db --local --json --command "SELECT count(*) n FROM user WHERE email='$EMAIL'"` (still `1`).
- **Weak password.** Run the sign-up command with `"password":"short"` and a
  fresh address. Status is `400` with code `PASSWORD_TOO_SHORT`, and no user row is created.
- **Sign in.** Run
  `curl -s -D- -o /dev/null -X POST $BASE/api/auth/sign-in/email -H 'content-type: application/json' -H "Origin: $BASE" -d "{\"email\":\"$EMAIL\",\"password\":\"verify-password-123\"}"`.
  A fresh `set-cookie` session token comes back.
- **Wrong password.** Run the same with `"password":"wrong-password-1"`. Status is `401`
  with code `INVALID_EMAIL_OR_PASSWORD`, and no `set-cookie` session token is issued.
- **Session is readable.** Run
  `node .claude/skills/verify/serverfn.mjs getSessionFn null "$COOKIE"`.
  `result.user.email` equals `$EMAIL`.
- **Landing page follows the session.** Run
  `curl -s -o /dev/null -w '%{redirect_url}\n' -H "Cookie: $COOKIE" $BASE/` — it is
  `…/dashboard`. Without the cookie it is `…/login`.
- **Sign out.** Run
  `curl -s -X POST $BASE/api/auth/sign-out -H 'content-type: application/json' -H "Cookie: $COOKIE" -H "Origin: $BASE" -d '{}'`.
  The body is `{"success":true}`;
  `node .claude/skills/verify/serverfn.mjs getSessionFn null "$COOKIE"` now returns
  `result: null`, and `curl -s -o /dev/null -w '%{http_code}' -H "Cookie: $COOKIE" $BASE/dashboard`
  is back to `307`.
- **Google is inert.** Run `grep -c . <(grep -o '^GOOGLE_[A-Z_]*=.\+' .dev.vars)`.
  If it is `0`, report `auth-google` skipped with that reason rather than driving
  an OAuth flow.
- **Secret guard.** Do not unset the vars on the running server. Read the guard
  instead: `sed -n '/missing/,/}/p' src/lib/auth.server.ts` shows the throw, and
  the env-var diff in `../SKILL.md` proves both names are declared for deploy.
- **Proof.** Save the sign-up headers, the `getSessionFn` result before and after
  sign-out, and the duplicate-email response to
  `.claude/skills/verify/artifacts/$RUN/auth/`.

## Gotchas

- The `Origin` header is required on every `/api/auth/*` call. Without it the
  request is rejected with `403`, which is easy to misread as bad credentials.
- `TRUSTED_ORIGINS` and `BETTER_AUTH_URL` must match the URL you are driving
  exactly — no trailing slash. A mismatch fails sign-up, not just OAuth.
- Sign-up returns the session cookie directly. Do not sign in afterwards to "get"
  a session; that masks a broken registration.
- `set-cookie` may appear more than once. Take the `better-auth.session_token`
  line, not the first line.
- Sign-out is `POST` **and needs `content-type: application/json` with a body**.
  Without them better-auth answers `415 UNSUPPORTED_MEDIA_TYPE` and the session
  survives — a sign-out check written without the header passes while proving
  nothing.
- The password is never echoed back. An account created with the wrong password
  in this recipe looks identical to one created correctly until sign-in fails.
