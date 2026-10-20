# Deployment and connection setup

## Do not send credentials through chat

Use the hosting provider's environment-variable/secret interface. No secret belongs in a `VITE_` variable, source code, screenshot, or Git commit. The application reports only missing configuration names. Developer apps are a one-time setup; thereafter users connect through each platform's official login.

## Fast interface preview

Use Vercel's New Project page to import `AA29I/mettglobalsocial`, root directory `.`, and deploy using the repository configuration. No environment variables are needed for this preview. The default `npm run build:vercel` builds the browser-only preview, marked prominently in the app. All data is local to the visitor's browser and account connections/publishing are disabled. This allows UI review without exposing a public owner-setup form or requiring a database. It is not a completed production deployment.

Do not set `APP_MODE=production` until the database and security variables below exist. To convert the preview to a real server-backed application, set it along with all prerequisites and redeploy. Browser-only preview records are not synced or migrated automatically.

## Hosting prerequisites

Choose a hosting plan that permits this company's intended use within its free allowance. The repository contains Vercel configuration, but Vercel Hobby commercial-use eligibility is not assumed. No authenticated Vercel connector or CLI session was available during development. A running production deployment has not been tested.

1. Create a Neon project using its free plan and supply its PostgreSQL connection string as `DATABASE_URL` in hosting secrets. No value is stored in Git.
2. Import this repository into an eligible Vercel project, or use a compatible Node.js 24 host. Vercel build: `npm run build:vercel` with `APP_MODE=production`, output: `dist`; `api/index.mjs` handles API routes. Confirm the project's Node runtime supports 24.
3. Set `APP_ORIGIN` to the exact canonical HTTPS application origin, without trailing slash. OAuth redirects, origin protection and cookies depend on it. Preview origins need their own configuration; arbitrary previews are intentionally not accepted.
4. Set `SETUP_TOKEN` to a strong random value, and `TOKEN_ENCRYPTION_KEY` to base64 encoding of 32 cryptographically random bytes. Generate them privately with a trusted password manager or a local cryptographic tool. Never use example values in production.
5. Set `COOKIE_SECURE=true` and `NODE_ENV=production`. On Vercel cookies are secure automatically. On a Node host set `HOST=0.0.0.0` and use the provider's assigned `PORT`.
6. Deploy, verify `/api/health`, create the owner account with the setup token, create Mett Global, then configure provider apps below. Redeploy after changing environment variables where the host requires it.

Vercel local filesystem is not used for hosted persistence. Startup fails if `DATABASE_URL` is absent on Vercel. Do not use a SQLite file under `/tmp` as a production database. Avoid an automatic daily Vercel cron as a substitute for minute-accurate social publication.

## Google: YouTube and Drive

Create a Google Cloud OAuth web application. Enable YouTube Data API v3 and Google Drive API. Configure the consent screen and test users for internal testing. Add the exact redirect URI:

`https://YOUR-APP/api/oauth/callback/google`

Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` securely. Requested scopes are Drive read-only, YouTube upload and YouTube read-only. Click Connect in Social accounts, authorize an eligible channel/account, then browse Drive in Media library. A channel without eligible YouTube access, quota, required verification or custom-thumbnail permission can fail. Test-user consent and refresh-token lifetime can limit long-running use. Production/public OAuth verification and YouTube audit requirements must be checked for the actual project; do not infer public publishing eligibility from successful login.

In Composer select the authorized YouTube destination, customize its title, caption, audience and cover, attach a specific Drive video, and add a future queue item. In Planner click Prepare YouTube schedule. This makes real platform changes; use a test video/channel first. Keep the tab open through preparation, inspect the schedule and cover in YouTube Studio, then verify publication at the scheduled time.

## Meta: Facebook and Instagram authorization

Create/configure a Meta developer app with the appropriate Facebook Login/business use case and eligible Page permissions. Register:

`https://YOUR-APP/api/oauth/callback/meta`

Set `META_CLIENT_ID` and `META_CLIENT_SECRET`. Current code uses Graph API v23.0 and requests Page enumeration/read/manage-posts plus Instagram basic/content-publish permissions. Verify current approval, business verification, login configuration, Page tasks and Graph-version requirements in the developer dashboard. This flow enumerates Pages and linked Instagram professional accounts. It does not support publishing to arbitrary personal Facebook profiles. App-specific configuration IDs or permission changes may require adaptation after live testing. Publishing is not implemented yet.

## Pinterest authorization

Register an app and approved redirect:

`https://YOUR-APP/api/oauth/callback/pinterest`

Set `PINTEREST_CLIENT_ID` and `PINTEREST_CLIENT_SECRET`. Code requests boards read, pins read/write and user-account read. Trial/standard access and account approval affect availability. Authorization implementation has not been live-tested; video upload, covers, publication and analytics are not implemented.

## TikTok authorization

Configure Login Kit and the necessary Content Posting products/scopes in a TikTok developer app. Register:

`https://YOUR-APP/api/oauth/callback/tiktok`

Set `TIKTOK_CLIENT_ID` (TikTok's client key) and `TIKTOK_CLIENT_SECRET`. Requested scopes include user basic info, video publish and video upload. Approval, audit and permitted privacy settings depend on the project and user. Authorization has not been live-tested; publication and analytics are not implemented.

## Data handling and recovery

Keep the encryption key stable across deployments. Rotate it only through a tested decrypt/re-encrypt procedure or reconnect all accounts. Restrict database access and keep recoverable backups. Deleting an account record after removing dependent posts deletes the locally saved connection; it does not necessarily revoke provider authorization. Revoke access in provider settings as needed. A remote YouTube video must be cancelled/deleted in Studio until remote cancellation is implemented.
