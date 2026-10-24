import { _electron as electron, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const data = await mkdtemp(join(tmpdir(), "mett-desktop-test-"));
const executablePath = process.argv[2];
let desktop;
const options = {
  ...(executablePath ? { executablePath: resolve(executablePath) } : { args: ["."] }),
  env: { ...process.env, METT_DESKTOP_TEST_DIR: data },
  timeout: 30000,
};
delete options.env.ELECTRON_RUN_AS_NODE;
try {
  desktop = await electron.launch(options);
  desktop.process().stderr.on("data", bytes => process.stderr.write(bytes));
  const page = await desktop.firstWindow();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.getByLabel("Username", { exact: true }).fill("desktop-test-owner");
  await page.getByLabel("Password", { exact: true }).fill("desktop-test-only-937-long");
  await page.getByRole("button", { name: "Create owner account" }).click();
  await page.getByRole("button", { name: "Create your first company" }).click();
  await page.getByLabel("Company name", { exact: true }).fill("Desktop Test Company");
  await page.getByRole("button", { name: "Create company", exact: true }).click();
  await page.getByRole("button", { name: "Add your first account" }).click();
  await page.getByLabel("Network", { exact: true }).selectOption("youtube");
  await page.getByLabel("Account name", { exact: true }).fill("Local channel");
  await page.getByRole("button", { name: "Add account record", exact: true }).click();
  await page.getByRole("button", { name: "Create a post", exact: true }).click();
  await page.getByRole("button", { name: "Local channel", exact: true }).click();
  await page.getByLabel("Internal post name").fill("Persistent desktop draft");
  await page.getByLabel("Shared caption").fill("Saved on this laptop");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByRole("button", { name: /Persistent desktop draft/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: /Persistent desktop draft/ })).toBeVisible();
  assert.equal(await page.evaluate(() => typeof window.require), "undefined");
  assert.equal(await page.getByText("Interface preview · browser-only data").count(), 0);
  const preferences = await desktop.evaluate(({ BrowserWindow }) => {
    const p = BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences();
    return { node: p.nodeIntegration, isolated: p.contextIsolation, sandbox: p.sandbox };
  });
  assert.deepEqual(preferences, { node: false, isolated: true, sandbox: true });
  await mkdir("test-results", { recursive: true });
  await page.screenshot({ path: "test-results/windows-desktop.png", fullPage: true });
  assert.deepEqual(errors, []);
  await desktop.close(); desktop = null;
  desktop = await electron.launch(options);
  const reopened = await desktop.firstWindow();
  // Chromium retains its HTTP-only login session across a full app restart.
  await expect(reopened.getByRole("button", { name: /Persistent desktop draft/ })).toBeVisible();
  await reopened.getByRole("button", { name: /Persistent desktop draft/ }).click();
  await expect(reopened.getByLabel("Shared caption")).toHaveValue("Saved on this laptop");
  console.log("PASS: Windows owner setup, local SQLite writes, reload, full restart persistence and renderer isolation.");
} finally {
  if (desktop) await desktop.close();
  const target = resolve(data), temporaryRoot = resolve(tmpdir());
  if (!target.startsWith(temporaryRoot + "\\") && !target.startsWith(temporaryRoot + "/"))
    throw new Error("Refusing to remove a path outside the temporary directory.");
  await rm(target, { recursive: true, force: true });
}
