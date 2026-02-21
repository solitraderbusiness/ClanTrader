/**
 * Schedule a SIMULATOR test run via the admin API.
 *
 * Usage:
 *   npx tsx scripts/schedule-test-runs.ts
 *
 * Environment variables:
 *   SERVER_URL  — Base URL of the ClanTrader server (default: http://localhost:3000)
 *   ADMIN_EMAIL — Admin account email (default: admin@clantrader.ir)
 *   ADMIN_PASS  — Admin account password (default: password123)
 */

const SERVER_URL = process.env.SERVER_URL || "http://localhost:3000";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@clantrader.ir";
const ADMIN_PASS = process.env.ADMIN_PASS || "password123";

async function login(): Promise<string> {
  // 1. Get CSRF token
  const csrfRes = await fetch(`${SERVER_URL}/api/auth/csrf`);
  const csrfData = (await csrfRes.json()) as { csrfToken: string };
  const csrfToken = csrfData.csrfToken;

  // Collect cookies
  const cookies: string[] = [];
  const collectCookies = (res: Response) => {
    const setCookie = res.headers.getSetCookie?.() || [];
    for (const c of setCookie) {
      cookies.push(c.split(";")[0]);
    }
  };
  collectCookies(csrfRes);

  // 2. POST credentials
  const formData = new URLSearchParams({
    email: ADMIN_EMAIL,
    password: ADMIN_PASS,
    csrfToken,
    json: "true",
  });

  const loginRes = await fetch(`${SERVER_URL}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      cookie: cookies.join("; "),
    },
    body: formData.toString(),
    redirect: "manual",
  });
  collectCookies(loginRes);

  // Follow redirect
  const location = loginRes.headers.get("location");
  if (location) {
    const url = location.startsWith("http") ? location : `${SERVER_URL}${location}`;
    const followRes = await fetch(url, {
      headers: { cookie: cookies.join("; ") },
      redirect: "follow",
    });
    collectCookies(followRes);
  }

  return cookies.join("; ");
}

async function scheduleRun(cookies: string): Promise<void> {
  const res = await fetch(`${SERVER_URL}/api/admin/test-runs`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: cookies,
    },
    body: JSON.stringify({
      suite: "SIMULATOR",
      requestedWorkers: 2,
      runMode: "HEADLESS",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to schedule test run: ${res.status} ${text}`);
  }

  const data = (await res.json()) as { id: string };
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Scheduled SIMULATOR test run: ${data.id}`);
}

async function main() {
  try {
    console.log(`Logging in as ${ADMIN_EMAIL}...`);
    const cookies = await login();
    await scheduleRun(cookies);
  } catch (error) {
    console.error("Failed to schedule test run:", error);
    process.exit(1);
  }
}

main();
