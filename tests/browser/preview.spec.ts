import { test, expect } from "@playwright/test";
test("Vercel interface preview works without API calls or credentials", async ({
  page,
}) => {
  const calls: string[] = [];
  page.on("request", (r) => {
    if (new URL(r.url()).pathname.startsWith("/api")) calls.push(r.url());
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await expect(
    page.getByText("Interface preview · browser-only data"),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "A little clarity. A lot of possibilities.",
    }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeHidden();
  await page.getByRole("button", { name: "Add your first account" }).click();
  await page.getByLabel("Network", { exact: true }).selectOption("instagram");
  await page
    .getByLabel("Account name", { exact: true })
    .fill("Preview Instagram");
  await page
    .getByRole("button", { name: "Add account record", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Create a post", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Preview Instagram", exact: true })
    .click();
  await page.getByLabel("Internal post name").fill("Preview brand story");
  await page.getByLabel("Shared caption").fill("Preview content only");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: /Preview brand story/ }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/vercel-preview-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "Switch company" }).click();
  await page
    .getByRole("button", { name: "Add a company", exact: true })
    .click();
  await page
    .getByLabel("Company name", { exact: true })
    .fill("Separate preview company");
  await page
    .getByRole("button", { name: "Create company", exact: true })
    .click();
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Preview brand story/ }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(calls).toEqual([]);
  await page.screenshot({
    path: "test-results/vercel-preview-mobile.png",
    fullPage: true,
  });
});
