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
} from "lucide-react";
import { api } from "./api";
import { previewMode } from "./preview";
import {
  networks,
  blankVariant,
  type Company,
  type Account,
  type Media,
  type Variant,
  type Payload,
  type Post,
  type Workspace,
} from "./types";

const empty: Workspace = { accounts: [], media: [], posts: [], activities: [] };
const pages = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "planner", label: "Planner", icon: CalendarDays },
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
  const company = companies.find((c) => c.id === companyId);
  useEffect(() => {
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
  if (!auth)
    return (
      <div className="boot">
        <div className="wordmark-icon">
          M<span>•</span>
        </div>
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
        { "--company-accent": company?.accent || "#c5da83" } as CSSProperties
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
          <div className="wordmark-icon">
            M<span>•</span>
          </div>
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
                    compose={compose}
                    remove={removePost}
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
              {page === "analytics" && (
                <section className="panel analytics-empty">
                  <div className="chart-placeholder" aria-hidden="true">
                    {[25, 45, 35, 62, 51, 75, 61, 90].map((h, i) => (
                      <i key={i} style={{ height: h + "%" }} />
                    ))}
                  </div>
                  <span className="eyebrow">
                    REAL DATA. WHEN YOU’RE CONNECTED.
                  </span>
                  <h2>Your performance story starts with a connection.</h2>
                  <p>
                    Analytics will appear after official platform authorization
                    and data sync are implemented. No sample numbers are shown
                    as account performance.
                  </p>
                  <button
                    className="primary"
                    onClick={() => changePage("accounts")}
                  >
                    Manage social accounts
                    <ArrowRight size={16} />
                  </button>
                  <div className="analytics-capabilities">
                    <span>
                      <BarChart3 size={16} />
                      Account & post insights
                    </span>
                    <span>
                      <CalendarDays size={16} />
                      Date comparisons
                    </span>
                    <span>
                      <Clock3 size={16} />
                      Data freshness
                    </span>
                  </div>
                </section>
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
          <div className="wordmark-icon">
            M<span>•</span>
          </div>
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
            <input type="color" name="accent" defaultValue="#c5da83" />
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
  compose,
  remove,
}: {
  data: Workspace;
  company: Company;
  compose: (p?: Post) => void;
  remove: (p: Post) => void;
}) {
  const [view, setView] = useState("list");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [month, setMonth] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const posts = data.posts.filter(
    (p) =>
      (filter === "all" || p.status === filter) &&
      (p.title + " " + p.payload.text)
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(first);
  start.setDate(1 - ((first.getDay() + 6) % 7));
  const days = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
  const dayKey = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  function postDay(p: Post) {
    return p.scheduled_at
      ? new Intl.DateTimeFormat("en-CA", {
          timeZone: company.timezone,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date(p.scheduled_at))
      : "";
  }
  return (
    <section className="panel planner-panel">
      <div className="planner-toolbar">
        <div className="tabs">
          {[
            ["all", "All content"],
            ["draft", "Drafts"],
            ["blocked", "Needs connection"],
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
        <span className="field-help">
          <Clock3 size={14} />
          {company.timezone}
        </span>
      </div>
      {view === "list" ? (
        posts.length ? (
          <div className="post-list planner-list">
            {posts.map((p) => (
              <div className="planner-post" key={p.id}>
                <PostRow
                  post={p}
                  accounts={data.accounts}
                  timezone={company.timezone}
                  edit={() => compose(p)}
                />
                <button
                  className="icon-button"
                  aria-label={"Delete post " + p.title}
                  onClick={() => remove(p)}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <Empty
            title="A blank page is a good beginning."
            text={
              search
                ? "No content matches your search."
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
            <h3>
              {month.toLocaleDateString("en", {
                month: "long",
                year: "numeric",
              })}
            </h3>
            <div>
              <button
                className="secondary"
                onClick={() =>
                  setMonth(
                    new Date(
                      new Date().getFullYear(),
                      new Date().getMonth(),
                      1,
                    ),
                  )
                }
              >
                Today
              </button>
              <button
                className="icon-button"
                aria-label="Previous month"
                onClick={() =>
                  setMonth(
                    new Date(month.getFullYear(), month.getMonth() - 1, 1),
                  )
                }
              >
                <ChevronLeft size={18} />
              </button>
              <button
                className="icon-button"
                aria-label="Next month"
                onClick={() =>
                  setMonth(
                    new Date(month.getFullYear(), month.getMonth() + 1, 1),
                  )
                }
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
          <div className="calendar-scroll">
            <div className="calendar-grid">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                <div className="weekday" key={d}>
                  {d}
                </div>
              ))}
              {days.map((d) => (
                <div
                  className={
                    "calendar-day " +
                    (d.getMonth() !== month.getMonth() ? "outside" : "")
                  }
                  key={dayKey(d)}
                >
                  <span
                    className={
                      dayKey(d) === dayKey(new Date()) ? "today-number" : ""
                    }
                  >
                    {d.getDate()}
                  </span>
                  {posts
                    .filter((p) => postDay(p) === dayKey(d))
                    .map((p) => (
                      <button
                        className={"calendar-post " + p.status}
                        key={p.id}
                        onClick={() => compose(p)}
                      >
                        {p.title}
                      </button>
                    ))}
                </div>
              ))}
            </div>
          </div>
          <p className="calendar-note">
            Undated drafts appear in List view. Queue items marked “Needs
            connection” will not auto-publish.
          </p>
        </>
      )}
    </section>
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
            Brand colors and monogram are provisional. The official Mett Global
            logo and palette have not been verified from mettglobal.com.
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
  save,
}: {
  company: Company;
  data: Workspace;
  existing: Post | null;
  close: () => void;
  busy: boolean;
  error: string;
  save: (p: Payload) => void;
}) {
  const destinationAccounts = data.accounts.filter(
    (a) => a.platform !== "drive",
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
  const toWall = (date: Date, timezone: string) => {
    const f = new Intl.DateTimeFormat("sv-SE", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
    return f.replace(" ", "T");
  };
  const [wall, setWall] = useState(
    toWall(
      payload.scheduledAt ? new Date(payload.scheduledAt) : defaultDate,
      payload.timezone,
    ),
  );
  const account = destinationAccounts.find((a) => a.id === tab);
  const override = account ? payload.overrides[account.id] : null;
  const previewAccount =
    destinationAccounts.find(
      (a) => a.id === previewId && payload.accountIds.includes(a.id),
    ) || destinationAccounts.find((a) => payload.accountIds.includes(a.id));
  const preview = previewAccount ? payload.overrides[previewAccount.id] : null;
  const change = (part: Partial<Payload>) =>
    setPayload((p) => ({ ...p, ...part }));
  function updateVariant(part: Partial<Variant>) {
    if (!account) return;
    setPayload((p) => ({
      ...p,
      overrides: {
        ...p.overrides,
        [account.id]: { ...p.overrides[account.id], ...part },
      },
    }));
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
    const target = new Date(wall + "Z");
    if (isNaN(target.getTime()))
      throw new Error("Choose a valid date and time.");
    let guess = target.getTime();
    for (let i = 0; i < 4; i++) {
      const displayed = new Date(
        toWall(new Date(guess), payload.timezone) + "Z",
      ).getTime();
      const difference = target.getTime() - displayed;
      if (!difference) break;
      guess += difference;
    }
    if (toWall(new Date(guess), payload.timezone) !== wall)
      throw new Error(
        "This local time is invalid because of a timezone clock change. Choose another time.",
      );
    return new Date(guess).toISOString();
  }
  function submit(intent: "draft" | "queue") {
    setStepError("");
    try {
      const scheduledAt =
        intent === "queue" || existing?.scheduled_at ? resolveTime() : null;
      if (
        intent === "queue" &&
        (!payload.accountIds.length ||
          !scheduledAt ||
          new Date(scheduledAt).getTime() <= Date.now())
      )
        throw new Error(
          "Select at least one destination and a future publishing time.",
        );
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
            {account && override && (
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
                      value={override.format}
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
                      value={override.title}
                      maxLength={200}
                      onChange={(e) => updateVariant({ title: e.target.value })}
                      placeholder="Platform title"
                    />
                  </label>
                </div>
                <label>
                  Tags
                  <input
                    value={override.tags}
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
                        value={override.board}
                        onChange={(e) =>
                          updateVariant({ board: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      Destination URL
                      <input
                        type="url"
                        value={override.link}
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
                        value={override.privacy}
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
                          value={override.audience}
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
                        checked={!!override[key as keyof Variant]}
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
                      checked={override.aiDisclosure}
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
                      value={override.coverMode}
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
                  {override.coverMode === "image" && (
                    <label>
                      Cover image URL
                      <input
                        type="url"
                        value={override.coverUrl}
                        onChange={(e) =>
                          updateVariant({ coverUrl: e.target.value })
                        }
                        placeholder="https://drive.google.com/file/d/…/view"
                      />
                    </label>
                  )}
                  {override.coverMode === "frame" && (
                    <label>
                      Frame time (seconds)
                      <input
                        type="number"
                        min="0"
                        max="86400"
                        step="0.1"
                        value={override.frameSeconds}
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
            disabled={busy}
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
