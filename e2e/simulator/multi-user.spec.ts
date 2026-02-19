import { test, expect } from "@playwright/test";

test.describe("Multi-User Simulator", () => {
  test("trader1 can log in and view clans", async ({ page }) => {
    await page.goto("/login");
    await page.fill("input[type='email']", "trader1@clantrader.ir");
    await page.fill("input[type='password']", "password123");
    await page.click("button[type='submit']");
    await page.waitForURL(/\/(dashboard|clans)/, { timeout: 10000 });

    await page.goto("/clans");
    await page.waitForTimeout(2000);
    expect(page.url()).toContain("/clans");
  });

  test("trader2 can log in and view discover", async ({ page }) => {
    await page.goto("/login");
    await page.fill("input[type='email']", "trader2@clantrader.ir");
    await page.fill("input[type='password']", "password123");
    await page.click("button[type='submit']");
    await page.waitForURL(/\/(dashboard|clans)/, { timeout: 10000 });

    await page.goto("/discover");
    await page.waitForTimeout(2000);
    expect(page.url()).toContain("/discover");
  });

  test("spectator cannot access admin", async ({ page }) => {
    await page.goto("/login");
    await page.fill("input[type='email']", "spectator@clantrader.ir");
    await page.fill("input[type='password']", "password123");
    await page.click("button[type='submit']");
    await page.waitForURL(/\/(dashboard|clans)/, { timeout: 10000 });

    await page.goto("/admin");
    // Should redirect away from admin
    await page.waitForTimeout(3000);
    expect(page.url()).not.toMatch(/\/admin$/);
  });
});
