import type {
  Company,
  Workspace,
  Payload,
  Post,
  Autolist,
  MetricSnapshot,
  PostMetric,
  DemographicSnapshot,
  Competitor,
  InboxConversation,
  InboxMessage,
  ReportTemplate,
  TrackedHashtag,
  SmartLinkItem,
  SmartLinkPage,
  AdCampaign,
  AdAccountConnection,
  Account,
} from "./types";

// Explicit interface-preview storage. No credentials, network requests or simulated publishing.
export const previewMode = import.meta.env.VITE_PREVIEW_MODE === "true";
const key = "mett-social-interface-preview-v1";
type PreviewState = {
  companies: Company[];
  workspaces: Record<string, Workspace>;
};
const workspace = (): Workspace => ({
  accounts: [],
  media: [],
  posts: [],
  autolists: [],
  metricSnapshots: [],
  postMetrics: [],
  demographicSnapshots: [],
  competitors: [],
  conversations: [],
  reportTemplates: [],
  trackedHashtags: [],
  adCampaigns: [],
  adConnections: {},
  activities: [],
});
function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h >>> 0);
}
function dayKey(offsetDays = 0): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - offsetDays);
  return d.toISOString().slice(0, 10);
}
function buildDemographicsForAccount(
  acc: Account,
  totalFollowers: number,
  timezone = "UTC",
) {
  const geoPool = [
    { country: "Pakistan", cities: ["Karachi", "Lahore", "Islamabad"] },
    {
      country: "United Arab Emirates",
      cities: ["Dubai", "Abu Dhabi"],
    },
    { country: "United Kingdom", cities: ["London", "Manchester"] },
    { country: "United States", cities: ["New York", "Los Angeles"] },
    { country: "Saudi Arabia", cities: ["Riyadh", "Jeddah"] },
    { country: "Canada", cities: ["Toronto", "Vancouver"] },
    { country: "Singapore", cities: ["Singapore"] },
    { country: "Australia", cities: ["Sydney", "Melbourne"] },
  ];
  const seed = hashSeed(
    `${acc.id}:${acc.platform}:${acc.name}:${acc.handle || ""}:${timezone}`,
  );
  const startIdx = timezone.includes("Karachi")
    ? 0
    : timezone.includes("Dubai")
      ? 1
      : timezone.includes("London")
        ? 2
        : timezone.includes("America")
          ? 3
          : seed % geoPool.length;
  const orderedCountries = [];
  for (let i = 0; i < 5; i++) {
    orderedCountries.push(
      geoPool[(startIdx + i + (i > 0 ? seed % 2 : 0)) % geoPool.length],
    );
  }
  const uniqueCountries = Array.from(
    new Map(orderedCountries.map((c) => [c.country, c])).values(),
  );
  while (uniqueCountries.length < 5) {
    for (const g of geoPool) {
      if (!uniqueCountries.some((u) => u.country === g.country)) {
        uniqueCountries.push(g);
        if (uniqueCountries.length === 5) break;
      }
    }
  }
  const rawCountryWeights = [
    41 + (seed % 11),
    23 + ((seed >> 2) % 8),
    16 + ((seed >> 4) % 6),
    11 + ((seed >> 6) % 5),
    7 + ((seed >> 8) % 4),
  ];
  const weightSum = rawCountryWeights.reduce((a, b) => a + b, 0);
  let pctRemaining = 100;
  const countries = uniqueCountries.map((c, idx) => {
    const pct =
      idx === uniqueCountries.length - 1
        ? Number(pctRemaining.toFixed(1))
        : Number(((rawCountryWeights[idx] / weightSum) * 100).toFixed(1));
    pctRemaining = Number((pctRemaining - pct).toFixed(1));
    return {
      name: c.country,
      percentage: pct,
      followers: Math.max(1, Math.round((pct / 100) * totalFollowers)),
    };
  });

  const cityCandidates: { name: string; region: string }[] = [];
  for (const c of uniqueCountries) {
    for (const cityName of c.cities) {
      cityCandidates.push({ name: cityName, region: c.country });
    }
  }
  const selectedCities = cityCandidates.slice(0, 6);
  const rawCityWeights = [
    31 + (seed % 9),
    22 + ((seed >> 3) % 7),
    16 + ((seed >> 5) % 5),
    13 + ((seed >> 7) % 4),
    10 + ((seed >> 9) % 4),
    8 + ((seed >> 11) % 3),
  ];
  const cityWeightSum = rawCityWeights
    .slice(0, selectedCities.length)
    .reduce((a, b) => a + b, 0);
  let cityPctRemaining = 100;
  const cities = selectedCities.map((city, idx) => {
    const pct =
      idx === selectedCities.length - 1
        ? Number(cityPctRemaining.toFixed(1))
        : Number(((rawCityWeights[idx] / cityWeightSum) * 100).toFixed(1));
    cityPctRemaining = Number((cityPctRemaining - pct).toFixed(1));
    return {
      name: city.name,
      region: city.region,
      percentage: pct,
      followers: Math.max(1, Math.round((pct / 100) * totalFollowers)),
    };
  });
  return { countries, cities };
}
function ensurePreviewMetrics(w: Workspace, timezone = "UTC"): boolean {
  w.metricSnapshots ||= [];
  w.postMetrics ||= [];
  w.demographicSnapshots ||= [];
  w.competitors ||= [];
  w.conversations ||= [];
  w.reportTemplates ||= [];
  w.trackedHashtags ||= [];
  let changed = false;
  const socialAccounts = w.accounts.filter((a) => a.platform !== "drive");
  const at = new Date().toISOString();
  const today = dayKey(0);

  for (const acc of socialAccounts) {
    const accountPosts = w.posts.filter((p) =>
      (p.payload.accountIds || []).includes(acc.id),
    );
    const hasAny = w.metricSnapshots.some((s) => s.account_id === acc.id);
    if (!hasAny) {
      const seed = hashSeed(
        `${acc.id}:${acc.platform}:${acc.name}:${acc.handle || ""}`,
      );
      const connectedBoost = acc.status === "connected" ? 420 : 180;
      const baseFollowers =
        connectedBoost + (seed % 900) + accountPosts.length * 45;
      const baseFollowing = 45 + ((seed >> 3) % 220);
      const dailyStep = 2 + (seed % 7) + Math.min(accountPosts.length, 5);
      for (let offset = 59; offset >= 0; offset--) {
        const dateStr = dayKey(offset);
        const dayIndex = 59 - offset;
        const wave = ((seed + dayIndex * 13) % 5) - 1;
        const followers = Math.max(
          20,
          baseFollowers + dayIndex * dailyStep + wave,
        );
        const following = Math.max(
          10,
          baseFollowing + Math.floor(dayIndex / 6),
        );
        const postsUpToDay = accountPosts.filter(
          (p) =>
            (p.scheduled_at || p.updated_at || "").slice(0, 10) <= dateStr,
        ).length;
        const postsCount =
          offset === 0
            ? accountPosts.length
            : Math.max(
                postsUpToDay,
                Math.min(
                  accountPosts.length,
                  Math.floor(((dayIndex + 1) * accountPosts.length) / 60),
                ),
              );
        const reach = Math.max(
          40,
          Math.round(followers * 0.34) +
            postsCount * 68 +
            ((seed + dayIndex * 29) % 55),
        );
        const engagement = Math.max(
          6,
          Math.round(reach * 0.085) +
            postsCount * 9 +
            ((seed + dayIndex * 7) % 14),
        );
        const row: MetricSnapshot = {
          id: crypto.randomUUID(),
          account_id: acc.id,
          snapshot_date: dateStr,
          followers,
          following,
          posts_count: postsCount,
          reach,
          engagement,
          recorded_at: at,
        };
        w.metricSnapshots.push(row);
      }
      changed = true;
    } else {
      const todaySnap = w.metricSnapshots.find(
        (s) => s.account_id === acc.id && s.snapshot_date === today,
      );
      if (todaySnap && todaySnap.posts_count !== accountPosts.length) {
        todaySnap.posts_count = accountPosts.length;
        todaySnap.recorded_at = at;
        changed = true;
      }
    }
    if (!w.demographicSnapshots.some((d) => d.account_id === acc.id)) {
      const accSnaps = w.metricSnapshots.filter((s) => s.account_id === acc.id);
      const latestFollowers = accSnaps.length
        ? accSnaps[accSnaps.length - 1].followers
        : 350;
      const { countries, cities } = buildDemographicsForAccount(
        acc,
        latestFollowers,
        timezone,
      );
      const demoRow: DemographicSnapshot = {
        id: crypto.randomUUID(),
        account_id: acc.id,
        countries,
        cities,
        recorded_at: at,
      };
      w.demographicSnapshots.push(demoRow);
      changed = true;

      if (!w.competitors.some((c) => c.platform === acc.platform)) {
        const seed = hashSeed(`${acc.id}:${acc.platform}:${acc.name}`);
        const baseName = acc.name.split(" ")[0] || "Brand";
        const seeds = [
          {
            name: `${baseName} Industry Peer`,
            handle: `@${baseName.toLowerCase().replace(/[^a-z0-9]/g, "")}_peer`,
            followers: Math.round(latestFollowers * 1.18) + (seed % 140),
            posts_count: Math.max(6, (seed % 28) + 8),
          },
          {
            name: `${baseName} Regional Benchmark`,
            handle: `@${baseName.toLowerCase().replace(/[^a-z0-9]/g, "")}_global`,
            followers: Math.max(
              95,
              Math.round(latestFollowers * 0.84) + ((seed >> 3) % 90),
            ),
            posts_count: Math.max(4, ((seed >> 4) % 22) + 5),
          },
        ];
        for (const item of seeds) {
          const eng = Math.max(
            12,
            Math.round(item.followers * 0.042 + item.posts_count * 7),
          );
          const compRow: Competitor = {
            id: crypto.randomUUID(),
            platform: acc.platform,
            name: item.name,
            handle: item.handle,
            followers: item.followers,
            posts_count: item.posts_count,
            engagement: eng,
            updated_at: at,
          };
          w.competitors.push(compRow);
        }
      }
    }
  }

  for (const p of w.posts) {
    if (!w.postMetrics.some((m) => m.post_id === p.id)) {
      const seed = hashSeed(`${p.id}:${p.title}:${p.payload.text || ""}`);
      const destCount = Math.max(1, (p.payload.accountIds || []).length);
      const mediaBoost = p.payload.mediaUrl
        ? p.payload.mediaKind === "video"
          ? 210
          : 130
        : 60;
      const statusFactor = p.status === "draft" ? 0.55 : 1;
      const reach = Math.max(
        35,
        Math.round(
          (160 +
            (seed % 480) +
            mediaBoost +
            (p.payload.text || "").length * 2) *
            destCount *
            statusFactor,
        ),
      );
      const likes = Math.max(
        4,
        Math.round(reach * (0.065 + (seed % 30) / 1000)),
      );
      const comments = Math.max(
        1,
        Math.round(likes * (0.14 + ((seed >> 4) % 10) / 100)),
      );
      const shares = Math.max(
        1,
        Math.round(likes * (0.09 + ((seed >> 7) % 8) / 100)),
      );
      const row: PostMetric = {
        post_id: p.id,
        reach,
        likes,
        comments,
        shares,
        updated_at: at,
      };
      w.postMetrics.push(row);
      changed = true;
    }
  }

  const contactsPool = [
    { name: "Zara Tariq", handle: "@zaratariq.studio", initials: "ZT" },
    { name: "Omar Farooq", handle: "@omarfarooq_pk", initials: "OF" },
    { name: "Elena Rostova", handle: "@elena.rostova", initials: "ER" },
    { name: "Tariq Mehmood", handle: "@tariq.mehmood", initials: "TM" },
    { name: "Nadia Siddiqui", handle: "@nadiasiddiqui", initials: "NS" },
    { name: "Liam Vance", handle: "@liamvance.co", initials: "LV" },
  ];
  const baseMs = Date.now();
  for (let accIdx = 0; accIdx < socialAccounts.length; accIdx++) {
    const acc = socialAccounts[accIdx];
    if (!w.conversations.some((c) => c.account_id === acc.id)) {
      const accountPosts = w.posts.filter((p) =>
        (p.payload.accountIds || []).includes(acc.id),
      );
      const seed = hashSeed(`${acc.id}:${acc.platform}:${acc.name}`);
      const c1 = contactsPool[seed % contactsPool.length];
      const c2 = contactsPool[(seed + 2) % contactsPool.length];
      const topic = accountPosts[0]?.title || `${acc.name} campaign`;

      const conv1Id = crypto.randomUUID();
      const t1a = new Date(
        baseMs - (3 * 3600000 + accIdx * 900000),
      ).toISOString();
      const t1b = new Date(
        baseMs - (42 * 60000 + accIdx * 600000),
      ).toISOString();
      const conv1: InboxConversation = {
        id: conv1Id,
        account_id: acc.id,
        platform: acc.platform,
        participant_name: c1.name,
        participant_handle: c1.handle,
        participant_initials: c1.initials,
        kind: "message",
        status: "unresolved",
        unread: true,
        last_message_at: t1b,
        messages: [
          {
            id: crypto.randomUUID(),
            conversation_id: conv1Id,
            sender_name: c1.name,
            sender_handle: c1.handle,
            direction: "inbound",
            delivery_source: "network",
            body: `Hi ${acc.name} team — we saw your recent update on "${topic}". Could you share availability and details for a collaboration this month?`,
            created_at: t1a,
          },
          {
            id: crypto.randomUUID(),
            conversation_id: conv1Id,
            sender_name: c1.name,
            sender_handle: c1.handle,
            direction: "inbound",
            delivery_source: "network",
            body: `Following up here on ${acc.platform} in case your team is reviewing messages today.`,
            created_at: t1b,
          },
        ],
      };

      const conv2Id = crypto.randomUUID();
      const t2a = new Date(
        baseMs - (20 * 3600000 + accIdx * 1200000),
      ).toISOString();
      const t2b = new Date(
        baseMs - (14 * 3600000 + accIdx * 1200000),
      ).toISOString();
      const conv2: InboxConversation = {
        id: conv2Id,
        account_id: acc.id,
        platform: acc.platform,
        participant_name: c2.name,
        participant_handle: c2.handle,
        participant_initials: c2.initials,
        kind: "comment",
        status: seed % 2 === 0 ? "unresolved" : "resolved",
        unread: seed % 2 === 0,
        last_message_at: t2b,
        messages: [
          {
            id: crypto.randomUUID(),
            conversation_id: conv2Id,
            sender_name: c2.name,
            sender_handle: c2.handle,
            direction: "inbound",
            delivery_source: "network",
            body: `Commented on ${topic}: The pacing and visuals on this ${acc.platform} post are spot on. When does part two go live?`,
            created_at: t2a,
          },
          {
            id: crypto.randomUUID(),
            conversation_id: conv2Id,
            sender_name: acc.name,
            sender_handle: acc.handle || `@${acc.platform}`,
            direction: "outbound",
            delivery_source: "local",
            body: `Thanks ${c2.name.split(" ")[0]}! We have the next part scheduled in our content calendar for next week.`,
            created_at: t2b,
          },
        ],
      };
      w.conversations.push(conv1, conv2);
      changed = true;
    }
  }
  w.conversations.sort((a, b) =>
    b.last_message_at.localeCompare(a.last_message_at),
  );

  if (w.reportTemplates.length === 0) {
    const allPlatforms = Array.from(
      new Set(socialAccounts.map((a) => a.platform)),
    );
    w.reportTemplates.push(
      {
        id: crypto.randomUUID(),
        name: "Executive Monthly Review",
        period_days: 30,
        platforms: allPlatforms,
        include_summary: true,
        include_network_overview: true,
        include_top_posts: true,
        created_at: at,
        updated_at: at,
      },
      {
        id: crypto.randomUUID(),
        name: "Weekly Performance Brief",
        period_days: 7,
        platforms: allPlatforms,
        include_summary: true,
        include_network_overview: false,
        include_top_posts: true,
        created_at: at,
        updated_at: at,
      },
    );
    changed = true;
  }

  if (w.trackedHashtags.length === 0 && socialAccounts.length > 0) {
    const platformsSeen = new Set<string>();
    for (const acc of socialAccounts) {
      if (!platformsSeen.has(acc.platform)) {
        platformsSeen.add(acc.platform);
        const seed = hashSeed(`${acc.id}:${acc.platform}:hashtags`);
        w.trackedHashtags.push(
          {
            id: crypto.randomUUID(),
            platform: acc.platform,
            tag: "#mettglobal",
            posts_count: 14 + (seed % 18),
            reach: 1200 + (seed % 1500),
            interactions: 160 + (seed % 220),
            recorded_at: at,
          },
          {
            id: crypto.randomUUID(),
            platform: acc.platform,
            tag: "#socialstrategy",
            posts_count: 8 + ((seed >> 2) % 12),
            reach: 840 + ((seed >> 2) % 900),
            interactions: 95 + ((seed >> 2) % 140),
            recorded_at: at,
          },
        );
        changed = true;
      }
    }
  }

  if (!w.smartlink) {
    const at = new Date().toISOString();
    w.smartlink = {
      id: crypto.randomUUID(),
      company_id: "preview-company",
      slug: "mett-global",
      title: "Mett Global",
      description: "Pioneering private workspace & enterprise social intelligence.",
      avatar_url: "",
      theme: "brand",
      visits: 1420,
      items: [
        {
          id: crypto.randomUUID(),
          smartlink_id: "preview-smartlink",
          label: "Official Website",
          url: "https://mettglobal.com",
          color: "#e0bc68",
          image_url: "",
          position: 0,
          clicks: 482,
          created_at: at,
          updated_at: at,
        },
        {
          id: crypto.randomUUID(),
          smartlink_id: "preview-smartlink",
          label: "Client Case Studies",
          url: "https://mettglobal.com/case-studies",
          color: "#18181b",
          image_url: "",
          position: 1,
          clicks: 310,
          created_at: at,
          updated_at: at,
        },
        {
          id: crypto.randomUUID(),
          smartlink_id: "preview-smartlink",
          label: "Schedule Executive Briefing",
          url: "https://cal.com/mettglobal",
          color: "#c49a37",
          image_url: "",
          position: 2,
          clicks: 295,
          created_at: at,
          updated_at: at,
        },
        {
          id: crypto.randomUUID(),
          smartlink_id: "preview-smartlink",
          label: "Read Our Latest Insights",
          url: "https://mettglobal.com/insights",
          color: "#475569",
          image_url: "",
          position: 3,
          clicks: 184,
          created_at: at,
          updated_at: at,
        },
      ],
      created_at: at,
      updated_at: at,
    };
    changed = true;
  }

  if (!w.adConnections || Object.keys(w.adConnections).length === 0) {
    const at = new Date().toISOString();
    w.adConnections = {
      meta: {
        platform: "meta",
        connected: true,
        account_name: "Mett Global Brand (Meta Ads)",
        account_id: "act_48104819",
        currency: "USD",
        updated_at: at,
      },
      google: {
        platform: "google",
        connected: true,
        account_name: "Mett Global Search (Google Ads)",
        account_id: "482-194-8291",
        currency: "USD",
        updated_at: at,
      },
      tiktok: {
        platform: "tiktok",
        connected: false,
        account_name: "Mett Global TikTok Ads",
        account_id: "adv_91038472",
        currency: "USD",
        updated_at: at,
      },
    };
    changed = true;
  }

  if (!Array.isArray(w.adCampaigns) || w.adCampaigns.length === 0) {
    const at = new Date().toISOString();
    w.adCampaigns = [
      {
        id: crypto.randomUUID(),
        company_id: "preview-company",
        name: "Meta — Q4 Executive Brand Reach",
        platform: "meta",
        status: "active",
        spend: 450.0,
        impressions: 84200,
        clicks: 1820,
        ctr: 2.16,
        results: 310,
        objective: "Brand Awareness",
        created_at: at,
        updated_at: at,
      },
      {
        id: crypto.randomUUID(),
        company_id: "preview-company",
        name: "Google — High Intent Enterprise Search",
        platform: "google",
        status: "active",
        spend: 680.0,
        impressions: 42100,
        clicks: 2450,
        ctr: 5.82,
        results: 420,
        objective: "Search Leads",
        created_at: at,
        updated_at: at,
      },
      {
        id: crypto.randomUUID(),
        company_id: "preview-company",
        name: "TikTok — Summer Growth Showcase",
        platform: "tiktok",
        status: "paused",
        spend: 320.0,
        impressions: 96400,
        clicks: 1290,
        ctr: 1.34,
        results: 185,
        objective: "Video Views",
        created_at: at,
        updated_at: at,
      },
      {
        id: crypto.randomUUID(),
        company_id: "preview-company",
        name: "Meta — Retargeting & Conversions",
        platform: "meta",
        status: "active",
        spend: 290.0,
        impressions: 28600,
        clicks: 980,
        ctr: 3.43,
        results: 142,
        objective: "Conversions",
        created_at: at,
        updated_at: at,
      },
      {
        id: crypto.randomUUID(),
        company_id: "preview-company",
        name: "Google — Performance Max Discovery",
        platform: "google",
        status: "active",
        spend: 510.0,
        impressions: 63500,
        clicks: 1910,
        ctr: 3.01,
        results: 260,
        objective: "Conversions",
        created_at: at,
        updated_at: at,
      },
      {
        id: crypto.randomUUID(),
        company_id: "preview-company",
        name: "TikTok — Innovation Tech Teaser",
        platform: "tiktok",
        status: "completed",
        spend: 195.0,
        impressions: 48000,
        clicks: 890,
        ctr: 1.85,
        results: 98,
        objective: "Traffic",
        created_at: at,
        updated_at: at,
      },
    ];
    changed = true;
  }

  return changed;
}
function read(): PreviewState {
  const value = localStorage.getItem(key);
  if (value) {
    const parsed = JSON.parse(value) as PreviewState;
    for (const w of Object.values(parsed.workspaces || {})) {
      if (!Array.isArray(w.autolists)) w.autolists = [];
      if (!Array.isArray(w.metricSnapshots)) w.metricSnapshots = [];
      if (!Array.isArray(w.postMetrics)) w.postMetrics = [];
      if (!Array.isArray(w.demographicSnapshots)) w.demographicSnapshots = [];
      if (!Array.isArray(w.competitors)) w.competitors = [];
      if (!Array.isArray(w.conversations)) w.conversations = [];
      if (!Array.isArray(w.reportTemplates)) w.reportTemplates = [];
      if (!Array.isArray(w.trackedHashtags)) w.trackedHashtags = [];
      if (!Array.isArray(w.adCampaigns)) w.adCampaigns = [];
      if (!w.adConnections || typeof w.adConnections !== "object") w.adConnections = {};
    }
    return parsed;
  }
  const company = {
    id: crypto.randomUUID(),
    name: "Mett Global",
    initials: "MG",
    accent: "#e0bc68",
    timezone: "Asia/Karachi",
  };
  return { companies: [company], workspaces: { [company.id]: workspace() } };
}
function write(state: PreviewState) {
  try {
    localStorage.setItem(key, JSON.stringify(state));
  } catch {
    throw new Error(
      "Browser storage is unavailable or full. Nothing was saved.",
    );
  }
}
function url(value: string, drive = false) {
  if (!value) return;
  const u = new URL(value);
  if (
    u.protocol !== "https:" ||
    u.username ||
    u.password ||
    (drive && !["drive.google.com", "docs.google.com"].includes(u.hostname))
  )
    throw new Error("Use a valid HTTPS Google Drive sharing URL.");
}
export async function previewApi<T>(
  path: string,
  method: string,
  body?: unknown,
): Promise<T> {
  const state = read();
  const d = body as any;
  const reply = (value: unknown): T => structuredClone(value) as T;
  const save = (value: unknown) => {
    write(state);
    return reply(value);
  };
  if (path === "/auth")
    return save({ user: { username: "Preview" }, needsSetup: false });
  if (path === "/integrations")
    return reply(
      Object.fromEntries(
        ["google", "meta", "pinterest", "tiktok"].map((p) => [
          p,
          {
            configured: false,
            missing: [
              "Live connections are disabled in this browser-only preview",
            ],
            callbackUrl: "Activate a server-backed deployment first.",
          },
        ]),
      ),
    );
  if (path === "/companies" && method === "GET") return reply(state.companies);
  if (path === "/companies" && method === "POST") {
    const c = { id: crypto.randomUUID(), ...d };
    state.companies.push(c);
    state.workspaces[c.id] = workspace();
    return save(c);
  }
  if (path.startsWith("/public/smartlinks/")) {
    const sub = path.replace("/public/smartlinks/", "");
    const parts = sub.split("/");
    const slug = parts[0].toLowerCase();
    let foundWs: Workspace | null = null;
    for (const c of state.companies) {
      const ws = state.workspaces[c.id];
      if (ws) {
        ensurePreviewMetrics(ws, c.timezone);
        if (ws.smartlink && ws.smartlink.slug.toLowerCase() === slug) {
          foundWs = ws;
          break;
        }
      }
    }
    if (!foundWs || !foundWs.smartlink) throw new Error("SmartLink not found.");

    if (parts.length === 1 && method === "GET") {
      return reply({ ok: true, smartlink: foundWs.smartlink });
    }
    if (parts.length === 2 && parts[1] === "visit" && method === "POST") {
      foundWs.smartlink.visits = (foundWs.smartlink.visits || 0) + 1;
      foundWs.smartlink.updated_at = new Date().toISOString();
      return save({ ok: true, visits: foundWs.smartlink.visits });
    }
    if (parts.length === 3 && parts[1] === "clicks" && method === "POST") {
      const itemId = parts[2];
      const item = foundWs.smartlink.items.find((it) => it.id === itemId);
      if (!item) throw new Error("SmartLink item not found.");
      item.clicks = (item.clicks || 0) + 1;
      item.updated_at = new Date().toISOString();
      return save({ ok: true, clicks: item.clicks });
    }
  }
  const match = /^\/companies\/([^/]+)(?:\/(.*))?$/.exec(path);
  if (!match)
    throw new Error("This action is unavailable in the interface preview.");
  const company = state.companies.find((c) => c.id === match[1]);
  if (!company) throw new Error("Company not found.");
  const data = state.workspaces[company.id],
    route = match[2] || "";
  const log = (message: string) =>
    data.activities.unshift({
      id: crypto.randomUUID(),
      message,
      created_at: new Date().toISOString(),
    });
  if (!route && method === "PATCH") {
    Object.assign(company, d, { id: company.id });
    log("Company settings updated");
    return save(company);
  }
  if (route === "workspace") {
    if (ensurePreviewMetrics(data, company.timezone)) write(state);
    return reply(data);
  }
  if (route === "metrics/refresh" && method === "POST") {
    ensurePreviewMetrics(data, company.timezone);
    const today = dayKey(0);
    const at = new Date().toISOString();
    const socialAccounts = data.accounts.filter((a) => a.platform !== "drive");
    for (const acc of socialAccounts) {
      const snaps = (data.metricSnapshots || []).filter(
        (s) => s.account_id === acc.id,
      );
      const latest = snaps[snaps.length - 1];
      const accountPosts = data.posts.filter((p) =>
        (p.payload.accountIds || []).includes(acc.id),
      );
      const stepSeed = hashSeed(`${acc.id}:${at}:${accountPosts.length}`);
      const followers =
        (latest ? latest.followers : 220) +
        2 +
        (stepSeed % 7) +
        Math.min(accountPosts.length, 4);
      const following = (latest ? latest.following : 60) + (stepSeed % 2);
      const postsCount = accountPosts.length;
      const reach =
        (latest ? latest.reach : 140) +
        14 +
        (stepSeed % 29) +
        postsCount * 9;
      const engagement =
        (latest ? latest.engagement : 18) +
        2 +
        (stepSeed % 8) +
        postsCount * 2;
      const existingToday = snaps.find((s) => s.snapshot_date === today);
      if (existingToday) {
        existingToday.followers = followers;
        existingToday.following = following;
        existingToday.posts_count = postsCount;
        existingToday.reach = reach;
        existingToday.engagement = engagement;
        existingToday.recorded_at = at;
      } else {
        data.metricSnapshots!.push({
          id: crypto.randomUUID(),
          account_id: acc.id,
          snapshot_date: today,
          followers,
          following,
          posts_count: postsCount,
          reach,
          engagement,
          recorded_at: at,
        });
      }
      const existingDemo = (data.demographicSnapshots || []).find(
        (dm) => dm.account_id === acc.id,
      );
      const { countries, cities } = buildDemographicsForAccount(
        acc,
        followers,
        company.timezone,
      );
      if (existingDemo) {
        existingDemo.countries = countries;
        existingDemo.cities = cities;
        existingDemo.recorded_at = at;
      }
    }
    for (const p of data.posts) {
      const existingMetric = (data.postMetrics || []).find(
        (m) => m.post_id === p.id,
      );
      const stepSeed = hashSeed(`${p.id}:${at}`);
      if (existingMetric) {
        existingMetric.reach += 9 + (stepSeed % 23);
        existingMetric.likes += 1 + (stepSeed % 5);
        existingMetric.comments += stepSeed % 2;
        existingMetric.shares += stepSeed % 3 === 0 ? 1 : 0;
        existingMetric.updated_at = at;
      }
    }
    log("Recorded fresh analytics snapshot");
    return save({
      metricSnapshots: data.metricSnapshots,
      postMetrics: data.postMetrics,
      demographicSnapshots: data.demographicSnapshots,
      competitors: data.competitors,
      refreshedAt: at,
    });
  }
  if (route === "competitors" && method === "POST") {
    data.competitors ||= [];
    const platform = String(d.platform || "instagram");
    const name = String(d.name || "").trim() || "Competitor";
    const handle =
      String(d.handle || "").trim() ||
      `@${name.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
    const seed = hashSeed(`${platform}:${name}:${handle}`);
    const followers =
      Number(d.followers) > 0 ? Number(d.followers) : 280 + (seed % 1400);
    const postsCount =
      d.posts_count !== undefined &&
      d.posts_count !== "" &&
      Number(d.posts_count) >= 0
        ? Number(d.posts_count)
        : 6 + (seed % 34);
    const engagement = Math.max(
      8,
      Math.round(followers * 0.045 + postsCount * 6),
    );
    const comp: Competitor = {
      id: crypto.randomUUID(),
      platform,
      name,
      handle,
      followers,
      posts_count: postsCount,
      engagement,
      updated_at: new Date().toISOString(),
    };
    data.competitors = [comp, ...data.competitors];
    log(`Added ${platform} competitor: ${name}`);
    return save(comp);
  }
  if (/^competitors\/[^/]+$/.test(route) && method === "DELETE") {
    const id = route.split("/")[1];
    const target = (data.competitors || []).find((c) => c.id === id);
    if (!target) throw new Error("Competitor not found.");
    data.competitors = (data.competitors || []).filter((c) => c.id !== id);
    log(`Removed competitor: ${target.name}`);
    return save({ ok: true });
  }
  if (/^inbox\/[^/]+\/replies$/.test(route) && method === "POST") {
    const id = route.split("/")[1];
    const conv = (data.conversations || []).find((c) => c.id === id);
    if (!conv) throw new Error("Conversation not found.");
    const bodyText = String(d?.body || "").trim();
    if (!bodyText) throw new Error("Reply cannot be empty.");
    const account = data.accounts.find((a) => a.id === conv.account_id);
    const at = new Date().toISOString();
    const msg: InboxMessage = {
      id: crypto.randomUUID(),
      conversation_id: conv.id,
      sender_name: account?.name || company.name,
      sender_handle: account?.handle || `@${conv.platform}`,
      direction: "outbound",
      delivery_source: "local",
      body: bodyText,
      created_at: at,
    };
    conv.messages.push(msg);
    conv.last_message_at = at;
    conv.unread = false;
    data.conversations!.sort((a, b) =>
      b.last_message_at.localeCompare(a.last_message_at),
    );
    log(`Saved local reply to ${conv.participant_name} (${conv.platform})`);
    return save(msg);
  }
  if (/^inbox\/[^/]+$/.test(route) && method === "PATCH") {
    const id = route.split("/")[1];
    const conv = (data.conversations || []).find((c) => c.id === id);
    if (!conv) throw new Error("Conversation not found.");
    if (d?.status === "resolved" || d?.status === "unresolved") {
      conv.status = d.status;
    }
    if (typeof d?.unread === "boolean") {
      conv.unread = d.unread;
    }
    const at = new Date().toISOString();
    log(
      `Updated inbox conversation (${conv.participant_name}): ${conv.status}, ${conv.unread ? "unread" : "read"}`,
    );
    return save({
      id: conv.id,
      status: conv.status,
      unread: conv.unread,
      updated_at: at,
    });
  }
  if (route === "reports/templates" && method === "POST") {
    data.reportTemplates ||= [];
    const name = String(d?.name || "").trim() || "Untitled template";
    const period_days = Number(d?.period_days) || 30;
    const platforms = Array.isArray(d?.platforms) ? d.platforms : [];
    const include_summary = d?.include_summary !== false;
    const include_network_overview = d?.include_network_overview !== false;
    const include_top_posts = d?.include_top_posts !== false;
    const at = new Date().toISOString();
    const t: ReportTemplate = {
      id: crypto.randomUUID(),
      name,
      period_days,
      platforms,
      include_summary,
      include_network_overview,
      include_top_posts,
      created_at: at,
      updated_at: at,
    };
    data.reportTemplates.push(t);
    log(`Saved report template: ${t.name}`);
    return save(t);
  }
  if (/^reports\/templates\/[^/]+$/.test(route) && method === "DELETE") {
    const id = route.split("/")[1];
    const target = (data.reportTemplates || []).find((t) => t.id === id);
    if (!target) throw new Error("Report template not found.");
    data.reportTemplates = (data.reportTemplates || []).filter((t) => t.id !== id);
    log(`Removed report template: ${target.name}`);
    return save({ ok: true });
  }
  if (route === "hashtags" && method === "POST") {
    data.trackedHashtags ||= [];
    const platform = String(d?.platform || "instagram");
    const rawTag = String(d?.tag || "").trim();
    if (!rawTag) throw new Error("Hashtag is required.");
    const tag = rawTag.startsWith("#") ? rawTag : `#${rawTag}`;
    const seed = hashSeed(`${platform}:${tag}`);
    const posts_count =
      d?.posts_count !== undefined && d?.posts_count !== ""
        ? Number(d.posts_count)
        : 10 + (seed % 20);
    const reach =
      d?.reach !== undefined && d?.reach !== ""
        ? Number(d.reach)
        : 900 + (seed % 1400);
    const interactions =
      d?.interactions !== undefined && d?.interactions !== ""
        ? Number(d.interactions)
        : 110 + (seed % 180);
    const at = new Date().toISOString();

    let item = data.trackedHashtags.find(
      (h) => h.platform === platform && h.tag.toLowerCase() === tag.toLowerCase(),
    );
    if (item) {
      item.posts_count = posts_count;
      item.reach = reach;
      item.interactions = interactions;
      item.recorded_at = at;
    } else {
      item = {
        id: crypto.randomUUID(),
        platform,
        tag,
        posts_count,
        reach,
        interactions,
        recorded_at: at,
      };
      data.trackedHashtags.push(item);
    }
    log(`Tracked hashtag on ${platform}: ${tag}`);
    return save(item);
  }
  if (/^hashtags\/[^/]+$/.test(route) && method === "DELETE") {
    const id = route.split("/")[1];
    const target = (data.trackedHashtags || []).find((h) => h.id === id);
    if (!target) throw new Error("Tracked hashtag not found.");
    data.trackedHashtags = (data.trackedHashtags || []).filter((h) => h.id !== id);
    log(`Removed tracked hashtag: ${target.tag}`);
    return save({ ok: true });
  }
  if (/^hashtags\/[^/]+\/snapshot$/.test(route) && method === "POST") {
    const id = route.split("/")[1];
    const target = (data.trackedHashtags || []).find((h) => h.id === id);
    if (!target) throw new Error("Tracked hashtag not found.");
    const seed = hashSeed(`${target.id}:${Date.now()}`);
    target.posts_count += 1 + (seed % 3);
    target.reach += 45 + (seed % 95);
    target.interactions += 5 + (seed % 14);
    target.recorded_at = new Date().toISOString();
    log(`Recorded manual snapshot for ${target.tag} (${target.platform})`);
    return save(target);
  }
  if (route === "youtube/jobs") return reply([]);
  if (route === "smartlink" && method === "GET") {
    ensurePreviewMetrics(data, company.timezone);
    return reply(data.smartlink);
  }
  if (route === "smartlink" && method === "PUT") {
    ensurePreviewMetrics(data, company.timezone);
    if (!data.smartlink) throw new Error("SmartLink not found.");
    if (d.slug && d.slug.toLowerCase() !== data.smartlink.slug.toLowerCase()) {
      for (const otherC of state.companies) {
        if (otherC.id !== company.id) {
          const otherWs = state.workspaces[otherC.id];
          if (otherWs?.smartlink?.slug.toLowerCase() === d.slug.toLowerCase()) {
            throw new Error("This URL slug is already taken by another brand.");
          }
        }
      }
    }
    data.smartlink = {
      ...data.smartlink,
      title: d.title ?? data.smartlink.title,
      slug: (d.slug ?? data.smartlink.slug).toLowerCase(),
      description: d.description ?? data.smartlink.description,
      avatar_url:
        d.avatar_url !== undefined
          ? d.avatar_url
          : data.smartlink.avatar_url,
      theme: d.theme ?? data.smartlink.theme,
      updated_at: new Date().toISOString(),
    };
    log(`Updated SmartLink microsite settings (/s/${data.smartlink.slug})`);
    return save(data.smartlink);
  }
  if (route === "smartlink/items" && method === "POST") {
    ensurePreviewMetrics(data, company.timezone);
    if (!data.smartlink) throw new Error("SmartLink not found.");
    const maxPos = data.smartlink.items.reduce(
      (max, it) => Math.max(max, it.position),
      -1,
    );
    const at = new Date().toISOString();
    const cleanUrl = String(d?.url || "").startsWith("http")
      ? String(d?.url)
      : `https://${d?.url}`;
    const newItem: SmartLinkItem = {
      id: crypto.randomUUID(),
      smartlink_id: data.smartlink.id,
      label: String(d?.label || "Link"),
      url: cleanUrl,
      color: d?.color || "#e0bc68",
      image_url: d?.image_url || "",
      position: d?.position !== undefined ? Number(d.position) : maxPos + 1,
      clicks: 0,
      created_at: at,
      updated_at: at,
    };
    data.smartlink.items.push(newItem);
    log(`Added SmartLink button: ${newItem.label}`);
    return save(newItem);
  }
  if (/^smartlink\/items\/[^/]+$/.test(route) && method === "PUT") {
    const itemId = route.split("/")[2];
    ensurePreviewMetrics(data, company.timezone);
    const item = data.smartlink?.items.find((it) => it.id === itemId);
    if (!item) throw new Error("SmartLink item not found.");
    if (d.label) item.label = String(d.label);
    if (d.url)
      item.url = String(d.url).startsWith("http")
        ? String(d.url)
        : `https://${d.url}`;
    if (d.color) item.color = d.color;
    if (d.image_url !== undefined) item.image_url = d.image_url;
    if (d.position !== undefined) item.position = Number(d.position);
    item.updated_at = new Date().toISOString();
    log(`Updated SmartLink button: ${item.label}`);
    return save(item);
  }
  if (/^smartlink\/items\/[^/]+$/.test(route) && method === "DELETE") {
    const itemId = route.split("/")[2];
    ensurePreviewMetrics(data, company.timezone);
    const item = data.smartlink?.items.find((it) => it.id === itemId);
    if (!item) throw new Error("SmartLink item not found.");
    data.smartlink!.items = data.smartlink!.items.filter((it) => it.id !== itemId);
    log(`Removed SmartLink button: ${item.label}`);
    return save({ ok: true });
  }
  if (route === "smartlink/reorder" && method === "PUT") {
    ensurePreviewMetrics(data, company.timezone);
    const itemIds: string[] = Array.isArray(d.itemIds) ? d.itemIds : [];
    const at = new Date().toISOString();
    if (data.smartlink) {
      for (let i = 0; i < itemIds.length; i++) {
        const item = data.smartlink.items.find((it) => it.id === itemIds[i]);
        if (item) {
          item.position = i;
          item.updated_at = at;
        }
      }
      data.smartlink.items.sort((a, b) => a.position - b.position);
    }
    return save({ ok: true });
  }
  if (route === "ads/campaigns" && method === "GET") {
    ensurePreviewMetrics(data, company.timezone);
    return reply(data.adCampaigns || []);
  }
  if (route === "ads/campaigns" && method === "POST") {
    ensurePreviewMetrics(data, company.timezone);
    const at = new Date().toISOString();
    const impressions = Number(d.impressions) || 0;
    const clicks = Number(d.clicks) || 0;
    const ctr =
      impressions > 0
        ? Number(((clicks / impressions) * 100).toFixed(2))
        : 0;
    const camp: AdCampaign = {
      id: crypto.randomUUID(),
      company_id: company.id,
      name: String(d.name || "").trim() || "Untitled Campaign",
      platform: (d.platform as any) || "meta",
      status: (d.status as any) || "active",
      spend: Number(d.spend) || 0,
      impressions,
      clicks,
      ctr,
      results: Number(d.results) || 0,
      objective: d.objective ? String(d.objective) : undefined,
      created_at: at,
      updated_at: at,
    };
    data.adCampaigns = [camp, ...(data.adCampaigns || [])];
    log(`Created ad campaign: ${camp.name} (${camp.platform})`);
    return save(camp);
  }
  if (/^ads\/campaigns\/[^/]+$/.test(route) && method === "PUT") {
    ensurePreviewMetrics(data, company.timezone);
    const id = route.split("/")[2];
    const existing = (data.adCampaigns || []).find((c) => c.id === id);
    if (!existing) throw new Error("Ad campaign not found.");
    const at = new Date().toISOString();
    const impressions =
      d.impressions !== undefined ? Number(d.impressions) : existing.impressions;
    const clicks =
      d.clicks !== undefined ? Number(d.clicks) : existing.clicks;
    const ctr =
      impressions > 0
        ? Number(((clicks / impressions) * 100).toFixed(2))
        : 0;
    const updated: AdCampaign = {
      ...existing,
      name: d.name !== undefined ? String(d.name).trim() : existing.name,
      platform: d.platform !== undefined ? (d.platform as any) : existing.platform,
      status: d.status !== undefined ? (d.status as any) : existing.status,
      spend: d.spend !== undefined ? Number(d.spend) : existing.spend,
      impressions,
      clicks,
      ctr,
      results: d.results !== undefined ? Number(d.results) : existing.results,
      objective: d.objective !== undefined ? (d.objective ? String(d.objective) : undefined) : existing.objective,
      updated_at: at,
    };
    data.adCampaigns = (data.adCampaigns || []).map((c) =>
      c.id === id ? updated : c,
    );
    log(`Updated ad campaign: ${updated.name}`);
    return save(updated);
  }
  if (/^ads\/campaigns\/[^/]+$/.test(route) && method === "DELETE") {
    ensurePreviewMetrics(data, company.timezone);
    const id = route.split("/")[2];
    const existing = (data.adCampaigns || []).find((c) => c.id === id);
    if (!existing) throw new Error("Ad campaign not found.");
    data.adCampaigns = (data.adCampaigns || []).filter((c) => c.id !== id);
    log(`Deleted ad campaign: ${existing.name}`);
    return save({ ok: true });
  }
  if (/^ads\/connections\/[^/]+\/toggle$/.test(route) && method === "POST") {
    ensurePreviewMetrics(data, company.timezone);
    const platform = route.split("/")[2] as "meta" | "google" | "tiktok";
    if (!["meta", "google", "tiktok"].includes(platform)) {
      throw new Error("Invalid ad platform.");
    }
    const at = new Date().toISOString();
    data.adConnections ||= {};
    const existing = data.adConnections[platform];
    const names: Record<string, string> = {
      meta: "Mett Global Brand (Meta Ads)",
      google: "Mett Global Search (Google Ads)",
      tiktok: "Mett Global TikTok Ads",
    };
    const ids: Record<string, string> = {
      meta: "act_48104819",
      google: "482-194-8291",
      tiktok: "adv_91038472",
    };
    const updated: AdAccountConnection = {
      platform,
      connected: existing ? !existing.connected : true,
      account_name: existing?.account_name || names[platform],
      account_id: existing?.account_id || ids[platform],
      currency: "USD",
      updated_at: at,
    };
    data.adConnections[platform] = updated;
    log(`${updated.connected ? "Connected" : "Disconnected"} ${platform} ad account`);
    return save(updated);
  }
  if (route === "accounts" && method === "POST") {
    const a = { id: crypto.randomUUID(), ...d, status: "disconnected" };
    data.accounts.push(a);
    ensurePreviewMetrics(data, company.timezone);
    log("Added account record: " + a.name);
    return save(a);
  }
  if (route.startsWith("accounts/") && method === "DELETE") {
    const id = route.split("/")[1];
    if (data.posts.some((p) => p.payload.accountIds.includes(id)))
      throw new Error("Remove this account from its posts before deleting it.");
    if (!data.accounts.some((a) => a.id === id))
      throw new Error("Account not found.");
    data.accounts = data.accounts.filter((a) => a.id !== id);
    data.metricSnapshots = (data.metricSnapshots || []).filter(
      (s) => s.account_id !== id,
    );
    data.demographicSnapshots = (data.demographicSnapshots || []).filter(
      (dm) => dm.account_id !== id,
    );
    data.conversations = (data.conversations || []).filter(
      (c) => c.account_id !== id,
    );
    return save({ ok: true });
  }
  if (route === "media" && method === "POST") {
    url(d.url, true);
    const m = { id: crypto.randomUUID(), ...d };
    data.media.unshift(m);
    log("Saved Drive reference: " + m.name);
    return save(m);
  }
  if (route.startsWith("media/") && method === "DELETE") {
    const id = route.split("/")[1];
    data.media = data.media.filter((m) => m.id !== id);
    return save({ ok: true });
  }
  if (
    (route === "posts" && method === "POST") ||
    (/^posts\/[^/]+$/.test(route) && method === "PUT")
  ) {
    const payload = structuredClone(d) as Payload;
    url(payload.mediaUrl);
    Object.values(payload.overrides).forEach((v) => {
      url(v.coverUrl);
      url(v.link);
    });
    if (
      payload.accountIds.some((id) => !data.accounts.some((a) => a.id === id))
    )
      throw new Error("Destinations must belong to this company.");
    if (
      payload.intent === "queue" &&
      (!payload.accountIds.length ||
        !payload.scheduledAt ||
        Date.parse(payload.scheduledAt) <= Date.now())
    )
      throw new Error("Choose destinations and a future publishing time.");
    const id = route === "posts" ? crypto.randomUUID() : route.split("/")[1];
    if (method === "PUT" && !data.posts.some((p) => p.id === id))
      throw new Error("Post not found.");
    const post: Post = {
      id,
      title: payload.title || "Untitled post",
      status: payload.intent === "queue" ? "blocked" : "draft",
      scheduled_at: payload.scheduledAt,
      updated_at: new Date().toISOString(),
      payload,
    };
    data.posts = [post, ...data.posts.filter((p) => p.id !== id)];
    ensurePreviewMetrics(data);
    log(
      (post.status === "draft"
        ? "Saved draft: "
        : "Saved preview queue item: ") + post.title,
    );
    return save(post);
  }
  if (/^posts\/[^/]+$/.test(route) && method === "DELETE") {
    const id = route.split("/")[1];
    if (!data.posts.some((p) => p.id === id))
      throw new Error("Post not found.");
    data.posts = data.posts.filter((p) => p.id !== id);
    data.postMetrics = (data.postMetrics || []).filter((m) => m.post_id !== id);
    ensurePreviewMetrics(data);
    return save({ ok: true });
  }
  data.autolists ||= [];
  if (route === "autolists" && method === "POST") {
    const at = new Date().toISOString();
    let items = Array.isArray(d.items) ? [...d.items] : [];
    let syncedAt = d.feed_synced_at || undefined;
    if (d.feed_url && d.feed_auto_queue !== false) {
      let host = "mettglobal.com";
      try {
        host = new URL(d.feed_url).hostname;
      } catch {}
      const prefix = d.feed_prefix ? d.feed_prefix.trim() + " " : "";
      const includeLink = d.feed_include_link !== false;
      const mockFeeds = [
        `Strategic Social Operations: Scaling Multi-Network Planning${includeLink ? " https://" + host + "/posts/strategic-ops" : ""}`,
        `The Metricool Parity Standard: Why Enterprise Workspaces Need Autolists${includeLink ? " https://" + host + "/insights/autolists" : ""}`,
        `Automated Content Ingestion: Integrating RSS with Cross-Channel Queues${includeLink ? " https://" + host + "/updates/rss-automation" : ""}`,
      ];
      for (const f of mockFeeds) {
        const formatted = `${prefix}${f}`.trim();
        if (!items.includes(formatted)) items.push(formatted);
      }
      syncedAt = at;
    }

    const autolist: Autolist = {
      id: crypto.randomUUID(),
      name: String(d.name || "").trim() || "Untitled autolist",
      platform: String(d.platform || "instagram"),
      items,
      slots: Array.isArray(d.slots) ? d.slots : [],
      is_circular: Boolean(d.is_circular),
      feed_url: d.feed_url ? String(d.feed_url) : undefined,
      feed_prefix: d.feed_prefix ? String(d.feed_prefix) : undefined,
      feed_include_link: d.feed_include_link !== false,
      feed_auto_queue: d.feed_auto_queue !== false,
      feed_synced_at: syncedAt,
      updated_at: at,
    };
    data.autolists = [autolist, ...data.autolists];
    log("Created autolist: " + autolist.name);
    return save(autolist);
  }
  if (/^autolists\/[^/]+$/.test(route) && method === "PUT") {
    const id = route.split("/")[1];
    const existing = data.autolists.find((a) => a.id === id);
    if (!existing)
      throw new Error("Autolist not found.");
    const at = new Date().toISOString();
    let items = Array.isArray(d.items) ? [...d.items] : existing.items;
    let syncedAt = existing.feed_synced_at;

    if (d.feed_url && d.feed_auto_queue !== false && d.feed_url !== existing.feed_url) {
      let host = "mettglobal.com";
      try {
        host = new URL(d.feed_url).hostname;
      } catch {}
      const prefix = d.feed_prefix ? d.feed_prefix.trim() + " " : "";
      const includeLink = d.feed_include_link !== false;
      const mockFeeds = [
        `Strategic Social Operations: Scaling Multi-Network Planning${includeLink ? " https://" + host + "/posts/strategic-ops" : ""}`,
        `The Metricool Parity Standard: Why Enterprise Workspaces Need Autolists${includeLink ? " https://" + host + "/insights/autolists" : ""}`,
      ];
      for (const f of mockFeeds) {
        const formatted = `${prefix}${f}`.trim();
        if (!items.includes(formatted)) items.push(formatted);
      }
      syncedAt = at;
    }

    const autolist: Autolist = {
      ...existing,
      id,
      name: String(d.name || "").trim() || existing.name,
      platform: String(d.platform || existing.platform),
      items,
      slots: Array.isArray(d.slots) ? d.slots : existing.slots,
      is_circular: d.is_circular !== undefined ? Boolean(d.is_circular) : existing.is_circular,
      feed_url: d.feed_url !== undefined ? (d.feed_url ? String(d.feed_url) : undefined) : existing.feed_url,
      feed_prefix: d.feed_prefix !== undefined ? (d.feed_prefix ? String(d.feed_prefix) : undefined) : existing.feed_prefix,
      feed_include_link: d.feed_include_link !== undefined ? Boolean(d.feed_include_link) : existing.feed_include_link,
      feed_auto_queue: d.feed_auto_queue !== undefined ? Boolean(d.feed_auto_queue) : existing.feed_auto_queue,
      feed_synced_at: syncedAt,
      updated_at: at,
    };
    data.autolists = [
      autolist,
      ...data.autolists.filter((a) => a.id !== id),
    ];
    log("Updated autolist: " + autolist.name);
    return save(autolist);
  }
  if (/^autolists\/[^/]+\/feed\/sync$/.test(route) && method === "POST") {
    const id = route.split("/")[1];
    const target = data.autolists.find((a) => a.id === id);
    if (!target) throw new Error("Autolist not found.");
    if (!target.feed_url) throw new Error("Configure an RSS feed URL first.");
    const at = new Date().toISOString();
    let host = "mettglobal.com";
    try {
      host = new URL(target.feed_url).hostname;
    } catch {}
    const prefix = target.feed_prefix ? target.feed_prefix.trim() + " " : "";
    const includeLink = target.feed_include_link !== false;
    const mockFeeds = [
      `Strategic Social Operations: Scaling Multi-Network Planning${includeLink ? " https://" + host + "/posts/strategic-ops" : ""}`,
      `The Metricool Parity Standard: Why Enterprise Workspaces Need Autolists${includeLink ? " https://" + host + "/insights/autolists" : ""}`,
      `Private Data Sovereignty in Modern Agency Social Scheduling${includeLink ? " https://" + host + "/articles/privacy" : ""}`,
      `Automated Content Ingestion: Integrating RSS with Cross-Channel Queues${includeLink ? " https://" + host + "/updates/rss-automation" : ""}`,
    ];
    const added: string[] = [];
    for (const f of mockFeeds) {
      const formatted = `${prefix}${f}`.trim();
      if (!target.items.includes(formatted)) {
        target.items.push(formatted);
        added.push(formatted);
      }
    }
    target.feed_synced_at = at;
    target.updated_at = at;
    log(`Synced RSS feed for ${target.name}: added ${added.length} items`);
    return save({ ok: true, added: added.length, items: target.items, feed_synced_at: at });
  }
  if (/^autolists\/[^/]+\/cycle$/.test(route) && method === "POST") {
    const id = route.split("/")[1];
    const target = data.autolists.find((a) => a.id === id);
    if (!target) throw new Error("Autolist not found.");
    if (!target.items.length) throw new Error("Autolist queue is empty.");
    const at = new Date().toISOString();
    const published = target.items[0];
    const isCircular = target.is_circular !== false;
    target.items = isCircular ? [...target.items.slice(1), published] : target.items.slice(1);
    target.updated_at = at;
    log(`Autolist ${target.name}: ${isCircular ? "recycled published item to queue end" : "published item and removed from queue"}`);
    return save({ ok: true, published, items: target.items, is_circular: isCircular, updated_at: at });
  }
  if (/^autolists\/[^/]+$/.test(route) && method === "DELETE") {
    const id = route.split("/")[1];
    const target = data.autolists.find((a) => a.id === id);
    if (!target) throw new Error("Autolist not found.");
    data.autolists = data.autolists.filter((a) => a.id !== id);
    log("Deleted autolist: " + target.name);
    return save({ ok: true });
  }
  throw new Error(
    "Live account connections and publishing are disabled in this browser-only preview.",
  );
}
