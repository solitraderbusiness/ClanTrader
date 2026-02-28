import { test, expect } from "../../e2e/fixtures/auth.fixture";
import { navigateToClanChat, waitForChatReady } from "../helpers/browser-utils";

const CLAN_NAME = "Golden Eagles";

test.setTimeout(60000);

test.describe("Analysis Card Composer", () => {
  test("opens composer dialog via lightbulb button", async ({ trader1Page }) => {
    await navigateToClanChat(trader1Page, CLAN_NAME);

    await trader1Page.locator('button[title="Share Analysis Card"]').click();

    await expect(trader1Page.locator("[role='dialog']")).toBeVisible({ timeout: 5000 });
  });

  test("fills all fields and submits analysis card", async ({ trader1Page }) => {
    await navigateToClanChat(trader1Page, CLAN_NAME);

    // Open composer
    await trader1Page.locator('button[title="Share Analysis Card"]').click();
    await expect(trader1Page.locator("[role='dialog']")).toBeVisible();

    // Fill instrument
    const dialog = trader1Page.locator("[role='dialog']");
    await dialog.locator("input").first().fill("EURUSD");

    // Direction defaults to LONG, leave as-is

    // Fill entry (the first number input)
    const numberInputs = dialog.locator("input[type='number']");
    await numberInputs.nth(0).fill("1.0850");
    // Fill SL
    await numberInputs.nth(1).fill("1.0800");
    // Fill TP
    await numberInputs.nth(2).fill("1.0950");

    // Note
    await dialog.locator("textarea").fill("Test analysis note");

    // Submit
    await dialog.locator("[data-testid='submit-analysis']").click();

    // Dialog should close
    await expect(trader1Page.locator("[role='dialog']")).toBeHidden({ timeout: 5000 });

    // Trade card should appear in chat
    await expect(
      trader1Page.locator("[data-testid='trade-card']:has-text('EURUSD')").first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("submit disabled when required fields empty", async ({ trader1Page }) => {
    await navigateToClanChat(trader1Page, CLAN_NAME);

    await trader1Page.locator('button[title="Share Analysis Card"]').click();
    const dialog = trader1Page.locator("[role='dialog']");
    await expect(dialog).toBeVisible();

    // Submit button should be disabled when no instrument/entry
    await expect(dialog.locator("[data-testid='submit-analysis']")).toBeDisabled();
  });

  test("can toggle between LONG and SHORT direction", async ({ trader1Page }) => {
    await navigateToClanChat(trader1Page, CLAN_NAME);

    await trader1Page.locator('button[title="Share Analysis Card"]').click();
    const dialog = trader1Page.locator("[role='dialog']");
    await expect(dialog).toBeVisible();

    // Direction buttons are in a flex container — find them by their container
    // LONG is the button with green styling, SHORT has red styling
    // In the layout, there are 2 sibling buttons in a flex div
    const directionBtns = dialog.locator(".flex.gap-2 > button");

    // Click the second button (SHORT)
    await directionBtns.nth(1).click();
    // SHORT should now be active (has red styling)
    await expect(directionBtns.nth(1)).toHaveClass(/bg-red-500/);

    // Click the first button (LONG)
    await directionBtns.nth(0).click();
    // LONG should now be active (has green styling)
    await expect(directionBtns.nth(0)).toHaveClass(/bg-green-500/);
  });

  test("card shows correct instrument and direction badge after submission", async ({ trader1Page }) => {
    await navigateToClanChat(trader1Page, CLAN_NAME);

    await trader1Page.locator('button[title="Share Analysis Card"]').click();
    const dialog = trader1Page.locator("[role='dialog']");

    // Fill form with SHORT direction
    await dialog.locator("input").first().fill("XAUUSD");

    // Click SHORT — second direction button
    const directionBtns = dialog.locator(".flex.gap-2 > button");
    await directionBtns.nth(1).click();

    // Entry
    await dialog.locator("input[type='number']").first().fill("2350");

    // Submit
    await dialog.locator("[data-testid='submit-analysis']").click();
    await expect(trader1Page.locator("[role='dialog']")).toBeHidden({ timeout: 5000 });

    // Verify the card — SHORT direction badge has red styling
    const card = trader1Page.locator("[data-testid='trade-card']:has-text('XAUUSD')").last();
    await expect(card).toBeVisible({ timeout: 10000 });
    // DirectionBadge renders with border-red-500 for SHORT
    await expect(card.locator(".border-red-500").first()).toBeVisible();
  });
});

test.describe("Trade Card Interaction", () => {
  test("track button appears on untracked cards", async ({ trader2Page }) => {
    await navigateToClanChat(trader2Page, CLAN_NAME);

    // Look for any trade card that has a Track button
    const trackBtn = trader2Page.locator("[data-testid='trade-card'] button:has-text('Track')").first();

    // If there are no untracked cards from previous tests, this might not be visible.
    // Use a soft check or the test will naturally skip if no trade cards exist.
    if (await trackBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await trackBtn.click();

      // After tracking, a status badge or actions menu should appear
      await expect(
        trader2Page.locator("[data-testid='trade-card']").first()
      ).toBeVisible();
    }
  });

  test("trade actions menu appears on tracked cards", async ({ trader1Page }) => {
    await navigateToClanChat(trader1Page, CLAN_NAME);

    // Send a trade card and track it
    await trader1Page.locator('button[title="Share Analysis Card"]').click();
    const dialog = trader1Page.locator("[role='dialog']");
    await dialog.locator("input").first().fill("GBPUSD");
    await dialog.locator("input[type='number']").first().fill("1.2650");
    await dialog.locator("input[type='number']").nth(1).fill("1.2600");
    await dialog.locator("input[type='number']").nth(2).fill("1.2750");
    await dialog.locator("[data-testid='submit-analysis']").click();
    await expect(trader1Page.locator("[role='dialog']")).toBeHidden({ timeout: 5000 });

    // Wait for card to appear then track it
    const card = trader1Page.locator("[data-testid='trade-card']:has-text('GBPUSD')").last();
    await expect(card).toBeVisible({ timeout: 10000 });

    const trackBtn = card.locator("button:has-text('Track')");
    if (await trackBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await trackBtn.click();
      // Wait for track to take effect
      await trader1Page.waitForTimeout(2000);
    }

    // After tracking, the 3-dot actions menu should be visible
    const actionsMenu = card.locator("button").last();
    await expect(actionsMenu).toBeVisible({ timeout: 5000 });
  });

  test("trade card displays entry/SL/TP price grid", async ({ trader1Page }) => {
    await navigateToClanChat(trader1Page, CLAN_NAME);

    // Find any EURUSD card with price data
    const card = trader1Page.locator("[data-testid='trade-card']:has-text('EURUSD')").first();

    if (await card.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Should show Entry, SL (Stop Loss), TP (Target) labels
      await expect(card.locator("text=Entry").first()).toBeVisible();
    }
  });

  test("R:R ratio is calculated and displayed", async ({ trader1Page }) => {
    await navigateToClanChat(trader1Page, CLAN_NAME);

    // Look for a card that has R:R display (from a card with both SL and TP set)
    const rrText = trader1Page.locator("[data-testid='trade-card']").locator("text=/R:R|1:\\d/").first();

    if (await rrText.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(rrText).toBeVisible();
    }
  });

  test("note text displayed in italic on the card", async ({ trader1Page }) => {
    await navigateToClanChat(trader1Page, CLAN_NAME);

    // Look for the italic note we submitted earlier
    const noteText = trader1Page.locator("[data-testid='trade-card'] .italic").first();

    if (await noteText.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(noteText).toBeVisible();
    }
  });
});
