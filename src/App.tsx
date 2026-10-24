import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock3,
  ExternalLink,
  FileText,
  FolderOpen,
  Globe2,
  Image,
  Layers3,
  LayoutDashboard,
  Link2,
  LogOut,
  Menu,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  Video,
  X,
  AlertCircle,
  Copy,
  Send,
  MessageSquare,
  Mail,
  MailOpen,
  Printer,
  Hash,
  RefreshCw,
  ChevronUp,
  Smartphone,
  MousePointerClick,
  Eye,
  Megaphone,
  Target,
  SlidersHorizontal,
  TrendingUp,
  Lightbulb,
  Edit3,
} from "lucide-react";
import { api } from "./api";
import { buildAutolistOccurrences, sortWeeklySlots } from "./autolists";
import {
  bestTimeNetworks,
  weekDays,
  hoursOfDay,
  getBestTimeScore,
  getBestTimeShading,
  isBestTimeNetwork,
  type BestTimeNetwork,
} from "./bestTimes";
import { previewMode } from "./preview";
import { formatWallTime, resolveWallTime } from "./time";
import {
  networks,
  blankVariant,
  type Company,
  type Account,
  type Media,
  type Variant,
  type Payload,
  type Post,
  type Autolist,
  type AutolistSlot,
  type InboxConversation,
  type ReportTemplate,
  type TrackedHashtag,
  type SmartLinkPage,
  type SmartLinkItem,
  type AdCampaign,
  type AdAccountConnection,
  type AdPlatform,
  type AdStatus,
  type Workspace,
} from "./types";
import { validateComposerDraft } from "./validation";

const empty: Workspace = {
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
  smartlink: undefined,
  adCampaigns: [],
  adConnections: {},
  activities: [],
};
const pages = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "planner", label: "Planner", icon: CalendarDays },
  { id: "inbox", label: "Inbox", icon: MessageSquare },
  { id: "smartlinks", label: "SmartLinks", icon: Link2 },
  { id: "reporting", label: "Reporting", icon: Printer },
  { id: "ads", label: "Ads", icon: Megaphone },
  { id: "library", label: "Media library", icon: FolderOpen },
  { id: "accounts", label: "Social accounts", icon: Globe2 },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
];
const tzs = [
  "Asia/Karachi",
  "UTC",
  "America/New_York",
  "America/Los_Angeles",
  "Europe/London",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Australia/Sydney",
];
const stamp = (v: string, timezone: string) =>
  new Intl.DateTimeFormat("en", {
    timeZone: timezone,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(v));
function Badge({
  platform,
  small = false,
}: {
  platform: string;
  small?: boolean;
}) {
  const n = networks[platform];
  return (
    <span
      className={"network-badge " + (small ? "small" : "")}
      style={{ "--network": n.color } as CSSProperties}
      title={n.label}
    >
      {n.mark}
    </span>
  );
}
function Status({ status }: { status: string }) {
  return (
    <span className={"status " + status}>
      <i />
      {status === "blocked"
        ? "Needs connection"
        : status === "draft"
          ? "Draft"
          : status === "authorized"
            ? "Authorized"
            : status === "scheduled"
              ? "Scheduled on YouTube"
              : "Not connected"}
    </span>
  );
}
function Modal({
  title,
  description,
  children,
  close,
  wide = false,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  close: () => void;
  wide?: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    box.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "Tab") {
        const els = box.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input,select,textarea,a[href],[tabindex="0"]',
        );
        if (!els?.length) return;
        const first = els[0],
          last = els[els.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = old;
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        ref={box}
        tabIndex={-1}
        className={"modal " + (wide ? "wide" : "")}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="modal-head">
          <div>
            <h2>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button
            className="icon-button"
            aria-label="Close dialog"
            onClick={close}
          >
            <X size={20} />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}

function Empty({
  icon: Icon = CalendarDays,
  title,
  text,
  action,
}: {
  icon?: typeof CalendarDays;
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Icon size={24} />
      </div>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}

export default function App() {
  const [auth, setAuth] = useState<{
    user: { username: string } | null;
    needsSetup: boolean;
    setupTokenRequired?: boolean;
  } | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [data, setData] = useState<Workspace>(empty);
  const [page, setPage] = useState("overview");
  const [nav, setNav] = useState(false);
  const [companyMenu, setCompanyMenu] = useState(false);
  const [modal, setModal] = useState<
    "company" | "account" | "media" | "composer" | null
  >(null);
  const [editing, setEditing] = useState<Post | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [integrations, setIntegrations] = useState<
    Record<
      string,
      { configured: boolean; missing: string[]; callbackUrl: string }
    >
  >({});
  const [driveAccount, setDriveAccount] = useState("");
  const [driveFiles, setDriveFiles] = useState<
    | { id: string; name: string; mimeType: string; webViewLink?: string }[]
    | null
  >(null);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [publicSlug] = useState<string | null>(() => {
    if (typeof window !== "undefined" && window.location.pathname) {
      const match = window.location.pathname.match(/^\/s\/([^/]+)/);
      if (match) return decodeURIComponent(match[1]);
    }
    return null;
  });
  const company = companies.find((c) => c.id === companyId);
  useEffect(() => {
    if (publicSlug) return;
    api<typeof auth>("/auth")
      .then(setAuth)
      .catch((e) => setError(e.message));
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);
  useEffect(() => {
    if (auth?.user) {
      loadCompanies().catch((e) => setError(e.message));
      api<typeof integrations>("/integrations")
        .then(setIntegrations)
        .catch((e) => setError(e.message));
      const result = new URLSearchParams(location.search).get("connection");
      if (result === "success")
        setNotice(
          "Account authorization completed. Publishing adapters are still in development.",
        );
      if (result === "failed" || result === "denied")
        setError(
          "Connection was cancelled or failed. Check the developer app settings and try again.",
        );
    }
  }, [auth?.user?.username]);
  async function loadCompanies() {
    const list = await api<Company[]>("/companies");
    setCompanies(list);
    setCompanyId((id) => {
      const callbackCompany = new URLSearchParams(location.search).get(
        "company",
      );
      return list.some((c) => c.id === callbackCompany)
        ? callbackCompany!
        : list.some((c) => c.id === id)
          ? id
          : list[0]?.id || "";
    });
  }
  const requestSequence = useRef(0);
  useEffect(() => {
    setData(empty);
    setEditing(null);
    setDriveFiles(null);
    setDriveAccount("");
    setModal(null);
    setError("");
    if (!companyId) return;
    refresh();
  }, [companyId]);
  async function refresh() {
    const sequence = ++requestSequence.current;
    setLoading(true);
    try {
      const next = await api<Workspace>(`/companies/${companyId}/workspace`);
      if (sequence === requestSequence.current) setData(next);
    } catch (e) {
      if (sequence === requestSequence.current) setError((e as Error).message);
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (notice) {
      const t = setTimeout(() => setNotice(""), 6000);
      return () => clearTimeout(t);
    }
  }, [notice]);
  function compose(post?: Post) {
    setEditing(post || null);
    setModal("composer");
  }
  const changePage = (id: string) => {
    setPage(id);
    setNav(false);
  };
  async function removePost(post: Post) {
    if (!confirm(`Delete “${post.title}”? This cannot be undone.`)) return;
    await run(async () => {
      await api(`/companies/${companyId}/posts/${post.id}`, "DELETE");
      await refresh();
      setNotice("Post deleted");
    });
  }
  async function bulkRemovePosts(postIds: string[]) {
    if (!postIds.length) return;
    await run(async () => {
      for (const id of postIds) {
        await api(`/companies/${companyId}/posts/${id}`, "DELETE");
      }
      await refresh();
      setNotice(
        `Deleted ${postIds.length} post${postIds.length === 1 ? "" : "s"}`,
      );
    });
  }
  async function saveAutolist(
    input: Omit<Autolist, "id" | "updated_at">,
    existingId?: string,
  ) {
    await run(async () => {
      await api(
        `/companies/${companyId}/autolists${existingId ? "/" + existingId : ""}`,
        existingId ? "PUT" : "POST",
        input,
      );
      await refresh();
      setNotice(existingId ? "Autolist updated" : "Autolist created");
    });
  }
  async function removeAutolist(autolist: Autolist) {
    await run(async () => {
      await api(`/companies/${companyId}/autolists/${autolist.id}`, "DELETE");
      await refresh();
      setNotice("Autolist deleted");
    });
  }
  async function syncAutolistFeed(autolist: Autolist) {
    if (!autolist.feed_url) return;
    await run(async () => {
      const res = await api<{ ok: boolean; added: number; items: string[] }>(
        `/companies/${companyId}/autolists/${autolist.id}/feed/sync`,
        "POST",
        {},
      );
      await refresh();
      setNotice(
        `Synced RSS feed: ${res.added ? `added ${res.added} new post${res.added === 1 ? "" : "s"}` : "no new posts found"}`,
      );
    });
  }
  async function cycleAutolist(autolist: Autolist) {
    if (!autolist.items.length) return;
    await run(async () => {
      const res = await api<{ ok: boolean; published: string; is_circular: boolean }>(
        `/companies/${companyId}/autolists/${autolist.id}/cycle`,
        "POST",
        {},
      );
      await refresh();
      setNotice(
        res.is_circular
          ? `Cycled item to end of queue: “${res.published.slice(0, 32)}…”`
          : `Published item and removed from queue: “${res.published.slice(0, 32)}…”`,
      );
    });
  }
  async function appendDraftToAutolist(autolistId: string, text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    const target = (data.autolists || []).find((a) => a.id === autolistId);
    if (!target) return;
    await run(async () => {
      await api(`/companies/${companyId}/autolists/${target.id}`, "PUT", {
        name: target.name,
        platform: target.platform,
        items: [...target.items, trimmed],
        slots: target.slots,
        is_circular: target.is_circular,
        feed_url: target.feed_url,
        feed_prefix: target.feed_prefix,
        feed_include_link: target.feed_include_link,
        feed_auto_queue: target.feed_auto_queue,
      });
      await refresh();
      setNotice(`Added draft text to autolist “${target.name}”`);
    });
  }
  if (publicSlug) {
    return <PublicSmartLinkView slug={publicSlug} />;
  }
  if (!auth)
    return (
      <div className="boot">
        <div className="wordmark-icon" aria-hidden="true" />
        <h1>Mett Social</h1>
        <p>{error || "Opening your workspace…"}</p>
        {error && (
          <button className="primary" onClick={() => location.reload()}>
            Retry
          </button>
        )}
      </div>
    );
  if (!auth.user)
    return (
      <Auth auth={auth} done={(user) => setAuth({ needsSetup: false, user })} />
    );
  const drafts = data.posts.filter((p) => p.status === "draft");
  const queued = data.posts.filter((p) => p.status === "blocked");
  return (
    <div
      className="app-shell"
      style={
        { "--company-accent": company?.accent || "#e0bc68" } as CSSProperties
      }
    >
      {nav && <div className="nav-scrim" onClick={() => setNav(false)} />}
      <aside className={"sidebar " + (nav ? "open" : "")}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            changePage("overview");
          }}
        >
          <div className="wordmark-icon" aria-hidden="true" />
          <div>
            <strong>
              mett<span>social</span>
            </strong>
            <small>BY METT GLOBAL</small>
          </div>
        </a>
        <div className="company-switcher">
          <button
            aria-label="Switch company"
            className="company-current"
            onClick={() => setCompanyMenu((v) => !v)}
            aria-expanded={companyMenu}
          >
            <span className="company-avatar">{company?.initials || "MG"}</span>
            <span>
              <strong>{company?.name || "Your companies"}</strong>
              <small>Company workspace</small>
            </span>
            <ChevronDown size={16} />
          </button>
          {companyMenu && (
            <div className="company-dropdown">
              {companies.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setCompanyId(c.id);
                    setCompanyMenu(false);
                  }}
                >
                  <span
                    className="company-avatar"
                    style={{ background: c.accent }}
                  >
                    {c.initials}
                  </span>
                  {c.name}
                  {c.id === companyId && <Check size={16} />}
                </button>
              ))}
              <button
                onClick={() => {
                  setCompanyMenu(false);
                  setModal("company");
                }}
              >
                <Plus size={17} />
                Add a company
              </button>
            </div>
          )}
        </div>
        <div className="nav-caption">WORKSPACE</div>
        <nav>
          {pages.map((p) => (
            <button
              key={p.id}
              className={"nav-item " + (page === p.id ? "active" : "")}
              onClick={() => changePage(p.id)}
            >
              <p.icon size={19} />
              {p.label}
              {p.id === "planner" && data.posts.length > 0 && (
                <span className="nav-count">{data.posts.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="workspace-note">
            <ShieldCheck size={19} />
            <strong>Your brands. Your space.</strong>
            <p>A private workspace for your social presence.</p>
            <span>
              INTERNAL TOOL <span className="live-dot" />
            </span>
          </div>
          <button
            className={"nav-item " + (page === "settings" ? "active" : "")}
            onClick={() => changePage("settings")}
          >
            <Settings2 size={19} />
            Settings
          </button>
          <button
            className="nav-item"
            hidden={previewMode}
            onClick={() =>
              run(async () => {
                await api("/auth/logout", "POST", {});
                setAuth({ user: null, needsSetup: false });
                setData(empty);
              })
            }
          >
            <LogOut size={18} />
            Sign out
          </button>
          <div className="operator">
            <span>{auth.user.username.slice(0, 2).toUpperCase()}</span>
            <div>
              <strong>{auth.user.username}</strong>
              <small>Workspace owner</small>
            </div>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setNav(true)}
            >
              <Menu size={22} />
            </button>
            <Building2 size={16} />
            <span>{company?.name || "Mett Global"}</span>
            <span className="slash">/</span>
            <strong>
              {pages.find((p) => p.id === page)?.label || "Settings"}
            </strong>
          </div>
          <div className="top-actions">
            {installPrompt && (
              <button
                className="text-button"
                onClick={async () => {
                  await installPrompt.prompt();
                  setInstallPrompt(null);
                }}
              >
                <ArrowDownToLine size={15} />
                Install app
              </button>
            )}
            <span className="private-label">
              <span className="live-dot" />
              {previewMode ? "Browser-only preview" : "Private workspace"}
            </span>
            <button
              className="icon-button"
              aria-label="View recent activity"
              onClick={() => changePage("overview")}
            >
              <Bell size={19} />
            </button>
            <span className="top-avatar">
              {auth.user.username.slice(0, 1).toUpperCase()}
            </span>
          </div>
        </header>
        <main>
          {previewMode && (
            <div className="preview-mode-banner" role="status">
              <ShieldCheck size={18} />
              <div>
                <strong>Interface preview · browser-only data</strong>
                <p>
                  Try companies, accounts, drafts and planning. Nothing connects
                  to your socials or publishes. Data stays in this browser and
                  is not synced.
                </p>
              </div>
            </div>
          )}
          {error && (
            <div role="alert" className="alert danger">
              <AlertCircle size={17} />
              <span>{error}</span>
              <button aria-label="Dismiss error" onClick={() => setError("")}>
                <X size={16} />
              </button>
            </div>
          )}
          {!company ? (
            <div className="first-company">
              <span className="eyebrow">ONE PLACE FOR EVERY BRAND</span>
              <h1>Build your social workspace.</h1>
              <p>
                Start with Mett Global. Add other companies whenever you’re
                ready.
                <br />
                Their accounts, content, and plans stay separate.
              </p>
              <button className="primary" onClick={() => setModal("company")}>
                <Plus size={18} />
                Create your first company
              </button>
              <div className="setup-tiles">
                <div>
                  <Building2 />
                  <h3>Separate companies</h3>
                  <p>Keep each brand’s content in its own workspace.</p>
                </div>
                <div>
                  <Layers3 />
                  <h3>One composer</h3>
                  <p>Shared ideas. Custom content for every account.</p>
                </div>
                <div>
                  <CalendarDays />
                  <h3>A clearer calendar</h3>
                  <p>Bring drafts and publishing plans together.</p>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">
                    {page === "overview"
                      ? "YOUR SOCIAL COMMAND CENTER"
                      : "METT SOCIAL WORKSPACE"}
                  </div>
                  <h1>
                    {
                      (
                        {
                          overview: "A little clarity. A lot of possibilities.",
                          planner: "Make room for your next idea.",
                          inbox: "Every conversation in one place.",
                          smartlinks: "One link. Infinite destinations.",
                          reporting: "Executive reporting, tailored for Mett Global.",
                          ads: "Drive growth with unified advertising.",
                          library: "Your content, close at hand.",
                          accounts: "Every channel. One workspace.",
                          analytics: "Turn attention into understanding.",
                          settings: "Make this space your own.",
                        } as Record<string, string>
                      )[page]
                    }
                  </h1>
                  <p>
                    {
                      (
                        {
                          overview: `Here’s what’s happening across ${company.name}.`,
                          planner:
                            "Plan the story. Customize the details. Keep the big picture.",
                          inbox:
                            "Review messages and comments across your connected networks, resolve threads, and draft local replies.",
                          smartlinks:
                            "Manage your brand’s Link-in-bio microsite, customize button styling, and monitor real-time visit and click analytics.",
                          reporting:
                            "Configure custom date ranges and networks, select executive sections, save templates, and export to print-ready PDF.",
                          ads:
                            "Cross-platform paid performance across Meta Ads, Google Ads, and TikTok Ads in one place.",
                          library:
                            "Reference your Google Drive files. Keep your originals where they belong.",
                          accounts:
                            "Organize all your social profiles under the right company.",
                          analytics:
                            "A clear view of performance, backed by your connected platforms.",
                          settings:
                            "Company identity, regional preferences, and application readiness.",
                        } as Record<string, string>
                      )[page]
                    }
                  </p>
                </div>
                {["overview", "planner"].includes(page) ? (
                  <button className="primary" onClick={() => compose()}>
                    <Plus size={18} />
                    Create a post
                  </button>
                ) : page === "accounts" ? (
                  <button
                    className="primary"
                    onClick={() => setModal("account")}
                  >
                    <Plus size={18} />
                    Add account
                  </button>
                ) : page === "library" ? (
                  <button className="primary" onClick={() => setModal("media")}>
                    <Plus size={18} />
                    Add Drive reference
                  </button>
                ) : page === "smartlinks" && data.smartlink ? (
                  <div className="smartlinks-top-actions">
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => {
                        const url = `${window.location.origin}/s/${data.smartlink?.slug}`;
                        navigator.clipboard.writeText(url);
                        setNotice(`Copied link to clipboard: ${url}`);
                      }}
                    >
                      <Copy size={16} />
                      Copy link
                    </button>
                    <a
                      href={`/s/${data.smartlink.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="primary text-link-btn"
                    >
                      <ExternalLink size={16} />
                      Open live microsite
                    </a>
                  </div>
                ) : null}
              </div>
              {loading && (
                <div className="loading-line" role="status">
                  Loading company workspace…
                </div>
              )}
              {page === "overview" && (
                <>
                  <section className="hero-card">
                    <div className="hero-copy">
                      <span className="hero-label">
                        <Sparkles size={14} />
                        THOUGHTFUL CONTENT. CONSISTENT PRESENCE.
                      </span>
                      <h2>
                        Your next great post
                        <br />
                        starts here.
                      </h2>
                      <p>
                        One idea, made for every channel.
                        <br />
                        Create once. Make it yours everywhere.
                      </p>
                      <button
                        className="cream-button"
                        onClick={() => compose()}
                      >
                        Let’s create something
                        <ArrowUpRight size={17} />
                      </button>
                    </div>
                    <div className="hero-art" aria-hidden="true">
                      <div className="orbit orbit-one" />
                      <div className="orbit orbit-two" />
                      <div className="art-core">
                        <Layers3 size={37} />
                      </div>
                      {["instagram", "youtube", "pinterest", "facebook"].map(
                        (p, i) => (
                          <div
                            key={p}
                            className={"floating-network floating-" + i}
                          >
                            <Badge platform={p} />
                          </div>
                        ),
                      )}
                      <span className="art-caption">
                        <span />A little more connected.
                      </span>
                    </div>
                  </section>
                  <section className="stat-grid">
                    {[
                      {
                        label: "Social accounts",
                        value: data.accounts.length,
                        note: "Organized in this company",
                        icon: Globe2,
                      },
                      {
                        label: "In your queue",
                        value: queued.length,
                        note: "Awaiting publishing connections",
                        icon: Clock3,
                      },
                      {
                        label: "Ideas in progress",
                        value: drafts.length,
                        note: "Drafts ready to come back to",
                        icon: FileText,
                      },
                      {
                        label: "Drive references",
                        value: data.media.length,
                        note: "Original files stay in Drive",
                        icon: FolderOpen,
                      },
                    ].map((s) => (
                      <div className="stat-card" key={s.label}>
                        <div>
                          <span>{s.label}</span>
                          <s.icon size={18} />
                        </div>
                        <strong>{s.value.toString().padStart(2, "0")}</strong>
                        <small>{s.note}</small>
                      </div>
                    ))}
                  </section>
                  <div className="dashboard-grid">
                    <section className="panel">
                      <div className="panel-head">
                        <div>
                          <h2>Your publishing desk</h2>
                          <p>A little planning goes a long way.</p>
                        </div>
                        <button
                          className="text-button"
                          onClick={() => changePage("planner")}
                        >
                          Open planner
                          <ArrowRight size={15} />
                        </button>
                      </div>
                      {data.posts.length ? (
                        <div className="post-list">
                          {data.posts.slice(0, 4).map((p) => (
                            <PostRow
                              key={p.id}
                              post={p}
                              accounts={data.accounts}
                              timezone={company.timezone}
                              edit={() => compose(p)}
                            />
                          ))}
                        </div>
                      ) : (
                        <Empty
                          title="An open calendar. A fresh start."
                          text="Your drafts and publishing plans will appear here. Give your next idea a place to land."
                          action={
                            <button
                              className="secondary"
                              onClick={() => compose()}
                            >
                              <Plus size={15} />
                              Create your first post
                            </button>
                          }
                        />
                      )}
                    </section>
                    <section className="panel">
                      <div className="panel-head">
                        <div>
                          <h2>Your channels</h2>
                          <p>Make space for every audience.</p>
                        </div>
                        <button
                          className="icon-button"
                          aria-label="Add social account"
                          onClick={() => setModal("account")}
                        >
                          <Plus size={19} />
                        </button>
                      </div>
                      {data.accounts.length ? (
                        <div className="channel-list">
                          {data.accounts.slice(0, 5).map((a) => (
                            <div className="channel-row" key={a.id}>
                              <Badge platform={a.platform} />
                              <div>
                                <strong>{a.name}</strong>
                                <small>
                                  {a.handle || networks[a.platform].label}
                                </small>
                              </div>
                              <span
                                className="connection-dot"
                                title="Not connected"
                              />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <>
                          <div className="network-cluster">
                            {[
                              "facebook",
                              "instagram",
                              "youtube",
                              "pinterest",
                              "tiktok",
                            ].map((p) => (
                              <Badge key={p} platform={p} />
                            ))}
                          </div>
                          <p className="channel-empty-copy">
                            Bring your accounts together.
                            <br />
                            Give each one its own voice.
                          </p>
                          <button
                            className="secondary full"
                            onClick={() => setModal("account")}
                          >
                            Add your first account
                            <Plus size={16} />
                          </button>
                        </>
                      )}
                      <div className="subtle-note">
                        <CircleHelp size={15} />
                        Account records need OAuth before publishing.
                      </div>
                    </section>
                  </div>
                  <section className="panel activity-panel">
                    <div className="panel-head">
                      <div>
                        <h2>Workspace activity</h2>
                        <p>The small steps behind your next big idea.</p>
                      </div>
                      <ShieldCheck size={18} />
                    </div>
                    {data.activities.length ? (
                      data.activities.slice(0, 5).map((a) => (
                        <div className="activity-row" key={a.id}>
                          <span className="activity-marker">
                            <Check size={13} />
                          </span>
                          <span>{a.message}</span>
                          <time>{stamp(a.created_at, company.timezone)}</time>
                        </div>
                      ))
                    ) : (
                      <p className="quiet-copy">
                        Your company activity will appear here as you add
                        accounts and save content.
                      </p>
                    )}
                  </section>
                </>
              )}
              {page === "planner" && (
                <>
                  <YouTubePreparation
                    company={company}
                    data={data}
                    changed={refresh}
                  />
                  <Planner
                    data={data}
                    company={company}
                    busy={busy}
                    compose={compose}
                    remove={removePost}
                    bulkRemove={bulkRemovePosts}
                    saveAutolist={saveAutolist}
                    removeAutolist={removeAutolist}
                    syncAutolistFeed={syncAutolistFeed}
                    cycleAutolist={cycleAutolist}
                  />
                </>
              )}
              {page === "accounts" && (
                <>
                  <div className="info-banner">
                    <ShieldCheck size={19} />
                    <div>
                      <strong>Account inventory, ready for connection</strong>
                      <p>
                        Authorize through the platform’s official login below,
                        or add an account record for planning. Publishing
                        adapters are not enabled yet.
                      </p>
                    </div>
                  </div>
                  <ConnectionPanel
                    integrations={integrations}
                    busy={busy}
                    connect={(provider) =>
                      run(async () => {
                        const result = await api<{ url: string }>(
                          `/companies/${companyId}/connect/${provider}`,
                          "POST",
                          {},
                        );
                        location.assign(result.url);
                      })
                    }
                  />
                  <div className="account-grid">
                    {data.accounts.map((a) => (
                      <article className="panel account-card" key={a.id}>
                        <div className="account-card-top">
                          <Badge platform={a.platform} />
                          <button
                            className="icon-button"
                            aria-label={"Delete " + a.name}
                            onClick={() => {
                              if (confirm("Remove this account record?"))
                                run(async () => {
                                  await api(
                                    `/companies/${companyId}/accounts/${a.id}`,
                                    "DELETE",
                                  );
                                  await refresh();
                                });
                            }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                        <small>{networks[a.platform].label}</small>
                        <h3>{a.name}</h3>
                        <p>{a.handle || "No handle added"}</p>
                        <Status status={a.status} />
                        <div className="account-card-footer">
                          <Link2 size={14} />
                          {a.status === "authorized"
                            ? "Authorized · publishing not enabled"
                            : "OAuth integration required"}
                        </div>
                      </article>
                    ))}
                    <button
                      className="add-account-card"
                      onClick={() => setModal("account")}
                    >
                      <span>
                        <Plus size={25} />
                      </span>
                      <h3>Add a social account</h3>
                      <p>Another channel. Another possibility.</p>
                    </button>
                  </div>
                </>
              )}
              {page === "library" && (
                <>
                  <div className="info-banner">
                    <FolderOpen size={19} />
                    <div>
                      <strong>Your library lives in Google Drive</strong>
                      <p>
                        Authorize Google in Social accounts to browse your
                        Drive. Save file references without copying the
                        originals.
                      </p>
                    </div>
                  </div>
                  <div className="drive-browser-controls">
                    <select
                      aria-label="Authorized Google Drive account"
                      value={driveAccount}
                      onChange={(e) => setDriveAccount(e.target.value)}
                    >
                      <option value="">
                        Choose an authorized Drive account
                      </option>
                      {data.accounts
                        .filter(
                          (a) =>
                            a.platform === "drive" && a.status === "authorized",
                        )
                        .map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                    </select>
                    <button
                      className="secondary"
                      disabled={!driveAccount || busy}
                      onClick={() =>
                        run(async () => {
                          const result = await api<{
                            files: NonNullable<typeof driveFiles>;
                          }>(`/companies/${companyId}/drive/${driveAccount}`);
                          setDriveFiles(result.files);
                        })
                      }
                    >
                      <FolderOpen size={16} />
                      Browse Drive
                    </button>
                  </div>
                  {driveFiles && (
                    <section className="panel drive-browser">
                      <div className="panel-head">
                        <h2>Recent images & videos</h2>
                        <button
                          className="icon-button"
                          aria-label="Close Drive browser"
                          onClick={() => setDriveFiles(null)}
                        >
                          <X size={17} />
                        </button>
                      </div>
                      {driveFiles.length ? (
                        driveFiles.map((f) => (
                          <div className="drive-file" key={f.id}>
                            <FileText size={18} />
                            <span>{f.name}</span>
                            <button
                              className="secondary"
                              disabled={busy}
                              onClick={() =>
                                run(async () => {
                                  await api(
                                    `/companies/${companyId}/media`,
                                    "POST",
                                    {
                                      name: f.name,
                                      url:
                                        f.webViewLink ||
                                        `https://drive.google.com/file/d/${f.id}/view`,
                                      kind: f.mimeType.startsWith("video/")
                                        ? "video"
                                        : "image",
                                    },
                                  );
                                  await refresh();
                                  setNotice(
                                    "Drive reference added to this company",
                                  );
                                })
                              }
                            >
                              Add to library
                            </button>
                          </div>
                        ))
                      ) : (
                        <p className="quiet-copy">
                          No image or video files found.
                        </p>
                      )}
                    </section>
                  )}
                  {data.media.length ? (
                    <div className="media-grid">
                      {data.media.map((m) => (
                        <article className="panel media-card" key={m.id}>
                          <div className={"media-art " + m.kind}>
                            {m.kind === "video" ? (
                              <Video size={39} />
                            ) : (
                              <Image size={39} />
                            )}
                            <span>GOOGLE DRIVE</span>
                          </div>
                          <div className="media-meta">
                            <span className="eyebrow">{m.kind}</span>
                            <h3>{m.name}</h3>
                            <p>Drive reference · access unverified</p>
                            <div>
                              <a
                                href={m.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-button"
                              >
                                Open in Drive
                                <ExternalLink size={14} />
                              </a>
                              <button
                                className="icon-button"
                                aria-label={"Remove reference " + m.name}
                                onClick={() => {
                                  if (
                                    confirm(
                                      "Remove this reference? The Drive file will not be deleted.",
                                    )
                                  )
                                    run(async () => {
                                      await api(
                                        `/companies/${companyId}/media/${m.id}`,
                                        "DELETE",
                                      );
                                      await refresh();
                                    });
                                }}
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <section className="panel">
                      <Empty
                        icon={FolderOpen}
                        title="Your library, without the extra storage."
                        text="Add a Google Drive video or image link to keep your company’s content organized."
                        action={
                          <button
                            className="primary"
                            onClick={() => setModal("media")}
                          >
                            <Plus size={16} />
                            Add a Drive reference
                          </button>
                        }
                      />
                    </section>
                  )}
                </>
              )}
              {page === "inbox" && (
                <InboxView
                  company={company}
                  data={data}
                  busy={busy}
                  sendReply={(conversationId, body) =>
                    run(async () => {
                      await api(
                        `/companies/${companyId}/inbox/${conversationId}/replies`,
                        "POST",
                        { body },
                      );
                      await refresh();
                      setNotice(
                        "Reply saved locally. It will be delivered when live network adapters are connected.",
                      );
                    })
                  }
                  updateConversation={(conversationId, patch) =>
                    run(async () => {
                      await api(
                        `/companies/${companyId}/inbox/${conversationId}`,
                        "PATCH",
                        patch,
                      );
                      await refresh();
                    })
                  }
                  manageAccounts={() => changePage("accounts")}
                />
              )}
              {page === "smartlinks" && (
                <SmartLinksView
                  company={company}
                  data={data}
                  busy={busy}
                  updateSmartLink={(patch) =>
                    run(async () => {
                      await api(`/companies/${companyId}/smartlink`, "PUT", patch);
                      await refresh();
                      setNotice("SmartLink microsite settings updated");
                    })
                  }
                  addItem={(payload) =>
                    run(async () => {
                      await api(`/companies/${companyId}/smartlink/items`, "POST", payload);
                      await refresh();
                      setNotice(`Added SmartLink button: ${payload.label}`);
                    })
                  }
                  updateItem={(id, patch) =>
                    run(async () => {
                      await api(`/companies/${companyId}/smartlink/items/${id}`, "PUT", patch);
                      await refresh();
                      setNotice("SmartLink button updated");
                    })
                  }
                  deleteItem={(id, label) =>
                    run(async () => {
                      await api(`/companies/${companyId}/smartlink/items/${id}`, "DELETE");
                      await refresh();
                      setNotice(`Removed SmartLink button: ${label}`);
                    })
                  }
                  reorderItems={(itemIds) =>
                    run(async () => {
                      await api(`/companies/${companyId}/smartlink/reorder`, "PUT", { itemIds });
                      await refresh();
                    })
                  }
                  setNotice={setNotice}
                  setError={setError}
                />
              )}
              {page === "reporting" && (
                <ReportingView
                  company={company}
                  data={data}
                  busy={busy}
                  saveTemplate={(payload) =>
                    run(async () => {
                      await api(`/companies/${companyId}/reports/templates`, "POST", payload);
                      await refresh();
                      setNotice(`Saved report template: ${payload.name}`);
                    })
                  }
                  deleteTemplate={(id, name) =>
                    run(async () => {
                      await api(`/companies/${companyId}/reports/templates/${id}`, "DELETE");
                      await refresh();
                      setNotice(`Removed template: ${name}`);
                    })
                  }
                />
              )}
              {page === "ads" && (
                <AdsView
                  company={company}
                  data={data}
                  busy={busy}
                  createCampaign={(payload) =>
                    run(async () => {
                      await api(`/companies/${companyId}/ads/campaigns`, "POST", payload);
                      await refresh();
                      setNotice(`Created ad campaign: ${payload.name}`);
                    })
                  }
                  updateCampaign={(id, payload) =>
                    run(async () => {
                      await api(`/companies/${companyId}/ads/campaigns/${id}`, "PUT", payload);
                      await refresh();
                      setNotice("Updated ad campaign");
                    })
                  }
                  deleteCampaign={(id, name) =>
                    run(async () => {
                      await api(`/companies/${companyId}/ads/campaigns/${id}`, "DELETE");
                      await refresh();
                      setNotice(`Deleted ad campaign: ${name}`);
                    })
                  }
                  toggleConnection={(platform) =>
                    run(async () => {
                      const updated = await api<{ connected: boolean }>(
                        `/companies/${companyId}/ads/connections/${platform}/toggle`,
                        "POST",
                        {},
                      );
                      await refresh();
                      setNotice(
                        `${updated.connected ? "Connected" : "Disconnected"} ${platform} ad account`,
                      );
                    })
                  }
                  setNotice={setNotice}
                  setError={setError}
                />
              )}
              {page === "analytics" && (
                <AnalyticsSummary
                  company={company}
                  data={data}
                  busy={busy}
                  refreshMetrics={() =>
                    run(async () => {
                      await api(`/companies/${companyId}/metrics/refresh`, "POST", {});
                      await refresh();
                      setNotice("Recorded a fresh analytics snapshot");
                    })
                  }
                  addCompetitor={(payload) =>
                    run(async () => {
                      await api(
                        `/companies/${companyId}/competitors`,
                        "POST",
                        payload,
                      );
                      await refresh();
                      setNotice(`Added competitor: ${payload.name}`);
                    })
                  }
                  removeCompetitor={(id, name) =>
                    run(async () => {
                      await api(
                        `/companies/${companyId}/competitors/${id}`,
                        "DELETE",
                      );
                      await refresh();
                      setNotice(`Removed competitor: ${name}`);
                    })
                  }
                  trackHashtag={(payload) =>
                    run(async () => {
                      await api(`/companies/${companyId}/hashtags`, "POST", payload);
                      await refresh();
                      setNotice(`Tracked hashtag #${payload.tag.replace(/^#/, "")}`);
                    })
                  }
                  deleteHashtag={(id, tag) =>
                    run(async () => {
                      await api(`/companies/${companyId}/hashtags/${id}`, "DELETE");
                      await refresh();
                      setNotice(`Removed hashtag #${tag.replace(/^#/, "")}`);
                    })
                  }
                  refreshHashtagSnapshot={(id, tag) =>
                    run(async () => {
                      await api(`/companies/${companyId}/hashtags/${id}/snapshot`, "POST", {});
                      await refresh();
                      setNotice(`Recorded fresh snapshot for #${tag.replace(/^#/, "")}`);
                    })
                  }
                  manageAccounts={() => changePage("accounts")}
                  openPost={(p) => compose(p)}
                  createPost={() => compose()}
                />
              )}
              {page === "settings" && (
                <Settings
                  company={company}
                  count={companies.length}
                  busy={busy}
                  save={(d) =>
                    run(async () => {
                      await api(`/companies/${companyId}`, "PATCH", d);
                      await loadCompanies();
                      setNotice("Company settings saved");
                    })
                  }
                  add={() => setModal("company")}
                />
              )}
              <footer className="app-footer">
                <span>
                  Mett Social <i /> Made for Mett Global.
                </span>
                <span>
                  {company.timezone} <span className="footer-dot">·</span>{" "}
                  {previewMode ? "Browser-only preview" : "Private workspace"}
                </span>
              </footer>
            </>
          )}
        </main>
      </div>
      {notice && (
        <div className="toast" role="status">
          <CheckCircle2 size={19} />
          {notice}
        </div>
      )}
      {modal === "company" && (
        <CompanyModal
          busy={busy}
          error={error}
          close={() => setModal(null)}
          save={(d) =>
            run(async () => {
              const c = await api<Company>("/companies", "POST", d);
              await loadCompanies();
              setCompanyId(c.id);
              setModal(null);
              setNotice("Company workspace created");
            })
          }
        />
      )}
      {modal === "account" && company && (
        <AccountModal
          busy={busy}
          error={error}
          close={() => setModal(null)}
          save={(d) =>
            run(async () => {
              await api(`/companies/${companyId}/accounts`, "POST", d);
              await refresh();
              setModal(null);
              setNotice(
                "Account record added. OAuth connection is still required.",
              );
            })
          }
        />
      )}
      {modal === "media" && company && (
        <MediaModal
          busy={busy}
          error={error}
          close={() => setModal(null)}
          save={(d) =>
            run(async () => {
              await api(`/companies/${companyId}/media`, "POST", d);
              await refresh();
              setModal(null);
              setNotice("Drive reference saved");
            })
          }
        />
      )}
      {modal === "composer" && company && (
        <Composer
          key={editing?.id || "new"}
          company={company}
          data={data}
          existing={editing}
          close={() => setModal(null)}
          busy={busy}
          error={error}
          appendToAutolist={appendDraftToAutolist}
          save={(payload) =>
            run(async () => {
              const result = await api<{ status: string }>(
                `/companies/${companyId}/posts${editing ? "/" + editing.id : ""}`,
                editing ? "PUT" : "POST",
                payload,
              );
              await refresh();
              setModal(null);
              setNotice(
                result.status === "blocked"
                  ? "Queue item saved. Publishing is blocked until integrations are connected."
                  : "Draft saved",
              );
            })
          }
        />
      )}
    </div>
  );
}

