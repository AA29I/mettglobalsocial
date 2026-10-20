# Architecture and zero-budget constraints

## Storage and execution

React/Vite serves the responsive interface. An authenticated Express API owns company checks, validation, sessions, OAuth and publishing preparation. SQLite provides local development persistence; the database abstraction supports Neon PostgreSQL through `DATABASE_URL`. The Neon path has not yet been exercised against a live database. Statements are parameterized and company-scoped. This version is one owner managing many companies, not a publicly multi-user SaaS with roles.

Videos and thumbnail images remain in the user's Google Drive. The app stores references, settings, encrypted credentials and upload progress. Drive OAuth currently uses `drive.readonly`, which can read accessible files; public release should assess a narrower picker/`drive.file` flow. Tokens never go to browser code. Hosted OAuth requires a stable 32-byte AES-GCM encryption key supplied securely. Credential encryption protects stored data; it does not replace database access controls or deployment secret management.

## Why YouTube first

YouTube supports native `status.publishAt`. Prepare an upload while the owner is using the app, upload the thumbnail, and only then set the native publishing time. Once confirmed by YouTube, no always-on Mett Social worker is needed for that release. This is a narrower, testable solution to the zero-budget scheduling problem. Other platforms must be researched and implemented individually; they are not scheduled by a sleeping browser.

Each upload chunk is a separate bounded HTTP operation. State, encrypted resumable URL, immutable post snapshot and progress are durable. An atomic lease prevents overlapping processing. Upload progress is queried before resuming. If the final response is lost, query the existing session before sending bytes again. An expired/ambiguous session requires manual review rather than blind reupload. Source version/size changes stop preparation. Thumbnail upload is repeated only against the same video ID, and native scheduling happens after cover success. Live API behavior and processing completion still need provider testing.

This preparation flow is not a general-purpose unattended worker. Closing the tab mid-preparation pauses progress; the job can be resumed. YouTube takes over only after the job is confirmed scheduled.

## Budget decision

- Google Drive: use the storage the user already has. Drive API quotas, bandwidth and file access still matter.
- Neon: target its free plan for relational metadata, with no paid upgrades. Verify current account quotas, retention and suspension behavior before deployment; no unlimited capacity claim is made.
- Vercel: deployment configuration is included. Hobby has historically been restricted to personal/non-commercial use. A company tool must not assume eligibility. Current plan terms could not be retrieved from this environment. Use an existing eligible plan with no incremental charge, or choose a commercially eligible free host after verifying its current terms.
- An optional Render Free manifest is included as a candidate alternative, not as verified free-plan eligibility. Sleeping is compatible with already-prepared native YouTube schedules, but not precise custom background publication.
- No paid service, card entry, automatic upgrade, or deployment has been enabled.

## Release boundaries

Before internal use: configure HTTPS origin, persistent database, setup token and encryption key; create platform developer apps; register callbacks; authorize actual test accounts; inspect real uploaded/scheduled results; test database backup/recovery and credential refresh. Before public use: memberships/RBAC, invitation onboarding, account recovery/MFA, audit retention, OAuth review, privacy/deletion policy, more substantial rate limiting and security review, accessibility/device checks, and published provider limitations.

## Interface preview deployment

The Vercel build defaults to a marked interface-preview mode. `src/preview.ts` stores non-secret planning data in browser localStorage, not a production database. It has no real authentication, account connections or publishing. Server-backed local builds remain the default for `npm run build`; a hosted server-backed build requires explicit `APP_MODE=production` and deployment prerequisites. This separates visual testing from live integration readiness without adding paid services.
