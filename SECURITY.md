# Security

## Reporting a problem

Please report security issues privately through GitHub: **Security → Report a vulnerability** on this repository. Don't open a public issue for them. You'll get a reply within a few days.

## What the app does to keep data safe

- **Sign-in:** Google sign-in through Firebase Auth. The server checks every Firebase ID token and keeps the session in an httpOnly, Secure, SameSite cookie. Accounts are for adults (18+); children are added by a parent and never sign in.
- **Every write goes through the server:** API routes validate every body with Zod, check the caller's family role, and check the request's `Origin`. Firestore security rules deny by default and are tested role by role on the emulator (`tests/emulator/`).
- **Health details stay private:** they are stored apart from the profile, shared only as the person chooses, and never sent to Gemini. The AI gets only band names, times and roles.
- **AI output is checked:** Gemini's text is parsed against a schema and screened before it is shown; if it fails, the app shows rule-based text instead.
- **Limits:** rate limits on the API and on Gemini calls, a body size cap, and no secrets in browser code (`NEXT_PUBLIC_*` holds only Firebase's public web config).
- **Headers:** a strict Content-Security-Policy, `X-Frame-Options: DENY`, `frame-ancestors 'none'`, HSTS, `nosniff`, a referrer policy and a permissions policy.
- **Supply chain:** CI uses read-only permissions and actions pinned by commit; Dependabot proposes dependency updates every week.
- **Your data:** Profile → Delete my account removes your profile, health details, family membership and sign-in account.