function Auth({
  auth,
  done,
}: {
  auth: { needsSetup: boolean; setupTokenRequired?: boolean };
  done: (user: { username: string }) => void;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const d = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const result = await api<{ user: { username: string } }>(
        auth.needsSetup ? "/auth/setup" : "/auth/login",
        "POST",
        d,
      );
      done(result.user);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-layout">
      <section className="auth-story">
        <div className="brand">
          <div className="wordmark-icon" aria-hidden="true" />
          <div>
            <strong>
              mett<span>social</span>
            </strong>
            <small>BY METT GLOBAL</small>
          </div>
        </div>
        <span className="eyebrow">ONE WORKSPACE. EVERY POSSIBILITY.</span>
        <h1>
          Good stories
          <br />
          deserve a<br />
          <em>connected world.</em>
        </h1>
        <p>
          Your companies, channels, and content.
          <br />
          Thoughtfully brought together.
        </p>
        <div className="auth-bottom">
          <ShieldCheck size={17} />
          Private by design. Made for Mett Global.
        </div>
      </section>
      <section className="auth-form-wrap">
        <form className="auth-form" onSubmit={submit}>
          <span className="eyebrow">METT GLOBAL WORKSPACE</span>
          <h2>
            {auth.needsSetup ? "Your workspace starts here." : "Welcome back."}
          </h2>
          <p>
            {auth.needsSetup
              ? "Create the private owner account to start organizing your companies."
              : "Sign in to pick up where your ideas left off."}
          </p>
          {error && (
            <div className="alert danger" role="alert">
              {error}
            </div>
          )}
          <label>
            Username
            <input
              name="username"
              required
              minLength={3}
              maxLength={80}
              autoComplete="username"
              placeholder="Your username"
            />
          </label>
          <label>
            Password
            <input
              type="password"
              name="password"
              required
              minLength={auth.needsSetup ? 12 : 1}
              maxLength={128}
              autoComplete={
                auth.needsSetup ? "new-password" : "current-password"
              }
              placeholder={
                auth.needsSetup ? "At least 12 characters" : "Your password"
              }
            />
          </label>
          {auth.needsSetup && auth.setupTokenRequired && (
            <label>
              Deployment setup token
              <input
                name="setupToken"
                type="password"
                required
                autoComplete="off"
              />
              <small>
                Use the token configured securely in your deployment settings.
              </small>
            </label>
          )}
          <button className="primary full" disabled={busy}>
            {busy
              ? "Please wait…"
              : auth.needsSetup
                ? "Create owner account"
                : "Sign in"}
            <ArrowRight size={17} />
          </button>
          <p className="form-footnote">
            <ShieldCheck size={14} />
            Internal owner access · no public registration
          </p>
        </form>
      </section>
    </div>
  );
}

function PostRow({
  post,
  accounts,
  timezone,
  edit,
}: {
  post: Post;
  accounts: Account[];
  timezone: string;
  edit: () => void;
}) {
  return (
    <button className="post-row" onClick={edit}>
      <span className="post-thumbnail">
        {post.payload.mediaKind === "video" ? (
          <Video size={20} />
        ) : (
          <Image size={20} />
        )}
      </span>
      <span className="post-row-copy">
        <strong>{post.title}</strong>
        <small>
          {post.scheduled_at
            ? stamp(post.scheduled_at, timezone)
            : "No date set"}{" "}
          <span>·</span> {post.payload.accountIds.length} destination
          {post.payload.accountIds.length !== 1 ? "s" : ""}
        </small>
      </span>
      <span className="mini-networks">
        {post.payload.accountIds.slice(0, 3).map((id) => {
          const a = accounts.find((a) => a.id === id);
          return a ? <Badge small key={id} platform={a.platform} /> : null;
        })}
      </span>
      <Status status={post.status} />
      <ChevronRight size={16} />
    </button>
  );
}

