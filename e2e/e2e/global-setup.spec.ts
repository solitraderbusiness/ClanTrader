import { test as setup } from "@playwright/test";
import path from "path";

const AUTH_DIR = path.join(__dirname, "..", ".auth");

interface AccountInfo {
  prefix: string;
  identifier: string; // email or username
  password: string;
}

const ACCOUNTS: AccountInfo[] = [
  { prefix: "admin", identifier: "admin@clantrader.ir", password: "password123" },
  { prefix: "trader1", identifier: "trader1@clantrader.ir", password: "password123" },
  { prefix: "trader2", identifier: "trader2@clantrader.ir", password: "password123" },
  { prefix: "trader3", identifier: "trader3@clantrader.ir", password: "password123" },
  { prefix: "spectator", identifier: "spectator@clantrader.ir", password: "password123" },
];

for (const account of ACCOUNTS) {
  setup(`authenticate ${account.prefix}`, async ({ page }) => {
    await page.goto("/login");

    await page.locator("input#identifier").fill(account.identifier);
    await page.locator("input#password").fill(account.password);
    await page.locator("button[type='submit']").click();

    await page.waitForURL("**/home", { timeout: 15000 });

    const storagePath = path.join(AUTH_DIR, `${account.prefix}.json`);
    await page.context().storageState({ path: storagePath });
  });
}
