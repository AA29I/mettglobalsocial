# Reference evidence

The user supplied eight Metricool screen recordings (approximately 3m13s total), followed by a 56.7s recording of thumbnail and scheduling controls. The recordings were visually sampled across their full duration, with detailed frames of the editor. Public Metricool, Buffer and Publer requests returned HTTP 403. No exhaustive comparison against current paid plans is claimed.

## Observed workflows

- Brand/company selector, connection management, network analytics and reporting, inbox, planning, SmartLinks and Ads navigation.
- Calendar/list planning, best-time controls and empty states.
- Multiple selected networks with format menus; shared template and per-network customization tabs.
- Facebook title; Instagram collaborators/audio/show-in-feed/disclosure controls; Pinterest board/link; TikTok privacy/comments/duet/stitch; YouTube privacy/category/playlist/tags/disclosure/notification controls.
- Media menu lists Google Drive. The Drive picker itself was not demonstrated.
- Video attachment menu offers video editing, Instagram people/product/audio tagging, thumbnail upload, cover selection and removal.
- Cover submenu shows Instagram, Pinterest and TikTok icons, a video preview and a frame-selection slider.
- Separate thumbnail dialog shows computer, URL and select-frame tabs, and says the thumbnail applies to YouTube and Facebook. Image selection and a changed Facebook preview are shown.
- Scheduling actions: draft, posts library, review, schedule, publish now and recurring schedule. A completed scheduling operation or published result was not shown.
- Validation grouped by destination: missing media/title/board/audience, format issues, past time and contextual video-length rules.

## What this does not establish

Visible controls do not prove that every account type or post format supports the same API operations. Independent covers saved to multiple accounts, actual OAuth completion, successful scheduling, platform publication, timezone picker details and analytics completeness were not demonstrated. Mett Social's intended account-level overrides are a user requirement, not a claim that every observed Metricool tab does exactly the same thing.

## Official API sources used during research

- https://developers.facebook.com/docs/instagram-platform/content-publishing/
- https://developers.google.com/youtube/v3/docs/videos/insert
- https://developers.google.com/youtube/v3/docs/videos/update
- https://developers.google.com/youtube/v3/docs/thumbnails/set
- https://developers.google.com/youtube/v3/guides/using_resumable_upload_protocol
- https://developers.google.com/drive/api/guides/manage-downloads
- https://developers.google.com/my-business/content/posts-data

Some sources were retrieved earlier; credentials and live API behavior remain unverified. OAuth app configuration and provider approval must be checked against the actual developer project. Do not treat source links as proof that a live publishing test passed.
