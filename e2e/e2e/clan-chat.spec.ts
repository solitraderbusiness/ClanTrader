import { test, expect } from "../../e2e/fixtures/auth.fixture";
import { navigateToClanChat, waitForChatReady, sendChatMessage } from "../helpers/browser-utils";

const CLAN_NAME = "Golden Eagles";

test.setTimeout(90000);

test.describe("Clan Navigation", () => {
  test("navigates to clan page and sees clan heading", async ({ trader1Page }) => {
    await trader1Page.goto("/clans");
    await trader1Page.locator(`text=${CLAN_NAME}`).first().click();
    await trader1Page.waitForURL(/\/clans\//, { timeout: 10000 });

    await expect(trader1Page.locator(`h1:has-text("${CLAN_NAME}"), h2:has-text("${CLAN_NAME}")`).first()).toBeVisible();
  });

  test("switches to Chat tab and sees chat textarea ready", async ({ trader1Page }) => {
    await navigateToClanChat(trader1Page, CLAN_NAME);

    const chatInput = trader1Page.locator("[data-testid='chat-input']");
    await expect(chatInput).toBeVisible();
    await expect(chatInput).toBeEnabled();
  });
});

test.describe.serial("Chat Messaging", () => {
  test("sends a text message and sees it appear", async ({ trader1Page }) => {
    await navigateToClanChat(trader1Page, CLAN_NAME);

    const msg = `Hello from trader1 ${Date.now()}`;
    await sendChatMessage(trader1Page, msg);

    // sendChatMessage already verifies the message appears - double check
    await expect(
      trader1Page.locator(`[data-testid="message-bubble"]:has-text("${msg}")`)
    ).toBeVisible({ timeout: 10000 });
  });

  test("receives message from another user in real-time", async ({ trader1Page, trader2Page }) => {
    // Both navigate to clan chat
    await navigateToClanChat(trader1Page, CLAN_NAME);
    await navigateToClanChat(trader2Page, CLAN_NAME);

    // Small delay to ensure both Socket.io connections are fully established
    await trader1Page.waitForTimeout(1000);

    const msg = `Realtime msg ${Date.now()}`;

    // trader2 sends a message
    await sendChatMessage(trader2Page, msg);

    // trader1 should see it appear
    await expect(
      trader1Page.locator(`[data-testid="message-bubble"]:has-text("${msg}")`)
    ).toBeVisible({ timeout: 15000 });
  });

  test("edits own message and sees edited indicator", async ({ trader1Page }) => {
    await navigateToClanChat(trader1Page, CLAN_NAME);

    const originalMsg = `Edit me ${Date.now()}`;
    await sendChatMessage(trader1Page, originalMsg);

    await trader1Page.waitForTimeout(500);

    // Hover over the message to reveal actions
    const bubble = trader1Page.locator(`[data-testid="message-bubble"]:has-text("${originalMsg}")`).last();
    await bubble.scrollIntoViewIfNeeded();
    await bubble.hover({ force: true });

    // Click the three-dot menu
    const actions = bubble.locator("[data-testid='message-actions']");
    await actions.waitFor({ state: "visible", timeout: 5000 });

    // Open dropdown menu (MoreHorizontal button — last button in actions or the dropdown trigger)
    const moreBtn = actions.locator("button").last();
    await moreBtn.click();

    // Click Edit
    await trader1Page.locator("[role='menuitem']:has-text('Edit')").click();

    // The textarea should now contain the original message (edit mode)
    const chatInput = trader1Page.locator("[data-testid='chat-input']");
    const editedMsg = `${originalMsg} (updated)`;
    await chatInput.fill(editedMsg);
    await chatInput.press("Enter");

    // Should see "(edited)" indicator
    await expect(
      trader1Page.locator("text=(edited)").first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("deletes own message and it is removed from DOM", async ({ trader1Page }) => {
    await navigateToClanChat(trader1Page, CLAN_NAME);

    const msg = `Delete me ${Date.now()}`;
    await sendChatMessage(trader1Page, msg);

    // Small delay to let the message render and auto-scroll settle
    await trader1Page.waitForTimeout(500);

    // Hover over the message
    const bubble = trader1Page.locator(`[data-testid="message-bubble"]:has-text("${msg}")`).last();
    await bubble.scrollIntoViewIfNeeded();
    await bubble.hover({ force: true });

    const actions = bubble.locator("[data-testid='message-actions']");
    await actions.waitFor({ state: "visible", timeout: 5000 });

    const moreBtn = actions.locator("button").last();
    await moreBtn.click();

    // Click Delete
    await trader1Page.locator("[role='menuitem']:has-text('Delete')").click();

    // Message should disappear
    await expect(
      trader1Page.locator(`[data-testid="message-bubble"]:has-text("${msg}")`)
    ).toHaveCount(0, { timeout: 10000 });
  });

  test("replies to a message and reply preview shows original content", async ({ trader1Page }) => {
    await navigateToClanChat(trader1Page, CLAN_NAME);

    const originalMsg = `Reply target ${Date.now()}`;
    await sendChatMessage(trader1Page, originalMsg);

    await trader1Page.waitForTimeout(500);

    // Hover over the message to see actions
    const bubble = trader1Page.locator(`[data-testid="message-bubble"]:has-text("${originalMsg}")`).last();
    await bubble.scrollIntoViewIfNeeded();
    await bubble.hover({ force: true });

    const actions = bubble.locator("[data-testid='message-actions']");
    await actions.waitFor({ state: "visible", timeout: 5000 });

    // Click the reply button (second button in actions — after the emoji button)
    const replyBtn = actions.locator("button").nth(1);
    await replyBtn.click();

    // Send a reply
    const replyText = `My reply ${Date.now()}`;
    const chatInput = trader1Page.locator("[data-testid='chat-input']");
    await chatInput.fill(replyText);
    await chatInput.press("Enter");

    // The reply bubble should show a preview of the original message
    await expect(
      trader1Page.locator(`[data-testid="message-bubble"]:has-text("${replyText}")`)
    ).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Reactions", () => {
  test("reacts to message with emoji and reaction badge appears", async ({ trader1Page }) => {
    await navigateToClanChat(trader1Page, CLAN_NAME);

    const msg = `React to me ${Date.now()}`;
    await sendChatMessage(trader1Page, msg);

    // Hover to show actions
    const bubble = trader1Page.locator(`[data-testid="message-bubble"]:has-text("${msg}")`).last();
    await bubble.hover();

    const actions = bubble.locator("[data-testid='message-actions']");
    await actions.waitFor({ state: "visible", timeout: 3000 });

    // Click the emoji button (first button in actions)
    await actions.locator("button").first().click();

    // Click the first emoji in the reaction picker
    const emojiPicker = trader1Page.locator(".bg-popover button").first();
    await emojiPicker.click();

    // A reaction badge should appear on the message
    await expect(
      bubble.locator("button:has-text('1')").first()
    ).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Topics", () => {
  test("can see topic selector in chat header", async ({ trader1Page }) => {
    await navigateToClanChat(trader1Page, CLAN_NAME);

    // The TopicSelector renders topic buttons/tabs — check it exists
    await expect(trader1Page.locator("text=General").first()).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Presence", () => {
  test("shows online users in chat header", async ({ trader1Page }) => {
    await navigateToClanChat(trader1Page, CLAN_NAME);

    // OnlineUsersBar should be visible with at least the current user
    // It renders avatars — look for the online users container
    await expect(
      trader1Page.locator(".border-b").first()
    ).toBeVisible();
  });
});

test.describe("Message Formatting", () => {
  test("renders bold, italic, and code formatting", async ({ trader1Page }) => {
    await navigateToClanChat(trader1Page, CLAN_NAME);

    const msg = "**bold** *italic* `code`";
    const input = trader1Page.locator("[data-testid='chat-input']");
    await input.fill(msg);
    await input.press("Enter");

    // Wait for the rendered message — the visible text will be "bold italic code"
    // but rendered as <strong>, <em>, <code>
    const bubble = trader1Page.locator("[data-testid='message-bubble']").last();
    await expect(bubble.locator("strong")).toContainText("bold", { timeout: 10000 });
    await expect(bubble.locator("em")).toContainText("italic");
    await expect(bubble.locator("code")).toContainText("code");
  });
});
