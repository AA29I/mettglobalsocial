# Mett Social — product specification

Mett Global's internal social publishing workspace, designed for future multi-company use. This document defines the intended product; README.md identifies what the current version actually implements.

## Reference evidence

Reviewed eight supplied Metricool clips and a 56.7-second thumbnail follow-up. Public Metricool, Buffer and Publer pages returned HTTP 403 during research; no unsupported claims about competitor feature coverage are made. Reference notes are in docs/reference-review.md. Build original Mett Global branding and interface assets. Do not copy third-party logos, code, illustrations, or paid assets.

## Workspace and identity model

- An operator can manage multiple companies under one identity.
- Each company owns its social account records, media references, drafts, scheduled jobs, metrics, and activity history. Every API operation must enforce this boundary on the server.
- Many accounts of the same platform can belong to a company. Destination identity is the account ID, never only the platform name.
- Initial version: one private owner with access to their companies. Public release requires invitations, workspace memberships, roles (owner/admin/editor/approver/viewer), account recovery, and tested authorization. A company boundary is not equivalent to a separate user's security boundary.
- Company brand settings include name, initials and accent. Mett Global's official logo/colors must be supplied; provisional colors are replaceable tokens.

## Required product areas

1. Overview: actual queue/draft/account totals, upcoming content, recent actions and integration readiness.
2. Company manager: create/select/update company; preserve independent company data; archive/delete only with explicit data-handling rules.
3. Accounts: Facebook Pages, Instagram professional accounts, Pinterest, Google Business Profile, YouTube and TikTok first. Add actual OAuth connections and capability badges per account. LinkedIn, Threads, Bluesky and other integrations are later adapters.
4. Composer: select one or many accounts; shared text/media defaults; account-specific text, title, tags, format and cover overrides; truthful platform preview; save incomplete drafts; validate publishing requirements.
5. Drive media library: use authorized Drive file IDs for videos and custom cover images. Avoid permanent duplicate video storage. Support file access checks, metadata, source version checks and temporary transfer only where necessary. A saved sharing URL is not a completed Drive integration.
6. Cover tools: separate uploaded image thumbnail from video-frame cover timestamp. The reference shows a frame slider for Instagram/Pinterest/TikTok and thumbnail upload for YouTube/Facebook. Capabilities depend on format and official APIs. Preserve independent account overrides.
7. Planning: company calendar/list, explicit timezone, draft/scheduled/blocked/published states, reschedule/cancel, publish now and durable per-account results. Library/review/recurrence follow after basic publication is reliable.
8. Publishing service: durable database-backed worker, official APIs, token refresh, processing polls, bounded retry/backoff, rate-limit tracking, reconciliation after ambiguous requests, duplicate prevention and audit trail. Browser closure must not stop jobs.
9. Analytics: provider-backed account/post metrics, ranges, comparisons, refresh time and unavailable states. Historical limits must be stated. No invented live metrics.
10. Settings: company identity, timezone, network configuration, session management and eventual team access.

## Platform-specific controls to implement and verify

| Platform                | Required controls based on recordings and user needs                                                                                                                         |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Facebook                | Page/account selection; post/reel/story; description; title; thumbnail; processing and delivery result                                                                       |
| Instagram               | Eligible professional account; post/reel/story/trial-reel where supported; description; cover frame; collaborator; supported audio/tagging; show reel in feed; AI disclosure |
| Pinterest               | Board; description/title; target link; media; cover frame; format-specific capability validation                                                                             |
| Google Business Profile | Location; post type/text; supported media; call-to-action; API eligibility and current format limits                                                                         |
| YouTube                 | Channel; video/Short format; title; description; tags; privacy; category; playlist; audience; thumbnail; synthetic-content disclosure; subscriber notification               |
| TikTok                  | Account; caption; privacy; cover frame; comments/duet/stitch; commercial-content/AI disclosures where permitted                                                              |

Never infer full API support from a visible competitor control. Disabled/unavailable features must explain their prerequisites rather than pretend to succeed.

## Services and infrastructure

- Responsive React client with installable PWA shell; desktop browsers, tablets and phones share the API. Native Windows/macOS/Linux and Android/iOS packages require explicit packaging, signing, distribution, and device testing; PWA installation alone is not App Store publication.
- Authenticated API, persistent relational database and migration strategy.
- Background publication/metrics workers and scheduler, provider adapters, OAuth callback endpoints and encrypted credential storage backed by a deployment secret/KMS.
- Google Drive OAuth and picker; least-privilege media authorization.
- Deployment with HTTPS, secure cookies, backups, health checks, monitoring and always-on execution. A development environment is not production hosting.
- Future: queue separation, PostgreSQL for concurrent/multi-instance operation, notification service, approvals, RBAC and public onboarding.

## Security and release requirements

Owner authentication, hashed passwords, expiring server sessions, origin validation, bounded input, server-side company scoping and parameterized SQL are baseline. Before external/public access add recovery/MFA, invitation-based setup, brute-force controls suitable for distributed deployment, OAuth review, encrypted refresh tokens, privacy/terms/deletion flows, CSRF and penetration review, backup restore validation, observability, accessibility and real-device testing. Never include provider secrets in browser code or repository files.

## Acceptance scenarios

- Two companies can contain same-network accounts; a post/account/media reference from one cannot be accessed through another company's API.
- Shared copy and account overrides survive reload, editing and changing company. Unselected accounts never publish.
- A media reference stays in the correct company and can be reused without copying video bytes.
- A draft can be saved without accounts/content. Scheduling requires eligible accounts, source media where required, a valid future time and verified provider support.
- Missing integrations leave the item explicitly blocked; they never produce a published success.
- Worker restart does not lose jobs; partial delivery cannot duplicate successful posts; uncertain responses require reconciliation.
- Local date/time round-trips with an explicit IANA timezone; invalid DST times are rejected or resolved explicitly.
- Real publication is validated with authorized test accounts, including cover outcome. Mock-only success is not integration readiness.
- All main tasks work with keyboard and at 390px mobile width as well as desktop.

## Delivery stages

Foundation: persistent owner login, companies, account inventory, Drive references, composer overrides, planning queue, local audit history, responsive UI and PWA shell. Google/Meta/Pinterest/TikTok authorization and Drive browsing implementations are present, along with YouTube native-schedule preparation; all require live provider acceptance. Other publishing adapters, a general worker and provider analytics remain subsequent stages, not silently simulated. Native delivery follows confirmed platform requirements. Official brand asset approval remains a dependency for final branding.
