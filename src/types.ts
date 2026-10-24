export type Company = {
  id: string;
  name: string;
  initials: string;
  accent: string;
  timezone: string;
};
export type Account = {
  id: string;
  platform: string;
  name: string;
  handle: string;
  status: string;
};
export type Media = {
  id: string;
  name: string;
  url: string;
  kind: "video" | "image";
};
export type Variant = {
  text: string;
  title: string;
  tags: string;
  format: string;
  coverMode: "default" | "image" | "frame";
  coverUrl: string;
  frameSeconds: number;
  board: string;
  link: string;
  privacy: string;
  audience: string;
  allowComments: boolean;
  allowDuet: boolean;
  allowStitch: boolean;
  showInFeed: boolean;
  notifySubscribers: boolean;
  aiDisclosure: boolean;
};
export type Payload = {
  title: string;
  text: string;
  mediaUrl: string;
  mediaName: string;
  mediaKind: "video" | "image";
  accountIds: string[];
  overrides: Record<string, Variant>;
  scheduledAt: string | null;
  timezone: string;
  intent: "draft" | "queue";
};
export type Post = {
  id: string;
  title: string;
  status: string;
  scheduled_at: string | null;
  updated_at: string;
  payload: Payload;
};
export type AutolistSlot = {
  day: number;
  time: string;
};
export type Autolist = {
  id: string;
  name: string;
  platform: string;
  items: string[];
  slots: AutolistSlot[];
  is_circular?: boolean;
  feed_url?: string;
  feed_prefix?: string;
  feed_include_link?: boolean;
  feed_auto_queue?: boolean;
  feed_synced_at?: string;
  updated_at?: string;
};
export type MetricSnapshot = {
  id: string;
  account_id: string;
  snapshot_date: string;
  followers: number;
  following: number;
  posts_count: number;
  reach: number;
  engagement: number;
  recorded_at: string;
};
export type PostMetric = {
  post_id: string;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  updated_at: string;
};
export type DemographicEntry = {
  name: string;
  region?: string;
  percentage: number;
  followers: number;
};
export type DemographicSnapshot = {
  id: string;
  account_id: string;
  countries: DemographicEntry[];
  cities: DemographicEntry[];
  recorded_at: string;
};
export type Competitor = {
  id: string;
  platform: string;
  name: string;
  handle: string;
  followers: number;
  posts_count: number;
  engagement: number;
  updated_at: string;
};
export type InboxMessage = {
  id: string;
  conversation_id: string;
  sender_name: string;
  sender_handle: string;
  direction: "inbound" | "outbound";
  delivery_source: "network" | "local";
  body: string;
  created_at: string;
};
export type InboxConversation = {
  id: string;
  account_id: string;
  platform: string;
  participant_name: string;
  participant_handle: string;
  participant_initials: string;
  kind: "message" | "comment";
  status: "unresolved" | "resolved";
  unread: boolean;
  last_message_at: string;
  messages: InboxMessage[];
};
export type ReportTemplate = {
  id: string;
  name: string;
  period_days: number;
  platforms: string[];
  include_summary: boolean;
  include_network_overview: boolean;
  include_top_posts: boolean;
  created_at: string;
  updated_at: string;
};
export type TrackedHashtag = {
  id: string;
  platform: string;
  tag: string;
  posts_count: number;
  reach: number;
  interactions: number;
  recorded_at: string;
};
export type SmartLinkItem = {
  id: string;
  smartlink_id: string;
  label: string;
  url: string;
  color?: string;
  image_url?: string;
  position: number;
  clicks: number;
  created_at: string;
  updated_at: string;
};
export type SmartLinkPage = {
  id: string;
  company_id: string;
  slug: string;
  title: string;
  description: string;
  avatar_url?: string;
  theme?: string;
  visits: number;
  items: SmartLinkItem[];
  created_at: string;
  updated_at: string;
};
export type AdPlatform = "meta" | "google" | "tiktok";
export type AdStatus = "active" | "paused" | "completed";
export type AdCampaign = {
  id: string;
  company_id: string;
  name: string;
  platform: AdPlatform;
  status: AdStatus;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  results: number;
  objective?: string;
  created_at: string;
  updated_at: string;
};
export type AdAccountConnection = {
  platform: AdPlatform;
  connected: boolean;
  account_name: string;
  account_id: string;
  currency?: string;
  updated_at: string;
};
export type Workspace = {
  accounts: Account[];
  media: Media[];
  posts: Post[];
  autolists?: Autolist[];
  metricSnapshots?: MetricSnapshot[];
  postMetrics?: PostMetric[];
  demographicSnapshots?: DemographicSnapshot[];
  competitors?: Competitor[];
  conversations?: InboxConversation[];
  reportTemplates?: ReportTemplate[];
  trackedHashtags?: TrackedHashtag[];
  smartlink?: SmartLinkPage;
  adCampaigns?: AdCampaign[];
  adConnections?: Record<string, AdAccountConnection>;
  activities: { id: string; message: string; created_at: string }[];
};
export const networks: Record<
  string,
  { label: string; color: string; mark: string; formats: string[] }
> = {
  drive: { label: "Google Drive", color: "#40845c", mark: "D", formats: [] },
  facebook: {
    label: "Facebook",
    color: "#1877f2",
    mark: "f",
    formats: ["post", "reel", "story"],
  },
  instagram: {
    label: "Instagram",
    color: "#c13d85",
    mark: "◎",
    formats: ["post", "reel", "story"],
  },
  pinterest: {
    label: "Pinterest",
    color: "#bd1731",
    mark: "P",
    formats: ["pin"],
  },
  google: {
    label: "Google Business",
    color: "#3979d4",
    mark: "G",
    formats: ["post", "photo"],
  },
  youtube: {
    label: "YouTube",
    color: "#dc3434",
    mark: "▶︎",
    formats: ["video", "short"],
  },
  tiktok: { label: "TikTok", color: "#202826", mark: "♪", formats: ["video"] },
  linkedin: {
    label: "LinkedIn",
    color: "#0b70a1",
    mark: "in",
    formats: ["post"],
  },
  threads: { label: "Threads", color: "#303331", mark: "@", formats: ["post"] },
  bluesky: { label: "Bluesky", color: "#1687e8", mark: "B", formats: ["post"] },
};
export const blankVariant = (text = "", platform = "facebook"): Variant => ({
  text,
  title: "",
  tags: "",
  format: networks[platform].formats[0],
  coverMode: "default",
  coverUrl: "",
  frameSeconds: 0,
  board: "",
  link: "",
  privacy: "public",
  audience: "",
  allowComments: true,
  allowDuet: true,
  allowStitch: true,
  showInFeed: true,
  notifySubscribers: true,
  aiDisclosure: false,
});
