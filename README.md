# Mett Social

Private social planning workspace for Mett Global. Responsive React interface, Express API, SQLite locally, and Neon PostgreSQL support for hosted deployment. The current monogram and palette are provisional pending official brand assets.

## Try the interface on Vercel without a database

Import `AA29I/mettglobalsocial` in Vercel, keep the repository root as the root directory, and deploy. `vercel.json` runs `npm run build:vercel`. With no `APP_MODE` set, this produces a clearly marked **browser-only interface preview**. It does not need Neon or social credentials. It allows company/account records, draft editing, cover preferences and planning; records stay only in that browser. It does not authenticate, connect accounts, sync between devices, or publish posts. Do not enter secrets or rely on it as your working production database.

To enable the real server-backed version later, set `APP_MODE=production` and configure the secure variables in docs/DEPLOYMENT.md, then redeploy. Existing browser-preview data is not automatically migrated to the real database. Confirm hosting-plan eligibility for the intended company use separately; no paid upgrade is configured.

Local preview validation:

```sh
npm run build:preview
npm run test:preview
```

## Run locally

Requires Node.js 24+.

```sh
npm ci
npm run build
npm start
```

The server listens on port 3001, loopback only by default. Open the application in your own local browser, create an owner account with a password of at least 12 characters, then create a company. For client hot reload use `npm run dev` instead. Do not run development mode as production hosting.

Local state lives in ignored `.data/`. Back up the SQLite database and `token.key` together; losing the key makes saved OAuth credentials unreadable. Do not commit this directory. `.env` is supported and ignored. Copy `.env.example`, then enter values securely on your own machine; never send secrets through chat or commit them.

## Working capabilities

- Owner login with hashed passwords, expiring HTTP-only sessions and origin checks.
- Multiple separate companies and multiple accounts per network.
- Persistent drafts, shared captions and independent account settings/cover preferences.
- Google Drive reference library, list/calendar planning, company timezone and activity history.
- Responsive phone/desktop layout and installable PWA metadata. No offline writes or native App Store packages are claimed.
- OAuth implementation for Google (YouTube + Drive), Meta (Facebook Pages + linked Instagram), Pinterest and TikTok. Provider developer credentials must be configured before the Connect buttons activate. Account records alone are not OAuth connections.
- Google Drive file browsing after authorization, including token refresh.
- YouTube preparation: resumable Drive-to-YouTube transfer, private upload, optional Drive thumbnail image, audience/disclosure settings, native scheduled release and confirmation of the channel/time. Progress is durable; keep the tab open while preparing. YouTube then owns the publishing time.

## Important current limits

No provider credentials, authorized live accounts, hosted PostgreSQL, or deployment authorization are present in this workspace. OAuth and YouTube behavior has automated simulated-provider coverage, not live platform acceptance. A real account test remains required.

Facebook/Instagram, Pinterest and TikTok publishing adapters are **not implemented**. Their OAuth implementation is present but has not been validated against live developer apps. Analytics are an honest unavailable state. Frame extraction, collaborations/audio publishing, approvals, recurrence and native installers are not implemented. Adding a generic queue item does not publish it. Unsupported destinations remain blocked.

YouTube preparation currently supports public scheduled release, a specific downloadable Drive video, a per-account title/description/audience, and either the provider default or a Drive JPEG/PNG thumbnail under 2 MB. Uploaded video bytes are transferred in 8 MiB chunks without permanent media storage. Prepare the release at least five minutes ahead; large videos need more lead time. Shorts classification is controlled by YouTube; a format label alone does not enforce Shorts eligibility. Category defaults to People & Blogs. Playlist support is not yet implemented.

Prepared jobs cannot be edited/deleted through this app yet because doing so would not cancel the remote video. Inspect or cancel the video in YouTube Studio. A job marked `needs_review` is never automatically reuploaded. Unfinished private uploads can remain in Studio and must be reviewed manually. After scheduling, this version does not poll actual publication or analytics; inspect Studio to confirm the final result.

## Validation

```sh
npm test
npm run build
npm run test:e2e
npm run build:preview
npm run test:preview
```

Browser checks use system Chromium (`/usr/bin/chromium` by default). Set `CHROMIUM_PATH` to your Chromium executable or install the appropriate Playwright browser and adjust the config. Tests use temporary databases and test-only credentials, never your accounts. See [validation evidence](docs/VALIDATION.md).

## Documents

- [Product requirements](docs/PRODUCT.md)
- [Recorded reference evidence](docs/reference-review.md)
- [Architecture and zero-budget constraints](docs/ARCHITECTURE.md)
- [Deployment and developer-app setup](docs/DEPLOYMENT.md)
- [Acceptance and remaining blockers](docs/VALIDATION.md)

Source code is saved in this checkout. No live deployment or public release is implied by a successful build.
