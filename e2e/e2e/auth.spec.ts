import { test, expect } from "@playwright/test";

test.describe("Authentication E2E", () => {
  test("can log in with valid credentials", async ({ page }) => {
    await page.goto("/login");

    await page.fill("input[type='email']", "admin@clantrader.ir");
    await page.fill("input[type='password']", "password123");
    await page.click("button[type='submit']");

    // Should redirect to dashboard after login
    await page.waitForURL(/\/(dashboard|clans)/, { timeout: 10000 });
    expect(page.url()).not.toContain("/login");
  });

  test("shows error on invalid credentials", async ({ page }) => {
    await page.goto("/login");

    await page.fill("input[type='email']", "bad@example.com");
    await page.fill("input[type='password']", "wrongpassword");
    await page.click("button[type='submit']");

    // Should stay on login page or show error
    await page.waitForTimeout(2000);
    const url = page.url();
    // Either still on login or shows error
    expect(
      url.includes("/login") || (await page.locator("[role='alert']").count()) > 0
    ).toBeTruthy();
  });

  test("can log in and see admin panel", async ({ page }) => {
    await page.goto("/login");
    await page.fill("input[type='email']", "admin@clantrader.ir");
    await page.fill("input[type='password']", "password123");
    await page.click("button[type='submit']");
    await page.waitForURL(/\/(dashboard|clans)/, { timeout: 10000 });

    await page.goto("/admin");
    await expect(page.locator("text=Admin Panel")).toBeVisible({ timeout: 5000 });
  });
});
