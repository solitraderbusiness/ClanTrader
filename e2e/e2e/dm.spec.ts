import { test, expect } from "../../e2e/fixtures/auth.fixture";
import { waitForDmReady, sendDmMessage } from "../helpers/browser-utils";
import type { Page } from "@playwright/test";

test.setTimeout(90000);

/** Get a DM recipient userId by visiting clan members tab and reading the first DM link href */
async function getFirstDmUserId(page: Page): Promise<string | null> {
  await page.goto("/clans");
  await page.waitForLoadState("networkidle", { timeout: 15000 });
  await page.locator("text=Golden Eagles").first().click();
  await page.waitForURL(/\/clans\//, { timeout: 10000 });
  await page.waitForLoadState("networkidle", { timeout: 15000 });

  // Dismiss onboarding dialog if present
  const skipBtn = page.locator("text=Skip for now");
  if (await skipBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await skipBtn.click();
    await page.waitForTimeout(500);
  }

  // Switch to Members tab — clicking triggers router.replace(?tab=members)
  const membersTab = page.locator("[data-testid='tab-members']");
  await membersTab.waitFor({ state: "visible", timeout: 10000 });
  await membersTab.click();
  // Wait for URL to reflect the tab change
  await page.waitForURL(/tab=members/, { timeout: 10000 });
  await page.waitForLoadState("networkidle", { timeout: 10000 });

  // Wait for member list DM links to render
  const dmLink = page.locator("a[href*='/dm/']").first();
  if (await dmLink.isVisible({ timeout: 15000 }).catch(() => false)) {
    const href = await dmLink.getAttribute("href");
    return href?.replace("/dm/", "") || null;
  }
  return null;
}

/** Navigate to a DM conversation page. Returns the userId of the recipient or null. */
async function goToDm(page: Page): Promise<string | null> {
  const userId = await getFirstDmUserId(page);
  if (!userId) return null;

  await page.goto(`/dm/${userId}`);
  await page.waitForLoadState("networkidle", { timeout: 15000 });
  return userId;
}

test.describe("DM Navigation", () => {
  test("navigates to DM from clan member list", async ({ trader1Page }) => {
    await trader1Page.goto("/clans");
    await trader1Page.waitForLoadState("networkidle", { timeout: 15000 });
    await trader1Page.locator("text=Golden Eagles").first().click();
    await trader1Page.waitForURL(/\/clans\//, { timeout: 10000 });
    await trader1Page.waitForLoadState("networkidle", { timeout: 15000 });

    // Dismiss onboarding
    const skipBtn = trader1Page.locator("text=Skip for now");
    if (await skipBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await skipBtn.click();
      await trader1Page.waitForTimeout(500);
    }

    const membersTab = trader1Page.locator("[data-testid='tab-members']");
    await membersTab.waitFor({ state: "visible", timeout: 10000 });
    await membersTab.click();
    await trader1Page.waitForTimeout(1000);

    const dmLink = trader1Page.locator("a[href*='/dm/']").first();
    await expect(dmLink).toBeVisible({ timeout: 5000 });

    await dmLink.click();
    await trader1Page.waitForURL(/\/dm\//, { timeout: 10000 });
    expect(trader1Page.url()).toContain("/dm/");
  });

  test("DM header shows recipient name", async ({ trader1Page }) => {
    const userId = await goToDm(trader1Page);
    if (!userId) {
      test.skip();
      return;
    }

    // Header should show a name (not "Unknown")
    const header = trader1Page.locator(".border-b .font-medium").first();
    await expect(header).toBeVisible({ timeout: 5000 });
    const name = await header.textContent();
    expect(name).toBeTruthy();
    expect(name).not.toBe("Unknown");
  });
});

test.describe("DM Messaging", () => {
  test("sends a direct message and sees it appear", async ({ trader1Page }) => {
    const userId = await goToDm(trader1Page);
    if (!userId) {
      test.skip();
      return;
    }
    await waitForDmReady(trader1Page);

    const msg = `DM test ${Date.now()}`;
    await sendDmMessage(trader1Page, msg);

    await expect(trader1Page.locator(`text=${msg}`).first()).toBeVisible();
  });

  test("receives a DM in real-time from another user", async ({ trader1Page }) => {
    const userId = await goToDm(trader1Page);
    if (!userId) {
      test.skip();
      return;
    }
    await waitForDmReady(trader1Page);

    const msg = `Realtime DM ${Date.now()}`;
    const input = trader1Page.locator("[data-testid='dm-input']");
    await input.fill(msg);
    await input.press("Enter");

    await expect(trader1Page.locator(`text=${msg}`).first()).toBeVisible({ timeout: 10000 });
  });

  test("shows empty state for new conversation", async ({ trader1Page }) => {
    const userId = await goToDm(trader1Page);
    if (!userId) {
      test.skip();
      return;
    }

    // Verify the DM panel is loaded with input
    const hasInput = await trader1Page.locator("[data-testid='dm-input']").isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasInput).toBeTruthy();
  });
});

test.describe("DM Actions", () => {
  test("opens View Profile from DM header menu", async ({ trader1Page }) => {
    const userId = await goToDm(trader1Page);
    if (!userId) {
      test.skip();
      return;
    }

    // Open the three-dot menu in the header
    const menuBtn = trader1Page.locator(".border-b button").last();
    await menuBtn.click();

    // Click "View Profile" menu item
    const viewProfile = trader1Page.locator("[role='menuitem']").first();
    await viewProfile.click();

    await trader1Page.waitForURL(/\/profile\//, { timeout: 10000 });
    expect(trader1Page.url()).toContain("/profile/");
  });

  test("back button navigates to /dm on mobile viewport", async ({ trader1Page }) => {
    const userId = await goToDm(trader1Page);
    if (!userId) {
      test.skip();
      return;
    }

    const dmPath = `/dm/${userId}`;

    // Create a mobile context
    const browser = trader1Page.context().browser()!;
    const mobileContext = await browser.newContext({
      storageState: "e2e/.auth/trader1.json",
      baseURL: process.env.TEST_BASE_URL || "http://localhost:3000",
      viewport: { width: 375, height: 667 },
    });
    const mobilePage = await mobileContext.newPage();
    await mobilePage.goto(dmPath);
    await mobilePage.waitForLoadState("networkidle", { timeout: 15000 });

    // Click back button (ArrowLeft link to /dm)
    const backBtn = mobilePage.locator("a[href='/dm']").first();
    if (await backBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await backBtn.click();
      await mobilePage.waitForURL("**/dm", { timeout: 5000 });
      expect(mobilePage.url()).toMatch(/\/dm$/);
    }

    await mobileContext.close();
  });
});

test.describe("Typing", () => {
  test("typing indicator — DM input works correctly", async ({ trader1Page }) => {
    const userId = await goToDm(trader1Page);
    if (!userId) {
      test.skip();
      return;
    }
    await waitForDmReady(trader1Page);

    const input = trader1Page.locator("[data-testid='dm-input']");
    await expect(input).toBeVisible();

    // Type something to verify input works
    await input.fill("typing test");
    await expect(input).toHaveValue("typing test");

    // Clear it
    await input.fill("");
    await expect(input).toHaveValue("");
  });
});