function CompanyModal({
  close,
  busy,
  error,
  save,
}: {
  close: () => void;
  busy: boolean;
  error: string;
  save: (d: unknown) => void;
}) {
  return (
    <Modal
      title="A space for another company"
      description="Its accounts, content, and plans stay separate."
      close={close}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save(Object.fromEntries(new FormData(e.currentTarget)));
        }}
        className="stack-form"
      >
        {error && (
          <div role="alert" className="alert danger">
            {error}
          </div>
        )}
        <label>
          Company name
          <input
            name="name"
            required
            maxLength={100}
            placeholder="Mett Global"
          />
        </label>
        <div className="form-grid">
          <label>
            Initials
            <input name="initials" required maxLength={3} defaultValue="MG" />
          </label>
          <label>
            Company accent
            <input type="color" name="accent" defaultValue="#e0bc68" />
          </label>
        </div>
        <label>
          Default timezone
          <select
            aria-label="Default timezone"
            name="timezone"
            defaultValue="Asia/Karachi"
          >
            {tzs.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <div className="modal-footer">
          <button type="button" className="secondary" onClick={close}>
            Cancel
          </button>
          <button className="primary" disabled={busy}>
            Create company
            <ArrowRight size={16} />
          </button>
        </div>
      </form>
    </Modal>
  );
}
function AccountModal({
  close,
  busy,
  error,
  save,
}: {
  close: () => void;
  busy: boolean;
  error: string;
  save: (d: unknown) => void;
}) {
  return (
    <Modal
      title="Add a social account"
      description="Create an account record in this company."
      close={close}
    >
      <form
        className="stack-form"
        onSubmit={(e) => {
          e.preventDefault();
          save(Object.fromEntries(new FormData(e.currentTarget)));
        }}
      >
        {error && (
          <div className="alert danger" role="alert">
            {error}
          </div>
        )}
        <label>
          Network
          <select name="platform" aria-label="Network">
            {Object.entries(networks)
              .filter(([key]) => key !== "drive")
              .map(([key, n]) => (
                <option value={key} key={key}>
                  {n.label}
                </option>
              ))}
          </select>
        </label>
        <label>
          Account name
          <input
            name="name"
            required
            maxLength={100}
            placeholder="Mett Global · Main channel"
          />
        </label>
        <label>
          Handle or location
          <input name="handle" maxLength={100} placeholder="@mettglobal" />
        </label>
        <div className="info-banner compact">
          <Link2 size={17} />
          <p>
            This saves an account record. It does not authorize access or enable
            publishing. Official OAuth integration is a separate step.
          </p>
        </div>
        <div className="modal-footer">
          <button type="button" className="secondary" onClick={close}>
            Cancel
          </button>
          <button className="primary" disabled={busy}>
            Add account record
            <Plus size={16} />
          </button>
        </div>
      </form>
    </Modal>
  );
}
function MediaModal({
  close,
  busy,
  error,
  save,
}: {
  close: () => void;
  busy: boolean;
  error: string;
  save: (d: unknown) => void;
}) {
  return (
    <Modal
      title="Add a Google Drive reference"
      description="Your original file stays in your Drive."
      close={close}
    >
      <form
        className="stack-form"
        onSubmit={(e) => {
          e.preventDefault();
          save(Object.fromEntries(new FormData(e.currentTarget)));
        }}
      >
        {error && (
          <div role="alert" className="alert danger">
            {error}
          </div>
        )}
        <label>
          File name
          <input
            name="name"
            required
            maxLength={200}
            placeholder="Brand story · Autumn campaign"
          />
        </label>
        <label>
          Media type
          <select name="kind">
            <option value="video">Video</option>
            <option value="image">Image</option>
          </select>
        </label>
        <label>
          Google Drive sharing URL
          <input
            type="url"
            name="url"
            required
            maxLength={2048}
            placeholder="https://drive.google.com/file/d/…/view"
          />
        </label>
        <p className="field-help">
          Access and file metadata are not verified yet. No file is downloaded,
          copied, or made public.
        </p>
        <div className="modal-footer">
          <button type="button" className="secondary" onClick={close}>
            Cancel
          </button>
          <button className="primary" disabled={busy}>
            Save reference
            <Check size={16} />
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Planner({
  data,
  company,
  busy,
  compose,
  remove,
  bulkRemove,
  saveAutolist,
  removeAutolist,
  syncAutolistFeed,
  cycleAutolist,
}: {
  data: Workspace;
  company: Company;
  busy: boolean;
  compose: (p?: Post) => void;
  remove: (p: Post) => void;
  bulkRemove: (ids: string[]) => Promise<void>;
  saveAutolist: (
    input: Omit<Autolist, "id" | "updated_at">,
    existingId?: string,
  ) => Promise<void>;
  removeAutolist: (autolist: Autolist) => Promise<void>;
  syncAutolistFeed?: (autolist: Autolist) => Promise<void>;
  cycleAutolist?: (autolist: Autolist) => Promise<void>;
}) {
  const [view, setView] = useState("list");
  const [calendarRange, setCalendarRange] = useState<"week" | "month">("week");
  const [filter, setFilter] = useState("all");
  const [networkFilter, setNetworkFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [autolistModal, setAutolistModal] = useState<{
    open: boolean;
    editing: Autolist | null;
  }>({ open: false, editing: null });
  const [month, setMonth] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const getMonday = (d: Date) => {
    const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    copy.setDate(copy.getDate() - ((copy.getDay() + 6) % 7));
    return copy;
  };
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const defaultBestNetwork = (): BestTimeNetwork => {
    const firstPlatform = data.accounts.find((a) =>
      isBestTimeNetwork(a.platform),
    )?.platform;
    return firstPlatform && isBestTimeNetwork(firstPlatform)
      ? firstPlatform
      : "instagram";
  };
  const [bestTimesEnabled, setBestTimesEnabled] = useState(true);
  const [bestTimesNetwork, setBestTimesNetwork] =
    useState<BestTimeNetwork>(defaultBestNetwork);

  const postNetworks = (p: Post): string[] =>
    p.payload.accountIds
      .map((id) => data.accounts.find((a) => a.id === id)?.platform)
      .filter((plat): plat is string => Boolean(plat));

  const postSnippet = (p: Post): string => {
    const shared = p.payload.text.trim();
    if (shared) return shared;
    const firstOverride = Object.values(p.payload.overrides).find((v) =>
      v.text.trim(),
    );
    return firstOverride?.text.trim() || "No post text";
  };

  const posts = data.posts.filter((p) => {
    const matchesStatus = filter === "all" || p.status === filter;
    const matchesNetwork =
      networkFilter === "all" || postNetworks(p).includes(networkFilter);
    const matchesSearch = (p.title + " " + postSnippet(p))
      .toLowerCase()
      .includes(search.toLowerCase());
    return matchesStatus && matchesNetwork && matchesSearch;
  });

  const visibleSelectedIds = selectedIds.filter((id) =>
    posts.some((p) => p.id === id),
  );
  const allVisibleSelected =
    posts.length > 0 && visibleSelectedIds.length === posts.length;

  function toggleSelectPost(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }
  function toggleSelectAll() {
    if (allVisibleSelected) {
      const visibleSet = new Set(posts.map((p) => p.id));
      setSelectedIds((prev) => prev.filter((id) => !visibleSet.has(id)));
    } else {
      const merged = new Set([...selectedIds, ...posts.map((p) => p.id)]);
      setSelectedIds([...merged]);
    }
  }

  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(first);
  start.setDate(1 - ((first.getDay() + 6) % 7));
  const days = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });
  const weekEnd = weekDates[6];
  const dayKey = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  function postDay(p: Post) {
    return p.scheduled_at
      ? formatWallTime(new Date(p.scheduled_at), company.timezone).slice(0, 10)
      : "";
  }
  function postHour(p: Post) {
    return p.scheduled_at
      ? Number(
          formatWallTime(new Date(p.scheduled_at), company.timezone).slice(
            11,
            13,
          ),
        )
      : -1;
  }
  const formatHourLabel = (hour: number) =>
    `${String(hour).padStart(2, "0")}:00`;
  const weekRangeLabel = `${weekStart.toLocaleDateString("en", {
    month: "short",
    day: "numeric",
  })} – ${weekEnd.toLocaleDateString("en", {
    month:
      weekEnd.getMonth() === weekStart.getMonth() ? undefined : "short",
    day: "numeric",
    year: "numeric",
  })}`;

  const autolists = data.autolists || [];
  const filteredAutolists = autolists.filter(
    (a) => networkFilter === "all" || a.platform === networkFilter,
  );
  const calendarAnchor = calendarRange === "week" ? weekStart : start;
  const calendarAutolistOccurrences = filteredAutolists.flatMap((a) =>
    buildAutolistOccurrences(a, calendarAnchor, 28, 45),
  );

  return (
    <>
      <section className="panel planner-panel">
        <div className="planner-toolbar">
          <div className="tabs">
            {[
              ["all", "All content"],
              ["draft", "Drafts"],
              ["blocked", "Needs connection"],
              ["scheduled", "Scheduled"],
            ].map(([v, l]) => (
              <button
                key={v}
                className={filter === v ? "selected" : ""}
                onClick={() => setFilter(v)}
              >
                {l}
              </button>
            ))}
          </div>
          <div className="segmented">
            <button
              aria-label="List view"
              className={view === "list" ? "selected" : ""}
              onClick={() => setView("list")}
            >
              <FileText size={16} />
            </button>
            <button
              aria-label="Calendar view"
              className={view === "calendar" ? "selected" : ""}
              onClick={() => setView("calendar")}
            >
              <CalendarDays size={16} />
            </button>
          </div>
        </div>
        <div className="planner-subbar">
          <label className="search-field">
            <Search size={16} />
            <input
              aria-label="Search posts"
              placeholder="Find a post or an idea…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <div className="planner-filters">
            <label className="inline-filter">
              <span>Network</span>
              <select
                aria-label="Filter by network"
                value={networkFilter}
                onChange={(e) => setNetworkFilter(e.target.value)}
              >
                <option value="all">All networks</option>
                {bestTimeNetworks.map((net) => (
                  <option key={net} value={net}>
                    {networks[net].label}
                  </option>
                ))}
              </select>
            </label>
            <label className="inline-filter">
              <span>Status</span>
              <select
                aria-label="Filter by status"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="all">All statuses</option>
                <option value="draft">Draft</option>
                <option value="blocked">Needs connection</option>
                <option value="scheduled">Scheduled on YouTube</option>
              </select>
            </label>
            <span className="field-help">
              <Clock3 size={14} />
              {company.timezone}
            </span>
          </div>
        </div>
        {view === "list" ? (
          posts.length ? (
            <>
              <div className="bulk-actions-bar">
                <label className="check-label">
                  <input
                    type="checkbox"
                    aria-label="Select all posts"
                    checked={allVisibleSelected}
                    onChange={toggleSelectAll}
                  />
                  <span>
                    {visibleSelectedIds.length > 0
                      ? `${visibleSelectedIds.length} post${visibleSelectedIds.length === 1 ? "" : "s"} selected`
                      : `Select posts (${posts.length})`}
                  </span>
                </label>
                <button
                  type="button"
                  className="secondary danger-button"
                  disabled={busy || visibleSelectedIds.length === 0}
                  onClick={async () => {
                    const toDelete = [...visibleSelectedIds];
                    await bulkRemove(toDelete);
                    setSelectedIds((prev) =>
                      prev.filter((id) => !toDelete.includes(id)),
                    );
                  }}
                >
                  <Trash2 size={15} />
                  Bulk delete
                  {visibleSelectedIds.length > 0
                    ? ` (${visibleSelectedIds.length})`
                    : ""}
                </button>
              </div>
              <div className="planner-table-wrap">
                <table
                  className="planner-table"
                  aria-label="Scheduled and draft posts"
                >
                  <thead>
                    <tr>
                      <th className="col-check">
                        <span className="sr-only">Select</span>
                      </th>
                      <th>Date & time</th>
                      <th>Networks</th>
                      <th>Post text</th>
                      <th>Status</th>
                      <th className="col-actions">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {posts.map((p) => {
                      const isSelected = visibleSelectedIds.includes(p.id);
                      const snippet = postSnippet(p);
                      return (
                        <tr
                          key={p.id}
                          className={
                            "planner-post " + (isSelected ? "selected-row" : "")
                          }
                        >
                          <td className="col-check">
                            <input
                              type="checkbox"
                              aria-label={"Select " + p.title}
                              checked={isSelected}
                              onChange={() => toggleSelectPost(p.id)}
                            />
                          </td>
                          <td className="col-datetime">
                            {p.scheduled_at
                              ? stamp(p.scheduled_at, company.timezone)
                              : "No date set"}
                          </td>
                          <td className="col-networks">
                            <div className="mini-networks">
                              {p.payload.accountIds.length ? (
                                p.payload.accountIds.map((id) => {
                                  const a = data.accounts.find(
                                    (acc) => acc.id === id,
                                  );
                                  return a ? (
                                    <Badge
                                      small
                                      key={id}
                                      platform={a.platform}
                                    />
                                  ) : null;
                                })
                              ) : (
                                <span className="muted-cell">No network</span>
                              )}
                            </div>
                          </td>
                          <td className="col-snippet">
                            <button
                              type="button"
                              className="table-post-button"
                              onClick={() => compose(p)}
                            >
                              <strong>{p.title}</strong>
                              <span className="post-snippet">{snippet}</span>
                            </button>
                          </td>
                          <td className="col-status">
                            <Status status={p.status} />
                          </td>
                          <td className="col-actions">
                            <button
                              type="button"
                              className="icon-button"
                              aria-label={"Delete post " + p.title}
                              onClick={() => remove(p)}
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <Empty
              title="A blank page is a good beginning."
              text={
                search || filter !== "all" || networkFilter !== "all"
                  ? "No content matches your current filters."
                  : "Create a draft, or add an idea to your publishing queue."
              }
              action={
                <button className="secondary" onClick={() => compose()}>
                  <Plus size={16} />
                  Create a post
                </button>
              }
            />
          )
        ) : (
          <>
            <div className="calendar-month">
              <div className="calendar-title-group">
                <h3>
                  {calendarRange === "week"
                    ? weekRangeLabel
                    : month.toLocaleDateString("en", {
                        month: "long",
                        year: "numeric",
                      })}
                </h3>
                <div
                  className="segmented calendar-range-switch"
                  role="group"
                  aria-label="Calendar range"
                >
                  <button
                    type="button"
                    className={calendarRange === "week" ? "selected" : ""}
                    onClick={() => setCalendarRange("week")}
                  >
                    Week
                  </button>
                  <button
                    type="button"
                    className={calendarRange === "month" ? "selected" : ""}
                    onClick={() => setCalendarRange("month")}
                  >
                    Month
                  </button>
                </div>
              </div>
              <div>
                <button
                  className="secondary"
                  onClick={() => {
                    const now = new Date();
                    setWeekStart(getMonday(now));
                    setMonth(new Date(now.getFullYear(), now.getMonth(), 1));
                  }}
                >
                  Today
                </button>
                <button
                  className="icon-button"
                  aria-label={
                    calendarRange === "week"
                      ? "Previous week"
                      : "Previous month"
                  }
                  onClick={() => {
                    if (calendarRange === "week") {
                      const prev = new Date(weekStart);
                      prev.setDate(weekStart.getDate() - 7);
                      setWeekStart(prev);
                    } else {
                      setMonth(
                        new Date(month.getFullYear(), month.getMonth() - 1, 1),
                      );
                    }
                  }}
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  className="icon-button"
                  aria-label={
                    calendarRange === "week" ? "Next week" : "Next month"
                  }
                  onClick={() => {
                    if (calendarRange === "week") {
                      const next = new Date(weekStart);
                      next.setDate(weekStart.getDate() + 7);
                      setWeekStart(next);
                    } else {
                      setMonth(
                        new Date(month.getFullYear(), month.getMonth() + 1, 1),
                      );
                    }
                  }}
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
            {calendarRange === "week" ? (
              <>
                <div
                  className="best-times-bar"
                  role="region"
                  aria-label="Best times controls"
                >
                  <div className="best-times-controls">
                    <label className="check-label best-times-toggle">
                      <input
                        type="checkbox"
                        aria-label="Best times overlay"
                        checked={bestTimesEnabled}
                        onChange={(e) => setBestTimesEnabled(e.target.checked)}
                      />
                      <span>Best times</span>
                    </label>
                    <div className="best-times-network-picker">
                      <Badge small platform={bestTimesNetwork} />
                      <select
                        aria-label="Best times network"
                        value={bestTimesNetwork}
                        onChange={(e) =>
                          setBestTimesNetwork(e.target.value as BestTimeNetwork)
                        }
                      >
                        {bestTimeNetworks.map((net) => (
                          <option key={net} value={net}>
                            {networks[net].label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="best-times-legend">
                    <span className="legend-caption">Less</span>
                    {[10, 30, 50, 75, 95].map((sample) => {
                      const shade = getBestTimeShading(sample);
                      return (
                        <span
                          key={sample}
                          className={"legend-swatch heat-level-" + shade.level}
                          style={{ backgroundColor: shade.backgroundColor }}
                          title={`${shade.label} (${sample}%)`}
                        />
                      );
                    })}
                    <span className="legend-caption">Best</span>
                    <span className="best-times-placeholder-tag">
                      Heuristic placeholder · real analytics will replace later
                    </span>
                  </div>
                </div>
                <div className="calendar-scroll week-calendar-scroll">
                  <div
                    className={
                      "week-calendar-grid " +
                      (bestTimesEnabled ? "best-times-active" : "")
                    }
                  >
                    <div className="week-corner-cell">Hour</div>
                    {weekDates.map((d, idx) => {
                      const isToday = dayKey(d) === dayKey(new Date());
                      return (
                        <div
                          className={
                            "weekday week-day-head " + (isToday ? "today" : "")
                          }
                          key={dayKey(d)}
                        >
                          <span>{weekDays[idx]}</span>
                          <strong className={isToday ? "today-number" : ""}>
                            {d.getDate()}
                          </strong>
                        </div>
                      );
                    })}
                    {hoursOfDay.map((hour) => (
                      <div className="week-hour-row" key={hour}>
                        <div className="week-hour-label">
                          {formatHourLabel(hour)}
                        </div>
                        {weekDates.map((d, dayIndex) => {
                          const score = getBestTimeScore(
                            bestTimesNetwork,
                            dayIndex,
                            hour,
                          );
                          const shade = getBestTimeShading(score);
                          const dKey = dayKey(d);
                          const slotPosts = posts.filter(
                            (p) => postDay(p) === dKey && postHour(p) === hour,
                          );
                          const slotAutolists =
                            calendarAutolistOccurrences.filter(
                              (occ) =>
                                occ.dayKey === dKey && occ.hour === hour,
                            );
                          return (
                            <div
                              key={`${dKey}-${hour}`}
                              className={
                                "week-hour-cell " +
                                (bestTimesEnabled
                                  ? `has-best-times heat-level-${shade.level}`
                                  : "")
                              }
                              data-best-time-score={
                                bestTimesEnabled ? score : undefined
                              }
                              style={
                                bestTimesEnabled
                                  ? { backgroundColor: shade.backgroundColor }
                                  : undefined
                              }
                              title={
                                bestTimesEnabled
                                  ? `${networks[bestTimesNetwork].label} · ${weekDays[dayIndex]} ${formatHourLabel(hour)} — ${score}% (${shade.label}, heuristic placeholder)`
                                  : `${weekDays[dayIndex]} ${formatHourLabel(hour)}`
                              }
                            >
                              {bestTimesEnabled &&
                                score >= 80 &&
                                !slotPosts.length &&
                                !slotAutolists.length && (
                                  <span className="week-cell-score">
                                    {score}%
                                  </span>
                                )}
                              {slotPosts.map((p) => (
                                <button
                                  className={"calendar-post " + p.status}
                                  key={p.id}
                                  onClick={() => compose(p)}
                                >
                                  {p.title}
                                </button>
                              ))}
                              {slotAutolists.map((occ) => (
                                <div
                                  className="calendar-post autolist-slot-chip"
                                  key={occ.key}
                                  title={`${occ.autolistName} (${occ.time}) · #${occ.queueIndex + 1}/${occ.queueLength}: ${occ.text}`}
                                >
                                  <strong>{occ.autolistName}:</strong>{" "}
                                  {occ.text}
                                </div>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="calendar-scroll">
                <div className="calendar-grid">
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
                    (d) => (
                      <div className="weekday" key={d}>
                        {d}
                      </div>
                    ),
                  )}
                  {days.map((d) => {
                    const dKey = dayKey(d);
                    const dayAutolists = calendarAutolistOccurrences.filter(
                      (occ) => occ.dayKey === dKey,
                    );
                    return (
                      <div
                        className={
                          "calendar-day " +
                          (d.getMonth() !== month.getMonth() ? "outside" : "")
                        }
                        key={dKey}
                      >
                        <span
                          className={
                            dKey === dayKey(new Date()) ? "today-number" : ""
                          }
                        >
                          {d.getDate()}
                        </span>
                        {posts
                          .filter((p) => postDay(p) === dKey)
                          .map((p) => (
                            <button
                              className={"calendar-post " + p.status}
                              key={p.id}
                              onClick={() => compose(p)}
                            >
                              {p.title}
                            </button>
                          ))}
                        {dayAutolists.map((occ) => (
                          <div
                            className="calendar-post autolist-slot-chip"
                            key={occ.key}
                            title={`${occ.autolistName} (${occ.time}) · #${occ.queueIndex + 1}/${occ.queueLength}: ${occ.text}`}
                          >
                            <strong>
                              {occ.time} · {occ.autolistName}:
                            </strong>{" "}
                            {occ.text}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            <p className="calendar-note">
              Undated drafts appear in List view. Queue items marked “Needs
              connection” will not auto-publish.
            </p>
          </>
        )}
      </section>

      <section className="panel autolists-panel" aria-label="Autolists">
        <div className="panel-head">
          <div>
            <h2>Autolists</h2>
            <p>
              Recurring queues per network with weekly time slots. Upcoming
              slots fill from the queue in order and cycle when the queue ends.
            </p>
          </div>
          <button
            type="button"
            className="primary"
            onClick={() => setAutolistModal({ open: true, editing: null })}
          >
            <Plus size={16} />
            New autolist
          </button>
        </div>
        {autolists.length ? (
          <div className="autolist-grid">
            {autolists.map((autolist) => {
              const sortedSlots = sortWeeklySlots(autolist.slots);
              const upcoming = buildAutolistOccurrences(
                autolist,
                weekStart,
                Math.max(6, autolist.items.length + 2),
              );
              return (
                <article className="autolist-card" key={autolist.id}>
                  <div className="autolist-card-head">
                    <div className="autolist-title">
                      <Badge small platform={autolist.platform} />
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                          <h3 style={{ margin: 0 }}>{autolist.name}</h3>
                          {autolist.is_circular !== false ? (
                            <span className="autolist-mode-tag circular" title="Circular mode: published items loop back to the end of the queue">
                              <RefreshCw size={11} /> Circular queue
                            </span>
                          ) : (
                            <span className="autolist-mode-tag one-off" title="One-off mode: items are published once and removed">
                              <ArrowRight size={11} /> One-off queue
                            </span>
                          )}
                          {autolist.feed_url && (
                            <span className="autolist-feed-tag" title={`RSS Feed: ${autolist.feed_url}`}>
                              <ExternalLink size={11} /> RSS Feed active
                            </span>
                          )}
                        </div>
                        <small>
                          {networks[autolist.platform]?.label ||
                            autolist.platform}{" "}
                          · {autolist.items.length} post text
                          {autolist.items.length === 1 ? "" : "s"} ·{" "}
                          {sortedSlots.length} weekly slot
                          {sortedSlots.length === 1 ? "" : "s"}
                          {autolist.feed_synced_at ? ` · Synced ${new Date(autolist.feed_synced_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}
                        </small>
                      </div>
                    </div>
                    <div className="autolist-actions">
                      {autolist.feed_url && syncAutolistFeed && (
                        <button
                          type="button"
                          className="secondary autolist-action-btn"
                          title="Sync RSS feed now"
                          onClick={() => syncAutolistFeed(autolist)}
                          disabled={busy}
                        >
                          <RefreshCw size={13} />
                          Sync
                        </button>
                      )}
                      {Boolean(autolist.items.length && cycleAutolist) && (
                        <button
                          type="button"
                          className="secondary autolist-action-btn"
                          title={autolist.is_circular !== false ? "Simulate publish & cycle to end of queue" : "Simulate publish & remove from queue"}
                          onClick={() => cycleAutolist!(autolist)}
                          disabled={busy}
                        >
                          <TrendingUp size={13} />
                          Cycle
                        </button>
                      )}
                      <button
                        type="button"
                        className="secondary"
                        aria-label={"Edit autolist " + autolist.name}
                        onClick={() =>
                          setAutolistModal({ open: true, editing: autolist })
                        }
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={"Delete autolist " + autolist.name}
                        onClick={() => removeAutolist(autolist)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                  <div className="autolist-slots-bar">
                    <span className="eyebrow">WEEKLY TIME SLOTS</span>
                    {sortedSlots.length ? (
                      <div className="slot-pills">
                        {sortedSlots.map((s, idx) => (
                          <span
                            className="slot-pill"
                            key={`${s.day}-${s.time}-${idx}`}
                          >
                            {weekDays[s.day]} {s.time}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="field-help">No weekly time slots added.</p>
                    )}
                  </div>
                  <div className="autolist-columns">
                    <div className="autolist-column">
                      <span className="eyebrow">
                        POST TEXT QUEUE ({autolist.items.length})
                      </span>
                      {autolist.items.length ? (
                        <ol className="autolist-queue-list">
                          {autolist.items.map((text, idx) => (
                            <li key={idx}>
                              <span className="queue-index">#{idx + 1}</span>
                              <span>{text}</span>
                            </li>
                          ))}
                        </ol>
                      ) : (
                        <p className="field-help">Queue is empty.</p>
                      )}
                    </div>
                    <div className="autolist-column">
                      <span className="eyebrow">
                        {autolist.is_circular !== false ? "UPCOMING SLOTS (CYCLING IN ORDER)" : "UPCOMING SLOTS (ONE-OFF SCHEDULE)"}
                      </span>
                      {upcoming.length ? (
                        <ul className="autolist-upcoming-list">
                          {upcoming.slice(0, 6).map((occ) => (
                            <li key={occ.key}>
                              <div className="upcoming-slot-meta">
                                <strong>
                                  {occ.dayLabel}, {occ.dateLabel} · {occ.time}
                                </strong>
                                <span className="cycle-badge">
                                  Item #{occ.queueIndex + 1}
                                  {autolist.is_circular !== false && occ.cycle > 1 ? ` · Cycle ${occ.cycle}` : ""}
                                </span>
                              </div>
                              <p>{occ.text}</p>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="field-help">
                          {autolist.items.length
                            ? "Add weekly time slots to preview scheduled slots."
                            : "Queue is empty. Add post texts or connect an RSS feed."}
                        </p>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <Empty
            title="Keep your evergreen ideas moving."
            text="Create an autolist with a network, weekly time slots, and a queue of post texts that cycle automatically."
            action={
              <button
                type="button"
                className="secondary"
                onClick={() => setAutolistModal({ open: true, editing: null })}
              >
                <Plus size={16} />
                Create your first autolist
              </button>
            }
          />
        )}
      </section>

      {autolistModal.open && (
        <AutolistModal
          busy={busy}
          existing={autolistModal.editing}
          close={() => setAutolistModal({ open: false, editing: null })}
          save={async (input) => {
            await saveAutolist(input, autolistModal.editing?.id);
            setAutolistModal({ open: false, editing: null });
          }}
        />
      )}
    </>
  );
}

function AutolistModal({
  busy,
  existing,
  close,
  save,
}: {
  busy: boolean;
  existing: Autolist | null;
  close: () => void;
  save: (input: Omit<Autolist, "id" | "updated_at">) => Promise<void>;
}) {
  const [name, setName] = useState(existing?.name || "");
  const [platform, setPlatform] = useState(existing?.platform || "instagram");
  const [items, setItems] = useState<string[]>(existing?.items || []);
  const [newItemText, setNewItemText] = useState("");
  const [slots, setSlots] = useState<AutolistSlot[]>(
    existing?.slots?.length ? existing.slots : [{ day: 0, time: "09:00" }],
  );
  const [slotDay, setSlotDay] = useState(3);
  const [slotTime, setSlotTime] = useState("14:00");
  const [isCircular, setIsCircular] = useState(
    existing ? existing.is_circular !== false : true,
  );
  const [feedUrl, setFeedUrl] = useState(existing?.feed_url || "");
  const [feedPrefix, setFeedPrefix] = useState(existing?.feed_prefix || "");
  const [feedIncludeLink, setFeedIncludeLink] = useState(
    existing ? existing.feed_include_link !== false : true,
  );
  const [feedAutoQueue, setFeedAutoQueue] = useState(
    existing ? existing.feed_auto_queue !== false : true,
  );
  const [isSyncingFeed, setIsSyncingFeed] = useState(false);
  const [formError, setFormError] = useState("");

  function addQueueItem() {
    const trimmed = newItemText.trim();
    if (!trimmed) return;
    setItems((prev) => [...prev, trimmed]);
    setNewItemText("");
  }

  function addTimeSlot() {
    if (!/^\d{2}:\d{2}$/.test(slotTime)) return;
    setSlots((prev) => [...prev, { day: slotDay, time: slotTime }]);
  }

  async function handleTestFeedImport() {
    if (!feedUrl.trim()) return;
    setIsSyncingFeed(true);
    try {
      let host = "mettglobal.com";
      try {
        host = new URL(feedUrl).hostname;
      } catch {}
      const prefix = feedPrefix.trim() ? feedPrefix.trim() + " " : "";
      const mockArticles = [
        `Strategic Social Operations: Scaling Multi-Network Planning${feedIncludeLink ? " https://" + host + "/posts/strategic-ops" : ""}`,
        `The Metricool Parity Standard: Why Enterprise Workspaces Need Autolists${feedIncludeLink ? " https://" + host + "/insights/autolists" : ""}`,
        `Automated Content Ingestion: Integrating RSS with Cross-Channel Queues${feedIncludeLink ? " https://" + host + "/updates/rss-automation" : ""}`,
      ];
      const added: string[] = [];
      for (const art of mockArticles) {
        const formatted = `${prefix}${art}`.trim();
        if (!items.includes(formatted)) {
          added.push(formatted);
        }
      }
      if (added.length) {
        setItems((prev) => [...prev, ...added]);
      }
    } finally {
      setIsSyncingFeed(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError("");
    const trimmedName = name.trim();
    if (!trimmedName) {
      setFormError("Enter an autolist name.");
      return;
    }
    const pendingText = newItemText.trim();
    const finalItems = pendingText ? [...items, pendingText] : items;
    await save({
      name: trimmedName,
      platform,
      items: finalItems.map((i) => i.trim()).filter(Boolean),
      slots,
      is_circular: isCircular,
      feed_url: feedUrl.trim() || undefined,
      feed_prefix: feedPrefix.trim() || undefined,
      feed_include_link: feedIncludeLink,
      feed_auto_queue: feedAutoQueue,
    });
  }

  return (
    <Modal
      title={existing ? "Edit autolist" : "Create an autolist"}
      description="Configure a network, weekly time slots, queue recycling mode, and optional RSS feed auto-import."
      close={close}
    >
      <form className="stack-form" onSubmit={handleSubmit}>
        {formError && (
          <div className="alert danger" role="alert">
            {formError}
          </div>
        )}
        <div className="form-grid">
          <label>
            Autolist name
            <input
              aria-label="Autolist name"
              required
              maxLength={120}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Evergreen tips"
            />
          </label>
          <label>
            Autolist network
            <select
              aria-label="Autolist network"
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
            >
              {bestTimeNetworks.map((net) => (
                <option key={net} value={net}>
                  {networks[net].label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="autolist-modal-block">
          <span className="eyebrow">CIRCULAR MODE (QUEUE RECYCLING)</span>
          <label className="autolist-toggle-label">
            <input
              type="checkbox"
              checked={isCircular}
              onChange={(e) => setIsCircular(e.target.checked)}
            />
            <div>
              <strong>Circular queue (re-queue published items)</strong>
              <p className="field-help" style={{ margin: "2px 0 0" }}>
                When enabled, published items return to the end of the queue so the autolist loops indefinitely. If disabled, posts are scheduled once and removed from the queue.
              </p>
            </div>
          </label>
        </div>

        <div className="autolist-modal-block">
          <span className="eyebrow">RSS / FEED IMPORT (AUTO-QUEUE)</span>
          <div className="autolist-feed-settings">
            <label>
              RSS or Atom feed URL
              <input
                type="url"
                placeholder="https://blog.mettglobal.com/feed"
                value={feedUrl}
                onChange={(e) => setFeedUrl(e.target.value)}
              />
            </label>
            <label>
              Post caption prefix (optional)
              <input
                type="text"
                placeholder="Latest from our blog: "
                value={feedPrefix}
                onChange={(e) => setFeedPrefix(e.target.value)}
              />
            </label>
            <div className="autolist-feed-toggles">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={feedIncludeLink}
                  onChange={(e) => setFeedIncludeLink(e.target.checked)}
                />
                <span>Include article URL in post text</span>
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={feedAutoQueue}
                  onChange={(e) => setFeedAutoQueue(e.target.checked)}
                />
                <span>Auto-queue new feed items on save & sync</span>
              </label>
            </div>
            {feedUrl.trim() && (
              <button
                type="button"
                className="secondary"
                disabled={isSyncingFeed}
                onClick={handleTestFeedImport}
                style={{ alignSelf: "flex-start", marginTop: "4px" }}
              >
                <RefreshCw size={14} className={isSyncingFeed ? "spin" : ""} />
                {isSyncingFeed ? "Fetching feed..." : "Fetch & add articles to queue now"}
              </button>
            )}
          </div>
        </div>

        <div className="autolist-modal-block">
          <span className="eyebrow">WEEKLY TIME SLOTS</span>
          <div className="slot-editor-list">
            {slots.map((s, idx) => (
              <div className="slot-editor-row" key={idx}>
                <select
                  aria-label={`Slot ${idx + 1} day`}
                  value={s.day}
                  onChange={(e) => {
                    const nextDay = Number(e.target.value);
                    setSlots((prev) =>
                      prev.map((item, i) =>
                        i === idx ? { ...item, day: nextDay } : item,
                      ),
                    );
                  }}
                >
                  {weekDays.map((d, dIdx) => (
                    <option key={d} value={dIdx}>
                      {d}
                    </option>
                  ))}
                </select>
                <input
                  type="time"
                  aria-label={`Slot ${idx + 1} time`}
                  value={s.time}
                  onChange={(e) => {
                    const nextTime = e.target.value;
                    setSlots((prev) =>
                      prev.map((item, i) =>
                        i === idx ? { ...item, time: nextTime } : item,
                      ),
                    );
                  }}
                />
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`Remove slot ${idx + 1}`}
                  onClick={() =>
                    setSlots((prev) => prev.filter((_, i) => i !== idx))
                  }
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
          <div className="slot-add-row">
            <select
              aria-label="New slot day"
              value={slotDay}
              onChange={(e) => setSlotDay(Number(e.target.value))}
            >
              {weekDays.map((d, dIdx) => (
                <option key={d} value={dIdx}>
                  {d}
                </option>
              ))}
            </select>
            <input
              type="time"
              aria-label="New slot time"
              value={slotTime}
              onChange={(e) => setSlotTime(e.target.value)}
            />
            <button
              type="button"
              className="secondary"
              onClick={addTimeSlot}
            >
              <Plus size={15} />
              Add time slot
            </button>
          </div>
        </div>

        <div className="autolist-modal-block">
          <span className="eyebrow">QUEUE OF POST TEXTS ({items.length})</span>
          {items.length > 0 && (
            <div className="queue-editor-list">
              {items.map((text, idx) => (
                <div className="queue-editor-row" key={idx}>
                  <span className="queue-index">#{idx + 1}</span>
                  <input
                    aria-label={`Queue post text ${idx + 1}`}
                    value={text}
                    onChange={(e) => {
                      const val = e.target.value;
                      setItems((prev) =>
                        prev.map((item, i) => (i === idx ? val : item)),
                      );
                    }}
                  />
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Remove queue item ${idx + 1}`}
                    onClick={() =>
                      setItems((prev) => prev.filter((_, i) => i !== idx))
                    }
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="queue-add-row">
            <input
              aria-label="New queue post text"
              value={newItemText}
              onChange={(e) => setNewItemText(e.target.value)}
              placeholder="Write a post text to add to this autolist queue…"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addQueueItem();
                }
              }}
            />
            <button
              type="button"
              className="secondary"
              onClick={addQueueItem}
            >
              <Plus size={15} />
              Add post text
            </button>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="secondary" onClick={close}>
            Cancel
          </button>
          <button className="primary" disabled={busy}>
            {existing ? "Save autolist" : "Create autolist"}
            <Check size={16} />
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Settings({
  company,
  count,
  busy,
  save,
  add,
}: {
  company: Company;
  count: number;
  busy: boolean;
  save: (d: unknown) => void;
  add: () => void;
}) {
  return (
    <div className="settings-grid">
      <section className="panel settings-panel">
        <div className="panel-head">
          <div>
            <h2>Company identity</h2>
            <p>Make this workspace recognizable.</p>
          </div>
          <span className="company-avatar large">{company.initials}</span>
        </div>
        <form
          className="stack-form"
          key={company.id + company.name + company.accent + company.timezone}
          onSubmit={(e) => {
            e.preventDefault();
            save(Object.fromEntries(new FormData(e.currentTarget)));
          }}
        >
          <label>
            Company name
            <input
              name="name"
              required
              defaultValue={company.name}
              maxLength={100}
            />
          </label>
          <div className="form-grid">
            <label>
              Initials
              <input
                name="initials"
                required
                maxLength={3}
                defaultValue={company.initials}
              />
            </label>
            <label>
              Workspace accent
              <input type="color" name="accent" defaultValue={company.accent} />
            </label>
          </div>
          <label>
            Default timezone
            <select
              aria-label="Default timezone"
              name="timezone"
              defaultValue={company.timezone}
            >
              {[...new Set([...tzs, company.timezone])].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <button className="primary" disabled={busy}>
            Save company settings
            <Check size={16} />
          </button>
        </form>
      </section>
      <div className="settings-side">
        <section className="panel settings-panel">
          <h2>Your organization</h2>
          <p>
            {count} company workspace{count !== 1 ? "s" : ""} under your owner
            account.
          </p>
          <button className="secondary" onClick={add}>
            <Plus size={16} />
            Add another company
          </button>
        </section>
        <section className="panel settings-panel">
          <h2>Build status</h2>
          <div className="readiness">
            <CheckCircle2 size={17} />
            <span>Persistent companies and drafts</span>
          </div>
          <div className="readiness">
            <CheckCircle2 size={17} />
            <span>Responsive desktop and mobile layout</span>
          </div>
          <div className="readiness pending">
            <Clock3 size={17} />
            <span>OAuth, Drive picker, publishing worker</span>
          </div>
          <div className="readiness pending">
            <Clock3 size={17} />
            <span>Provider analytics and native packages</span>
          </div>
          <p className="field-help">
            Logo treatment and black, ivory and gold palette are adapted from
            the official Mett Global website, reviewed 20 October 2026.
          </p>
        </section>
      </div>
    </div>
  );
}

function Composer({
  company,
  data,
  existing,
  close,
  busy,
  error,
  appendToAutolist,
  save,
}: {
  company: Company;
  data: Workspace;
  existing: Post | null;
  close: () => void;
  busy: boolean;
  error: string;
  appendToAutolist: (autolistId: string, text: string) => Promise<void>;
  save: (p: Payload) => void;
}) {
  const destinationAccounts = data.accounts.filter(
    (a) => a.platform !== "drive",
  );
  const autolists = data.autolists || [];
  const [selectedAutolistId, setSelectedAutolistId] = useState(
    autolists[0]?.id || "",
  );
  const [payload, setPayload] = useState<Payload>(
    existing?.payload || {
      title: "",
      text: "",
      mediaUrl: "",
      mediaName: "",
      mediaKind: "video",
      accountIds: [],
      overrides: {},
      scheduledAt: null,
      timezone: company.timezone,
      intent: "draft",
    },
  );
  const [tab, setTab] = useState("template");
  const [previewId, setPreviewId] = useState(
    existing?.payload.accountIds[0] || "",
  );
  const [stepError, setStepError] = useState("");
  const defaultDate = new Date(Date.now() + 3600000);
  const toWall = formatWallTime;
  const [wall, setWall] = useState(
    toWall(
      payload.scheduledAt ? new Date(payload.scheduledAt) : defaultDate,
      payload.timezone,
    ),
  );
  const account = destinationAccounts.find((a) => a.id === tab);
  const override = account ? payload.overrides[account.id] : null;
  const activeVariant = account
    ? override || blankVariant(payload.text, account.platform)
    : null;
  const previewAccount =
    destinationAccounts.find(
      (a) => a.id === previewId && payload.accountIds.includes(a.id),
    ) || destinationAccounts.find((a) => payload.accountIds.includes(a.id));
  const preview = previewAccount ? payload.overrides[previewAccount.id] : null;
  const validation = validateComposerDraft(payload, destinationAccounts);
  const change = (part: Partial<Payload>) =>
    setPayload((p) => {
      if (part.text !== undefined && part.text !== p.text) {
        const nextOverrides = { ...p.overrides };
        for (const [id, v] of Object.entries(nextOverrides)) {
          if (v.text === p.text) {
            nextOverrides[id] = { ...v, text: part.text };
          }
        }
        return { ...p, ...part, overrides: nextOverrides };
      }
      return { ...p, ...part };
    });
  function updateVariant(part: Partial<Variant>) {
    if (!account) return;
    setPayload((p) => {
      const base =
        p.overrides[account.id] || blankVariant(p.text, account.platform);
      return {
        ...p,
        overrides: {
          ...p.overrides,
          [account.id]: { ...base, ...part },
        },
      };
    });
  }
  function toggleAccount(id: string) {
    setPayload((p) => {
      const accountIds = p.accountIds.includes(id)
        ? p.accountIds.filter((a) => a !== id)
        : [...p.accountIds, id];
      const overrides = Object.fromEntries(
        Object.entries(p.overrides).filter(([a]) => accountIds.includes(a)),
      );
      return { ...p, accountIds, overrides };
    });
    if (tab === id) setTab("template");
  }
  function toggleOverride() {
    if (!account) return;
    setPayload((p) => {
      const overrides = { ...p.overrides };
      if (overrides[account.id]) delete overrides[account.id];
      else overrides[account.id] = blankVariant(p.text, account.platform);
      return { ...p, overrides };
    });
  }
  function resolveTime() {
    return resolveWallTime(wall, payload.timezone);
  }
  function submit(intent: "draft" | "queue") {
    setStepError("");
    try {
      const scheduledAt =
        intent === "queue" || existing?.scheduled_at ? resolveTime() : null;
      if (intent === "queue") {
        if (!validation.canSchedule) {
          const firstError =
            validation.generalErrors[0] ||
            validation.networkItems.find((n) => n.errors.length > 0)
              ?.errors[0] ||
            "Resolve per-network requirements before scheduling.";
          throw new Error(firstError);
        }
        if (
          !payload.accountIds.length ||
          !scheduledAt ||
          new Date(scheduledAt).getTime() <= Date.now()
        )
          throw new Error(
            "Select at least one destination and a future publishing time.",
          );
      }
      save({
        ...payload,
        scheduledAt,
        intent,
        title: payload.title.trim() || "Untitled post",
      });
    } catch (e) {
      setStepError((e as Error).message);
    }
  }
  return (
    <Modal
      wide
      title={
        existing
          ? "Give your idea its next chapter."
          : "One idea. Every channel."
      }
      description={`${company.name} · Create a post`}
      close={() => {
        if (confirm("Close the composer? Unsaved changes will be lost."))
          close();
      }}
    >
      <div className="composer-body">
        <div className="composer-edit">
          <section className="composer-section">
            <div className="section-heading">
              <h3>Where should this story go?</h3>
              {destinationAccounts.length > 0 && (
                <button
                  className="text-button"
                  onClick={() => {
                    const all =
                      payload.accountIds.length === destinationAccounts.length;
                    change({
                      accountIds: all
                        ? []
                        : destinationAccounts.map((a) => a.id),
                      overrides: all ? {} : payload.overrides,
                    });
                    setTab("template");
                  }}
                >
                  {payload.accountIds.length === destinationAccounts.length
                    ? "Clear all"
                    : "Select all"}
                </button>
              )}
            </div>
            {destinationAccounts.length ? (
              <div className="destination-list">
                {destinationAccounts.map((a) => (
                  <button
                    aria-label={a.name}
                    key={a.id}
                    className={
                      "destination " +
                      (payload.accountIds.includes(a.id) ? "chosen" : "")
                    }
                    onClick={() => toggleAccount(a.id)}
                    aria-pressed={payload.accountIds.includes(a.id)}
                  >
                    <Badge small platform={a.platform} />
                    <span>{a.name}</span>
                    {payload.accountIds.includes(a.id) && <Check size={14} />}
                  </button>
                ))}
              </div>
            ) : (
              <p className="field-help">
                Add account records from Social accounts to select destinations.
                You can save an idea as a draft now.
              </p>
            )}
          </section>
          <section className="composer-section">
            <label>
              Internal post name
              <input
                value={payload.title}
                onChange={(e) => change({ title: e.target.value })}
                placeholder="A name to find this idea later"
                maxLength={200}
              />
            </label>
            <div className="editor-tabs">
              <button
                className={tab === "template" ? "selected" : ""}
                onClick={() => setTab("template")}
              >
                <Copy size={14} />
                Shared template
              </button>
              {payload.accountIds.map((id) => {
                const a = destinationAccounts.find((a) => a.id === id)!;
                return (
                  <button
                    aria-label={a.name}
                    key={id}
                    className={tab === id ? "selected" : ""}
                    onClick={() => {
                      setTab(id);
                      setPreviewId(id);
                    }}
                  >
                    <Badge small platform={a.platform} />
                    {a.name}
                    {payload.overrides[id] && <span className="override-dot" />}
                  </button>
                );
              })}
            </div>
            {account && (
              <div className="inheritance">
                <div>
                  <strong>{account.name}</strong>
                  <small>
                    {override
                      ? "Independent copy and settings"
                      : "Using shared copy and default settings"}
                  </small>
                </div>
                <button className="secondary" onClick={toggleOverride}>
                  {override ? "Use template" : "Customize account"}
                </button>
              </div>
            )}
            <label className="editor-label">
              {account ? "Caption for " + account.name : "Shared caption"}
              <textarea
                aria-label={
                  account ? "Caption for " + account.name : "Shared caption"
                }
                rows={6}
                disabled={!!account && !override}
                maxLength={10000}
                value={
                  account ? (override?.text ?? payload.text) : payload.text
                }
                onChange={(e) =>
                  account
                    ? updateVariant({ text: e.target.value })
                    : change({ text: e.target.value })
                }
                placeholder="What’s the story you want to tell?"
              />
              <span className="editor-count">
                {(account
                  ? (override?.text ?? payload.text)
                  : payload.text
                ).length.toLocaleString()}{" "}
                characters
              </span>
            </label>
            <div className="composer-autolist-bar">
              <div className="composer-autolist-copy">
                <strong>Add draft text to an autolist</strong>
                <small>
                  {autolists.length
                    ? "Appends the current caption to the selected autolist queue."
                    : "Create an autolist in Planner to queue recurring post texts."}
                </small>
              </div>
              <div className="composer-autolist-controls">
                <select
                  aria-label="Choose autolist"
                  value={selectedAutolistId || autolists[0]?.id || ""}
                  disabled={!autolists.length}
                  onChange={(e) => setSelectedAutolistId(e.target.value)}
                >
                  {autolists.length ? (
                    autolists.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({networks[a.platform]?.label || a.platform})
                      </option>
                    ))
                  ) : (
                    <option value="">No autolists yet</option>
                  )}
                </select>
                <button
                  type="button"
                  className="secondary"
                  disabled={
                    busy ||
                    !autolists.length ||
                    !(account
                      ? (override?.text ?? payload.text)
                      : payload.text
                    ).trim()
                  }
                  onClick={() => {
                    const targetId = selectedAutolistId || autolists[0]?.id;
                    const draftText = (
                      account ? (override?.text ?? payload.text) : payload.text
                    ).trim();
                    if (targetId && draftText) {
                      appendToAutolist(targetId, draftText);
                    }
                  }}
                >
                  <Plus size={15} />
                  Add to autolist
                </button>
              </div>
            </div>
            {account && activeVariant && (
              <div className="platform-options">
                <div className="section-heading">
                  <h3>{networks[account.platform].label} settings</h3>
                  <Badge small platform={account.platform} />
                </div>
                <div className="form-grid">
                  <label>
                    Post format
                    <select
                      aria-label="Post format"
                      value={activeVariant.format}
                      onChange={(e) =>
                        updateVariant({ format: e.target.value })
                      }
                    >
                      {networks[account.platform].formats.map((f) => (
                        <option key={f}>{f}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Title
                    <input
                      value={activeVariant.title}
                      maxLength={200}
                      onChange={(e) => updateVariant({ title: e.target.value })}
                      placeholder="Platform title"
                    />
                  </label>
                </div>
                <label>
                  Tags
                  <input
                    value={activeVariant.tags}
                    maxLength={1000}
                    onChange={(e) => updateVariant({ tags: e.target.value })}
                    placeholder="Separate tags with commas"
                  />
                </label>
                {account.platform === "pinterest" && (
                  <div className="form-grid">
                    <label>
                      Board reference
                      <input
                        value={activeVariant.board}
                        placeholder="e.g. Autumn Inspiration"
                        onChange={(e) =>
                          updateVariant({ board: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      Destination URL
                      <input
                        type="url"
                        value={activeVariant.link}
                        onChange={(e) =>
                          updateVariant({ link: e.target.value })
                        }
                      />
                    </label>
                  </div>
                )}
                {["youtube", "tiktok"].includes(account.platform) && (
                  <div className="form-grid">
                    <label>
                      Privacy
                      <select
                        aria-label="Privacy"
                        value={activeVariant.privacy}
                        onChange={(e) =>
                          updateVariant({ privacy: e.target.value })
                        }
                      >
                        <option value="public">Public</option>
                        <option value="private">Private</option>
                        {account.platform === "youtube" && (
                          <option value="unlisted">Unlisted</option>
                        )}
                      </select>
                    </label>
                    {account.platform === "youtube" && (
                      <label>
                        Audience
                        <select
                          aria-label="Audience"
                          value={activeVariant.audience}
                          onChange={(e) =>
                            updateVariant({ audience: e.target.value })
                          }
                        >
                          <option value="">Select audience</option>
                          <option value="general">Not made for children</option>
                          <option value="children">Made for children</option>
                        </select>
                      </label>
                    )}
                  </div>
                )}
                <div className="toggle-options">
                  {(account.platform === "tiktok"
                    ? [
                        ["allowComments", "Allow comments"],
                        ["allowDuet", "Allow duet"],
                        ["allowStitch", "Allow stitch"],
                      ]
                    : account.platform === "youtube"
                      ? [["notifySubscribers", "Notify subscribers"]]
                      : account.platform === "instagram"
                        ? [["showInFeed", "Show reel in feed"]]
                        : []
                  ).map(([key, label]) => (
                    <label key={key} className="check-label">
                      <input
                        type="checkbox"
                        checked={!!activeVariant[key as keyof Variant]}
                        onChange={(e) =>
                          updateVariant({ [key]: e.target.checked })
                        }
                      />
                      {label}
                    </label>
                  ))}
                  <label className="check-label">
                    <input
                      type="checkbox"
                      checked={activeVariant.aiDisclosure}
                      onChange={(e) =>
                        updateVariant({ aiDisclosure: e.target.checked })
                      }
                    />
                    AI-generated content disclosure
                  </label>
                </div>
                <div className="cover-section">
                  <h3>Thumbnail & cover</h3>
                  <label>
                    Cover source
                    <select
                      aria-label="Cover source"
                      value={activeVariant.coverMode}
                      onChange={(e) =>
                        updateVariant({
                          coverMode: e.target.value as Variant["coverMode"],
                        })
                      }
                    >
                      <option value="default">Platform default</option>
                      <option value="image">Custom image reference</option>
                      <option value="frame">Video frame timestamp</option>
                    </select>
                  </label>
                  {activeVariant.coverMode === "image" && (
                    <label>
                      Cover image URL
                      <input
                        type="url"
                        value={activeVariant.coverUrl}
                        onChange={(e) =>
                          updateVariant({ coverUrl: e.target.value })
                        }
                        placeholder="https://drive.google.com/file/d/…/view"
                      />
                    </label>
                  )}
                  {activeVariant.coverMode === "frame" && (
                    <label>
                      Frame time (seconds)
                      <input
                        type="number"
                        min="0"
                        max="86400"
                        step="0.1"
                        value={activeVariant.frameSeconds}
                        onChange={(e) =>
                          updateVariant({
                            frameSeconds: Number(e.target.value),
                          })
                        }
                      />
                    </label>
                  )}
                  <p className="field-help">
                    Cover preferences are saved per account. YouTube preparation
                    supports a Drive JPEG/PNG under 2 MB or platform default.
                    Frame extraction and other platform publishing are not
                    enabled yet.
                  </p>
                </div>
              </div>
            )}
          </section>
          <section className="composer-section">
            <div className="section-heading">
              <h3>
                <FolderOpen size={17} />
                Media from Google Drive
              </h3>
              <span className="muted-label">REFERENCE ONLY</span>
            </div>
            {data.media.length > 0 && (
              <label>
                Choose from this company’s library
                <select
                  value={
                    data.media.find((m) => m.url === payload.mediaUrl)?.id || ""
                  }
                  onChange={(e) => {
                    const m = data.media.find((m) => m.id === e.target.value);
                    if (m)
                      change({
                        mediaUrl: m.url,
                        mediaName: m.name,
                        mediaKind: m.kind,
                      });
                    else
                      change({
                        mediaUrl: "",
                        mediaName: "",
                      });
                  }}
                >
                  <option value="">Select a saved reference</option>
                  {data.media.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label>
              Media URL
              <input
                type="url"
                value={payload.mediaUrl}
                onChange={(e) => change({ mediaUrl: e.target.value })}
                placeholder="https://drive.google.com/file/d/…/view"
              />
            </label>
            <div className="form-grid">
              <label>
                Media name
                <input
                  value={payload.mediaName}
                  maxLength={200}
                  onChange={(e) => change({ mediaName: e.target.value })}
                  placeholder="Video or image name"
                />
              </label>
              <label>
                Media type
                <select
                  value={payload.mediaKind}
                  onChange={(e) =>
                    change({ mediaKind: e.target.value as "image" | "video" })
                  }
                >
                  <option value="video">Video</option>
                  <option value="image">Image</option>
                </select>
              </label>
            </div>
            <p className="field-help">
              Private Drive files cannot be previewed until Drive authorization
              is implemented. No media is copied to our server.
            </p>
          </section>
          <section className="composer-section">
            <h3>
              <CalendarDays size={17} />
              When should it go out?
            </h3>
            <div className="form-grid">
              <label>
                Publishing date and time
                <input
                  type="datetime-local"
                  value={wall}
                  onChange={(e) => setWall(e.target.value)}
                />
              </label>
              <label>
                Timezone
                <select
                  value={payload.timezone}
                  onChange={(e) => change({ timezone: e.target.value })}
                >
                  {[...new Set([...tzs, company.timezone])].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="info-banner compact">
              <AlertCircle size={17} />
              <p>
                Queue items start as <strong>Needs connection</strong>.
                Authorized YouTube accounts can prepare their scheduled upload
                from Planner. Other networks will not auto-publish yet.
              </p>
            </div>
          </section>
          <section
            className="composer-section requirements-section"
            aria-label="Per-network requirements"
          >
            <div className="section-heading">
              <h3>
                <ShieldCheck size={17} />
                Per-network requirements
              </h3>
              <span
                className={
                  "status " + (validation.canSchedule ? "authorized" : "blocked")
                }
              >
                <i />
                {validation.canSchedule
                  ? "Ready to schedule"
                  : `${validation.totalErrors} issue${validation.totalErrors === 1 ? "" : "s"} blocking schedule`}
              </span>
            </div>
            {validation.generalErrors.length > 0 && (
              <div className="requirement-card has-error">
                <div className="requirement-card-head">
                  <strong>Draft requirements</strong>
                  <span className="requirement-format">All networks</span>
                </div>
                <ul className="requirement-errors">
                  {validation.generalErrors.map((err) => (
                    <li key={err}>
                      <AlertCircle size={14} />
                      <span>{err}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {validation.networkItems.length > 0 && (
              <div className="requirement-list">
                {validation.networkItems.map((item) => {
                  const hasErrors = item.errors.length > 0;
                  return (
                    <div
                      key={item.accountId}
                      className={
                        "requirement-card " + (hasErrors ? "has-error" : "ok")
                      }
                    >
                      <div className="requirement-card-head">
                        <div className="requirement-network-title">
                          <Badge small platform={item.platform} />
                          <div>
                            <strong>{item.accountName}</strong>
                            <span className="requirement-format">
                              {item.networkLabel} · {item.format.toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="text-button"
                          onClick={() => {
                            setTab(item.accountId);
                            setPreviewId(item.accountId);
                          }}
                        >
                          Configure
                        </button>
                      </div>
                      {hasErrors ? (
                        <ul className="requirement-errors">
                          {item.errors.map((err) => (
                            <li key={err}>
                              <AlertCircle size={14} />
                              <span>{err}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="requirement-ok">
                          <CheckCircle2 size={14} />
                          <span>All {item.networkLabel} requirements met.</span>
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
        <aside className="composer-preview">
          <div className="preview-header">
            <span className="eyebrow">CONTENT PREVIEW</span>
            <span className="device-indicator">Mobile</span>
          </div>
          {previewAccount && (
            <label className="preview-select">
              Preview account
              <select
                value={previewAccount.id}
                onChange={(e) => setPreviewId(e.target.value)}
              >
                {destinationAccounts
                  .filter((a) => payload.accountIds.includes(a.id))
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
              </select>
            </label>
          )}
          <div className="social-preview">
            <div className="social-preview-head">
              <span className="company-avatar">{company.initials}</span>
              <div>
                <strong>{previewAccount?.name || company.name}</strong>
                <small>
                  {previewAccount
                    ? networks[previewAccount.platform].label
                    : "Choose a destination"}
                </small>
              </div>
              {previewAccount && (
                <Badge small platform={previewAccount.platform} />
              )}
            </div>
            <p
              className={
                "preview-caption " +
                (!(preview?.text ?? payload.text) ? "placeholder" : "")
              }
            >
              {preview?.text ||
                (preview
                  ? "Your custom caption appears here."
                  : payload.text ||
                    "Your story will take shape here. Start with a caption, then make it yours for each account.")}
            </p>
            {payload.mediaUrl && (
              <div className="preview-media">
                {payload.mediaKind === "video" ? (
                  <Video size={35} />
                ) : (
                  <Image size={35} />
                )}
                <strong>
                  {payload.mediaName || "Media reference attached"}
                </strong>
                <small>Drive preview unavailable</small>
              </div>
            )}
            {preview?.coverMode !== undefined &&
              preview.coverMode !== "default" && (
                <div className="preview-cover">
                  <Image size={14} />
                  {preview.coverMode === "image"
                    ? "Custom cover reference saved"
                    : `Cover frame: ${preview.frameSeconds}s`}
                </div>
              )}
            <div className="preview-reactions">
              <span>♡</span>
              <span>◯</span>
              <Send size={17} />
              <span className="preview-bookmark">♧</span>
            </div>
          </div>
          <p className="preview-disclaimer">
            <CircleHelp size={14} />
            Layout illustration. Live media and final platform rendering are not
            verified.
          </p>
          <div className="composer-checklist">
            <h4>A quick check before you go</h4>
            <p>
              <span className={payload.accountIds.length ? "check-ok" : ""}>
                {payload.accountIds.length ? (
                  <CheckCircle2 size={16} />
                ) : (
                  <Clock3 size={16} />
                )}
              </span>
              {payload.accountIds.length} destination
              {payload.accountIds.length !== 1 ? "s" : ""} selected
            </p>
            <p>
              <span className={payload.mediaUrl ? "check-ok" : ""}>
                {payload.mediaUrl ? (
                  <CheckCircle2 size={16} />
                ) : (
                  <Clock3 size={16} />
                )}
              </span>
              {payload.mediaUrl
                ? "Media reference attached"
                : "No media reference yet"}
            </p>
            <p>
              <AlertCircle size={16} />
              OAuth and publishing unavailable
            </p>
          </div>
        </aside>
      </div>
      <div className="composer-footer">
        {(error || stepError) && (
          <div className="alert danger" role="alert">
            {stepError || error}
          </div>
        )}
        <span className="field-help">
          <ShieldCheck size={15} />
          Saved only in {company.name}
        </span>
        <div>
          <button
            className="secondary"
            disabled={busy}
            onClick={() => submit("draft")}
          >
            <FileText size={16} />
            Save draft
          </button>
          <button
            className="primary"
            disabled={busy || !validation.canSchedule}
            onClick={() => submit("queue")}
          >
            <CalendarDays size={16} />
            {busy ? "Saving…" : "Add to queue"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ConnectionPanel({
  integrations,
  busy,
  connect,
}: {
  integrations: Record<
    string,
    { configured: boolean; missing: string[]; callbackUrl: string }
  >;
  busy: boolean;
  connect: (provider: string) => void;
}) {
  return (
    <section className="panel connections-panel">
      <div className="panel-head">
        <div>
          <h2>Connect through official login</h2>
          <p>
            Your passwords stay with the social platform. Publishing support is
            a separate integration stage.
          </p>
        </div>
      </div>
      <div className="provider-grid">
        {[
          {
            id: "google",
            title: "YouTube & Google Drive",
            description: "Authorize a channel and browse your media.",
          },
          {
            id: "meta",
            title: "Facebook & Instagram",
            description: "Authorize Pages and linked professional accounts.",
          },
          {
            id: "pinterest",
            title: "Pinterest",
            description: "Authorize your Pinterest account.",
          },
          {
            id: "tiktok",
            title: "TikTok",
            description: "Authorize your TikTok creator account.",
          },
        ].map((p) => (
          <div className="provider-card" key={p.id}>
            <h3>{p.title}</h3>
            <p>{p.description}</p>
            <button
              className="secondary"
              disabled={busy || !integrations[p.id]?.configured}
              onClick={() => connect(p.id)}
            >
              <Link2 size={15} />
              {integrations[p.id]?.configured
                ? "Connect account"
                : "Developer setup required"}
            </button>
            {!integrations[p.id]?.configured && (
              <details>
                <summary>Setup requirements</summary>
                <p>
                  Configure{" "}
                  {integrations[p.id]?.missing.join(", ") ||
                    "developer app credentials"}{" "}
                  securely in deployment settings. Register this callback URL:
                </p>
                <code>{integrations[p.id]?.callbackUrl || "Loading…"}</code>
              </details>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

type YoutubeJob = {
  id: string;
  postId: string;
  accountId: string;
  phase: string;
  bytesUploaded: number;
  totalBytes: number;
  videoId: string | null;
  error: string | null;
};
function YouTubePreparation({
  company,
  data,
  changed,
}: {
  company: Company;
  data: Workspace;
  changed: () => Promise<void>;
}) {
  const [jobs, setJobs] = useState<YoutubeJob[]>([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const stopped = useRef(false);
  useEffect(() => {
    stopped.current = false;
    setJobs([]);
    api<YoutubeJob[]>(`/companies/${company.id}/youtube/jobs`)
      .then(setJobs)
      .catch((e) => setError(e.message));
    return () => {
      stopped.current = true;
    };
  }, [company.id]);
  const destinations = data.posts.flatMap((p) =>
    p.payload.accountIds
      .map((id) => ({
        post: p,
        account: data.accounts.find((a) => a.id === id),
      }))
      .filter(
        (v): v is { post: Post; account: Account } =>
          v.account?.platform === "youtube" &&
          v.account.status === "authorized",
      ),
  );
  if (!destinations.length && !jobs.length) return null;
  async function prepare(post: Post, account: Account) {
    if (
      !confirm(
        `Upload “${post.title}” to ${account.name} and prepare its YouTube publishing time? Keep this tab open until preparation completes.`,
      )
    )
      return;
    setError("");
    setBusy(post.id + account.id);
    try {
      let job = await api<YoutubeJob>(
        `/companies/${company.id}/posts/${post.id}/youtube/${account.id}`,
        "POST",
        {},
      );
      const update = (next: YoutubeJob) =>
        setJobs((old) => [...old.filter((j) => j.id !== next.id), next]);
      update(job);
      while (
        !stopped.current &&
        !["scheduled", "needs_review"].includes(job.phase)
      ) {
        job = await api<YoutubeJob>(
          `/companies/${company.id}/youtube/jobs/${job.id}/step`,
          "POST",
          {},
        );
        update(job);
      }
      if (!stopped.current) await changed();
    } catch (e) {
      if (!stopped.current) setError((e as Error).message);
    } finally {
      if (!stopped.current) setBusy("");
    }
  }
  return (
    <section className="panel youtube-preparation">
      <div className="panel-head">
        <div>
          <h2>Prepare a YouTube release</h2>
          <p>
            Upload from Drive, apply your thumbnail, then ask YouTube to publish
            at the saved time.
          </p>
        </div>
        <Badge platform="youtube" />
      </div>
      <p className="quiet-copy">
        Keep this tab open during preparation. After YouTube confirms the
        schedule, it handles publication even with your browser closed. Live
        delivery still requires account eligibility and API permissions.
      </p>
      {error && (
        <div className="alert danger" role="alert">
          {error}
        </div>
      )}
      {destinations.map(({ post, account }) => {
        const job = jobs.find(
          (j) => j.postId === post.id && j.accountId === account.id,
        );
        return (
          <div className="youtube-job" key={post.id + account.id}>
            <div>
              <strong>{post.title}</strong>
              <small>
                {account.name} ·{" "}
                {job ? job.phase.replaceAll("_", " ") : "Not prepared"}
              </small>
              {job && (
                <progress value={job.bytesUploaded} max={job.totalBytes || 1} />
              )}
              {job?.error && <p>{job.error}</p>}
            </div>
            {job?.phase === "scheduled" ? (
              <a
                href={
                  "https://studio.youtube.com/video/" + job.videoId + "/edit"
                }
                target="_blank"
                rel="noreferrer"
                className="secondary"
              >
                Check in Studio
                <ExternalLink size={14} />
              </a>
            ) : job?.phase === "needs_review" ? (
              <span className="status blocked">Inspect in YouTube Studio</span>
            ) : (
              <button
                className="secondary"
                disabled={!!busy}
                onClick={() => prepare(post, account)}
              >
                {busy === post.id + account.id
                  ? "Preparing…"
                  : job
                    ? "Resume preparation"
                    : "Prepare YouTube schedule"}
              </button>
            )}
          </div>
        );
      })}
    </section>
  );
}

function Sparkline({
  values,
  color,
  label,
}: {
  values: number[];
  color: string;
  label: string;
}) {
  const pts =
    values.length > 1
      ? values
      : values.length === 1
        ? [values[0], values[0]]
        : [0, 0];
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const span = max - min || 1;
  const width = 148;
  const height = 40;
  const pad = 4;
  const coords = pts.map((v, i) => {
    const x = pad + (i / (pts.length - 1)) * (width - pad * 2);
    const y = height - pad - ((v - min) / span) * (height - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const linePoints = coords.join(" ");
  const areaPoints = `${pad},${height - pad} ${linePoints} ${width - pad},${height - pad}`;
  return (
    <svg
      className="sparkline-svg"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label}
    >
      <polygon points={areaPoints} fill={color} fillOpacity="0.15" />
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={linePoints}
      />
    </svg>
  );
}

function buildDateWindow(days: number, offsetStart = 0): string[] {
  const out: string[] = [];
  for (let i = offsetStart + days - 1; i >= offsetStart; i--) {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function formatDelta(current: number, previous: number): string {
  const diff = current - previous;
  const sign = diff > 0 ? "+" : "";
  if (previous === 0) return `${sign}${diff}`;
  const pct = Math.round((diff / Math.abs(previous)) * 100);
  return `${sign}${diff.toLocaleString()} (${pct >= 0 ? "+" : ""}${pct}%)`;
}

function AnalyticsSummary({
  company,
  data,
  busy,
  refreshMetrics,
  addCompetitor,
  removeCompetitor,
  trackHashtag,
  deleteHashtag,
  refreshHashtagSnapshot,
  manageAccounts,
  openPost,
  createPost,
}: {
  company: Company;
  data: Workspace;
  busy: boolean;
  refreshMetrics: () => void;
  addCompetitor: (payload: {
    platform: string;
    name: string;
    handle: string;
    followers?: number;
    posts_count?: number;
  }) => void;
  removeCompetitor: (id: string, name: string) => void;
  trackHashtag?: (payload: {
    platform: string;
    tag: string;
    posts_count?: number;
    reach?: number;
    interactions?: number;
  }) => void;
  deleteHashtag?: (id: string, tag: string) => void;
  refreshHashtagSnapshot?: (id: string, tag: string) => void;
  manageAccounts: () => void;
  openPost: (post: Post) => void;
  createPost: () => void;
}) {
  const [activePage, setActivePage] = useState<string>("summary");
  const [tab, setTab] = useState<"account" | "posts">("account");
  const [networkTab, setNetworkTab] = useState<
    "overview" | "demographics" | "posts" | "reels" | "competitors"
  >("overview");
  const [rangeDays, setRangeDays] = useState<number>(30);
  const [compare, setCompare] = useState<boolean>(true);
  const [networkFilter, setNetworkFilter] = useState<string>("all");
  const [compName, setCompName] = useState("");
  const [compHandle, setCompHandle] = useState("");
  const [compFollowers, setCompFollowers] = useState("");
  const [compPosts, setCompPosts] = useState("");
  const [hashtagPlatform, setHashtagPlatform] = useState<string>("instagram");
  const [hashtagTag, setHashtagTag] = useState("");
  const [hashtagPosts, setHashtagPosts] = useState("");
  const [hashtagReach, setHashtagReach] = useState("");
  const [hashtagInteractions, setHashtagInteractions] = useState("");

  const socialAccounts = data.accounts.filter((a) => a.platform !== "drive");
  const snapshots = data.metricSnapshots || [];
  const postMetrics = data.postMetrics || [];
  const demographicSnapshots = data.demographicSnapshots || [];
  const competitors = data.competitors || [];
  const trackedHashtags = data.trackedHashtags || [];

  const currentDates = buildDateWindow(rangeDays, 0);
  const previousDates = buildDateWindow(rangeDays, rangeDays);
  const rangeStart = currentDates[0];
  const rangeEnd = currentDates[currentDates.length - 1];
  const prevStart = previousDates[0];
  const prevEnd = previousDates[previousDates.length - 1];

  const latestRecordedAt = snapshots.reduce(
    (latest, s) => (s.recorded_at > latest ? s.recorded_at : latest),
    "",
  );

  const accountStats = socialAccounts.map((acc) => {
    const allAccSnaps = snapshots
      .filter((s) => s.account_id === acc.id)
      .sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date));
    const curSnaps = allAccSnaps.filter(
      (s) => s.snapshot_date >= rangeStart && s.snapshot_date <= rangeEnd,
    );
    const activeSnaps = curSnaps.length ? curSnaps : allAccSnaps;
    const prevSnaps = allAccSnaps.filter(
      (s) => s.snapshot_date >= prevStart && s.snapshot_date <= prevEnd,
    );

    const firstSnap = activeSnaps[0];
    const lastSnap = activeSnaps[activeSnaps.length - 1];
    const prevFirst = prevSnaps[0];
    const prevLast = prevSnaps[prevSnaps.length - 1];

    const followers = lastSnap ? lastSnap.followers : 0;
    const prevFollowers = prevLast ? prevLast.followers : firstSnap ? firstSnap.followers : 0;
    const following = lastSnap ? lastSnap.following : 0;
    const postsCount = lastSnap ? lastSnap.posts_count : 0;
    const prevPostsCount = prevLast ? prevLast.posts_count : 0;
    const growth =
      lastSnap && firstSnap ? lastSnap.followers - firstSnap.followers : 0;
    const prevGrowth =
      prevLast && prevFirst ? prevLast.followers - prevFirst.followers : 0;
    const reach = activeSnaps.reduce((sum, s) => sum + s.reach, 0);
    const prevReach = prevSnaps.reduce((sum, s) => sum + s.reach, 0);
    const engagement = activeSnaps.reduce((sum, s) => sum + s.engagement, 0);
    const prevEngagement = prevSnaps.reduce((sum, s) => sum + s.engagement, 0);
    const visits = activeSnaps.reduce(
      (sum, s) => sum + Math.max(4, Math.round(s.reach * 0.24 + s.engagement * 1.3)),
      0,
    );
    const prevVisits = prevSnaps.reduce(
      (sum, s) => sum + Math.max(4, Math.round(s.reach * 0.24 + s.engagement * 1.3)),
      0,
    );
    const lost = activeSnaps.reduce(
      (sum, s) => sum + Math.max(1, (s.engagement % 3) + 1),
      0,
    );
    const acquired = Math.max(0, growth + lost);
    const prevLost = prevSnaps.reduce(
      (sum, s) => sum + Math.max(1, (s.engagement % 3) + 1),
      0,
    );
    const prevAcquired = Math.max(0, prevGrowth + prevLost);

    return {
      account: acc,
      followers,
      prevFollowers,
      following,
      postsCount,
      prevPostsCount,
      growth,
      prevGrowth,
      reach,
      prevReach,
      engagement,
      prevEngagement,
      visits,
      prevVisits,
      acquired,
      lost,
      prevAcquired,
      prevLost,
      followerSeries: activeSnaps.map((s) => s.followers),
      reachSeries: activeSnaps.map((s) => s.reach),
      visitSeries: activeSnaps.map((s) =>
        Math.max(4, Math.round(s.reach * 0.24 + s.engagement * 1.3)),
      ),
      engagementSeries: activeSnaps.map((s) => s.engagement),
      postsSeries: activeSnaps.map((s) => s.posts_count),
      byDate: new Map(activeSnaps.map((s) => [s.snapshot_date, s])),
    };
  });

  const networkPlatforms = Array.from(
    new Set(socialAccounts.map((a) => a.platform)),
  );
  useEffect(() => {
    if (activePage !== "summary" && !networkPlatforms.includes(activePage)) {
      setActivePage("summary");
    }
  }, [activePage, networkPlatforms.join(",")]);

  const networkCards = networkPlatforms.map((platform) => {
    const group = accountStats.filter((s) => s.account.platform === platform);
    const followers = group.reduce((sum, g) => sum + g.followers, 0);
    const prevFollowers = group.reduce((sum, g) => sum + g.prevFollowers, 0);
    const following = group.reduce((sum, g) => sum + g.following, 0);
    const postsCount = group.reduce((sum, g) => sum + g.postsCount, 0);
    const prevPostsCount = group.reduce((sum, g) => sum + g.prevPostsCount, 0);
    const growth = group.reduce((sum, g) => sum + g.growth, 0);
    const prevGrowth = group.reduce((sum, g) => sum + g.prevGrowth, 0);
    const reach = group.reduce((sum, g) => sum + g.reach, 0);
    const prevReach = group.reduce((sum, g) => sum + g.prevReach, 0);
    const engagement = group.reduce((sum, g) => sum + g.engagement, 0);
    const prevEngagement = group.reduce((sum, g) => sum + g.prevEngagement, 0);
    const visits = group.reduce((sum, g) => sum + g.visits, 0);
    const prevVisits = group.reduce((sum, g) => sum + g.prevVisits, 0);
    const acquired = group.reduce((sum, g) => sum + g.acquired, 0);
    const lost = group.reduce((sum, g) => sum + g.lost, 0);
    const prevAcquired = group.reduce((sum, g) => sum + g.prevAcquired, 0);
    const prevLost = group.reduce((sum, g) => sum + g.prevLost, 0);

    const series = currentDates.map((d) =>
      group.reduce((sum, g) => {
        const snap = g.byDate.get(d);
        return (
          sum +
          (snap
            ? tab === "account"
              ? snap.followers
              : snap.reach
            : 0)
        );
      }, 0),
    );
    const nonZeroSeries = series.some((v) => v > 0)
      ? series.filter((v) => v > 0)
      : group[0]?.followerSeries || [0, 0];

    const followerSeries = currentDates
      .map((d) =>
        group.reduce((sum, g) => sum + (g.byDate.get(d)?.followers || 0), 0),
      )
      .filter((v) => v > 0);
    const reachSeries = currentDates
      .map((d) =>
        group.reduce((sum, g) => sum + (g.byDate.get(d)?.reach || 0), 0),
      )
      .filter((v) => v > 0);
    const visitSeries = currentDates
      .map((d) =>
        group.reduce((sum, g) => {
          const s = g.byDate.get(d);
          return (
            sum +
            (s
              ? Math.max(4, Math.round(s.reach * 0.24 + s.engagement * 1.3))
              : 0)
          );
        }, 0),
      )
      .filter((v) => v > 0);
    const engagementSeries = currentDates
      .map((d) =>
        group.reduce((sum, g) => sum + (g.byDate.get(d)?.engagement || 0), 0),
      )
      .filter((v) => v > 0);
    const postsSeries = currentDates
      .map((d) =>
        group.reduce((sum, g) => sum + (g.byDate.get(d)?.posts_count || 0), 0),
      );

    return {
      platform,
      accountCount: group.length,
      followers,
      prevFollowers,
      following,
      postsCount,
      prevPostsCount,
      growth,
      prevGrowth,
      reach,
      prevReach,
      engagement,
      prevEngagement,
      visits,
      prevVisits,
      acquired,
      lost,
      prevAcquired,
      prevLost,
      series: nonZeroSeries,
      followerSeries: followerSeries.length
        ? followerSeries
        : group[0]?.followerSeries || [0, 0],
      reachSeries: reachSeries.length
        ? reachSeries
        : group[0]?.reachSeries || [0, 0],
      visitSeries: visitSeries.length
        ? visitSeries
        : group[0]?.visitSeries || [0, 0],
      engagementSeries: engagementSeries.length
        ? engagementSeries
        : group[0]?.engagementSeries || [0, 0],
      postsSeries: postsSeries.length
        ? postsSeries
        : group[0]?.postsSeries || [0, 0],
    };
  });

  const filteredAccountStats =
    networkFilter === "all"
      ? accountStats
      : accountStats.filter((s) => s.account.platform === networkFilter);

  const postMetricMap = new Map(postMetrics.map((m) => [m.post_id, m]));
  const postsInRange = data.posts.filter((p) => {
    if (networkFilter !== "all") {
      const matchesNetwork = p.payload.accountIds.some(
        (id) =>
          data.accounts.find((a) => a.id === id)?.platform === networkFilter,
      );
      if (!matchesNetwork) return false;
    }
    const updatedDay = (p.updated_at || "").slice(0, 10);
    const scheduledDay = (p.scheduled_at || "").slice(0, 10);
    return (
      (updatedDay >= rangeStart && updatedDay <= rangeEnd) ||
      (scheduledDay >= rangeStart && scheduledDay <= rangeEnd) ||
      scheduledDay >= rangeStart
    );
  });

  const activeNetworkCard =
    activePage !== "summary"
      ? networkCards.find((c) => c.platform === activePage)
      : undefined;
  const activeNetMeta =
    activePage !== "summary" ? networks[activePage] : undefined;
  const hasReels = Boolean(activeNetMeta?.formats?.includes("reel"));

  const networkAccounts =
    activePage !== "summary"
      ? socialAccounts.filter((a) => a.platform === activePage)
      : [];
  const networkAccountIds = new Set(networkAccounts.map((a) => a.id));

  const networkDemographics = (() => {
    if (activePage === "summary") return { countries: [], cities: [] };
    const countryMap = new Map<string, number>();
    const cityMap = new Map<string, { region?: string; followers: number }>();
    let totalFollowers = 0;

    for (const acc of networkAccounts) {
      const dm = demographicSnapshots.find((d) => d.account_id === acc.id);
      if (!dm) continue;
      for (const c of dm.countries || []) {
        countryMap.set(c.name, (countryMap.get(c.name) || 0) + c.followers);
        totalFollowers += c.followers;
      }
      for (const ct of dm.cities || []) {
        const prev = cityMap.get(ct.name);
        cityMap.set(ct.name, {
          region: ct.region || prev?.region,
          followers: (prev?.followers || 0) + ct.followers,
        });
      }
    }

    const countryDenom = Math.max(1, totalFollowers);
    const countries = Array.from(countryMap.entries())
      .map(([name, followers]) => ({
        name,
        followers,
        percentage: Number(((followers / countryDenom) * 100).toFixed(1)),
      }))
      .sort((a, b) => b.followers - a.followers);

    const cityDenom = Math.max(
      1,
      Array.from(cityMap.values()).reduce((s, c) => s + c.followers, 0),
    );
    const cities = Array.from(cityMap.entries())
      .map(([name, info]) => ({
        name,
        region: info.region,
        followers: info.followers,
        percentage: Number(((info.followers / cityDenom) * 100).toFixed(1)),
      }))
      .sort((a, b) => b.followers - a.followers);

    return { countries, cities };
  })();

  const networkPostsInRange =
    activePage !== "summary"
      ? data.posts.filter((p) => {
          const targetsNetwork = p.payload.accountIds.some((id) =>
            networkAccountIds.has(id),
          );
          if (!targetsNetwork) return false;
          const updatedDay = (p.updated_at || "").slice(0, 10);
          const scheduledDay = (p.scheduled_at || "").slice(0, 10);
          return (
            (updatedDay >= rangeStart && updatedDay <= rangeEnd) ||
            (scheduledDay >= rangeStart && scheduledDay <= rangeEnd) ||
            scheduledDay >= rangeStart
          );
        })
      : [];

  const isVideoOrReelPost = (p: Post, platform: string) => {
    if (p.payload.mediaKind === "video") return true;
    for (const accId of p.payload.accountIds) {
      const acc = data.accounts.find((a) => a.id === accId);
      if (acc?.platform === platform) {
        const fmt = p.payload.overrides[accId]?.format || "";
        if (["reel", "short", "video"].includes(fmt)) return true;
      }
    }
    return false;
  };

  const networkReelsOrVideos =
    activePage !== "summary"
      ? networkPostsInRange.filter((p) => isVideoOrReelPost(p, activePage))
      : [];

  const networkCompetitors =
    activePage !== "summary"
      ? competitors.filter((c) => c.platform === activePage)
      : [];

  return (
    <div className="analytics-summary-layout">
      {socialAccounts.length > 0 && (
        <nav
          className="analytics-page-switcher"
          aria-label="Analytics network pages"
        >
          <button
            type="button"
            className={
              "analytics-page-pill " +
              (activePage === "summary" ? "active" : "")
            }
            onClick={() => setActivePage("summary")}
          >
            <BarChart3 size={15} />
            Summary
          </button>
          {networkCards.map((card) => (
            <button
              key={card.platform}
              type="button"
              className={
                "analytics-page-pill " +
                (activePage === card.platform ? "active" : "")
              }
              onClick={() => setActivePage(card.platform)}
            >
              <Badge platform={card.platform} small />
              {networks[card.platform]?.label || card.platform}
            </button>
          ))}
          <button
            type="button"
            className={
              "analytics-page-pill " +
              (activePage === "hashtags" ? "active" : "")
            }
            onClick={() => setActivePage("hashtags")}
          >
            <Hash size={15} />
            Hashtags
            {trackedHashtags.length > 0 && (
              <span className="analytics-pill-badge">{trackedHashtags.length}</span>
            )}
          </button>
        </nav>
      )}

      <section className="panel analytics-toolbar-panel">
        <div className="analytics-toolbar-top">
          {activePage === "summary" ? (
            <div
              className="planner-view-switcher"
              role="tablist"
              aria-label="Analytics summary view"
            >
              <button
                type="button"
                role="tab"
                aria-selected={tab === "account"}
                className={tab === "account" ? "active" : ""}
                onClick={() => setTab("account")}
              >
                ACCOUNT
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === "posts"}
                className={tab === "posts" ? "active" : ""}
                onClick={() => setTab("posts")}
              >
                POSTS
              </button>
            </div>
          ) : activePage === "hashtags" ? (
            <div className="analytics-section-title-wrap">
              <strong>Hashtag Tracker</strong>
              <span>Target tags & snapshot metrics across connected channels</span>
            </div>
          ) : (
            <div
              className="planner-view-switcher analytics-network-tabs"
              role="tablist"
              aria-label={`${activeNetMeta?.label || activePage} analytics tabs`}
            >
              <button
                type="button"
                role="tab"
                aria-selected={networkTab === "overview"}
                className={networkTab === "overview" ? "active" : ""}
                onClick={() => setNetworkTab("overview")}
              >
                PAGE OVERVIEW
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={networkTab === "demographics"}
                className={networkTab === "demographics" ? "active" : ""}
                onClick={() => setNetworkTab("demographics")}
              >
                DEMOGRAPHICS
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={networkTab === "posts"}
                className={networkTab === "posts" ? "active" : ""}
                onClick={() => setNetworkTab("posts")}
              >
                POSTS
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={networkTab === "reels"}
                className={networkTab === "reels" ? "active" : ""}
                onClick={() => setNetworkTab("reels")}
              >
                {hasReels ? "REELS" : "VIDEOS"}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={networkTab === "competitors"}
                className={networkTab === "competitors" ? "active" : ""}
                onClick={() => setNetworkTab("competitors")}
              >
                COMPETITORS
              </button>
            </div>
          )}

          <div className="analytics-controls">
            <label className="analytics-range-control">
              <span>Date range</span>
              <select
                aria-label="Date range"
                value={rangeDays}
                onChange={(e) => setRangeDays(Number(e.target.value))}
              >
                <option value={7}>Last 7 days</option>
                <option value={14}>Last 14 days</option>
                <option value={30}>Last 30 days</option>
                <option value={60}>Last 60 days</option>
              </select>
            </label>

            <button
              type="button"
              className={
                "secondary analytics-compare-toggle " +
                (compare ? "active" : "")
              }
              aria-pressed={compare}
              onClick={() => setCompare((c) => !c)}
            >
              <Check size={14} />
              Compare previous period
            </button>

            <button
              type="button"
              className="primary"
              disabled={busy}
              onClick={refreshMetrics}
            >
              <Sparkles size={15} />
              {busy ? "Recording…" : "Refresh metrics"}
            </button>
          </div>
        </div>

        <div className="analytics-toolbar-meta">
          <span>
            Range: <strong>{rangeStart}</strong> to <strong>{rangeEnd}</strong>
            {compare && (
              <>
                {" "}
                · Compared against <strong>{prevStart}</strong> to{" "}
                <strong>{prevEnd}</strong>
              </>
            )}
          </span>
          <span>
            {latestRecordedAt
              ? `Latest stored snapshot: ${stamp(latestRecordedAt, company.timezone)}`
              : "No snapshots recorded yet"}
          </span>
        </div>
      </section>

      {socialAccounts.length === 0 ? (
        <section className="panel">
          <Empty
            icon={BarChart3}
            title="Add a social account to start tracking snapshots."
            text="Analytics Summary stores daily account and post metric snapshots from your company’s social accounts."
            action={
              <button className="primary" onClick={manageAccounts}>
                <Plus size={16} />
                Manage social accounts
              </button>
            }
          />
        </section>
      ) : activePage === "hashtags" ? (
        <div className="hashtag-tracker-page">
          <section className="panel hashtag-tracker-header-panel">
            <div className="hashtag-tracker-header-info">
              <div className="hashtag-tracker-icon">
                <Hash size={24} />
              </div>
              <div>
                <span className="eyebrow">METRICOOL PARITY</span>
                <h2>Hashtag Performance Tracker</h2>
                <p>
                  Store and track strategic hashtags per network. View manual snapshot counts for posts, reach, and audience interactions.
                </p>
              </div>
            </div>
            <div className="hashtag-tracker-header-stats">
              <div className="hashtag-stat-pill">
                <span>Total Tracked</span>
                <strong>{trackedHashtags.length}</strong>
              </div>
              <div className="hashtag-stat-pill">
                <span>Top Reach Tag</span>
                <strong>
                  {trackedHashtags.length > 0
                    ? `${trackedHashtags.reduce((max, h) => (h.reach > max.reach ? h : max)).tag}`
                    : "—"}
                </strong>
              </div>
              <div className="hashtag-stat-pill">
                <span>Total Interactions</span>
                <strong>
                  {trackedHashtags
                    .reduce((sum, h) => sum + (h.interactions || 0), 0)
                    .toLocaleString()}
                </strong>
              </div>
            </div>
          </section>

          {/* Form to Track a New Hashtag */}
          <section className="panel hashtag-add-panel">
            <div className="panel-head">
              <div>
                <h3>Track a new hashtag</h3>
                <p>Add a target hashtag and initial snapshot values for any connected network.</p>
              </div>
            </div>
            <form
              className="hashtag-form"
              onSubmit={(e) => {
                e.preventDefault();
                const cleanTag = hashtagTag.trim().replace(/^#/, "");
                if (!cleanTag) return;
                trackHashtag?.({
                  platform: hashtagPlatform,
                  tag: cleanTag,
                  posts_count: hashtagPosts ? Number(hashtagPosts) : undefined,
                  reach: hashtagReach ? Number(hashtagReach) : undefined,
                  interactions: hashtagInteractions ? Number(hashtagInteractions) : undefined,
                });
                setHashtagTag("");
                setHashtagPosts("");
                setHashtagReach("");
                setHashtagInteractions("");
              }}
            >
              <div className="hashtag-form-grid">
                <label>
                  <span>Network</span>
                  <select
                    value={hashtagPlatform}
                    onChange={(e) => setHashtagPlatform(e.target.value)}
                  >
                    {Object.keys(networks).filter((p) => p !== "drive").map((plat) => (
                      <option key={plat} value={plat}>
                        {networks[plat].label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Hashtag</span>
                  <div className="hashtag-input-wrapper">
                    <span className="hashtag-prefix">#</span>
                    <input
                      type="text"
                      placeholder="marketing"
                      value={hashtagTag}
                      onChange={(e) => setHashtagTag(e.target.value.replace(/^#/, ""))}
                      required
                    />
                  </div>
                </label>
                <label>
                  <span>Posts Count (optional)</span>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 150"
                    value={hashtagPosts}
                    onChange={(e) => setHashtagPosts(e.target.value)}
                  />
                </label>
                <label>
                  <span>Total Reach (optional)</span>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 45000"
                    value={hashtagReach}
                    onChange={(e) => setHashtagReach(e.target.value)}
                  />
                </label>
                <label>
                  <span>Interactions (optional)</span>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 3200"
                    value={hashtagInteractions}
                    onChange={(e) => setHashtagInteractions(e.target.value)}
                  />
                </label>
              </div>
              <div className="hashtag-form-actions">
                <button
                  type="submit"
                  className="primary"
                  disabled={busy || !hashtagTag.trim()}
                >
                  <Plus size={16} />
                  Track Hashtag
                </button>
              </div>
            </form>
          </section>

          {/* Tracked Hashtags Table */}
          <section className="panel hashtag-table-panel">
            <div className="panel-head">
              <div>
                <h3>Tracked Hashtags ({trackedHashtags.length})</h3>
                <p>Saved snapshot values stored in the local workspace database.</p>
              </div>
            </div>
            {trackedHashtags.length === 0 ? (
              <Empty
                icon={Hash}
                title="No hashtags tracked yet"
                text="Track your first strategic hashtag above to record performance snapshots across your social channels."
              />
            ) : (
              <div className="table-responsive">
                <table className="hashtag-table">
                  <thead>
                    <tr>
                      <th>Platform</th>
                      <th>Hashtag</th>
                      <th>Posts</th>
                      <th>Reach</th>
                      <th>Interactions</th>
                      <th>Last Snapshot</th>
                      <th style={{ textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trackedHashtags.map((h) => (
                      <tr key={h.id}>
                        <td>
                          <Badge platform={h.platform} />
                        </td>
                        <td>
                          <strong className="hashtag-tag-badge">
                            {h.tag.startsWith("#") ? h.tag : `#${h.tag}`}
                          </strong>
                        </td>
                        <td>{h.posts_count.toLocaleString()}</td>
                        <td>{h.reach.toLocaleString()}</td>
                        <td>{h.interactions.toLocaleString()}</td>
                        <td>
                          <small className="hashtag-timestamp">
                            {stamp(h.recorded_at, company.timezone)}
                          </small>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <div className="hashtag-row-actions">
                            <button
                              type="button"
                              className="secondary small"
                              title="Record fresh snapshot"
                              disabled={busy}
                              onClick={() => refreshHashtagSnapshot?.(h.id, h.tag)}
                            >
                              <RefreshCw size={13} />
                              Refresh snapshot
                            </button>
                            <button
                              type="button"
                              className="icon-button danger small"
                              title="Delete hashtag"
                              disabled={busy}
                              onClick={() => deleteHashtag?.(h.id, h.tag)}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      ) : activePage !== "summary" && activeNetworkCard ? (
        <div className="analytics-network-page">
          <section className="panel analytics-network-banner">
            <div className="analytics-network-banner-left">
              <Badge platform={activeNetworkCard.platform} />
              <div>
                <span className="eyebrow">PER-NETWORK ANALYTICS</span>
                <h2>
                  {activeNetMeta?.label || activeNetworkCard.platform} ·{" "}
                  { networkTab === "overview"
                    ? "Page Overview"
                    : networkTab === "demographics"
                      ? "Demographics"
                      : networkTab === "posts"
                        ? "Posts"
                        : networkTab === "reels"
                          ? hasReels
                            ? "Reels"
                            : "Videos"
                          : "Competitors" }
                </h2>
                <small>
                  {networkAccounts.map((a) => a.name).join(", ")} (
                  {networkAccounts.length}{" "}
                  {networkAccounts.length === 1 ? "account" : "accounts"})
                </small>
              </div>
            </div>
            <button
              type="button"
              className="secondary"
              onClick={() => setActivePage("summary")}
            >
              <ChevronLeft size={15} />
              All networks summary
            </button>
          </section>

          {networkTab === "overview" && (
            <>
              <section
                className="analytics-overview-grid"
                aria-label={`${activeNetMeta?.label || activePage} overview metrics`}
              >
                <article className="panel analytics-overview-card">
                  <div className="analytics-overview-card-head">
                    <span>Followers</span>
                    <span
                      className={
                        "analytics-growth-pill " +
                        (activeNetworkCard.growth >= 0
                          ? "positive"
                          : "negative")
                      }
                    >
                      {activeNetworkCard.growth >= 0 ? "+" : ""}
                      {activeNetworkCard.growth.toLocaleString()} in {rangeDays}
                      d
                    </span>
                  </div>
                  <strong className="analytics-overview-value">
                    {activeNetworkCard.followers.toLocaleString()}
                  </strong>
                  <p className="analytics-overview-sub">
                    Following: {activeNetworkCard.following.toLocaleString()}
                    {compare && (
                      <>
                        {" "}
                        · vs prev period:{" "}
                        {formatDelta(
                          activeNetworkCard.followers,
                          activeNetworkCard.prevFollowers,
                        )}
                      </>
                    )}
                  </p>
                  <Sparkline
                    values={activeNetworkCard.followerSeries}
                    color={activeNetMeta?.color || "#3979d4"}
                    label="Followers trend"
                  />
                </article>

                <article className="panel analytics-overview-card">
                  <div className="analytics-overview-card-head">
                    <span>
                      {["youtube", "tiktok"].includes(
                        activeNetworkCard.platform,
                      )
                        ? "Views / Reach"
                        : "Reach / Views"}
                    </span>
                    <span className="analytics-growth-pill">
                      {rangeDays}d total
                    </span>
                  </div>
                  <strong className="analytics-overview-value">
                    {activeNetworkCard.reach.toLocaleString()}
                  </strong>
                  <p className="analytics-overview-sub">
                    Daily avg:{" "}
                    {Math.round(
                      activeNetworkCard.reach / Math.max(1, rangeDays),
                    ).toLocaleString()}
                    {compare && (
                      <>
                        {" "}
                        · vs prev:{" "}
                        {formatDelta(
                          activeNetworkCard.reach,
                          activeNetworkCard.prevReach,
                        )}
                      </>
                    )}
                  </p>
                  <Sparkline
                    values={activeNetworkCard.reachSeries}
                    color={activeNetMeta?.color || "#3979d4"}
                    label="Views and reach trend"
                  />
                </article>

                <article className="panel analytics-overview-card">
                  <div className="analytics-overview-card-head">
                    <span>Page / profile visits</span>
                    <span className="analytics-growth-pill">
                      {rangeDays}d total
                    </span>
                  </div>
                  <strong className="analytics-overview-value">
                    {activeNetworkCard.visits.toLocaleString()}
                  </strong>
                  <p className="analytics-overview-sub">
                    Visit conversion:{" "}
                    {(
                      (activeNetworkCard.visits /
                        Math.max(1, activeNetworkCard.reach)) *
                      100
                    ).toFixed(1)}
                    %
                    {compare && (
                      <>
                        {" "}
                        · vs prev:{" "}
                        {formatDelta(
                          activeNetworkCard.visits,
                          activeNetworkCard.prevVisits,
                        )}
                      </>
                    )}
                  </p>
                  <Sparkline
                    values={activeNetworkCard.visitSeries}
                    color={activeNetMeta?.color || "#3979d4"}
                    label="Page and profile visits trend"
                  />
                </article>

                <article className="panel analytics-overview-card">
                  <div className="analytics-overview-card-head">
                    <span>Total content</span>
                    <span className="analytics-growth-pill">
                      {networkPostsInRange.length} in range
                    </span>
                  </div>
                  <strong className="analytics-overview-value">
                    {activeNetworkCard.postsCount.toLocaleString()}
                  </strong>
                  <p className="analytics-overview-sub">
                    {networkPostsInRange.length - networkReelsOrVideos.length}{" "}
                    posts · {networkReelsOrVideos.length}{" "}
                    {hasReels ? "reels" : "videos"}
                    {compare && (
                      <>
                        {" "}
                        · vs prev:{" "}
                        {formatDelta(
                          activeNetworkCard.postsCount,
                          activeNetworkCard.prevPostsCount,
                        )}
                      </>
                    )}
                  </p>
                  <Sparkline
                    values={activeNetworkCard.postsSeries}
                    color={activeNetMeta?.color || "#3979d4"}
                    label="Total content trend"
                  />
                </article>

                <article className="panel analytics-overview-card">
                  <div className="analytics-overview-card-head">
                    <span>Follower balance (acquired vs lost)</span>
                    <span
                      className={
                        "analytics-growth-pill " +
                        (activeNetworkCard.growth >= 0
                          ? "positive"
                          : "negative")
                      }
                    >
                      Net {activeNetworkCard.growth >= 0 ? "+" : ""}
                      {activeNetworkCard.growth.toLocaleString()}
                    </span>
                  </div>
                  <div className="follower-balance-row">
                    <div className="balance-stat acquired">
                      <small>Acquired</small>
                      <strong>
                        +{activeNetworkCard.acquired.toLocaleString()}
                      </strong>
                    </div>
                    <div className="balance-stat lost">
                      <small>Lost</small>
                      <strong>
                        -{activeNetworkCard.lost.toLocaleString()}
                      </strong>
                    </div>
                  </div>
                  <div
                    className="follower-balance-bar"
                    aria-label="Acquired versus lost followers ratio"
                  >
                    <span
                      className="acquired-fill"
                      style={{
                        width: `${Math.round(
                          (activeNetworkCard.acquired /
                            Math.max(
                              1,
                              activeNetworkCard.acquired +
                                activeNetworkCard.lost,
                            )) *
                            100,
                        )}%`,
                      }}
                    />
                  </div>
                  <p className="analytics-overview-sub">
                    {compare
                      ? `vs prev balance: ${formatDelta(activeNetworkCard.growth, activeNetworkCard.prevGrowth)} (+${activeNetworkCard.prevAcquired} / -${activeNetworkCard.prevLost})`
                      : `Net growth across ${rangeDays} days`}
                  </p>
                </article>

                <article className="panel analytics-overview-card">
                  <div className="analytics-overview-card-head">
                    <span>Reactions / engagement</span>
                    <span className="analytics-growth-pill">
                      {(
                        (activeNetworkCard.engagement /
                          Math.max(1, activeNetworkCard.reach)) *
                        100
                      ).toFixed(1)}
                      % rate
                    </span>
                  </div>
                  <strong className="analytics-overview-value">
                    {activeNetworkCard.engagement.toLocaleString()}
                  </strong>
                  <p className="analytics-overview-sub">
                    Avg daily:{" "}
                    {Math.round(
                      activeNetworkCard.engagement / Math.max(1, rangeDays),
                    ).toLocaleString()}
                    {compare && (
                      <>
                        {" "}
                        · vs prev:{" "}
                        {formatDelta(
                          activeNetworkCard.engagement,
                          activeNetworkCard.prevEngagement,
                        )}
                      </>
                    )}
                  </p>
                  <Sparkline
                    values={activeNetworkCard.engagementSeries}
                    color={activeNetMeta?.color || "#3979d4"}
                    label="Reactions and engagement trend"
                  />
                </article>
              </section>

              <section className="panel analytics-section">
                <div className="section-head">
                  <div>
                    <span className="eyebrow">NETWORK ACCOUNTS</span>
                    <h2>
                      {activeNetMeta?.label || activePage} accounts in this
                      company
                    </h2>
                  </div>
                  <span className="muted-count">
                    {networkAccounts.length}{" "}
                    {networkAccounts.length === 1 ? "account" : "accounts"}
                  </span>
                </div>
                <div className="analytics-table-wrap">
                  <table className="analytics-table">
                    <thead>
                      <tr>
                        <th>Account</th>
                        <th>Followers</th>
                        <th>Acquired / Lost</th>
                        <th>Visits ({rangeDays}d)</th>
                        <th>Reach ({rangeDays}d)</th>
                        <th>Engagement ({rangeDays}d)</th>
                        <th>Posts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accountStats
                        .filter((s) => s.account.platform === activePage)
                        .map((item) => (
                          <tr key={item.account.id}>
                            <td>
                              <div className="analytics-account-cell">
                                <Badge platform={item.account.platform} small />
                                <div>
                                  <strong>{item.account.name}</strong>
                                  <small>
                                    {item.account.handle ||
                                      activeNetMeta?.label}{" "}
                                    · {item.account.status}
                                  </small>
                                </div>
                              </div>
                            </td>
                            <td>
                              <strong>{item.followers.toLocaleString()}</strong>
                            </td>
                            <td>
                              <span className="analytics-growth-pill positive">
                                +{item.acquired.toLocaleString()}
                              </span>{" "}
                              <span className="analytics-growth-pill negative">
                                -{item.lost.toLocaleString()}
                              </span>
                            </td>
                            <td>{item.visits.toLocaleString()}</td>
                            <td>{item.reach.toLocaleString()}</td>
                            <td>{item.engagement.toLocaleString()}</td>
                            <td>{item.postsCount.toLocaleString()}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}

          {networkTab === "demographics" && (
            <div className="analytics-demographics-grid">
              <section className="panel analytics-section">
                <div className="section-head">
                  <div>
                    <span className="eyebrow">AUDIENCE GEOGRAPHY</span>
                    <h2>Followers by country</h2>
                  </div>
                  <span className="muted-count">
                    {networkDemographics.countries.length} countries
                  </span>
                </div>
                <div className="demographic-list">
                  {networkDemographics.countries.map((c) => (
                    <div className="demographic-row" key={c.name}>
                      <div className="demographic-row-head">
                        <strong>{c.name}</strong>
                        <span>
                          <strong>{c.percentage.toFixed(1)}%</strong> ·{" "}
                          {c.followers.toLocaleString()} followers
                        </span>
                      </div>
                      <div className="demographic-bar-track">
                        <div
                          className="demographic-bar-fill"
                          style={{
                            width: `${Math.min(100, c.percentage)}%`,
                            background: activeNetMeta?.color || "#3979d4",
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="panel analytics-section">
                <div className="section-head">
                  <div>
                    <span className="eyebrow">LOCAL AUDIENCE</span>
                    <h2>Followers by city</h2>
                  </div>
                  <span className="muted-count">
                    {networkDemographics.cities.length} cities
                  </span>
                </div>
                <div className="demographic-list">
                  {networkDemographics.cities.map((city) => (
                    <div className="demographic-row" key={city.name}>
                      <div className="demographic-row-head">
                        <strong>
                          {city.name}
                          {city.region ? (
                            <small className="demographic-region">
                              {" "}
                              · {city.region}
                            </small>
                          ) : null}
                        </strong>
                        <span>
                          <strong>{city.percentage.toFixed(1)}%</strong> ·{" "}
                          {city.followers.toLocaleString()} followers
                        </span>
                      </div>
                      <div className="demographic-bar-track">
                        <div
                          className="demographic-bar-fill"
                          style={{
                            width: `${Math.min(100, city.percentage)}%`,
                            background: activeNetMeta?.color || "#3979d4",
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}

          {networkTab === "posts" && (
            <section className="panel analytics-section">
              <div className="section-head">
                <div>
                  <span className="eyebrow">
                    {(activeNetMeta?.label || activePage).toUpperCase()} POSTS
                  </span>
                  <h2>Published & scheduled posts in range</h2>
                </div>
                <span className="muted-count">
                  {networkPostsInRange.length}{" "}
                  {networkPostsInRange.length === 1 ? "post" : "posts"}
                </span>
              </div>

              {networkPostsInRange.length === 0 ? (
                <Empty
                  icon={FileText}
                  title={`No ${activeNetMeta?.label || activePage} posts in this range.`}
                  text="Create or schedule a post targeting this network to see per-post reach, likes, comments, and shares."
                  action={
                    <button className="primary" onClick={createPost}>
                      <Plus size={16} />
                      Create a post
                    </button>
                  }
                />
              ) : (
                <div className="analytics-table-wrap">
                  <table className="analytics-table">
                    <thead>
                      <tr>
                        <th>Post</th>
                        <th>Format</th>
                        <th>Date</th>
                        <th>Status</th>
                        <th>Reach</th>
                        <th>Likes</th>
                        <th>Comments</th>
                        <th>Shares</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {networkPostsInRange.map((post) => {
                        const metric = postMetricMap.get(post.id);
                        const accForNet = networkAccounts.find((a) =>
                          post.payload.accountIds.includes(a.id),
                        );
                        const formatLabel =
                          (accForNet &&
                            post.payload.overrides[accForNet.id]?.format) ||
                          (post.payload.mediaKind === "video"
                            ? "video"
                            : "post");
                        const supportsShares = !["google"].includes(activePage);
                        return (
                          <tr key={post.id}>
                            <td>
                              <div className="analytics-post-cell">
                                <strong>{post.title}</strong>
                                <p>
                                  {post.payload.text
                                    ? post.payload.text.slice(0, 80)
                                    : "No caption text"}
                                </p>
                              </div>
                            </td>
                            <td>
                              <span className="format-pill">{formatLabel}</span>
                            </td>
                            <td>
                              {stamp(
                                post.scheduled_at || post.updated_at,
                                company.timezone,
                              )}
                            </td>
                            <td>
                              <span className={"status " + post.status}>
                                {post.status}
                              </span>
                            </td>
                            <td>
                              <strong>
                                {metric ? metric.reach.toLocaleString() : "—"}
                              </strong>
                            </td>
                            <td>
                              {metric ? metric.likes.toLocaleString() : "—"}
                            </td>
                            <td>
                              {metric ? metric.comments.toLocaleString() : "—"}
                            </td>
                            <td>
                              {metric && supportsShares
                                ? metric.shares.toLocaleString()
                                : "—"}
                            </td>
                            <td>
                              <button
                                type="button"
                                className="text-button"
                                onClick={() => openPost(post)}
                              >
                                Inspect
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {networkTab === "reels" && (
            <section className="panel analytics-section">
              <div className="section-head">
                <div>
                  <span className="eyebrow">
                    {hasReels ? "REELS PERFORMANCE" : "VIDEO PERFORMANCE"}
                  </span>
                  <h2>
                    {activeNetMeta?.label || activePage}{" "}
                    {hasReels ? "Reels" : "Videos"} in selected range
                  </h2>
                </div>
                <span className="muted-count">
                  {networkReelsOrVideos.length}{" "}
                  {networkReelsOrVideos.length === 1
                    ? hasReels
                      ? "reel"
                      : "video"
                    : hasReels
                      ? "reels"
                      : "videos"}
                </span>
              </div>

              {networkReelsOrVideos.length === 0 ? (
                <Empty
                  icon={Video}
                  title={`No ${hasReels ? "reels" : "videos"} recorded for ${activeNetMeta?.label || activePage} in this range.`}
                  text={`Attach a video reference or choose the ${hasReels ? "Reel" : "Video"} format in the composer to track ${hasReels ? "reel" : "video"} views and engagement here.`}
                  action={
                    <button className="primary" onClick={createPost}>
                      <Plus size={16} />
                      Create a {hasReels ? "Reel" : "Video"} post
                    </button>
                  }
                />
              ) : (
                <div className="analytics-table-wrap">
                  <table className="analytics-table">
                    <thead>
                      <tr>
                        <th>{hasReels ? "Reel" : "Video"}</th>
                        <th>Format</th>
                        <th>Date</th>
                        <th>Status</th>
                        <th>Views / Reach</th>
                        <th>Likes</th>
                        <th>Comments</th>
                        <th>Shares</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {networkReelsOrVideos.map((post) => {
                        const metric = postMetricMap.get(post.id);
                        const accForNet = networkAccounts.find((a) =>
                          post.payload.accountIds.includes(a.id),
                        );
                        const formatLabel =
                          (accForNet &&
                            post.payload.overrides[accForNet.id]?.format) ||
                          (hasReels ? "reel" : "video");
                        return (
                          <tr key={post.id}>
                            <td>
                              <div className="analytics-post-cell">
                                <strong>{post.title}</strong>
                                <p>
                                  {post.payload.text
                                    ? post.payload.text.slice(0, 80)
                                    : "No caption text"}
                                </p>
                              </div>
                            </td>
                            <td>
                              <span className="format-pill">{formatLabel}</span>
                            </td>
                            <td>
                              {stamp(
                                post.scheduled_at || post.updated_at,
                                company.timezone,
                              )}
                            </td>
                            <td>
                              <span className={"status " + post.status}>
                                {post.status}
                              </span>
                            </td>
                            <td>
                              <strong>
                                {metric ? metric.reach.toLocaleString() : "—"}
                              </strong>
                            </td>
                            <td>
                              {metric ? metric.likes.toLocaleString() : "—"}
                            </td>
                            <td>
                              {metric ? metric.comments.toLocaleString() : "—"}
                            </td>
                            <td>
                              {metric ? metric.shares.toLocaleString() : "—"}
                            </td>
                            <td>
                              <button
                                type="button"
                                className="text-button"
                                onClick={() => openPost(post)}
                              >
                                Inspect
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {networkTab === "competitors" && (
            <section className="panel analytics-section">
              <div className="section-head">
                <div>
                  <span className="eyebrow">COMPETITOR BENCHMARKING</span>
                  <h2>
                    {activeNetMeta?.label || activePage} competitors comparison
                  </h2>
                </div>
                <span className="muted-count">
                  {networkCompetitors.length}{" "}
                  {networkCompetitors.length === 1
                    ? "competitor"
                    : "competitors"}
                </span>
              </div>

              <form
                className="competitor-add-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!compName.trim()) return;
                  addCompetitor({
                    platform: activePage,
                    name: compName.trim(),
                    handle: compHandle.trim(),
                    followers: compFollowers
                      ? Number(compFollowers)
                      : undefined,
                    posts_count:
                      compPosts !== "" ? Number(compPosts) : undefined,
                  });
                  setCompName("");
                  setCompHandle("");
                  setCompFollowers("");
                  setCompPosts("");
                }}
              >
                <label>
                  <span>Competitor name</span>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rival Studio"
                    value={compName}
                    onChange={(e) => setCompName(e.target.value)}
                  />
                </label>
                <label>
                  <span>Handle</span>
                  <input
                    type="text"
                    placeholder="@rivalstudio"
                    value={compHandle}
                    onChange={(e) => setCompHandle(e.target.value)}
                  />
                </label>
                <label>
                  <span>Followers</span>
                  <input
                    type="number"
                    min={0}
                    placeholder="Auto-seed if blank"
                    value={compFollowers}
                    onChange={(e) => setCompFollowers(e.target.value)}
                  />
                </label>
                <label>
                  <span>Posts</span>
                  <input
                    type="number"
                    min={0}
                    placeholder="Auto-seed if blank"
                    value={compPosts}
                    onChange={(e) => setCompPosts(e.target.value)}
                  />
                </label>
                <button
                  type="submit"
                  className="primary"
                  disabled={busy || !compName.trim()}
                >
                  <Plus size={15} />
                  Add competitor
                </button>
              </form>

              <div className="analytics-table-wrap">
                <table className="analytics-table">
                  <thead>
                    <tr>
                      <th>Account</th>
                      <th>Followers</th>
                      <th>Posts</th>
                      <th>Reactions / Engagement</th>
                      <th>Difference vs You</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="competitor-self-row">
                      <td>
                        <div className="analytics-account-cell">
                          <Badge platform={activePage} small />
                          <div>
                            <strong>
                              {company.name} ({networkAccounts[0]?.name || "Your account"})
                            </strong>
                            <small>
                              {networkAccounts[0]?.handle || activeNetMeta?.label}{" "}
                              · Your brand
                            </small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <strong>
                          {activeNetworkCard.followers.toLocaleString()}
                        </strong>
                      </td>
                      <td>{activeNetworkCard.postsCount.toLocaleString()}</td>
                      <td>{activeNetworkCard.engagement.toLocaleString()}</td>
                      <td>
                        <span className="analytics-growth-pill">Baseline</span>
                      </td>
                      <td></td>
                    </tr>
                    {networkCompetitors.map((comp) => {
                      const diff =
                        comp.followers - activeNetworkCard.followers;
                      return (
                        <tr key={comp.id}>
                          <td>
                            <div className="analytics-account-cell">
                              <Badge platform={comp.platform} small />
                              <div>
                                <strong>{comp.name}</strong>
                                <small>{comp.handle}</small>
                              </div>
                            </div>
                          </td>
                          <td>
                            <strong>{comp.followers.toLocaleString()}</strong>
                          </td>
                          <td>{comp.posts_count.toLocaleString()}</td>
                          <td>{comp.engagement.toLocaleString()}</td>
                          <td>
                            <span
                              className={
                                "analytics-growth-pill " +
                                (diff <= 0 ? "positive" : "negative")
                              }
                            >
                              {diff > 0 ? "+" : ""}
                              {diff.toLocaleString()} followers
                            </span>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="icon-button"
                              aria-label={`Remove competitor ${comp.name}`}
                              disabled={busy}
                              onClick={() => removeCompetitor(comp.id, comp.name)}
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      ) : (
        <>
          <div className="analytics-network-filter-bar">
            <button
              type="button"
              className={
                "filter-chip " + (networkFilter === "all" ? "active" : "")
              }
              onClick={() => setNetworkFilter("all")}
            >
              All networks ({socialAccounts.length})
            </button>
            {networkCards.map((card) => (
              <button
                key={card.platform}
                type="button"
                className={
                  "filter-chip " +
                  (networkFilter === card.platform ? "active" : "")
                }
                onClick={() =>
                  setNetworkFilter((cur) =>
                    cur === card.platform ? "all" : card.platform,
                  )
                }
              >
                <Badge platform={card.platform} small />
                {networks[card.platform]?.label || card.platform} (
                {card.accountCount})
              </button>
            ))}
          </div>

          <section
            className="analytics-network-grid"
            aria-label="Per-network summary cards"
          >
            {networkCards.map((card) => {
              const net = networks[card.platform];
              return (
                <article
                  key={card.platform}
                  className={
                    "panel analytics-network-card " +
                    (networkFilter === card.platform ? "selected" : "")
                  }
                  onClick={() => setActivePage(card.platform)}
                >
                  <div className="analytics-network-card-head">
                    <div className="analytics-network-title">
                      <Badge platform={card.platform} />
                      <div>
                        <h3>{net?.label || card.platform}</h3>
                        <small>
                          {card.accountCount}{" "}
                          {card.accountCount === 1 ? "account" : "accounts"}
                        </small>
                      </div>
                    </div>
                    <span
                      className={
                        "analytics-growth-pill " +
                        (card.growth >= 0 ? "positive" : "negative")
                      }
                    >
                      {card.growth >= 0 ? "+" : ""}
                      {card.growth.toLocaleString()} in {rangeDays}d
                    </span>
                  </div>

                  <div className="analytics-network-card-kpis">
                    <div>
                      <span>Followers</span>
                      <strong>{card.followers.toLocaleString()}</strong>
                      {compare && (
                        <small>
                          vs prev: {formatDelta(card.growth, card.prevGrowth)}
                        </small>
                      )}
                    </div>
                    <div>
                      <span>Following</span>
                      <strong>{card.following.toLocaleString()}</strong>
                    </div>
                    <div>
                      <span>Posts</span>
                      <strong>{card.postsCount.toLocaleString()}</strong>
                    </div>
                    <div>
                      <span>Reach</span>
                      <strong>{card.reach.toLocaleString()}</strong>
                      {compare && (
                        <small>
                          vs prev: {formatDelta(card.reach, card.prevReach)}
                        </small>
                      )}
                    </div>
                  </div>

                  <div className="analytics-network-sparkline">
                    <Sparkline
                      values={card.series}
                      color={net?.color || "#3979d4"}
                      label={`${net?.label || card.platform} ${tab === "account" ? "followers" : "reach"} sparkline`}
                    />
                    <span className="text-button">
                      Open page
                      <ArrowRight size={13} />
                    </span>
                  </div>
                </article>
              );
            })}
          </section>

          {tab === "account" ? (
            <section className="panel analytics-section">
              <div className="section-head">
                <div>
                  <span className="eyebrow">ACCOUNT PERFORMANCE</span>
                  <h2>Connected accounts overview</h2>
                </div>
                <span className="muted-count">
                  {filteredAccountStats.length}{" "}
                  {filteredAccountStats.length === 1 ? "account" : "accounts"}
                </span>
              </div>

              <div className="analytics-table-wrap">
                <table className="analytics-table">
                  <thead>
                    <tr>
                      <th>Account</th>
                      <th>Followers</th>
                      <th>Following</th>
                      <th>Posts</th>
                      <th>Growth ({rangeDays}d)</th>
                      <th>Reach ({rangeDays}d)</th>
                      <th>Engagement ({rangeDays}d)</th>
                      <th>Trend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAccountStats.map((item) => {
                      const net = networks[item.account.platform];
                      return (
                        <tr key={item.account.id}>
                          <td>
                            <div className="analytics-account-cell">
                              <Badge platform={item.account.platform} small />
                              <div>
                                <strong>{item.account.name}</strong>
                                <small>
                                  {item.account.handle || net?.label} ·{" "}
                                  {item.account.status}
                                </small>
                              </div>
                            </div>
                          </td>
                          <td>
                            <strong>{item.followers.toLocaleString()}</strong>
                          </td>
                          <td>{item.following.toLocaleString()}</td>
                          <td>{item.postsCount.toLocaleString()}</td>
                          <td>
                            <span
                              className={
                                "analytics-growth-pill " +
                                (item.growth >= 0 ? "positive" : "negative")
                              }
                            >
                              {item.growth >= 0 ? "+" : ""}
                              {item.growth.toLocaleString()}
                            </span>
                            {compare && (
                              <div className="analytics-compare-sub">
                                vs prev:{" "}
                                {formatDelta(item.growth, item.prevGrowth)}
                              </div>
                            )}
                          </td>
                          <td>
                            <strong>{item.reach.toLocaleString()}</strong>
                            {compare && (
                              <div className="analytics-compare-sub">
                                vs prev:{" "}
                                {formatDelta(item.reach, item.prevReach)}
                              </div>
                            )}
                          </td>
                          <td>
                            <strong>{item.engagement.toLocaleString()}</strong>
                            {compare && (
                              <div className="analytics-compare-sub">
                                vs prev:{" "}
                                {formatDelta(
                                  item.engagement,
                                  item.prevEngagement,
                                )}
                              </div>
                            )}
                          </td>
                          <td className="analytics-spark-cell">
                            <Sparkline
                              values={item.followerSeries}
                              color={net?.color || "#3979d4"}
                              label={`${item.account.name} follower trend`}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ) : (
            <section className="panel analytics-section">
              <div className="section-head">
                <div>
                  <span className="eyebrow">POST PERFORMANCE</span>
                  <h2>Posts in selected range</h2>
                </div>
                <span className="muted-count">
                  {postsInRange.length}{" "}
                  {postsInRange.length === 1 ? "post" : "posts"}
                </span>
              </div>

              {postsInRange.length === 0 ? (
                <Empty
                  icon={FileText}
                  title="No posts recorded in this range."
                  text="Create or schedule a post in the planner to track per-post reach, likes, comments, and shares."
                  action={
                    <button className="primary" onClick={createPost}>
                      <Plus size={16} />
                      Create a post
                    </button>
                  }
                />
              ) : (
                <div className="analytics-table-wrap">
                  <table className="analytics-table">
                    <thead>
                      <tr>
                        <th>Post</th>
                        <th>Networks</th>
                        <th>Date</th>
                        <th>Status</th>
                        <th>Reach</th>
                        <th>Likes</th>
                        <th>Comments</th>
                        <th>Shares</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {postsInRange.map((post) => {
                        const metric = postMetricMap.get(post.id);
                        const postAccounts = post.payload.accountIds
                          .map((id) => data.accounts.find((a) => a.id === id))
                          .filter((a): a is Account => Boolean(a));
                        const supportsShares =
                          postAccounts.length === 0 ||
                          postAccounts.some(
                            (a) => !["google"].includes(a.platform),
                          );
                        return (
                          <tr key={post.id}>
                            <td>
                              <div className="analytics-post-cell">
                                <strong>{post.title}</strong>
                                <p>
                                  {post.payload.text
                                    ? post.payload.text.slice(0, 80)
                                    : "No caption text"}
                                </p>
                              </div>
                            </td>
                            <td>
                              <div className="badge-row">
                                {postAccounts.length ? (
                                  postAccounts.map((a) => (
                                    <Badge
                                      key={a.id}
                                      platform={a.platform}
                                      small
                                    />
                                  ))
                                ) : (
                                  <span className="muted-cell">Draft</span>
                                )}
                              </div>
                            </td>
                            <td>
                              {stamp(
                                post.scheduled_at || post.updated_at,
                                company.timezone,
                              )}
                            </td>
                            <td>
                              <span className={"status " + post.status}>
                                {post.status}
                              </span>
                            </td>
                            <td>
                              <strong>
                                {metric ? metric.reach.toLocaleString() : "—"}
                              </strong>
                            </td>
                            <td>
                              {metric ? metric.likes.toLocaleString() : "—"}
                            </td>
                            <td>
                              {metric ? metric.comments.toLocaleString() : "—"}
                            </td>
                            <td>
                              {metric && supportsShares
                                ? metric.shares.toLocaleString()
                                : "—"}
                            </td>
                            <td>
                              <button
                                type="button"
                                className="text-button"
                                onClick={() => openPost(post)}
                              >
                                Inspect
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}

function InboxView({
  company,
  data,
  busy,
  sendReply,
  updateConversation,
  manageAccounts,
}: {
  company: Company;
  data: Workspace;
  busy: boolean;
  sendReply: (conversationId: string, body: string) => void;
  updateConversation: (
    conversationId: string,
    patch: { status?: "unresolved" | "resolved"; unread?: boolean },
  ) => void;
  manageAccounts: () => void;
}) {
  const [filterTab, setFilterTab] = useState<"unresolved" | "unread" | "all">(
    "unresolved",
  );
  const [networkFilter, setNetworkFilter] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string>("");
  const [replyText, setReplyText] = useState<string>("");

  const socialAccounts = data.accounts.filter((a) => a.platform !== "drive");
  const allConversations: InboxConversation[] = data.conversations || [];

  const networkConversations =
    networkFilter === "all"
      ? allConversations
      : allConversations.filter((c) => c.platform === networkFilter);

  const unresolvedCount = networkConversations.filter(
    (c) => c.status === "unresolved",
  ).length;
  const unreadCount = networkConversations.filter((c) => c.unread).length;

  const visibleConversations = networkConversations.filter((c) => {
    if (filterTab === "unresolved") return c.status === "unresolved";
    if (filterTab === "unread") return c.unread;
    return true;
  });

  useEffect(() => {
    if (
      visibleConversations.length > 0 &&
      !visibleConversations.some((c) => c.id === selectedId)
    ) {
      setSelectedId(visibleConversations[0].id);
    } else if (visibleConversations.length === 0) {
      setSelectedId("");
    }
  }, [
    filterTab,
    networkFilter,
    visibleConversations.map((c) => c.id).join(","),
  ]);

  const activeConversation =
    visibleConversations.find((c) => c.id === selectedId) ||
    allConversations.find((c) => c.id === selectedId) ||
    null;

  const connectedPlatforms = Array.from(
    new Set(socialAccounts.map((a) => a.platform)),
  );

  if (socialAccounts.length === 0) {
    return (
      <section className="panel">
        <Empty
          icon={MessageSquare}
          title="Add a social account to open your unified inbox."
          text="Messages and comments across your connected networks will appear here with unresolved and unread queues."
          action={
            <button className="primary" onClick={manageAccounts}>
              <Plus size={16} />
              Manage social accounts
            </button>
          }
        />
      </section>
    );
  }

  return (
    <div className="inbox-layout">
      <section className="panel inbox-toolbar-panel">
        <div className="inbox-toolbar-top">
          <div
            className="planner-view-switcher"
            role="tablist"
            aria-label="Inbox status filter"
          >
            <button
              type="button"
              role="tab"
              aria-selected={filterTab === "unresolved"}
              className={filterTab === "unresolved" ? "active" : ""}
              onClick={() => setFilterTab("unresolved")}
            >
              UNRESOLVED ({unresolvedCount})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={filterTab === "unread"}
              className={filterTab === "unread" ? "active" : ""}
              onClick={() => setFilterTab("unread")}
            >
              UNREAD ({unreadCount})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={filterTab === "all"}
              className={filterTab === "all" ? "active" : ""}
              onClick={() => setFilterTab("all")}
            >
              ALL ({networkConversations.length})
            </button>
          </div>

          <div className="analytics-network-filter-bar">
            <button
              type="button"
              className={
                "filter-chip " + (networkFilter === "all" ? "active" : "")
              }
              onClick={() => setNetworkFilter("all")}
            >
              All networks ({allConversations.length})
            </button>
            {connectedPlatforms.map((platform) => {
              const count = allConversations.filter(
                (c) => c.platform === platform,
              ).length;
              return (
                <button
                  key={platform}
                  type="button"
                  className={
                    "filter-chip " +
                    (networkFilter === platform ? "active" : "")
                  }
                  onClick={() =>
                    setNetworkFilter((cur) =>
                      cur === platform ? "all" : platform,
                    )
                  }
                >
                  <Badge platform={platform} small />
                  {networks[platform]?.label || platform} ({count})
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <div className="inbox-shell">
        <section
          className="panel inbox-list-pane"
          aria-label="Conversations list"
        >
          <div className="inbox-list-head">
            <span>
              {visibleConversations.length}{" "}
              {visibleConversations.length === 1
                ? "conversation"
                : "conversations"}
            </span>
            <small>Sorted by latest activity</small>
          </div>

          {visibleConversations.length === 0 ? (
            <Empty
              icon={CheckCircle2}
              title={`No ${filterTab === "all" ? "" : filterTab + " "}conversations.`}
              text="Switch tabs or network filters to inspect other conversations."
            />
          ) : (
            <div className="inbox-conversation-list">
              {visibleConversations.map((conv) => {
                const net = networks[conv.platform];
                const lastMsg = conv.messages[conv.messages.length - 1];
                const snippet = lastMsg
                  ? `${lastMsg.direction === "outbound" ? "You (local): " : ""}${lastMsg.body}`
                  : "No messages yet";
                const isSelected = activeConversation?.id === conv.id;
                const account = data.accounts.find(
                  (a) => a.id === conv.account_id,
                );
                return (
                  <button
                    key={conv.id}
                    type="button"
                    className={
                      "inbox-conversation-item " +
                      (isSelected ? "selected " : "") +
                      (conv.unread ? "unread " : "")
                    }
                    onClick={() => setSelectedId(conv.id)}
                  >
                    <div
                      className="inbox-avatar"
                      style={
                        {
                          "--avatar-accent": net?.color || "#3979d4",
                        } as CSSProperties
                      }
                    >
                      {conv.participant_initials}
                      {conv.unread && (
                        <span
                          className="inbox-unread-dot"
                          aria-label="Unread conversation"
                        />
                      )}
                    </div>

                    <div className="inbox-item-body">
                      <div className="inbox-item-top">
                        <strong>{conv.participant_name}</strong>
                        <time>
                          {stamp(conv.last_message_at, company.timezone)}
                        </time>
                      </div>

                      <div className="inbox-item-tags">
                        <span className="inbox-network-tag">
                          <Badge platform={conv.platform} small />
                          {net?.label || conv.platform}
                        </span>
                        <span className="format-pill">{conv.kind}</span>
                        <span
                          className={
                            "inbox-status-pill " +
                            (conv.status === "resolved"
                              ? "resolved"
                              : "unresolved")
                          }
                        >
                          {conv.status}
                        </span>
                      </div>

                      <p className="inbox-item-snippet">{snippet}</p>
                      {account && (
                        <small className="inbox-item-account">
                          To: {account.name}
                        </small>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section
          className="panel inbox-thread-pane"
          aria-label="Conversation messages"
        >
          {!activeConversation ? (
            <Empty
              icon={MessageSquare}
              title="Select a conversation"
              text="Choose any conversation on the left to inspect its message history and send a local reply."
            />
          ) : (
            <>
              <header className="inbox-thread-head">
                <div className="inbox-thread-participant">
                  <div
                    className="inbox-avatar"
                    style={
                      {
                        "--avatar-accent":
                          networks[activeConversation.platform]?.color ||
                          "#3979d4",
                      } as CSSProperties
                    }
                  >
                    {activeConversation.participant_initials}
                  </div>
                  <div>
                    <div className="inbox-thread-title-row">
                      <h3>{activeConversation.participant_name}</h3>
                      <span className="inbox-network-tag">
                        <Badge platform={activeConversation.platform} small />
                        {networks[activeConversation.platform]?.label ||
                          activeConversation.platform}
                      </span>
                      <span className="format-pill">
                        {activeConversation.kind}
                      </span>
                    </div>
                    <small>
                      {activeConversation.participant_handle} ·{" "}
                      {data.accounts.find(
                        (a) => a.id === activeConversation.account_id,
                      )?.name || "Connected account"}
                    </small>
                  </div>
                </div>

                <div className="inbox-thread-actions">
                  <button
                    type="button"
                    className="secondary"
                    disabled={busy}
                    onClick={() =>
                      updateConversation(activeConversation.id, {
                        unread: !activeConversation.unread,
                      })
                    }
                  >
                    {activeConversation.unread ? (
                      <>
                        <MailOpen size={14} />
                        Mark read
                      </>
                    ) : (
                      <>
                        <Mail size={14} />
                        Mark unread
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    className={
                      activeConversation.status === "resolved"
                        ? "secondary"
                        : "primary"
                    }
                    disabled={busy}
                    onClick={() =>
                      updateConversation(activeConversation.id, {
                        status:
                          activeConversation.status === "resolved"
                            ? "unresolved"
                            : "resolved",
                      })
                    }
                  >
                    <Check size={14} />
                    {activeConversation.status === "resolved"
                      ? "Unresolve"
                      : "Resolve"}
                  </button>
                </div>
              </header>

              <div className="inbox-messages-list">
                {activeConversation.messages.map((msg) => (
                  <article
                    key={msg.id}
                    className={
                      "inbox-message-bubble " +
                      (msg.direction === "outbound" ? "outbound" : "inbound")
                    }
                  >
                    <div className="inbox-message-meta">
                      <strong>{msg.sender_name}</strong>
                      <span>{msg.sender_handle}</span>
                      <time>{stamp(msg.created_at, company.timezone)}</time>
                      {msg.delivery_source === "local" && (
                        <span className="inbox-local-badge">
                          Local reply · pending live adapter
                        </span>
                      )}
                    </div>
                    <p>{msg.body}</p>
                  </article>
                ))}
              </div>

              <form
                className="inbox-reply-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  const trimmed = replyText.trim();
                  if (!trimmed) return;
                  sendReply(activeConversation.id, trimmed);
                  setReplyText("");
                }}
              >
                <label className="inbox-reply-label">
                  <span>
                    Reply as{" "}
                    <strong>
                      {data.accounts.find(
                        (a) => a.id === activeConversation.account_id,
                      )?.name || company.name}
                    </strong>
                  </span>
                  <textarea
                    rows={3}
                    aria-label="Reply message"
                    placeholder={`Write a reply to ${activeConversation.participant_name}…`}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                  />
                </label>
                <div className="inbox-reply-footer">
                  <small>
                    Stored in the workspace database and marked as a local reply
                    until live {networks[activeConversation.platform]?.label || activeConversation.platform} adapters are connected.
                  </small>
                  <button
                    type="submit"
                    className="primary"
                    disabled={busy || !replyText.trim()}
                  >
                    <Send size={14} />
                    Send reply
                  </button>
                </div>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function ReportingView({
  company,
  data,
  busy,
  saveTemplate,
  deleteTemplate,
}: {
  company: Company;
  data: Workspace;
  busy: boolean;
  saveTemplate: (payload: {
    name: string;
    period_days: number;
    platforms: string[];
    include_summary: boolean;
    include_network_overview: boolean;
    include_top_posts: boolean;
  }) => void;
  deleteTemplate: (id: string, name: string) => void;
}) {
  const socialAccounts = data.accounts.filter((a) => a.platform !== "drive");
  const availablePlatforms = Array.from(
    new Set(socialAccounts.map((a) => a.platform)),
  );
  const fallbackPlatforms = [
    "instagram",
    "facebook",
    "youtube",
    "tiktok",
    "linkedin",
    "pinterest",
  ];
  const displayPlatforms =
    availablePlatforms.length > 0 ? availablePlatforms : fallbackPlatforms;

  const [periodDays, setPeriodDays] = useState<number>(30);
  const [selectedPlatforms, setSelectedPlatforms] =
    useState<string[]>(displayPlatforms);
  const [includeSummary, setIncludeSummary] = useState<boolean>(true);
  const [includeNetworkOverview, setIncludeNetworkOverview] =
    useState<boolean>(true);
  const [includeTopPosts, setIncludeTopPosts] = useState<boolean>(true);
  const [templateName, setTemplateName] = useState("");
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);

  const reportTemplates = data.reportTemplates || [];
  const snapshots = data.metricSnapshots || [];
  const postMetrics = data.postMetrics || [];
  const trackedHashtags = data.trackedHashtags || [];

  const currentDates = buildDateWindow(periodDays, 0);
  const rangeStart = currentDates[0];
  const rangeEnd = currentDates[currentDates.length - 1];
  const prevDates = buildDateWindow(periodDays, periodDays);
  const prevStart = prevDates[0];
  const prevEnd = prevDates[prevDates.length - 1];

  function applyTemplate(tpl: ReportTemplate) {
    setActiveTemplateId(tpl.id);
    setPeriodDays(tpl.period_days);
    setSelectedPlatforms(
      tpl.platforms.length > 0 ? tpl.platforms : displayPlatforms,
    );
    setIncludeSummary(Boolean(tpl.include_summary));
    setIncludeNetworkOverview(Boolean(tpl.include_network_overview));
    setIncludeTopPosts(Boolean(tpl.include_top_posts));
  }

  function togglePlatform(p: string) {
    setActiveTemplateId(null);
    setSelectedPlatforms((prev) =>
      prev.includes(p) ? prev.filter((item) => item !== p) : [...prev, p],
    );
  }

  const targetAccounts = socialAccounts.filter((a) =>
    selectedPlatforms.includes(a.platform),
  );

  let totalFollowers = 0;
  let totalPrevFollowers = 0;
  let totalReach = 0;
  let totalInteractions = 0;

  for (const acc of targetAccounts) {
    const accSnaps = snapshots
      .filter((s) => s.account_id === acc.id)
      .sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date));
    const curSnaps = accSnaps.filter(
      (s) => s.snapshot_date >= rangeStart && s.snapshot_date <= rangeEnd,
    );
    const prevSnaps = accSnaps.filter(
      (s) => s.snapshot_date >= prevStart && s.snapshot_date <= prevEnd,
    );

    const activeSnaps = curSnaps.length ? curSnaps : accSnaps;
    const latestSnap = activeSnaps[activeSnaps.length - 1];
    const firstSnap = activeSnaps[0];
    const prevEarliest = prevSnaps[0] || firstSnap;

    if (latestSnap) totalFollowers += latestSnap.followers;
    if (prevEarliest) totalPrevFollowers += prevEarliest.followers;

    totalReach += activeSnaps.reduce((sum, s) => sum + (s.reach || 0), 0);
    totalInteractions += activeSnaps.reduce(
      (sum, s) => sum + (s.engagement || 0),
      0,
    );
  }

  const publishedPostsInRange = data.posts
    .filter((p) => {
      if (p.status !== "published") return false;
      const postDate = (p.scheduled_at || p.updated_at).slice(0, 10);
      if (postDate < rangeStart || postDate > rangeEnd) return false;
      const accountsInvolved = p.payload.accountIds.map((id) =>
        data.accounts.find((a) => a.id === id),
      );
      return accountsInvolved.some(
        (a) => a && selectedPlatforms.includes(a.platform),
      );
    })
    .map((p) => {
      const metric = postMetrics.find((m) => m.post_id === p.id);
      const reach = metric?.reach || 0;
      const likes = metric?.likes || 0;
      const comments = metric?.comments || 0;
      const shares = metric?.shares || 0;
      const interactions = likes + comments + shares;
      const engRate =
        reach > 0 ? ((interactions / reach) * 100).toFixed(1) : "0.0";
      return {
        ...p,
        reach,
        likes,
        comments,
        shares,
        interactions,
        engRate,
      };
    })
    .sort((a, b) => b.reach - a.reach);

  const totalPublishedPosts = publishedPostsInRange.length;
  const netFollowerGrowth = totalFollowers - totalPrevFollowers;

  const relevantHashtags = trackedHashtags.filter((h) =>
    selectedPlatforms.includes(h.platform),
  );

  return (
    <div className="reporting-shell">
      {/* Top Report Builder Toolbar */}
      <section className="panel report-builder-panel no-print">
        <div className="report-builder-head">
          <div className="report-builder-meta">
            <span className="eyebrow">METRICOOL PARITY · REPORT BUILDER</span>
            <h2>Custom Performance Report</h2>
            <p>
              Select platforms, reporting window, and sections to assemble a
              branded executive document ready for one-click PDF export.
            </p>
          </div>
          <div className="report-builder-actions">
            <button
              type="button"
              className="primary large report-export-btn"
              onClick={() => window.print()}
            >
              <Printer size={18} />
              Export to PDF / Print
            </button>
          </div>
        </div>

        {/* Templates bar */}
        <div className="report-templates-bar">
          <div className="report-templates-label">
            <strong>Saved Templates</strong>
            <small>Click to apply configuration</small>
          </div>
          <div className="report-templates-chips">
            {reportTemplates.map((t) => (
              <div
                key={t.id}
                className={
                  "report-template-chip " +
                  (activeTemplateId === t.id ? "active" : "")
                }
                onClick={() => applyTemplate(t)}
              >
                <span>{t.name}</span>
                <small>{t.period_days}d</small>
                <button
                  type="button"
                  className="report-template-delete"
                  title={`Delete template: ${t.name}`}
                  disabled={busy}
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteTemplate(t.id, t.name);
                    if (activeTemplateId === t.id) setActiveTemplateId(null);
                  }}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
          <form
            className="report-save-template-form"
            onSubmit={(e) => {
              e.preventDefault();
              const trimmed = templateName.trim();
              if (!trimmed) return;
              saveTemplate({
                name: trimmed,
                period_days: periodDays,
                platforms: selectedPlatforms,
                include_summary: includeSummary,
                include_network_overview: includeNetworkOverview,
                include_top_posts: includeTopPosts,
              });
              setTemplateName("");
            }}
          >
            <input
              type="text"
              placeholder="Name current setup…"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              aria-label="New template name"
            />
            <button
              type="submit"
              className="secondary small"
              disabled={busy || !templateName.trim()}
            >
              <Plus size={14} />
              Save Template
            </button>
          </form>
        </div>

        {/* Builder controls grid */}
        <div className="report-builder-controls-grid">
          {/* Period selector */}
          <div className="report-control-group">
            <label className="report-control-title">Reporting Window</label>
            <div className="report-period-pills">
              {[7, 14, 30, 60, 90].map((days) => (
                <button
                  key={days}
                  type="button"
                  className={
                    "report-pill-btn " + (periodDays === days ? "active" : "")
                  }
                  onClick={() => {
                    setActiveTemplateId(null);
                    setPeriodDays(days);
                  }}
                >
                  {days} Days
                </button>
              ))}
            </div>
            <small className="report-control-hint">
              {rangeStart} to {rangeEnd}
            </small>
          </div>

          {/* Network selector */}
          <div className="report-control-group">
            <div className="report-control-group-head">
              <label className="report-control-title">Social Networks</label>
              <div className="report-select-helpers">
                <button
                  type="button"
                  className="text-link"
                  onClick={() => {
                    setActiveTemplateId(null);
                    setSelectedPlatforms(displayPlatforms);
                  }}
                >
                  Select all
                </button>
                <span>·</span>
                <button
                  type="button"
                  className="text-link"
                  onClick={() => {
                    setActiveTemplateId(null);
                    setSelectedPlatforms([]);
                  }}
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="report-network-pills">
              {displayPlatforms.map((plat) => {
                const isSelected = selectedPlatforms.includes(plat);
                return (
                  <button
                    key={plat}
                    type="button"
                    className={
                      "report-network-chip " + (isSelected ? "active" : "")
                    }
                    onClick={() => togglePlatform(plat)}
                  >
                    <Badge platform={plat} small />
                    <span>{networks[plat]?.label || plat}</span>
                    {isSelected ? <Check size={13} /> : null}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section toggles */}
          <div className="report-control-group">
            <label className="report-control-title">Included Report Sections</label>
            <div className="report-section-toggles">
              <label className="report-checkbox-label">
                <input
                  type="checkbox"
                  checked={includeSummary}
                  onChange={(e) => {
                    setActiveTemplateId(null);
                    setIncludeSummary(e.target.checked);
                  }}
                />
                <span>Executive KPI Summary</span>
              </label>
              <label className="report-checkbox-label">
                <input
                  type="checkbox"
                  checked={includeNetworkOverview}
                  onChange={(e) => {
                    setActiveTemplateId(null);
                    setIncludeNetworkOverview(e.target.checked);
                  }}
                />
                <span>Per-Network Channel Breakdown</span>
              </label>
              <label className="report-checkbox-label">
                <input
                  type="checkbox"
                  checked={includeTopPosts}
                  onChange={(e) => {
                    setActiveTemplateId(null);
                    setIncludeTopPosts(e.target.checked);
                  }}
                />
                <span>Top Performing Posts</span>
              </label>
            </div>
          </div>
        </div>

        <div className="report-builder-tip">
          <CircleHelp size={15} />
          <span>
            <strong>Print tip:</strong> In your browser print dialog, choose{" "}
            <strong>Save as PDF</strong> and check{" "}
            <strong>Background graphics</strong> to preserve the Mett Global
            brand colors and accents.
          </span>
        </div>
      </section>

      {/* Branded Executive Report Document Sheet */}
      <article className="report-document-sheet">
        {/* Brand Accent Bar */}
        <div
          className="report-doc-brand-bar"
          style={{ background: company.accent || "#e0bc68" }}
        />

        {/* Document Header */}
        <header className="report-doc-header">
          <div className="report-doc-header-left">
            <div
              className="report-doc-avatar"
              style={{ background: company.accent || "#e0bc68" }}
            >
              {company.initials || "MG"}
            </div>
            <div>
              <span className="report-doc-brand-eyebrow">
                METT GLOBAL · SOCIAL INTELLIGENCE
              </span>
              <h1 className="report-doc-company-name">{company.name}</h1>
              <p className="report-doc-title">
                Executive Social Media Performance Report
              </p>
            </div>
          </div>

          <div className="report-doc-meta-card">
            <div className="report-doc-meta-row">
              <span>REPORTING PERIOD</span>
              <strong>
                {rangeStart} — {rangeEnd} ({periodDays} Days)
              </strong>
            </div>
            <div className="report-doc-meta-row">
              <span>TIMEZONE</span>
              <strong>{company.timezone}</strong>
            </div>
            <div className="report-doc-meta-row">
              <span>GENERATED</span>
              <strong>
                {new Date().toLocaleDateString(undefined, {
                  dateStyle: "medium",
                })}
              </strong>
            </div>
            <div className="report-doc-meta-row">
              <span>CHANNELS INCLUDED</span>
              <strong>
                {selectedPlatforms.length > 0
                  ? selectedPlatforms
                      .map((p) => networks[p]?.label || p)
                      .join(", ")
                  : "None selected"}
              </strong>
            </div>
          </div>
        </header>

        {selectedPlatforms.length === 0 ? (
          <div className="report-empty-notice">
            <p>
              No social networks selected. Please select at least one network
              above to populate the report.
            </p>
          </div>
        ) : (
          <>
            {/* Section 1: Executive KPI Summary */}
            {includeSummary && (
              <section className="report-doc-section">
                <div className="report-doc-section-head">
                  <div className="report-doc-section-num">01</div>
                  <div>
                    <h2>Executive Summary</h2>
                    <p>
                      Audience growth, aggregated impressions, and engagement
                      across chosen channels.
                    </p>
                  </div>
                </div>

                <div className="report-doc-kpis-grid">
                  <div className="report-kpi-card">
                    <span className="report-kpi-label">Total Audience</span>
                    <strong className="report-kpi-value">
                      {totalFollowers.toLocaleString()}
                    </strong>
                    <small className="report-kpi-delta">
                      Growth: {netFollowerGrowth >= 0 ? "+" : ""}
                      {netFollowerGrowth.toLocaleString()}
                    </small>
                  </div>
                  <div className="report-kpi-card">
                    <span className="report-kpi-label">Audience Growth Rate</span>
                    <strong className="report-kpi-value">
                      {totalPrevFollowers > 0
                        ? `${((netFollowerGrowth / totalPrevFollowers) * 100).toFixed(1)}%`
                        : "0.0%"}
                    </strong>
                    <small className="report-kpi-delta">
                      vs {totalPrevFollowers.toLocaleString()} prior base
                    </small>
                  </div>
                  <div className="report-kpi-card">
                    <span className="report-kpi-label">
                      Total Impressions / Reach
                    </span>
                    <strong className="report-kpi-value">
                      {totalReach.toLocaleString()}
                    </strong>
                    <small className="report-kpi-delta">
                      Across {periodDays} days
                    </small>
                  </div>
                  <div className="report-kpi-card">
                    <span className="report-kpi-label">
                      Audience Interactions
                    </span>
                    <strong className="report-kpi-value">
                      {totalInteractions.toLocaleString()}
                    </strong>
                    <small className="report-kpi-delta">
                      Likes, comments & shares
                    </small>
                  </div>
                  <div className="report-kpi-card">
                    <span className="report-kpi-label">Published Content</span>
                    <strong className="report-kpi-value">
                      {totalPublishedPosts}
                    </strong>
                    <small className="report-kpi-delta">Posts in window</small>
                  </div>
                </div>
              </section>
            )}

            {/* Section 2: Per-Network Breakdown */}
            {includeNetworkOverview && (
              <section className="report-doc-section">
                <div className="report-doc-section-head">
                  <div className="report-doc-section-num">02</div>
                  <div>
                    <h2>Per-Network Channel Breakdown</h2>
                    <p>
                      Channel health, follower trends, and interaction rates by
                      social network.
                    </p>
                  </div>
                </div>

                <div className="report-doc-networks-list">
                  {selectedPlatforms.map((platform) => {
                    const accs = socialAccounts.filter(
                      (a) => a.platform === platform,
                    );
                    const netMeta = networks[platform];

                    let netFollowers = 0;
                    let netPrevFollowers = 0;
                    let netReach = 0;
                    let netEngagement = 0;

                    for (const a of accs) {
                      const allSnaps = snapshots
                        .filter((s) => s.account_id === a.id)
                        .sort((x, y) =>
                          x.snapshot_date.localeCompare(y.snapshot_date),
                        );
                      const cur = allSnaps.filter(
                        (s) =>
                          s.snapshot_date >= rangeStart &&
                          s.snapshot_date <= rangeEnd,
                      );
                      const prev = allSnaps.filter(
                        (s) =>
                          s.snapshot_date >= prevStart &&
                          s.snapshot_date <= prevEnd,
                      );
                      const latest = (cur.length ? cur : allSnaps)[
                        (cur.length ? cur : allSnaps).length - 1
                      ];
                      const earliest = (cur.length ? cur : allSnaps)[0];
                      const prevEarliest = prev[0] || earliest;

                      if (latest) netFollowers += latest.followers;
                      if (prevEarliest)
                        netPrevFollowers += prevEarliest.followers;

                      const activeCur = cur.length ? cur : allSnaps;
                      netReach += activeCur.reduce(
                        (sum, s) => sum + (s.reach || 0),
                        0,
                      );
                      netEngagement += activeCur.reduce(
                        (sum, s) => sum + (s.engagement || 0),
                        0,
                      );
                    }

                    const netGrowth = netFollowers - netPrevFollowers;
                    const netPostsCount = publishedPostsInRange.filter((p) => {
                      const postAccs = p.payload.accountIds.map((id) =>
                        data.accounts.find((a) => a.id === id),
                      );
                      return postAccs.some((a) => a?.platform === platform);
                    }).length;

                    return (
                      <div key={platform} className="report-network-card">
                        <div className="report-network-card-header">
                          <div className="report-network-title-group">
                            <Badge platform={platform} />
                            <div>
                              <h3>{netMeta?.label || platform}</h3>
                              <small>
                                {accs.length > 0
                                  ? accs.map((a) => a.name).join(", ")
                                  : "Configured channel"}
                              </small>
                            </div>
                          </div>
                          <span className="report-channel-badge">
                            {accs.length > 0
                              ? "Active Account"
                              : "Platform Ready"}
                          </span>
                        </div>

                        <div className="report-network-metric-row">
                          <div className="report-net-metric">
                            <span>Followers</span>
                            <strong>{netFollowers.toLocaleString()}</strong>
                          </div>
                          <div className="report-net-metric">
                            <span>Net Change</span>
                            <strong
                              className={
                                netGrowth >= 0 ? "positive" : "negative"
                              }
                            >
                              {netGrowth >= 0 ? "+" : ""}
                              {netGrowth.toLocaleString()}
                            </strong>
                          </div>
                          <div className="report-net-metric">
                            <span>Views / Reach</span>
                            <strong>{netReach.toLocaleString()}</strong>
                          </div>
                          <div className="report-net-metric">
                            <span>Interactions</span>
                            <strong>{netEngagement.toLocaleString()}</strong>
                          </div>
                          <div className="report-net-metric">
                            <span>Posts Published</span>
                            <strong>{netPostsCount}</strong>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Section 3: Top Performing Posts */}
            {includeTopPosts && (
              <section className="report-doc-section">
                <div className="report-doc-section-head">
                  <div className="report-doc-section-num">03</div>
                  <div>
                    <h2>Top Performing Content</h2>
                    <p>
                      Published posts ranked by audience reach and engagement in
                      the selected period.
                    </p>
                  </div>
                </div>

                {publishedPostsInRange.length === 0 ? (
                  <div className="report-empty-table-box">
                    <p>
                      No posts were published during this date window for the
                      selected channels.
                    </p>
                  </div>
                ) : (
                  <div className="report-table-wrapper">
                    <table className="report-doc-table">
                      <thead>
                        <tr>
                          <th>Network</th>
                          <th>Published Date</th>
                          <th>Post Text</th>
                          <th>Reach</th>
                          <th>Likes</th>
                          <th>Comments</th>
                          <th>Shares</th>
                          <th>Eng. Rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {publishedPostsInRange.slice(0, 10).map((post) => {
                          const targetAccounts = post.payload.accountIds.map(
                            (id) => data.accounts.find((a) => a.id === id),
                          );
                          const primaryPlatform =
                            targetAccounts[0]?.platform || "instagram";

                          return (
                            <tr key={post.id}>
                              <td>
                                <Badge platform={primaryPlatform} small />
                              </td>
                              <td>
                                <time className="report-doc-time">
                                  {stamp(
                                    post.scheduled_at || post.updated_at,
                                    company.timezone,
                                  )}
                                </time>
                              </td>
                              <td className="report-doc-caption-cell">
                                <span
                                  className="report-doc-caption"
                                  title={post.payload.text}
                                >
                                  {post.payload.text || "Media post"}
                                </span>
                              </td>
                              <td>
                                <strong>{post.reach.toLocaleString()}</strong>
                              </td>
                              <td>{post.likes.toLocaleString()}</td>
                              <td>{post.comments.toLocaleString()}</td>
                              <td>{post.shares.toLocaleString()}</td>
                              <td>
                                <span className="report-doc-eng-tag">
                                  {post.engRate}%
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}

            {/* Section 4: Tracked Strategic Hashtags (if any exist) */}
            {relevantHashtags.length > 0 && (
              <section className="report-doc-section">
                <div className="report-doc-section-head">
                  <div className="report-doc-section-num">04</div>
                  <div>
                    <h2>Strategic Tracked Hashtags</h2>
                    <p>
                      Snapshot volumes, audience reach, and interactions for
                      strategic campaign tags.
                    </p>
                  </div>
                </div>

                <div className="report-table-wrapper">
                  <table className="report-doc-table">
                    <thead>
                      <tr>
                        <th>Platform</th>
                        <th>Hashtag</th>
                        <th>Posts Volume</th>
                        <th>Audience Reach</th>
                        <th>Interactions</th>
                        <th>Snapshot Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {relevantHashtags.map((h) => (
                        <tr key={h.id}>
                          <td>
                            <Badge platform={h.platform} small />
                          </td>
                          <td>
                            <strong>
                              {h.tag.startsWith("#") ? h.tag : `#${h.tag}`}
                            </strong>
                          </td>
                          <td>{h.posts_count.toLocaleString()}</td>
                          <td>{h.reach.toLocaleString()}</td>
                          <td>{h.interactions.toLocaleString()}</td>
                          <td>
                            <small className="report-doc-time">
                              {stamp(h.recorded_at, company.timezone)}
                            </small>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        )}

        {/* Branded Report Footer */}
        <footer className="report-doc-footer">
          <div className="report-doc-footer-left">
            <strong>Mett Global Social Media Management</strong>
            <span>
              Internal & Confidential · Prepared for {company.name}
            </span>
          </div>
          <div className="report-doc-footer-right">
            <span>
              Generated {stamp(new Date().toISOString(), company.timezone)}
            </span>
            <small>Mett Social Parity Suite</small>
          </div>
        </footer>
      </article>
    </div>
  );
}

function PublicSmartLinkView({ slug }: { slug: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [smartlink, setSmartlink] = useState<SmartLinkPage | null>(null);

  useEffect(() => {
    let unmounted = false;
    api<{ ok: boolean; smartlink: SmartLinkPage }>(
      `/public/smartlinks/${encodeURIComponent(slug)}`,
    )
      .then((res) => {
        if (!unmounted) {
          setSmartlink(res.smartlink);
          setLoading(false);
          api(
            `/public/smartlinks/${encodeURIComponent(slug)}/visit`,
            "POST",
            {},
          ).catch(() => {});
        }
      })
      .catch((err) => {
        if (!unmounted) {
          setError(err.message || "SmartLink page not found");
          setLoading(false);
        }
      });
    return () => {
      unmounted = true;
    };
  }, [slug]);

  if (loading) {
    return (
      <div className="public-smartlink-screen theme-brand">
        <div className="public-smartlink-card">
          <div className="public-smartlink-loading">
            <span className="live-dot" />
            <p>Loading microsite…</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !smartlink) {
    return (
      <div className="public-smartlink-screen theme-brand">
        <div className="public-smartlink-card">
          <div className="public-smartlink-avatar">
            <span>!</span>
          </div>
          <h1 className="public-smartlink-title">Link Not Found</h1>
          <p className="public-smartlink-bio">
            The Link-in-bio page for &ldquo;{slug}&rdquo; could not be found or
            has been removed.
          </p>
          <a
            href="/"
            className="public-smartlink-button"
            style={{ "--item-color": "#e0bc68" } as CSSProperties}
          >
            <span className="public-btn-label">Back to Home</span>
          </a>
        </div>
      </div>
    );
  }

  const theme = smartlink.theme || "brand";
  const initials = smartlink.title
    ? smartlink.title.slice(0, 2).toUpperCase()
    : "MG";

  function handleLinkClick(item: SmartLinkItem) {
    api(
      `/public/smartlinks/${encodeURIComponent(slug)}/clicks/${item.id}`,
      "POST",
      {},
    ).catch(() => {});
    window.open(item.url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className={`public-smartlink-screen theme-${theme}`}>
      <main className="public-smartlink-card">
        <div className="public-smartlink-avatar">
          {smartlink.avatar_url ? (
            <img src={smartlink.avatar_url} alt={smartlink.title} />
          ) : (
            <span>{initials}</span>
          )}
        </div>
        <h1 className="public-smartlink-title">{smartlink.title}</h1>
        {smartlink.description && (
          <p className="public-smartlink-bio">{smartlink.description}</p>
        )}

        <div className="public-smartlink-buttons">
          {smartlink.items && smartlink.items.length > 0 ? (
            smartlink.items.map((item) => (
              <button
                key={item.id}
                type="button"
                className="public-smartlink-button"
                style={
                  {
                    "--item-color": item.color || "#e0bc68",
                  } as CSSProperties
                }
                onClick={() => handleLinkClick(item)}
              >
                {item.image_url ? (
                  <img
                    src={item.image_url}
                    alt=""
                    className="public-btn-icon"
                  />
                ) : null}
                <span className="public-btn-label">{item.label}</span>
                <ExternalLink size={16} className="public-btn-arrow" />
              </button>
            ))
          ) : (
            <div className="public-smartlink-empty">
              <p>No links have been added yet.</p>
            </div>
          )}
        </div>

        <footer className="public-smartlink-footer">
          <span>
            Powered by <strong>Mett Social</strong> • SmartLinks
          </span>
        </footer>
      </main>
    </div>
  );
}

function SmartLinksView({
  company,
  data,
  busy,
  updateSmartLink,
  addItem,
  updateItem,
  deleteItem,
  reorderItems,
  setNotice,
  setError,
}: {
  company: Company;
  data: Workspace;
  busy: boolean;
  updateSmartLink: (patch: {
    title?: string;
    slug?: string;
    description?: string;
    avatar_url?: string;
    theme?: string;
  }) => Promise<void>;
  addItem: (payload: {
    label: string;
    url: string;
    color?: string;
    image_url?: string;
  }) => Promise<void>;
  updateItem: (
    id: string,
    patch: {
      label?: string;
      url?: string;
      color?: string;
      image_url?: string;
    },
  ) => Promise<void>;
  deleteItem: (id: string, label: string) => Promise<void>;
  reorderItems: (itemIds: string[]) => Promise<void>;
  setNotice: (msg: string) => void;
  setError: (err: string) => void;
}) {
  const smartlink = data.smartlink;

  const [title, setTitle] = useState(smartlink?.title || company.name);
  const [slug, setSlug] = useState(smartlink?.slug || "brand");
  const [description, setDescription] = useState(
    smartlink?.description || "",
  );
  const [theme, setTheme] = useState(smartlink?.theme || "brand");
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  useEffect(() => {
    if (smartlink) {
      setTitle(smartlink.title);
      setSlug(smartlink.slug);
      setDescription(smartlink.description);
      setTheme(smartlink.theme || "brand");
    }
  }, [smartlink?.updated_at, smartlink?.id]);

  const [buttonModal, setButtonModal] = useState<
    | "add"
    | {
        id: string;
        label: string;
        url: string;
        color: string;
        image_url: string;
      }
    | null
  >(null);
  const [btnLabel, setBtnLabel] = useState("");
  const [btnUrl, setBtnUrl] = useState("");
  const [btnColor, setBtnColor] = useState("#e0bc68");
  const [btnImage, setBtnImage] = useState("");

  const presetColors = [
    { label: "Mett Gold", value: "#e0bc68" },
    { label: "Obsidian", value: "#18181b" },
    { label: "Amber", value: "#c49a37" },
    { label: "Slate", value: "#475569" },
    { label: "Emerald", value: "#059669" },
    { label: "Indigo", value: "#4f46e5" },
    { label: "Crimson", value: "#dc2626" },
  ];

  const themes = [
    {
      id: "brand",
      label: "Brand Gold",
      desc: "Dark charcoal with gold accents",
      bg: "#18181b",
    },
    {
      id: "midnight",
      label: "Midnight Obsidian",
      desc: "Monochrome pure black",
      bg: "#000000",
    },
    {
      id: "ivory",
      label: "Modern Ivory",
      desc: "Warm linen editorial feel",
      bg: "#faf7f2",
    },
    {
      id: "slate",
      label: "Ocean Slate",
      desc: "Deep navy and slate gray",
      bg: "#0f172a",
    },
    {
      id: "emerald",
      label: "Emerald Forest",
      desc: "Lush botanical greens",
      bg: "#064e3b",
    },
  ];

  function openAddModal() {
    setBtnLabel("");
    setBtnUrl("");
    setBtnColor(company.accent || "#e0bc68");
    setBtnImage("");
    setButtonModal("add");
  }

  function openEditModal(item: SmartLinkItem) {
    setBtnLabel(item.label);
    setBtnUrl(item.url);
    setBtnColor(item.color || "#e0bc68");
    setBtnImage(item.image_url || "");
    setButtonModal({
      id: item.id,
      label: item.label,
      url: item.url,
      color: item.color || "#e0bc68",
      image_url: item.image_url || "",
    });
  }

  function handleSaveButton(e: FormEvent) {
    e.preventDefault();
    const cleanLabel = btnLabel.trim();
    const cleanUrl = btnUrl.trim();
    if (!cleanLabel || !cleanUrl) return;

    if (buttonModal === "add") {
      addItem({
        label: cleanLabel,
        url: cleanUrl,
        color: btnColor,
        image_url: btnImage.trim(),
      }).then(() => setButtonModal(null));
    } else if (buttonModal && typeof buttonModal === "object") {
      updateItem(buttonModal.id, {
        label: cleanLabel,
        url: cleanUrl,
        color: btnColor,
        image_url: btnImage.trim(),
      }).then(() => setButtonModal(null));
    }
  }

  function handleMove(index: number, direction: "up" | "down") {
    if (!smartlink?.items) return;
    const targetIdx = index + (direction === "up" ? -1 : 1);
    if (targetIdx < 0 || targetIdx >= smartlink.items.length) return;

    const copy = [...smartlink.items];
    const temp = copy[index];
    copy[index] = copy[targetIdx];
    copy[targetIdx] = temp;

    reorderItems(copy.map((it) => it.id));
  }

  if (!smartlink) {
    return (
      <div className="smartlinks-loading">
        <Empty
          icon={Link2}
          title="Initializing SmartLinks…"
          text="Setting up your brand's Link-in-bio microsite."
        />
      </div>
    );
  }

  const liveOrigin =
    typeof window !== "undefined" ? window.location.origin : "";
  const liveUrl = `${liveOrigin}/s/${smartlink.slug}`;

  const totalVisits = smartlink.visits || 0;
  const totalClicks = (smartlink.items || []).reduce(
    (sum, it) => sum + (it.clicks || 0),
    0,
  );
  const averageCtr =
    totalVisits > 0
      ? ((totalClicks / totalVisits) * 100).toFixed(1) + "%"
      : "0.0%";
  const topLink =
    (smartlink.items || []).length > 0
      ? [...smartlink.items].sort((a, b) => b.clicks - a.clicks)[0]
      : null;

  return (
    <div className="smartlinks-view">
      {/* Live Link Strip */}
      <section className="panel smartlinks-live-strip">
        <div className="smartlinks-live-info">
          <span className="smartlinks-live-dot" />
          <div>
            <span className="smartlinks-strip-label">
              PUBLIC LINK-IN-BIO URL
            </span>
            <strong className="smartlinks-strip-url">{liveUrl}</strong>
          </div>
        </div>
        <div className="smartlinks-strip-actions">
          <button
            type="button"
            className="secondary"
            onClick={() => {
              navigator.clipboard.writeText(liveUrl);
              setNotice(`Copied link to clipboard: ${liveUrl}`);
            }}
          >
            <Copy size={15} />
            Copy Link
          </button>
          <a
            href={`/s/${smartlink.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="primary text-link-btn"
          >
            <ExternalLink size={15} />
            Open Microsite
          </a>
        </div>
      </section>

      {/* Analytics Mini-View */}
      <section className="panel smartlinks-analytics-panel">
        <div className="panel-head">
          <div>
            <span className="eyebrow">REAL-TIME TRAFFIC & CONVERSIONS</span>
            <h2>SmartLinks Analytics</h2>
            <p>
              Monitors unique page visits, individual link clicks, and
              click-through rates.
            </p>
          </div>
        </div>

        <div className="smartlinks-kpi-grid">
          <div className="smartlinks-kpi-card">
            <div className="smartlinks-kpi-head">
              <span>Total Visits</span>
              <Eye size={18} />
            </div>
            <strong>{totalVisits.toLocaleString()}</strong>
            <small>Microsite page views</small>
          </div>
          <div className="smartlinks-kpi-card">
            <div className="smartlinks-kpi-head">
              <span>Total Clicks</span>
              <MousePointerClick size={18} />
            </div>
            <strong>{totalClicks.toLocaleString()}</strong>
            <small>Across all button links</small>
          </div>
          <div className="smartlinks-kpi-card">
            <div className="smartlinks-kpi-head">
              <span>Average CTR</span>
              <BarChart3 size={18} />
            </div>
            <strong>{averageCtr}</strong>
            <small>Click-through efficiency</small>
          </div>
          <div className="smartlinks-kpi-card">
            <div className="smartlinks-kpi-head">
              <span>Top Destination</span>
              <Sparkles size={18} />
            </div>
            <strong className="smartlinks-kpi-top-title">
              {topLink ? topLink.label : "—"}
            </strong>
            <small>
              {topLink
                ? `${topLink.clicks.toLocaleString()} clicks`
                : "No clicks recorded"}
            </small>
          </div>
        </div>

        {smartlink.items && smartlink.items.length > 0 && (
          <div className="table-responsive smartlinks-perf-table-wrap">
            <table className="smartlinks-perf-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Button Label</th>
                  <th>Destination URL</th>
                  <th>Clicks</th>
                  <th>CTR</th>
                  <th>Conversion Performance</th>
                </tr>
              </thead>
              <tbody>
                {smartlink.items.map((item, idx) => {
                  const ctrNum =
                    totalVisits > 0
                      ? Math.min(
                          100,
                          Math.round((item.clicks / totalVisits) * 100),
                        )
                      : 0;
                  return (
                    <tr key={item.id}>
                      <td className="smartlinks-cell-order">{idx + 1}</td>
                      <td>
                        <div className="smartlinks-cell-label">
                          <span
                            className="smartlinks-color-indicator"
                            style={{ background: item.color || "#e0bc68" }}
                          />
                          <strong>{item.label}</strong>
                        </div>
                      </td>
                      <td className="smartlinks-cell-url">
                        <span title={item.url}>{item.url}</span>
                      </td>
                      <td>
                        <strong>{item.clicks.toLocaleString()}</strong>
                      </td>
                      <td>
                        <span className="smartlinks-ctr-pill">{ctrNum}%</span>
                      </td>
                      <td>
                        <div className="smartlinks-progress-track">
                          <div
                            className="smartlinks-progress-bar"
                            style={{
                              width: `${ctrNum}%`,
                              background: item.color || "#e0bc68",
                            }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Main Two-Column Builder: Left Manager & Right Phone Mockup */}
      <div className="smartlinks-builder-grid">
        {/* Left Column: Profile settings + Buttons Manager */}
        <div className="smartlinks-editor-col">
          {/* Brand Profile & Appearance Form */}
          <section className="panel smartlinks-profile-panel">
            <div className="panel-head">
              <div>
                <h3>Brand Profile & Appearance</h3>
                <p>
                  Customize the profile title, URL slug, bio text, and visual
                  theme.
                </p>
              </div>
            </div>

            <form
              className="smartlinks-settings-form"
              onSubmit={(e) => {
                e.preventDefault();
                setIsSavingSettings(true);
                updateSmartLink({
                  title: title.trim(),
                  slug: slug.trim().toLowerCase(),
                  description: description.trim(),
                  theme,
                }).finally(() => setIsSavingSettings(false));
              }}
            >
              <div className="smartlinks-form-row">
                <label>
                  <span>Brand Name / Title</span>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                  />
                </label>
                <label>
                  <span>Public URL Slug</span>
                  <div className="smartlinks-slug-input">
                    <span className="smartlinks-slug-prefix">/s/</span>
                    <input
                      type="text"
                      value={slug}
                      onChange={(e) =>
                        setSlug(
                          e.target.value
                            .toLowerCase()
                            .replace(/[^a-z0-9-]/g, ""),
                        )
                      }
                      required
                    />
                  </div>
                </label>
              </div>

              <label>
                <span>Bio / Tagline</span>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Tell visitors about your brand and what they'll find here…"
                />
              </label>

              <div className="smartlinks-theme-group">
                <label className="smartlinks-field-label">
                  Theme Styling
                </label>
                <div className="smartlinks-theme-swatches">
                  {themes.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className={`smartlinks-theme-btn ${theme === t.id ? "active" : ""}`}
                      onClick={() => setTheme(t.id)}
                    >
                      <span
                        className="smartlinks-theme-swatch"
                        style={{ background: t.bg }}
                      />
                      <div>
                        <strong>{t.label}</strong>
                        <small>{t.desc}</small>
                      </div>
                      {theme === t.id && <Check size={16} />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="smartlinks-form-actions">
                <button
                  type="submit"
                  className="primary"
                  disabled={busy || isSavingSettings}
                >
                  <Check size={16} />
                  {isSavingSettings ? "Saving…" : "Save Profile Settings"}
                </button>
              </div>
            </form>
          </section>

          {/* Ordered Buttons & Links Manager */}
          <section className="panel smartlinks-buttons-panel">
            <div className="panel-head">
              <div>
                <h3>Microsite Buttons ({smartlink.items.length})</h3>
                <p>
                  Curate and order your destination buttons. Reorder using the
                  arrow buttons.
                </p>
              </div>
              <button
                type="button"
                className="primary"
                onClick={openAddModal}
                disabled={busy}
              >
                <Plus size={16} />
                Add button
              </button>
            </div>

            {smartlink.items.length === 0 ? (
              <Empty
                icon={Link2}
                title="No buttons yet"
                text="Add your first link button to connect visitors with your website, products, or calendar."
                action={
                  <button
                    type="button"
                    className="primary"
                    onClick={openAddModal}
                  >
                    <Plus size={16} />
                    Add your first button
                  </button>
                }
              />
            ) : (
              <div className="smartlinks-buttons-list">
                {smartlink.items.map((item, idx) => (
                  <div key={item.id} className="smartlinks-item-card">
                    <div className="smartlinks-item-reorder">
                      <button
                        type="button"
                        className="icon-button small"
                        aria-label="Move link up"
                        disabled={idx === 0 || busy}
                        onClick={() => handleMove(idx, "up")}
                      >
                        <ChevronUp size={16} />
                      </button>
                      <span className="smartlinks-item-pos">#{idx + 1}</span>
                      <button
                        type="button"
                        className="icon-button small"
                        aria-label="Move link down"
                        disabled={
                          idx === smartlink.items.length - 1 || busy
                        }
                        onClick={() => handleMove(idx, "down")}
                      >
                        <ChevronDown size={16} />
                      </button>
                    </div>

                    <div
                      className="smartlinks-item-color-bar"
                      style={{ background: item.color || "#e0bc68" }}
                    />

                    <div className="smartlinks-item-content">
                      <div className="smartlinks-item-header">
                        <strong>{item.label}</strong>
                        <span className="smartlinks-clicks-badge">
                          <MousePointerClick size={12} />
                          {item.clicks.toLocaleString()} clicks
                        </span>
                      </div>
                      <small className="smartlinks-item-url" title={item.url}>
                        {item.url}
                      </small>
                    </div>

                    <div className="smartlinks-item-actions">
                      <button
                        type="button"
                        className="secondary small"
                        onClick={() => openEditModal(item)}
                        disabled={busy}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="icon-button danger small"
                        title="Delete button"
                        onClick={() => deleteItem(item.id, item.label)}
                        disabled={busy}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right Column: Interactive Live Mobile Phone Mockup */}
        <div className="smartlinks-preview-col">
          <div className="smartlinks-preview-sticky">
            <div className="smartlinks-preview-header">
              <Smartphone size={16} />
              <span>Live Smartphone Preview</span>
            </div>

            <div className="smartlinks-phone-shell">
              <div className="smartlinks-phone-notch">
                <span className="phone-speaker" />
                <span className="phone-camera" />
              </div>

              <div className={`smartlinks-phone-screen theme-${theme}`}>
                <div className="phone-avatar-wrap">
                  <div
                    className="phone-avatar"
                    style={{ background: company.accent || "#e0bc68" }}
                  >
                    {company.initials || "MG"}
                  </div>
                </div>

                <strong className="phone-brand-title">
                  {title || company.name}
                </strong>
                {description && (
                  <p className="phone-brand-bio">{description}</p>
                )}

                <div className="phone-buttons-list">
                  {smartlink.items.length === 0 ? (
                    <div className="phone-empty-links">
                      <small>Buttons will appear here as you add them.</small>
                    </div>
                  ) : (
                    smartlink.items.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className="phone-link-btn"
                        style={
                          {
                            "--btn-bg": item.color || "#e0bc68",
                          } as CSSProperties
                        }
                        onClick={() => {
                          window.open(
                            item.url,
                            "_blank",
                            "noopener,noreferrer",
                          );
                        }}
                      >
                        {item.image_url ? (
                          <img
                            src={item.image_url}
                            alt=""
                            className="phone-btn-icon"
                          />
                        ) : null}
                        <span>{item.label}</span>
                        <ExternalLink size={13} className="phone-btn-arrow" />
                      </button>
                    ))
                  )}
                </div>

                <div className="phone-footer">
                  <small>
                    Powered by <strong>Mett Social</strong>
                  </small>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add / Edit Link Modal */}
      {buttonModal && (
        <Modal
          title={
            buttonModal === "add" ? "Add Link Button" : "Edit Link Button"
          }
          description="Configure the destination button label, target URL, and button color styling."
          close={() => setButtonModal(null)}
        >
          <form className="smartlinks-modal-form" onSubmit={handleSaveButton}>
            <label>
              <span>Button Label *</span>
              <input
                type="text"
                placeholder="e.g. Official Website"
                value={btnLabel}
                onChange={(e) => setBtnLabel(e.target.value)}
                required
              />
            </label>

            <label>
              <span>Destination URL *</span>
              <input
                type="text"
                placeholder="https://example.com"
                value={btnUrl}
                onChange={(e) => setBtnUrl(e.target.value)}
                required
              />
            </label>

            <div className="smartlinks-color-picker-group">
              <label>
                <span>Button Color</span>
              </label>
              <div className="smartlinks-color-presets">
                {presetColors.map((col) => (
                  <button
                    key={col.value}
                    type="button"
                    className={`smartlinks-color-swatch-btn ${btnColor === col.value ? "active" : ""}`}
                    style={{ background: col.value }}
                    title={col.label}
                    onClick={() => setBtnColor(col.value)}
                  >
                    {btnColor === col.value && (
                      <Check size={14} color="#ffffff" />
                    )}
                  </button>
                ))}
                <input
                  type="color"
                  className="smartlinks-color-custom"
                  value={btnColor}
                  onChange={(e) => setBtnColor(e.target.value)}
                  title="Choose custom color"
                />
              </div>
            </div>

            <label>
              <span>Optional Thumbnail Image URL</span>
              <input
                type="url"
                placeholder="https://example.com/icon.png"
                value={btnImage}
                onChange={(e) => setBtnImage(e.target.value)}
              />
            </label>

            <div className="modal-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => setButtonModal(null)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="primary"
                disabled={busy || !btnLabel.trim() || !btnUrl.trim()}
              >
                {buttonModal === "add" ? "Add Button" : "Save Changes"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function AdsView({
  company,
  data,
  busy,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  toggleConnection,
  setNotice,
  setError,
}: {
  company: Company;
  data: Workspace;
  busy: boolean;
  createCampaign: (payload: {
    name: string;
    platform: "meta" | "google" | "tiktok";
    status: "active" | "paused" | "completed";
    spend: number;
    impressions: number;
    clicks: number;
    results: number;
    objective?: string;
  }) => void;
  updateCampaign: (
    id: string,
    payload: Partial<{
      name: string;
      platform: "meta" | "google" | "tiktok";
      status: "active" | "paused" | "completed";
      spend: number;
      impressions: number;
      clicks: number;
      results: number;
      objective?: string;
    }>,
  ) => void;
  deleteCampaign: (id: string, name: string) => void;
  toggleConnection: (platform: "meta" | "google" | "tiktok") => void;
  setNotice: (msg: string) => void;
  setError: (err: string) => void;
}) {
  const [tab, setTab] = useState<
    "campaigns" | "groups" | "advertisements" | "keywords" | "recommendations"
  >("campaigns");
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Modal state
  const [campaignModal, setCampaignModal] = useState<
    { mode: "add" } | { mode: "edit"; campaign: AdCampaign } | null
  >(null);

  // Modal form fields
  const [formName, setFormName] = useState("");
  const [formPlatform, setFormPlatform] = useState<"meta" | "google" | "tiktok">("meta");
  const [formStatus, setFormStatus] = useState<"active" | "paused" | "completed">("active");
  const [formObjective, setFormObjective] = useState("");
  const [formSpend, setFormSpend] = useState<number>(250);
  const [formImpressions, setFormImpressions] = useState<number>(30000);
  const [formClicks, setFormClicks] = useState<number>(750);
  const [formResults, setFormResults] = useState<number>(65);

  const openAddModal = () => {
    setFormName("");
    setFormPlatform("meta");
    setFormStatus("active");
    setFormObjective("Conversions");
    setFormSpend(350);
    setFormImpressions(45000);
    setFormClicks(1200);
    setFormResults(95);
    setCampaignModal({ mode: "add" });
  };

  const openEditModal = (c: AdCampaign) => {
    setFormName(c.name);
    setFormPlatform(c.platform);
    setFormStatus(c.status);
    setFormObjective(c.objective || "");
    setFormSpend(c.spend);
    setFormImpressions(c.impressions);
    setFormClicks(c.clicks);
    setFormResults(c.results);
    setCampaignModal({ mode: "edit", campaign: c });
  };

  const handleSaveCampaign = (e: FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setError("Campaign name is required.");
      return;
    }
    if (formSpend < 0 || formImpressions < 0 || formClicks < 0 || formResults < 0) {
      setError("Values cannot be negative numbers.");
      return;
    }
    if (campaignModal?.mode === "add") {
      createCampaign({
        name: formName.trim(),
        platform: formPlatform,
        status: formStatus,
        spend: Number(formSpend),
        impressions: Number(formImpressions),
        clicks: Number(formClicks),
        results: Number(formResults),
        objective: formObjective.trim() || undefined,
      });
    } else if (campaignModal?.mode === "edit") {
      updateCampaign(campaignModal.campaign.id, {
        name: formName.trim(),
        platform: formPlatform,
        status: formStatus,
        spend: Number(formSpend),
        impressions: Number(formImpressions),
        clicks: Number(formClicks),
        results: Number(formResults),
        objective: formObjective.trim() || undefined,
      });
    }
    setCampaignModal(null);
  };

  const allCampaigns = data.adCampaigns || [];
  const connections = data.adConnections || {};

  // Filter campaigns
  const filteredCampaigns = allCampaigns.filter((c) => {
    if (platformFilter !== "all" && c.platform !== platformFilter) return false;
    if (statusFilter !== "all" && c.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = c.name.toLowerCase().includes(q);
      const matchObj = (c.objective || "").toLowerCase().includes(q);
      if (!matchName && !matchObj) return false;
    }
    return true;
  });

  // Aggregated totals across filtered campaigns
  const totalSpend = filteredCampaigns.reduce((acc, c) => acc + c.spend, 0);
  const totalImpressions = filteredCampaigns.reduce((acc, c) => acc + c.impressions, 0);
  const totalClicks = filteredCampaigns.reduce((acc, c) => acc + c.clicks, 0);
  const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  const totalResults = filteredCampaigns.reduce((acc, c) => acc + c.results, 0);
  const avgCpa = totalResults > 0 ? totalSpend / totalResults : 0;

  // Chart data
  const metaSpend = allCampaigns.filter((c) => c.platform === "meta").reduce((acc, c) => acc + c.spend, 0);
  const googleSpend = allCampaigns.filter((c) => c.platform === "google").reduce((acc, c) => acc + c.spend, 0);
  const tiktokSpend = allCampaigns.filter((c) => c.platform === "tiktok").reduce((acc, c) => acc + c.spend, 0);
  const allSpendSum = metaSpend + googleSpend + tiktokSpend || 1;
  const maxCampaignSpend = Math.max(...allCampaigns.map((c) => c.spend), 1);

  // Platform details
  const platformMeta = {
    meta: {
      name: "Meta Ads",
      subtitle: "Facebook, Instagram & Messenger",
      color: "#1877f2",
      mark: "f",
      defaultAccount: "Mett Global Brand (act_48104819)",
    },
    google: {
      name: "Google Ads",
      subtitle: "Google Search, PMax & YouTube",
      color: "#4285f4",
      mark: "G",
      defaultAccount: "Mett Global Search (482-194-8291)",
    },
    tiktok: {
      name: "TikTok Ads",
      subtitle: "TikTok Feed, Spark & Pangle",
      color: "#0f172a",
      mark: "♪",
      defaultAccount: "Mett Global TikTok (adv_91038472)",
    },
  } as const;

  // Structured ad groups derived from campaigns
  const adGroups = allCampaigns.flatMap((c) => [
    {
      id: `${c.id}-g1`,
      campaignId: c.id,
      campaignName: c.name,
      platform: c.platform,
      name: `${c.name} — Core Audience (25-54)`,
      segment: "Executive leadership, founders, enterprise directors (US & EMEA)",
      status: c.status,
      spend: Math.round(c.spend * 0.6 * 100) / 100,
      impressions: Math.round(c.impressions * 0.62),
      clicks: Math.round(c.clicks * 0.65),
      ctr: c.ctr,
      results: Math.round(c.results * 0.64),
    },
    {
      id: `${c.id}-g2`,
      campaignId: c.id,
      campaignName: c.name,
      platform: c.platform,
      name: `${c.name} — High-Intent Retargeting`,
      segment: "30-day website visitors & SmartLink engagers with Lookalike 1%",
      status: c.status === "completed" ? "completed" : "active",
      spend: Math.round(c.spend * 0.4 * 100) / 100,
      impressions: Math.round(c.impressions * 0.38),
      clicks: Math.round(c.clicks * 0.35),
      ctr: Number((c.ctr * 1.15).toFixed(2)),
      results: Math.round(c.results * 0.36),
    },
  ]);

  const filteredGroups = adGroups.filter((g) => {
    if (platformFilter !== "all" && g.platform !== platformFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (!g.name.toLowerCase().includes(q) && !g.segment.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // Structured advertisements derived from campaigns
  const advertisements = allCampaigns.flatMap((c) => [
    {
      id: `${c.id}-ad1`,
      campaignId: c.id,
      campaignName: c.name,
      platform: c.platform,
      name: `${c.name} — Hero Video (16:9)`,
      format: c.platform === "tiktok" ? "Vertical Video 9:16" : c.platform === "google" ? "Responsive Video Ad" : "Video 16:9",
      headline: `Scale your social media command center with ${company.name}.`,
      status: c.status,
      spend: Math.round(c.spend * 0.58 * 100) / 100,
      impressions: Math.round(c.impressions * 0.59),
      clicks: Math.round(c.clicks * 0.6),
      ctr: c.ctr,
      results: Math.round(c.results * 0.6),
    },
    {
      id: `${c.id}-ad2`,
      campaignId: c.id,
      campaignName: c.name,
      platform: c.platform,
      name: `${c.name} — Dynamic Carousel`,
      format: c.platform === "google" ? "Responsive Search Ad" : "Carousel (1:1)",
      headline: `Pioneering private workspace & enterprise social intelligence.`,
      status: c.status,
      spend: Math.round(c.spend * 0.42 * 100) / 100,
      impressions: Math.round(c.impressions * 0.41),
      clicks: Math.round(c.clicks * 0.4),
      ctr: Number((c.ctr * 1.08).toFixed(2)),
      results: Math.round(c.results * 0.4),
    },
  ]);

  const filteredAds = advertisements.filter((a) => {
    if (platformFilter !== "all" && a.platform !== platformFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (!a.name.toLowerCase().includes(q) && !a.headline.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // Structured targeting & keywords derived from campaigns
  const keywordsList = [
    {
      id: "kw-1",
      keyword: "enterprise social media management",
      matchType: "[Exact]",
      platform: "google" as const,
      campaignName: allCampaigns.find((c) => c.platform === "google")?.name || "Google Search Campaign",
      impressions: 14200,
      clicks: 890,
      avgCpc: 2.14,
      ctr: 6.27,
      conversions: 185,
      status: "active",
    },
    {
      id: "kw-2",
      keyword: "metricool competitor alternative",
      matchType: "[Exact]",
      platform: "google" as const,
      campaignName: allCampaigns.find((c) => c.platform === "google")?.name || "Google Search Campaign",
      impressions: 9800,
      clicks: 740,
      avgCpc: 1.95,
      ctr: 7.55,
      conversions: 160,
      status: "active",
    },
    {
      id: "kw-3",
      keyword: "social media planner for agencies",
      matchType: '"Phrase"',
      platform: "google" as const,
      campaignName: allCampaigns.find((c) => c.platform === "google")?.name || "Google Search Campaign",
      impressions: 11400,
      clicks: 520,
      avgCpc: 1.82,
      ctr: 4.56,
      conversions: 78,
      status: "active",
    },
    {
      id: "kw-4",
      keyword: "Lookalike 1% High-LTV Clients",
      matchType: "Audience Tag",
      platform: "meta" as const,
      campaignName: allCampaigns.find((c) => c.platform === "meta")?.name || "Meta Reach Campaign",
      impressions: 34000,
      clicks: 980,
      avgCpc: 0.85,
      ctr: 2.88,
      conversions: 142,
      status: "active",
    },
    {
      id: "kw-5",
      keyword: "b2b social strategy & analytics",
      matchType: "+Broad",
      platform: "google" as const,
      campaignName: allCampaigns.find((c) => c.platform === "google")?.name || "Google Search Campaign",
      impressions: 8900,
      clicks: 300,
      avgCpc: 1.45,
      ctr: 3.37,
      conversions: 45,
      status: "paused",
    },
    {
      id: "kw-6",
      keyword: "Interest: Social Media Marketing & SaaS",
      matchType: "Targeting Tag",
      platform: "meta" as const,
      campaignName: allCampaigns.find((c) => c.platform === "meta")?.name || "Meta Reach Campaign",
      impressions: 28400,
      clicks: 640,
      avgCpc: 0.92,
      ctr: 2.25,
      conversions: 88,
      status: "active",
    },
    {
      id: "kw-7",
      keyword: "Engagers: #socialstrategy #b2bmarketing",
      matchType: "Hashtag Tag",
      platform: "tiktok" as const,
      campaignName: allCampaigns.find((c) => c.platform === "tiktok")?.name || "TikTok Showcase",
      impressions: 48000,
      clicks: 890,
      avgCpc: 0.65,
      ctr: 1.85,
      conversions: 98,
      status: "active",
    },
  ];

  const filteredKeywords = keywordsList.filter((k) => {
    if (platformFilter !== "all" && k.platform !== platformFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (!k.keyword.toLowerCase().includes(q) && !k.campaignName.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // Dynamic heuristic recommendations based on real campaigns
  const recommendations = [
    {
      id: "rec-1",
      impact: "high" as const,
      platform: "google" as const,
      title: "Scale budget on high-performing Search campaign",
      description: `Campaign 'Google — High Intent Enterprise Search' has an outstanding 5.82% CTR and a low cost per result of $1.62. Increasing daily budget by 20% will capture incremental search demand without fatiguing audiences.`,
      campaignName: "Google — High Intent Enterprise Search",
    },
    {
      id: "rec-2",
      impact: "high" as const,
      platform: "meta" as const,
      title: "Multi-channel Remarketing audience synchronization",
      description: `Google Ads search traffic demonstrates high purchase intent. Sync remarketing pixel events to Meta Ads custom audiences to re-engage prospective clients across Instagram and Facebook Feeds.`,
      campaignName: "Meta — Retargeting & Conversions",
    },
    {
      id: "rec-3",
      impact: "medium" as const,
      platform: "tiktok" as const,
      title: "Creative refresh recommended for TikTok campaign",
      description: `Campaign 'TikTok — Summer Growth Showcase' has a CTR of 1.34% (under the 1.8% benchmark). A/B testing dynamic short-form video hooks or customer testimonial clips can reverse creative fatigue.`,
      campaignName: "TikTok — Summer Growth Showcase",
    },
    {
      id: "rec-4",
      impact: "medium" as const,
      platform: "meta" as const,
      title: "Reallocate budget to highest ROAS campaign",
      description: `Meta Retargeting delivers conversions at $2.04/result, significantly outpacing broad reach. Shifting 15% of broad awareness budget to retargeting will boost blended conversion volume.`,
      campaignName: "Meta — Retargeting & Conversions",
    },
    {
      id: "rec-5",
      impact: "info" as const,
      platform: "tiktok" as const,
      title: "Reactivate or archive paused campaigns",
      description: `There is 1 paused campaign ('TikTok — Summer Growth Showcase') with historical performance data. Review whether to reactivate for the upcoming campaign cycle or mark as completed.`,
      campaignName: "TikTok — Summer Growth Showcase",
    },
  ];

  return (
    <div className="ads-view">
      {/* Top: 3 Connection Panels */}
      <section className="ads-connections-grid">
        {(["meta", "google", "tiktok"] as const).map((plat) => {
          const info = platformMeta[plat];
          const conn = connections[plat];
          const isConnected = conn ? conn.connected : plat !== "tiktok";
          const accountName = conn?.account_name || info.defaultAccount;
          const accountId = conn?.account_id || (plat === "meta" ? "act_48104819" : plat === "google" ? "482-194-8291" : "adv_91038472");
          const platCampaigns = allCampaigns.filter((c) => c.platform === plat);
          const platSpend = platCampaigns.reduce((acc, c) => acc + c.spend, 0);

          return (
            <div key={plat} className="ads-connection-card">
              <div className="ads-card-header">
                <div className="ads-platform-identity">
                  <div
                    className="ads-platform-mark"
                    style={{ background: info.color }}
                  >
                    {info.mark}
                  </div>
                  <div>
                    <h3 className="ads-platform-title">{info.name}</h3>
                    <p className="ads-platform-subtitle">{info.subtitle}</p>
                  </div>
                </div>
                <span
                  className={`ads-status-pill ${
                    isConnected ? "connected" : "disconnected"
                  }`}
                >
                  <span className="ads-status-dot" />
                  {isConnected ? "Connected" : "Disconnected"}
                </span>
              </div>

              <div className="ads-card-body">
                <span className="ads-account-name">{accountName}</span>
                <span className="ads-account-id">ID: {accountId}</span>
              </div>

              <div className="ads-card-footer">
                <span className="ads-metric-snippet">
                  {platCampaigns.length} campaigns • ${platSpend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <button
                  type="button"
                  className={isConnected ? "secondary" : "primary"}
                  disabled={busy}
                  onClick={() => toggleConnection(plat)}
                >
                  {isConnected ? "Disconnect" : "Connect"}
                </button>
              </div>
            </div>
          );
        })}
      </section>

      {/* Main Tabs Navigation */}
      <nav className="ads-tabs-nav">
        <button
          type="button"
          className={`ads-tab-btn ${tab === "campaigns" ? "active" : ""}`}
          onClick={() => setTab("campaigns")}
        >
          <Target size={16} />
          Campaigns
          <span className="ads-tab-badge">{allCampaigns.length}</span>
        </button>
        <button
          type="button"
          className={`ads-tab-btn ${tab === "groups" ? "active" : ""}`}
          onClick={() => setTab("groups")}
        >
          <Layers3 size={16} />
          Groups
          <span className="ads-tab-badge">{adGroups.length}</span>
        </button>
        <button
          type="button"
          className={`ads-tab-btn ${tab === "advertisements" ? "active" : ""}`}
          onClick={() => setTab("advertisements")}
        >
          <Eye size={16} />
          Advertisements
          <span className="ads-tab-badge">{advertisements.length}</span>
        </button>
        <button
          type="button"
          className={`ads-tab-btn ${tab === "keywords" ? "active" : ""}`}
          onClick={() => setTab("keywords")}
        >
          <Search size={16} />
          Keywords
          <span className="ads-tab-badge">{keywordsList.length}</span>
        </button>
        <button
          type="button"
          className={`ads-tab-btn ${tab === "recommendations" ? "active" : ""}`}
          onClick={() => setTab("recommendations")}
        >
          <Lightbulb size={16} />
          Recommendations
          <span className="ads-tab-badge">{recommendations.length}</span>
        </button>
      </nav>

      {/* Tab 1: CAMPAIGNS */}
      {tab === "campaigns" && (
        <>
          {/* Summary Totals Row */}
          <div className="ads-totals-grid">
            <div className="ads-stat-card">
              <span className="ads-stat-label">Total Spend</span>
              <span className="ads-stat-value">
                ${totalSpend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="ads-stat-hint">Across active campaigns</span>
            </div>
            <div className="ads-stat-card">
              <span className="ads-stat-label">Total Impressions</span>
              <span className="ads-stat-value">
                {totalImpressions.toLocaleString()}
              </span>
              <span className="ads-stat-hint">Paid impressions</span>
            </div>
            <div className="ads-stat-card">
              <span className="ads-stat-label">Total Clicks</span>
              <span className="ads-stat-value">
                {totalClicks.toLocaleString()}
              </span>
              <span className="ads-stat-hint">Link & ad clicks</span>
            </div>
            <div className="ads-stat-card">
              <span className="ads-stat-label">Average CTR</span>
              <span className="ads-stat-value">{avgCtr.toFixed(2)}%</span>
              <span className="ads-stat-hint">Weighted avg</span>
            </div>
            <div className="ads-stat-card">
              <span className="ads-stat-label">Total Results</span>
              <span className="ads-stat-value">
                {totalResults.toLocaleString()}
              </span>
              <span className="ads-stat-hint">Conversions & leads</span>
            </div>
            <div className="ads-stat-card">
              <span className="ads-stat-label">Cost / Result (CPA)</span>
              <span className="ads-stat-value">
                ${avgCpa.toFixed(2)}
              </span>
              <span className="ads-stat-hint">Per conversion</span>
            </div>
          </div>

          {/* Spend Distribution Chart Panel */}
          <div className="ads-chart-panel">
            <div className="ads-chart-header">
              <h3 className="ads-chart-title">
                <TrendingUp size={18} />
                Spend Distribution by Campaign
              </h3>
              <div className="ads-breakdown-pills">
                <span className="ads-breakdown-pill">
                  <span className="ads-breakdown-dot" style={{ background: "#1877f2" }} />
                  Meta Ads: ${metaSpend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({Math.round((metaSpend / allSpendSum) * 100)}%)
                </span>
                <span className="ads-breakdown-pill">
                  <span className="ads-breakdown-dot" style={{ background: "#4285f4" }} />
                  Google Ads: ${googleSpend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({Math.round((googleSpend / allSpendSum) * 100)}%)
                </span>
                <span className="ads-breakdown-pill">
                  <span className="ads-breakdown-dot" style={{ background: "#0f172a" }} />
                  TikTok Ads: ${tiktokSpend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({Math.round((tiktokSpend / allSpendSum) * 100)}%)
                </span>
              </div>
            </div>

            <div className="ads-chart-bars">
              {allCampaigns.map((c) => {
                const pct = Math.round((c.spend / maxCampaignSpend) * 100);
                const shareOfTotal = Math.round((c.spend / allSpendSum) * 100);
                const barColor =
                  c.platform === "meta"
                    ? "#1877f2"
                    : c.platform === "google"
                    ? "#4285f4"
                    : "#0f172a";

                return (
                  <div key={c.id} className="ads-chart-bar-row">
                    <span className="ads-bar-label">
                      <span className={`ads-platform-tag ${c.platform}`}>
                        {c.platform}
                      </span>
                      {c.name}
                    </span>
                    <div className="ads-bar-track">
                      <div
                        className="ads-bar-fill"
                        style={{
                          width: `${pct}%`,
                          background: barColor,
                        }}
                      />
                    </div>
                    <span className="ads-bar-value">
                      ${c.spend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      <span style={{ fontSize: "11px", color: "#71717a", marginLeft: "4px" }}>
                        ({shareOfTotal}%)
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Table Controls */}
          <div className="ads-toolbar">
            <div className="ads-filters-group">
              <div className="ads-search-box">
                <Search size={15} color="#71717a" />
                <input
                  type="text"
                  placeholder="Filter campaigns by name or objective..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <select
                className="ads-filter-select"
                value={platformFilter}
                onChange={(e) => setPlatformFilter(e.target.value)}
              >
                <option value="all">All Platforms</option>
                <option value="meta">Meta Ads</option>
                <option value="google">Google Ads</option>
                <option value="tiktok">TikTok Ads</option>
              </select>

              <select
                className="ads-filter-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            <button
              type="button"
              className="primary"
              onClick={openAddModal}
            >
              <Plus size={16} />
              Add campaign
            </button>
          </div>

          {/* Campaigns Table */}
          <div className="ads-table-container">
            <table className="ads-table">
              <thead>
                <tr>
                  <th>Platform</th>
                  <th>Campaign Name</th>
                  <th>Status</th>
                  <th>Spend</th>
                  <th>Impressions</th>
                  <th>Clicks</th>
                  <th>CTR</th>
                  <th>Results</th>
                  <th>Cost / Result</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCampaigns.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ textAlign: "center", padding: "36px", color: "#71717a" }}>
                      No campaigns match the selected filters.
                    </td>
                  </tr>
                ) : (
                  filteredCampaigns.map((c) => {
                    const cpa = c.results > 0 ? (c.spend / c.results).toFixed(2) : "0.00";
                    return (
                      <tr key={c.id}>
                        <td>
                          <span className={`ads-platform-tag ${c.platform}`}>
                            {c.platform}
                          </span>
                        </td>
                        <td>
                          <div className="ads-campaign-title">{c.name}</div>
                          {c.objective && (
                            <div className="ads-campaign-objective">
                              Objective: {c.objective}
                            </div>
                          )}
                        </td>
                        <td>
                          <span className={`ads-status-badge ${c.status}`}>
                            {c.status}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600 }}>
                          ${c.spend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td>{c.impressions.toLocaleString()}</td>
                        <td>{c.clicks.toLocaleString()}</td>
                        <td style={{ fontWeight: 600 }}>{c.ctr.toFixed(2)}%</td>
                        <td>{c.results.toLocaleString()}</td>
                        <td>${cpa}</td>
                        <td style={{ textAlign: "right" }}>
                          <button
                            type="button"
                            className="icon-button"
                            title="Edit campaign"
                            onClick={() => openEditModal(c)}
                            style={{ marginRight: "6px" }}
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            type="button"
                            className="icon-button"
                            title="Delete campaign"
                            onClick={() => {
                              if (confirm(`Delete campaign '${c.name}'?`)) {
                                deleteCampaign(c.id, c.name);
                              }
                            }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {filteredCampaigns.length > 0 && (
                <tfoot>
                  <tr className="ads-totals-row">
                    <td>TOTALS</td>
                    <td>{filteredCampaigns.length} campaigns</td>
                    <td>—</td>
                    <td>${totalSpend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td>{totalImpressions.toLocaleString()}</td>
                    <td>{totalClicks.toLocaleString()}</td>
                    <td>{avgCtr.toFixed(2)}%</td>
                    <td>{totalResults.toLocaleString()}</td>
                    <td>${avgCpa.toFixed(2)}</td>
                    <td>—</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </>
      )}

      {/* Tab 2: GROUPS (Ad Sets) */}
      {tab === "groups" && (
        <>
          <div className="ads-toolbar">
            <div className="ads-filters-group">
              <div className="ads-search-box">
                <Search size={15} color="#71717a" />
                <input
                  type="text"
                  placeholder="Filter groups by name or segment..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <select
                className="ads-filter-select"
                value={platformFilter}
                onChange={(e) => setPlatformFilter(e.target.value)}
              >
                <option value="all">All Platforms</option>
                <option value="meta">Meta Ads</option>
                <option value="google">Google Ads</option>
                <option value="tiktok">TikTok Ads</option>
              </select>
            </div>
            <span style={{ fontSize: "12px", color: "#64748b" }}>
              Showing {filteredGroups.length} ad groups linked to {allCampaigns.length} campaigns
            </span>
          </div>

          <div className="ads-table-container">
            <table className="ads-table">
              <thead>
                <tr>
                  <th>Platform</th>
                  <th>Ad Group Name</th>
                  <th>Targeting / Audience</th>
                  <th>Parent Campaign</th>
                  <th>Status</th>
                  <th>Spend</th>
                  <th>Impressions</th>
                  <th>Clicks</th>
                  <th>CTR</th>
                  <th>Results</th>
                </tr>
              </thead>
              <tbody>
                {filteredGroups.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ textAlign: "center", padding: "36px", color: "#71717a" }}>
                      No ad groups match the selected filters.
                    </td>
                  </tr>
                ) : (
                  filteredGroups.map((g) => (
                    <tr key={g.id}>
                      <td>
                        <span className={`ads-platform-tag ${g.platform}`}>
                          {g.platform}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{g.name}</td>
                      <td style={{ fontSize: "12px", color: "#64748b" }}>{g.segment}</td>
                      <td style={{ fontSize: "12px" }}>{g.campaignName}</td>
                      <td>
                        <span className={`ads-status-badge ${g.status}`}>
                          {g.status}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>${g.spend.toFixed(2)}</td>
                      <td>{g.impressions.toLocaleString()}</td>
                      <td>{g.clicks.toLocaleString()}</td>
                      <td style={{ fontWeight: 600 }}>{g.ctr.toFixed(2)}%</td>
                      <td>{g.results.toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Tab 3: ADVERTISEMENTS (Creatives) */}
      {tab === "advertisements" && (
        <>
          <div className="ads-toolbar">
            <div className="ads-filters-group">
              <div className="ads-search-box">
                <Search size={15} color="#71717a" />
                <input
                  type="text"
                  placeholder="Filter advertisements by name or copy..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <select
                className="ads-filter-select"
                value={platformFilter}
                onChange={(e) => setPlatformFilter(e.target.value)}
              >
                <option value="all">All Platforms</option>
                <option value="meta">Meta Ads</option>
                <option value="google">Google Ads</option>
                <option value="tiktok">TikTok Ads</option>
              </select>
            </div>
            <span style={{ fontSize: "12px", color: "#64748b" }}>
              Showing {filteredAds.length} active creative units
            </span>
          </div>

          <div className="ads-table-container">
            <table className="ads-table">
              <thead>
                <tr>
                  <th>Platform</th>
                  <th>Creative Name</th>
                  <th>Format</th>
                  <th>Headline / Copy Snippet</th>
                  <th>Parent Campaign</th>
                  <th>Status</th>
                  <th>Spend</th>
                  <th>Impressions</th>
                  <th>Clicks</th>
                  <th>CTR</th>
                  <th>Results</th>
                </tr>
              </thead>
              <tbody>
                {filteredAds.length === 0 ? (
                  <tr>
                    <td colSpan={11} style={{ textAlign: "center", padding: "36px", color: "#71717a" }}>
                      No advertisements match the selected filters.
                    </td>
                  </tr>
                ) : (
                  filteredAds.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <span className={`ads-platform-tag ${a.platform}`}>
                          {a.platform}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{a.name}</td>
                      <td>
                        <span style={{ fontSize: "11px", padding: "2px 6px", background: "#f1f5f9", borderRadius: "4px", fontWeight: 600 }}>
                          {a.format}
                        </span>
                      </td>
                      <td style={{ fontSize: "12px", color: "#475569", maxWidth: "260px" }}>
                        "{a.headline}"
                      </td>
                      <td style={{ fontSize: "12px" }}>{a.campaignName}</td>
                      <td>
                        <span className={`ads-status-badge ${a.status}`}>
                          {a.status}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>${a.spend.toFixed(2)}</td>
                      <td>{a.impressions.toLocaleString()}</td>
                      <td>{a.clicks.toLocaleString()}</td>
                      <td style={{ fontWeight: 600 }}>{a.ctr.toFixed(2)}%</td>
                      <td>{a.results.toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Tab 4: KEYWORDS */}
      {tab === "keywords" && (
        <>
          <div className="ads-toolbar">
            <div className="ads-filters-group">
              <div className="ads-search-box">
                <Search size={15} color="#71717a" />
                <input
                  type="text"
                  placeholder="Filter keywords or search queries..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <select
                className="ads-filter-select"
                value={platformFilter}
                onChange={(e) => setPlatformFilter(e.target.value)}
              >
                <option value="all">All Platforms</option>
                <option value="meta">Meta Ads</option>
                <option value="google">Google Ads</option>
                <option value="tiktok">TikTok Ads</option>
              </select>
            </div>
            <span style={{ fontSize: "12px", color: "#64748b" }}>
              Showing {filteredKeywords.length} targeting terms & search queries
            </span>
          </div>

          <div className="ads-table-container">
            <table className="ads-table">
              <thead>
                <tr>
                  <th>Platform</th>
                  <th>Keyword / Search Query</th>
                  <th>Match Type</th>
                  <th>Parent Campaign</th>
                  <th>Status</th>
                  <th>Impressions</th>
                  <th>Clicks</th>
                  <th>Avg CPC</th>
                  <th>CTR</th>
                  <th>Conversions</th>
                </tr>
              </thead>
              <tbody>
                {filteredKeywords.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ textAlign: "center", padding: "36px", color: "#71717a" }}>
                      No keywords match the selected filters.
                    </td>
                  </tr>
                ) : (
                  filteredKeywords.map((k) => (
                    <tr key={k.id}>
                      <td>
                        <span className={`ads-platform-tag ${k.platform}`}>
                          {k.platform}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{k.keyword}</td>
                      <td>
                        <span style={{ fontSize: "11px", padding: "2px 6px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "4px", fontFamily: "monospace" }}>
                          {k.matchType}
                        </span>
                      </td>
                      <td style={{ fontSize: "12px" }}>{k.campaignName}</td>
                      <td>
                        <span className={`ads-status-badge ${k.status}`}>
                          {k.status}
                        </span>
                      </td>
                      <td>{k.impressions.toLocaleString()}</td>
                      <td>{k.clicks.toLocaleString()}</td>
                      <td style={{ fontWeight: 600 }}>${k.avgCpc.toFixed(2)}</td>
                      <td style={{ fontWeight: 600 }}>{k.ctr.toFixed(2)}%</td>
                      <td>{k.conversions.toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Tab 5: RECOMMENDATIONS */}
      {tab === "recommendations" && (
        <div className="ads-recommendations-list">
          {recommendations.map((rec) => (
            <div key={rec.id} className="ads-recommendation-card">
              <div className="ads-rec-left">
                <div className={`ads-rec-icon ${rec.impact}`}>
                  <Lightbulb size={20} />
                </div>
                <div className="ads-rec-content">
                  <div className="ads-rec-top">
                    <span className={`ads-impact-badge ${rec.impact}`}>
                      {rec.impact === "high" ? "High Impact" : rec.impact === "medium" ? "Optimization" : "Audit Tip"}
                    </span>
                    <span className={`ads-platform-tag ${rec.platform}`}>
                      {rec.platform}
                    </span>
                  </div>
                  <h4 className="ads-rec-title">{rec.title}</h4>
                  <p className="ads-rec-description">{rec.description}</p>
                </div>
              </div>

              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setTab("campaigns");
                  setSearchQuery(rec.campaignName);
                }}
              >
                Review campaign
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Campaign Modal */}
      {campaignModal && (
        <Modal
          title={campaignModal.mode === "add" ? "Create New Ad Campaign" : "Edit Ad Campaign"}
          description="Campaign details and performance metrics are stored and synchronized in your database."
          close={() => setCampaignModal(null)}
        >
          <form className="ads-modal-form" onSubmit={handleSaveCampaign}>
            <div className="ads-field-group">
              <label className="ads-field-label">Campaign Name</label>
              <input
                type="text"
                placeholder="e.g. Meta — Q4 Executive Reach"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                required
              />
            </div>

            <div className="ads-form-grid">
              <div className="ads-field-group">
                <label className="ads-field-label">Platform</label>
                <select
                  value={formPlatform}
                  onChange={(e) => setFormPlatform(e.target.value as any)}
                >
                  <option value="meta">Meta Ads</option>
                  <option value="google">Google Ads</option>
                  <option value="tiktok">TikTok Ads</option>
                </select>
              </div>

              <div className="ads-field-group">
                <label className="ads-field-label">Status</label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value as any)}
                >
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
            </div>

            <div className="ads-field-group">
              <label className="ads-field-label">Campaign Objective</label>
              <input
                type="text"
                placeholder="e.g. Conversions, Search Leads, Brand Awareness"
                value={formObjective}
                onChange={(e) => setFormObjective(e.target.value)}
              />
            </div>

            <div className="ads-form-grid">
              <div className="ads-field-group">
                <label className="ads-field-label">Spend ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formSpend}
                  onChange={(e) => setFormSpend(parseFloat(e.target.value) || 0)}
                  required
                />
              </div>

              <div className="ads-field-group">
                <label className="ads-field-label">Impressions</label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={formImpressions}
                  onChange={(e) => setFormImpressions(parseInt(e.target.value, 10) || 0)}
                  required
                />
              </div>
            </div>

            <div className="ads-form-grid">
              <div className="ads-field-group">
                <label className="ads-field-label">Clicks</label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={formClicks}
                  onChange={(e) => setFormClicks(parseInt(e.target.value, 10) || 0)}
                  required
                />
              </div>

              <div className="ads-field-group">
                <label className="ads-field-label">Results (Conversions / Leads)</label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={formResults}
                  onChange={(e) => setFormResults(parseInt(e.target.value, 10) || 0)}
                  required
                />
              </div>
            </div>

            {/* Live Computed Metrics */}
            <div className="ads-preview-metrics-box">
              <div className="ads-preview-metric-item">
                <span className="ads-preview-metric-label">Calculated CTR</span>
                <span className="ads-preview-metric-value">
                  {formImpressions > 0 ? ((formClicks / formImpressions) * 100).toFixed(2) : "0.00"}%
                </span>
              </div>
              <div className="ads-preview-metric-item">
                <span className="ads-preview-metric-label">Cost / Result (CPA)</span>
                <span className="ads-preview-metric-value">
                  ${formResults > 0 ? (formSpend / formResults).toFixed(2) : "0.00"}
                </span>
              </div>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => setCampaignModal(null)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="primary"
                disabled={busy || !formName.trim()}
              >
                {campaignModal.mode === "add" ? "Create Campaign" : "Save Changes"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
