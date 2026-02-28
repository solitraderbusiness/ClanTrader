import type { Page } from "@playwright/test";

/**
 * Waits for the Socket.io chat connection to be ready.
 * The chat textarea placeholder changes from "Connecting..." to the normal placeholder
 * once the socket connects.
 */
export async function waitForChatReady(page: Page, timeout = 15000): Promise<void> {
  await page.locator("[data-testid='chat-input']").waitFor({ state: "visible", timeout });
  // Wait until the textarea is enabled (not disabled = socket connected)
  await page.waitForFunction(
    () => {
      const el = document.querySelector("[data-testid='chat-input']") as HTMLTextAreaElement | null;
      return el && !el.disabled;
    },
    { timeout },
  );
}

/**
 * Navigates to a clan's chat tab via direct URL or clan page.
 */
export async function navigateToClanChat(
  page: Page,
  clanName: string,
  timeout = 30000,
): Promise<void> {
  await page.goto("/clans");
  // Wait for the page to load
  await page.waitForLoadState("networkidle", { timeout });

  await page.locator(`text=${clanName}`).first().click();
  await page.waitForURL(/\/clans\//, { timeout });
  await page.waitForLoadState("networkidle", { timeout: 15000 });

  // Dismiss onboarding dialog if present
  const skipBtn = page.locator("text=Skip for now");
  if (await skipBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await skipBtn.click();
    await page.waitForTimeout(500);
  }

  // Click the Chat tab — wait for it to be visible first
  const chatTab = page.locator("[data-testid='tab-chat']");
  await chatTab.waitFor({ state: "visible", timeout: 15000 });
  await chatTab.click();

  // Wait for chat to be ready
  await waitForChatReady(page, timeout);
}

/**
 * Sends a chat message and waits for it to appear in the message list.
 */
export async function sendChatMessage(
  page: Page,
  text: string,
  timeout = 15000,
): Promise<void> {
  const input = page.locator("[data-testid='chat-input']");
  await input.fill(text);
  await input.press("Enter");

  // Wait for the message to appear — scroll to bottom first to ensure visibility
  const msgLocator = page.locator(`[data-testid="message-bubble"]:has-text("${text}")`);
  await msgLocator.waitFor({ state: "attached", timeout });
  await msgLocator.scrollIntoViewIfNeeded();
  await msgLocator.waitFor({ state: "visible", timeout: 5000 });
}

/**
 * Sends a DM message and waits for it to appear.
 */
export async function sendDmMessage(
  page: Page,
  text: string,
  timeout = 10000,
): Promise<void> {
  const input = page.locator("[data-testid='dm-input']");
  await input.fill(text);
  await input.press("Enter");

  // Wait for the message text to appear
  await page.locator(`text=${text}`).first().waitFor({ state: "visible", timeout });
}

/**
 * Waits for the DM panel to be ready (textarea visible and enabled).
 */
export async function waitForDmReady(page: Page, timeout = 15000): Promise<void> {
  await page.locator("[data-testid='dm-input']").waitFor({ state: "visible", timeout });
}
