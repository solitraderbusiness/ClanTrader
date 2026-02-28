import { test, expect } from "@playwright/test";

test.describe("Login Flow", () => {
  test("shows login form with identifier and password fields", async ({ page }) => {
    await page.goto("/login");

    await expect(page.locator("input#identifier")).toBeVisible();
    await expect(page.locator("input#password")).toBeVisible();
    await expect(page.locator("button[type='submit']")).toBeVisible();
  });

  test("logs in with valid email and redirects to /home", async ({ page }) => {
    await page.goto("/login");

    await page.locator("input#identifier").fill("admin@clantrader.ir");
    await page.locator("input#password").fill("password123");
    await page.locator("button[type='submit']").click();

    await page.waitForURL("**/home", { timeout: 15000 });
    expect(page.url()).toContain("/home");
  });

  test("logs in with username and redirects to /home", async ({ page }) => {
    await page.goto("/login");

    await page.locator("input#identifier").fill("alitrader");
    await page.locator("input#password").fill("password123");
    await page.locator("button[type='submit']").click();

    await page.waitForURL("**/home", { timeout: 15000 });
    expect(page.url()).toContain("/home");
  });

  test("shows error on invalid credentials", async ({ page }) => {
    await page.goto("/login");

    await page.locator("input#identifier").fill("bad@example.com");
    await page.locator("input#password").fill("wrongpassword");
    await page.locator("button[type='submit']").click();

    // Error div should appear
    await expect(page.locator(".bg-destructive\\/10")).toBeVisible({ timeout: 10000 });
    // Should still be on login page
    expect(page.url()).toContain("/login");
  });

  test("submit button disabled when fields empty, enabled when both filled", async ({ page }) => {
    await page.goto("/login");

    const submitBtn = page.locator("button[type='submit']");

    // Both empty → disabled
    await expect(submitBtn).toBeDisabled();

    // Fill identifier only → still disabled
    await page.locator("input#identifier").fill("test@test.com");
    await expect(submitBtn).toBeDisabled();

    // Fill password too → enabled
    await page.locator("input#password").fill("somepass");
    await expect(submitBtn).toBeEnabled();
  });
});

test.describe("Signup Flow", () => {
  test("shows signup form with all required fields", async ({ page }) => {
    await page.goto("/signup");

    await expect(page.locator("input#name")).toBeVisible();
    await expect(page.locator("input#username")).toBeVisible();
    await expect(page.locator("input#email")).toBeVisible();
    await expect(page.locator("input#password")).toBeVisible();
    await expect(page.locator("input#confirmPassword")).toBeVisible();
  });

  test("username check shows red X for taken username", async ({ page }) => {
    await page.goto("/signup");

    await page.locator("input#username").fill("alitrader");

    // Wait for the check to complete — XCircle icon should appear
    await expect(page.locator("input#username ~ div .text-destructive, input#username + div .text-destructive").first()).toBeVisible({
      timeout: 5000,
    });
  });

  test("username check shows green check for available username", async ({ page }) => {
    await page.goto("/signup");

    const unique = `testuser_${Date.now()}`;
    await page.locator("input#username").fill(unique);

    // Wait for the check to complete — CheckCircle2 icon should appear
    await expect(page.locator("input#username ~ div .text-green-500, input#username + div .text-green-500").first()).toBeVisible({
      timeout: 5000,
    });
  });

  test("shows validation errors for empty submission", async ({ page }) => {
    await page.goto("/signup");

    // Click submit without filling anything
    await page.locator("button[type='submit']").click();

    // Should show at least one validation error message
    await expect(page.locator(".text-destructive").first()).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Navigation", () => {
  test("login page has link to signup page", async ({ page }) => {
    await page.goto("/login");

    const signupLink = page.locator("a[href='/signup']");
    await expect(signupLink).toBeVisible();
    await signupLink.click();

    await page.waitForURL("**/signup", { timeout: 5000 });
    expect(page.url()).toContain("/signup");
  });
});
