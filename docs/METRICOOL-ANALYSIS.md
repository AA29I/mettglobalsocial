# Metricool inside out, and the Mett Social gap map
Prepared for Ahmad, 2026-10-24. Sources: Metricool's own help center and product pages (read 2026-10-24), his live Metricool instance (free plan, one brand), and the Mett Social codebase itself (README.md, docs/PRODUCT.md, docs/reference-review.md, full file inventory of the ported copy at D:\Antigravity\mett-social).

Rule for the build: functional and layout parity with Metricool, original Mett Global branding and assets. No Metricool logos, code, illustrations or paid assets are copied. This matches the guardrail already written into docs/PRODUCT.md.

## Part 1: What we already have (Mett Social, built by Codex)

Stack: React 19 + TypeScript (Vite 6) client, Express 5 server, SQLite locally, Neon PostgreSQL when hosted, zod validation, lucide-react icons. Electron desktop shell also present. PWA metadata included.

Size: 52 source files, about 370 KB of hand written code. The whole client UI lives in one file, src/App.tsx (97 KB), with src/styles.css (49 KB). Server: app.mjs (19.7 KB), connections.mjs (15.1 KB), youtube.mjs (15.3 KB), db.mjs (2.8 KB). Tests: node test suites for API, OAuth, time handling and YouTube failures, plus Playwright browser specs. Docs: ARCHITECTURE, DEPLOYMENT, PRODUCT, VALIDATION, reference-review.

Working today (per README, verified against the code inventory):
- Owner login, hashed passwords, expiring HTTP only sessions, origin checks.
- Multiple companies (Metricool calls them brands), multiple accounts per network per company, server enforced company scoping.
- Drafts, shared captions, per account overrides and cover preferences, persistent queue items.
- Google Drive reference library and Drive browsing after authorization, token refresh.
- List and calendar planning, company timezone, activity history.
- OAuth flows implemented for Google (YouTube + Drive), Meta (Facebook Pages + linked Instagram), Pinterest, TikTok.
- YouTube publishing path: resumable Drive to YouTube transfer, private upload, thumbnail from Drive, audience and disclosure settings, native scheduled release. This is the one real publishing pipeline.
- Deployment configs present but unused: vercel.json (API as a serverless function, 30s max duration), netlify.toml, render.yaml. Never deployed, no git repo, no provider credentials configured anywhere.

Not built (README states these plainly):
- Publishing adapters for Facebook, Instagram, Pinterest, TikTok (OAuth exists, publishing does not).
- Analytics: honest unavailable state, no metrics pipeline.
- No LinkedIn, Threads, Bluesky, X, Google Business, Twitch connections at all.
- No inbox, no SmartLinks, no ads, no approvals, no recurrence/autolists, no hashtag tools, no AI assistant.
- Branding is provisional (monogram and palette placeholders, pending official assets).

## Part 2: Metricool inside out (the target)

Core model: everything hangs off a BRAND (one business). Each brand holds exactly one account per platform. Users, roles and approvals sit above brands.

Top menu, six blocks:
1. Analytics. Per network metric dashboards (followers, growth, engagement, posts, reels and stories), date ranges and comparisons, post level tables. Hashtag Tracker lives here. Competitor tracking (add rival accounts, benchmark; Threads competitors added 2026). On connect, Metricool backfills the previous 30 days, then tracks forward.
2. Reporting. Custom report builder exported as PDF, PPT or CSV, saved templates; Campaign Dashboards; Metricool Studio; Looker Studio (Data Studio) connector.
3. Inbox. One queue for messages and comments: Facebook, Instagram and Google Business primarily; mark read/unread, assign, reply in place, saved replies.
4. Planning. The centerpiece:
   - Calendar view and List view (his instance shows exactly these tabs plus Posts library, Autolists, Deleted posts, Flows).
   - Create post: pick profiles, upload media, per network text customization, per network previews, best times to post heatmap per platform, drag and drop rescheduling.
   - Drafts and notes; duplicate and repurpose posts, including across brands.
   - Posts library (content bank) and media library (image and video bank) with a built in editor and hashtag search.
   - Autolists: recurring queues (evergreen recycling) fed manually or by RSS; bulk scheduling by CSV.
   - Social Calendars: ready made notable dates layered on the planner.
   - Flows (new in his instance): chained/automated planning flows.
   - Approval system: posts can require review; Review requests queue in the account menu.
