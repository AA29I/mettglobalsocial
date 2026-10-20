import type { Company, Workspace, Payload, Post } from "./types";

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
  activities: [],
});
function read(): PreviewState {
  const value = localStorage.getItem(key);
  if (value) return JSON.parse(value);
  const company = {
    id: crypto.randomUUID(),
    name: "Mett Global",
    initials: "MG",
    accent: "#c5da83",
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
  if (route === "workspace") return reply(data);
  if (route === "youtube/jobs") return reply([]);
  if (route === "accounts" && method === "POST") {
    const a = { id: crypto.randomUUID(), ...d, status: "disconnected" };
    data.accounts.push(a);
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
    return save({ ok: true });
  }
  throw new Error(
    "Live account connections and publishing are disabled in this browser-only preview.",
  );
}
