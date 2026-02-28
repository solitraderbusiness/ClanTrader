import { test as base, type Page, type BrowserContext } from "@playwright/test";
import path from "path";

const AUTH_DIR = path.join(__dirname, "..", ".auth");
const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";

type AccountKey = "admin" | "trader1" | "trader2" | "trader3" | "spectator";

async function pageForAccount(
  browserFactory: { newContext: (opts?: Record<string, unknown>) => Promise<BrowserContext> },
  account: AccountKey,
): Promise<{ page: Page; context: BrowserContext }> {
  const storagePath = path.join(AUTH_DIR, `${account}.json`);
  const context = await browserFactory.newContext({
    storageState: storagePath,
    baseURL: BASE_URL,
  });
  const page = await context.newPage();
  return { page, context };
}

type AuthFixtures = {
  trader1Page: Page;
  trader2Page: Page;
  trader3Page: Page;
  adminPage: Page;
  spectatorPage: Page;
  loginAs: (account: AccountKey) => Promise<Page>;
};

export const test = base.extend<AuthFixtures>({
  trader1Page: async ({ browser }, use) => {
    const { page, context } = await pageForAccount(browser, "trader1");
    await use(page);
    await context.close();
  },

  trader2Page: async ({ browser }, use) => {
    const { page, context } = await pageForAccount(browser, "trader2");
    await use(page);
    await context.close();
  },

  trader3Page: async ({ browser }, use) => {
    const { page, context } = await pageForAccount(browser, "trader3");
    await use(page);
    await context.close();
  },

  adminPage: async ({ browser }, use) => {
    const { page, context } = await pageForAccount(browser, "admin");
    await use(page);
    await context.close();
  },

  spectatorPage: async ({ browser }, use) => {
    const { page, context } = await pageForAccount(browser, "spectator");
    await use(page);
    await context.close();
  },

  loginAs: async ({ browser }, use) => {
    const contexts: BrowserContext[] = [];

    const factory = async (account: AccountKey): Promise<Page> => {
      const { page, context } = await pageForAccount(browser, account);
      contexts.push(context);
      return page;
    };

    await use(factory);

    for (const ctx of contexts) {
      await ctx.close();
    }
  },
});

export { expect } from "@playwright/test";
