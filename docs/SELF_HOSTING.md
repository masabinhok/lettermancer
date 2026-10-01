# Self-hosting

Lettermancer works as a plain static site. Accounts, sync and leaderboards are optional and need a Supabase project,
either local through the Supabase CLI or hosted.

## 1. Offline only (no accounts)

```bash
npm install
npm run build          # outputs apps/web/build
```

Serve `apps/web/build` from any static host. Unknown paths must fall back to `index.html` (it's a single-page app).
With no Supabase variables set, the game hides sign-in and leaderboards and saves everything in the browser.

## 2. Local Supabase (development)

Needs Docker.

```bash
npm run supabase:start             # bundles the engine for edge functions and starts the stack
npx supabase functions serve       # in a second terminal: verify-run, verify-practice, delete-account
npx supabase status -o env         # prints API_URL, ANON_KEY, SERVICE_ROLE_KEY
```

Create `apps/web/.env.local` (it's gitignored):

```bash
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<ANON_KEY from status>
```

Then `npm run dev`. Magic-link emails are caught by Mailpit at http://127.0.0.1:54324.

To run the cloud tests:

```bash
export SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=...
npm run test:cloud          # RLS, verification, daily runs, ghosts, account deletion
npm run test:e2e:cloud      # sign-in and sync in a real browser
```

After changing the engine, run `npm run bundle:engine` again so the functions replay with the new rules.

## 3. Hosted Supabase (production)

1. Create a project at supabase.com and link it: `npx supabase link --project-ref <ref>`.
2. Apply the schema with `npx supabase db push`.
3. Deploy the functions:
   ```bash
   npm run bundle:engine
   npx supabase functions deploy verify-run verify-practice delete-account
   ```
   The functions read `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, which Supabase provides to them
   automatically. **Never put the service-role key in the web app.**
4. Set up auth in the dashboard:
   - Set **Site URL** to your domain, and add `https://<your-domain>/profile` to the redirect URLs.
   - Turn on the providers you want. Email is on by default. GitHub and Google each need an OAuth app whose callback
     is `https://<ref>.supabase.co/auth/v1/callback`.
   - Set up SMTP for email in production. The built-in sender is heavily rate-limited.
5. Build the web app with the project's URL and anon key:
   ```bash
   VITE_SUPABASE_URL=https://<ref>.supabase.co VITE_SUPABASE_ANON_KEY=<anon key> npm run build
   ```

## Environment variables

| Variable                    | Where           | Purpose                                           |
| --------------------------- | --------------- | ------------------------------------------------- |
| `VITE_SUPABASE_URL`         | web build       | Enables accounts; the Supabase API URL            |
| `VITE_SUPABASE_ANON_KEY`    | web build       | Public anon key (safe to ship; RLS protects data) |
| `SUPABASE_URL`              | edge functions  | Provided by Supabase                              |
| `SUPABASE_SERVICE_ROLE_KEY` | edge functions  | Provided by Supabase; bypasses RLS, server-only   |
| `SUPABASE_*` (same names)   | cloud tests, CI | Point `tests/cloud` at a stack                    |

## Deploying the web app

`vercel.json` at the repo root builds `apps/web` and rewrites every path to `index.html`. On Vercel, add the two
`VITE_` variables in the project settings. On Cloudflare Pages, use build command `npm run build`, output directory
`apps/web/build`, and the same variables. `apps/web/static/_redirects` gives Pages the SPA fallback.