5. SmartLinks. Link in bio pages: multiple buttons and links, themes and branding, click analytics.
6. Ads. Create and manage Meta Ads, Google Ads and TikTok Ads campaigns next to the organic data.

Connections per brand (15): website/blog, Facebook Page (Groups also supported), Instagram Business or Creator, Threads, X (paid add on), Bluesky, LinkedIn profile or Page (paid plans), Pinterest, TikTok, Google Business Profile, YouTube, Twitch, Meta Ads, Google Ads, TikTok Ads.

AI layer: AI Social Media Assistant generates captions and variations inside the composer, credit based; higher tiers add instruction tuning and AI scheduling/alt text.

Account layer (top right menu): Add brand, Connections dashboard, Brand settings (name, picture, engagement formula), User management (invite users per brand, roles), Plans and billing, Review requests, Language (EN, FR, ES, PT, DE), Account settings.

His instance specifically: free plan, 20 published posts per month (drafts do not count, resets on the 1st), one brand, plan usage banner in the planner. The replica is for in house use, so plan limits do not apply to ours; the UX patterns do.

## Part 3: Gap map (Metricool block vs Mett Social today)

- Brands/companies model: BUILT (companies, scoping, settings). Missing: user management, roles, invitations.
- Connections: PARTIAL. OAuth for Google, Meta, Pinterest, TikTok built, none configured with live credentials. Missing networks: LinkedIn, Threads, Bluesky, X, Google Business, Twitch, all three Ads accounts, website/blog tracking.
- Planning core: PARTIAL. Calendar + list + drafts + per account overrides built. Missing: best times heatmap, drag and drop (to verify in code), post previews per network exist in spec, library/recurrence/autolists/CSV bulk/social calendars/flows, approvals.
- Publishing: MOSTLY MISSING. YouTube pipeline only. Meta (FB/IG), TikTok, Pinterest adapters are the critical path. A durable background worker with retry, backoff, rate limit tracking and reconciliation is specified in PRODUCT.md but is a later stage; on Vercel the 30 second function cap means the worker design needs care (queue + cron driven chunks, or keep the always on server on a small host and use Vercel for the client; DEPLOYMENT.md should be checked against this).
- Analytics: MISSING (unavailable state only). Needs per network metrics ingestion once accounts connect.
- Reporting: MISSING.
- Inbox: MISSING.
- SmartLinks: MISSING (small, self contained; quick win).
- Ads: MISSING (start read only dashboards later; campaign creation last).
- AI assistant: MISSING (Ahmad already pays for Google AI Pro; Gemini can power captions at no extra tool cost when we build it).

## Part 4: Build order to an exact working replica

Phase 0, foundation (first): port is done (D:\Antigravity\mett-social). Apply the real Mett Global brand kit (logo lockup, palette near black #090908, paper #FBFAF6, gold #B8892D and #E0BC68). Split the 97 KB App.tsx into modules as features land. Create the repo on AHMAD's GitHub and link AHMAD's Vercel (accounts rule; verify in Antigravity UI before pushing). Decide hosting shape for the worker (see publishing note above) before wiring scheduled posts.
Phase 1, connections + credentials: register the developer apps (Meta, Google, TikTok, Pinterest) under Mett Global, configure secrets on the machine only, connect the real Mett Global accounts, validate each OAuth live.
Phase 2, publishing: Meta adapter (FB + IG) first, then TikTok, then Pinterest, then LinkedIn, Threads, Bluesky, Google Business. Durable worker with the PRODUCT.md acceptance rules (no duplicates, restart safe, blocked states honest).
Phase 3, planning parity: best times, autolists + RSS, bulk CSV, posts library, social calendars, approvals (Review requests queue), drag and drop.
Phase 4, analytics + reporting: metrics ingestion per network, hashtag tracker, competitors, report builder (PDF/PPT/CSV).
Phase 5, inbox: FB/IG/GBP messages and comments queue with saved replies.
Phase 6, SmartLinks: link in bio pages with click analytics (can jump the queue; it is small).
Phase 7, ads + AI: ads dashboards (Meta first), then AI captions via Gemini.

## Honest constraints
- Platform approvals are the long pole, not code: Meta app review, TikTok API approval and LinkedIn's partner gates each take days to weeks and sit outside our control. The plan sequences around them.
- X is a paid API tier at any real volume; treat X as a later adapter.
- "Exact replica" means every Metricool workflow above working under Mett Global branding. It is a multi week build run in phases, with a usable planner from Phase 2 onward.
