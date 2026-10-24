import { app, BrowserWindow, Menu, dialog, shell } from "electron";
import { join } from "node:path";
import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { createServer } from "node:http";

app.setName("Mett Social");
if (process.env.METT_DESKTOP_TEST_DIR) app.setPath("userData", process.env.METT_DESKTOP_TEST_DIR);
const locked = app.requestSingleInstanceLock();
if (!locked) app.quit();
let window, server, service, quitting = false;
app.on("second-instance", () => { window?.show(); window?.focus(); });
app.on("window-all-closed", () => app.quit());

function external(value) {
  try {
    const u = new URL(value);
    const hosts = ["accounts.google.com", "www.facebook.com", "www.pinterest.com", "www.tiktok.com", "drive.google.com", "docs.google.com", "www.youtube.com", "studio.youtube.com", "mettglobal.com", "www.mettglobal.com"];
    if (u.protocol === "https:" && !u.username && !u.password && hosts.includes(u.hostname))
      void shell.openExternal(u.toString());
  } catch { /* Never execute arbitrary protocols from renderer content. */ }
}

async function boot() {
  await app.whenReady();
  const home = app.getPath("userData"), data = join(home, "data");
  mkdirSync(data, { recursive: true });
  const configFile = join(home, "connections.env");
  if (!existsSync(configFile)) writeFileSync(configFile,
    "# Configure developer apps locally. Never share this file or paste secrets in chat.\n# Restart Mett Social after changes.\n# Google redirect: http://127.0.0.1:43127/api/oauth/callback/google\n# GOOGLE_CLIENT_ID=\n# GOOGLE_CLIENT_SECRET=\n# META_CLIENT_ID=\n# META_CLIENT_SECRET=\n# PINTEREST_CLIENT_ID=\n# PINTEREST_CLIENT_SECRET=\n# TIKTOK_CLIENT_ID=\n# TIKTOK_CLIENT_SECRET=\n", { flag: "wx" });
  const config = parseEnv(readFileSync(configFile, "utf8"));
  for (const name of ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "META_CLIENT_ID", "META_CLIENT_SECRET", "PINTEREST_CLIENT_ID", "PINTEREST_CLIENT_SECRET", "TIKTOK_CLIENT_ID", "TIKTOK_CLIENT_SECRET"])
    if (config[name]) process.env[name] = config[name];
  // Desktop is deliberately local. Never inherit a shell's hosted database settings.
  delete process.env.DATABASE_URL;
  delete process.env.VERCEL;
  delete process.env.TOKEN_ENCRYPTION_KEY;
  delete process.env.SETUP_TOKEN;
  process.env.DATA_DIR = data;
  process.env.NODE_ENV = "desktop";
  process.env.COOKIE_SECURE = "false";
  const port = process.env.METT_DESKTOP_TEST_DIR ? 43128 : 43127;
  const origin = `http://127.0.0.1:${port}`;
  process.env.APP_ORIGIN = origin;
  const { createApp } = await import("../server/app.mjs");
  service = await createApp({ staticDir: join(app.getAppPath(), "dist") });
  server = createServer((req, res) => {
    if (req.url?.startsWith("/api/oauth/callback/"))
      res.once("finish", () => {
        const destination = new URL(String(res.getHeader("location") || "/"), origin);
        if (destination.origin === origin && window && !window.isDestroyed()) {
          void window.loadURL(destination.href);
          window.show(); window.focus();
        }
      });
    service.app(req, res);
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  window = new BrowserWindow({
    width: 1440, height: 960, minWidth: 390, minHeight: 640,
    title: "Mett Social", backgroundColor: "#faf8f2",
    icon: join(app.getAppPath(), "public", "icon-512.png"),
    show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true },
  });
  window.webContents.setWindowOpenHandler(({ url }) => { external(url); return { action: "deny" }; });
  window.webContents.on("will-navigate", (event, url) => {
    if (new URL(url).origin !== origin) { event.preventDefault(); external(url); }
  });
  window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: "Workspace", submenu: [
      { label: "Reload", accelerator: "CmdOrCtrl+R", click: () => window.reload() },
      { label: "Open data and connection settings folder", click: () => shell.openPath(home) },
      { type: "separator" }, { role: "quit", label: "Exit Mett Social" },
    ] },
    { label: "Edit", submenu: [{ role: "undo" }, { role: "redo" }, { type: "separator" }, { role: "cut" }, { role: "copy" }, { role: "paste" }, { role: "selectAll" }] },
    { label: "View", submenu: [{ role: "resetZoom" }, { role: "zoomIn" }, { role: "zoomOut" }, { role: "togglefullscreen" }] },
    { label: "Help", submenu: [{ label: "About Mett Social", click: () => dialog.showMessageBox(window, {
      title: "Mett Social", message: "Mett Social · local Windows workspace",
      detail: "Data stays on this Windows profile. Each laptop has separate data. Google developer-app setup and authorization are required for Drive and YouTube. Keep the app open during preparation; YouTube takes over only after it confirms the schedule. Other networks do not publish yet. To back up, close the app and copy the data folder and connections.env together. Never share those files with the executable.",
    }) }] },
  ]));
  await window.loadURL(origin);
  window.show();
}

app.on("before-quit", event => {
  if (quitting || !server) return;
  event.preventDefault(); quitting = true;
  server.close(async () => { await service?.close(); app.quit(); });
  server.closeIdleConnections();
});

if (locked) boot().catch(async error => {
  // Do not display provider credentials, request URLs, or database contents.
  const message = error.code === "EADDRINUSE"
    ? "The local Mett Social port is in use. Close the other instance or the program using port 43127, then reopen the app."
    : "The local workspace could not start. Your saved data has not been removed. Check the application files and local folder permissions.";
  console.error("Desktop startup failed:", error.code || error.name);
  await dialog.showMessageBox({ type: "error", title: "Mett Social", message });
  quitting = true;
  server?.close(); await service?.close(); app.quit();
});
