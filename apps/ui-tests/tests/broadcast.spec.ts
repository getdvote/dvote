import { expect, test } from "@playwright/test";
import { DASHBOARD } from "../playwright.config";
import { mockApi, signIn } from "../lib/mock-api";
for (const width of [390, 1440]) {
  test.describe(`broadcast ${width}`, () => {
    test.use({ viewport: { width, height: 900 } });
    test("composes a campaign, saves a draft, and selects nearby branches", async ({
      page,
    }) => {
      await mockApi(page, "vendor_admin");
      await signIn(page);
      let saved: Record<string, unknown> | undefined;
      await page.route("**/api/vendor/broadcasts/campaigns", async (route) => {
        if (route.request().method() === "POST") {
          saved = route.request().postDataJSON();
          await route.fulfill({ json: { id: "draft-1" } });
        } else await route.fulfill({ json: [] });
      });
      await page.goto(DASHBOARD + "/broadcast");
      await expect(page.getByText("Notifications left")).toBeVisible();
      await expect(page.getByText("of 3", { exact: true })).toBeVisible();
      await page
        .getByRole("button", { name: "New campaign", exact: true })
        .click();
      const d = page.getByRole("dialog", { name: "New campaign" });
      await d
        .getByLabel("Campaign name", { exact: true })
        .fill("Friday coffee");
      await d
        .getByLabel("Message", { exact: true })
        .fill("Fresh coffee awaits.");
      await expect(d.getByText("20 / 2000")).toBeVisible();
      await d.getByRole("button", { name: "Continue", exact: true }).click();
      await expect(d.getByText("Selected", { exact: true })).toBeVisible();
      await d.getByRole("radio", { name: /Saved segment/ }).check();
      await expect(
        d.getByRole("combobox", { name: "Saved segment" }),
      ).toBeVisible();
      await d.getByRole("button", { name: "Continue", exact: true }).click();
      await d
        .getByRole("radio", { name: "Schedule once", exact: true })
        .check();
      await expect(d.getByLabel("First send date and time")).toBeVisible();
      await expect(
        d.getByRole("button", { name: "Schedule send", exact: true }),
      ).toBeDisabled();
      await d.getByLabel("First send date and time").click();
      const calendar = page.locator('[data-slot="popover-content"]');
      await expect(calendar).toBeVisible();
      await expect(
        calendar.getByRole("button", { name: "Previous month" }),
      ).toBeDisabled();
      await calendar.getByRole("button", { name: "Next month" }).click();
      await calendar
        .getByRole("button", { name: "15", exact: true })
        .first()
        .click();
      await calendar
        .getByRole("button", { name: "Apply", exact: true })
        .click();
      await expect(calendar).toBeHidden();
      await d.getByLabel("Send time", { exact: true }).click();
      const timePicker = page.locator('[data-slot="popover-content"]');
      await timePicker
        .getByRole("group", { name: "Hours (24-hour)" })
        .getByRole("button", { name: "14", exact: true })
        .click();
      await timePicker
        .getByRole("group", { name: "Minutes", exact: true })
        .getByRole("button", { name: "30", exact: true })
        .click();
      await timePicker
        .getByRole("button", { name: "Apply", exact: true })
        .click();
      await expect(d.getByLabel("Send time", { exact: true })).toHaveText(
        /14:30/,
      );
      await expect(
        d.getByRole("button", { name: "Schedule send", exact: true }),
      ).toBeEnabled();
      await d.getByRole("radio", { name: "Google Wallet", exact: true }).click();
      await expect(d.getByText("Your loyalty card")).toBeVisible();
      await d
        .getByRole("button", { name: "Save as draft", exact: true })
        .click();
      await expect(d).toBeHidden();
      expect(saved).toMatchObject({
        name: "Friday coffee",
        body: "Fresh coffee awaits.",
        mode: "draft",
      });
      await page
        .getByRole("tab", { name: "Nearby reminders", exact: true })
        .click();
      await expect(
        page.getByText("Choose branches", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText(
          "Nearby reminders use 1 of the 3 notifications each card gets every 24 hours, leaving up to 2 for campaigns.",
        ),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `test-results/broadcast-${width}.png`,
        fullPage: true,
      });
    });
  });
}

test("Arabic dark mode retains RTL layout and preview controls", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("dvote-dashboard-language", "ar");
    localStorage.setItem("dvote-dashboard-theme", "dark");
  });
  await mockApi(page, "vendor_admin");
  await signIn(page);
  await page.goto(DASHBOARD + "/broadcast");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await page.getByRole("button", { name: "حملة جديدة", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "حملة جديدة" });
  await expect(dialog.getByText("معاينة", { exact: true })).toBeVisible();
  await expect(
    dialog.getByRole("radio", { name: "Google Wallet" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/broadcast-ar.png",
    fullPage: true,
  });
});

test("autosaves on close, updates one draft, and recovers unsynced text after refresh", async ({
  page,
}) => {
  await mockApi(page, "vendor_admin");
  await signIn(page);
  const drafts = new Map<string, any>();
  let offline = false;
  let creates = 0;
  await page.route("**/api/vendor/broadcasts/campaigns**", async (route) => {
    const req = route.request();
    if (req.method() === "GET")
      return route.fulfill({ json: [...drafts.values()] });
    if (offline) return route.abort("failed");
    const input = req.postDataJSON();
    const id =
      req.method() === "PATCH"
        ? new URL(req.url()).pathname.split("/").at(-1)!
        : input.clientDraftId;
    if (!drafts.has(id)) creates++;
    drafts.set(id, {
      id,
      name: input.name,
      body: input.body,
      audience: {
        segment: input.segment,
        customSegment: input.customSegment,
        draftMode: input.draftMode,
        draftNextAt: input.nextAt,
        draftRepeatDays: input.repeatDays,
      },
      status: "draft",
      createdAt: new Date().toISOString(),
      nextAt: null,
      repeatDays: null,
      accepted: 0,
    });
    await route.fulfill({ json: { id } });
  });
  await page.goto(DASHBOARD + "/broadcast");
  await page
    .getByRole("button", { name: "New campaign", exact: true })
    .click();
  let dialog = page.getByRole("dialog", { name: "New campaign" });
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  expect(creates).toBe(0);
  await page
    .getByRole("button", { name: "New campaign", exact: true })
    .click();
  dialog = page.getByRole("dialog", { name: "New campaign" });
  await dialog
    .getByLabel("Message", { exact: true })
    .fill("Keep this unfinished message.");
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await expect(
    page.getByText("Untitled campaign", { exact: true }),
  ).toBeVisible();
  expect(creates).toBe(1);
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await dialog
    .getByLabel("Campaign name", { exact: true })
    .fill("Saved automatically");
  await expect(
    dialog.getByText("Draft saved", { exact: true }),
  ).toBeVisible();
  expect(creates).toBe(1);
  offline = true;
  await dialog
    .getByLabel("Message", { exact: true })
    .fill("Recover this text after reload.");
  await expect(
    dialog.getByText(
      "Draft saved on this device. We'll try again when you're back online.",
    ),
  ).toBeVisible();
  offline = false;
  await page.reload();
  await expect(
    page.getByText("Recover this text after reload.", { exact: true }),
  ).toBeVisible();
  expect(creates).toBe(1);
  expect([...drafts.values()][0].name).toBe("Saved automatically");
});
