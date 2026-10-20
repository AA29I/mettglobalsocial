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
export type Workspace = {
  accounts: Account[];
  media: Media[];
  posts: Post[];
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
