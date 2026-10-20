import { test, expect } from "@playwright/test";
test("desktop owner workflow and mobile company isolation", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await page.getByLabel("Username", { exact: true }).fill("browser-owner");
  await page
    .getByLabel("Password", { exact: true })
    .fill("browser-test-password-937");
  await page.getByRole("button", { name: "Create owner account" }).click();
  await page.getByRole("button", { name: "Create your first company" }).click();
  await page.getByLabel("Company name", { exact: true }).fill("Mett Global");
  await page
    .getByRole("button", { name: "Create company", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "A little clarity. A lot of possibilities.",
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add your first account" }).click();
  await page.getByLabel("Network", { exact: true }).selectOption("youtube");
  await page.getByLabel("Account name", { exact: true }).fill("Main channel");
  await page.getByLabel("Handle or location").fill("@mettglobal");
  await page
    .getByRole("button", { name: "Add account record", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Create a post", exact: true })
    .click();
  await page.getByRole("button", { name: "Main channel", exact: true }).click();
  await page.getByLabel("Internal post name").fill("Autumn story");
  await page.getByLabel("Shared caption").fill("Shared brand story");
  await page
    .getByRole("button", { name: "Main channel", exact: true })
    .last()
    .click();
  await page.getByRole("button", { name: "Customize account" }).click();
  await page
    .getByLabel("Caption for Main channel")
    .fill("YouTube-specific story");
  await page.getByLabel("Cover source").selectOption("frame");
  await page.getByLabel("Frame time (seconds)").fill("4.5");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Autumn story/ }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: /Autumn story/ }).click();
  await page
    .getByRole("button", { name: "Main channel", exact: true })
    .last()
    .click();
  await expect(page.getByLabel("Caption for Main channel")).toHaveValue(
    "YouTube-specific story",
  );
  await expect(page.getByLabel("Frame time (seconds)")).toHaveValue("4.5");
  await page.getByRole("button", { name: "Add to queue", exact: true }).click();
  await expect(
    page.getByText(
      "Queue item saved. Publishing is blocked until integrations are connected.",
    ),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/desktop-overview.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "Switch company" }).click();
  await page
    .getByRole("button", { name: "Add a company", exact: true })
    .click();
  await page.getByLabel("Company name", { exact: true }).fill("Second company");
  await page
    .getByRole("button", { name: "Create company", exact: true })
    .click();
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await expect(
    page.getByText("Here’s what’s happening across Second company."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Autumn story/ })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page
    .getByRole("button", { name: "Media library", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Add Drive reference", exact: true })
    .click();
  await page.getByLabel("File name").fill("Second company video");
  await page
    .getByLabel("Google Drive sharing URL")
    .fill("https://drive.google.com/file/d/source-video/view");
  await page.getByRole("button", { name: "Save reference" }).click();
  await expect(
    page.getByRole("heading", { name: "Second company video" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/mobile-library.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
