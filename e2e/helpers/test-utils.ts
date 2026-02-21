import { TestAgent } from "./test-agent";
import type { SeedAccount } from "./seed-accounts";
import type { APIRequestContext } from "@playwright/test";

let counter = 0;

/** Generate a unique name for test entities to avoid collisions */
export function uniqueName(prefix: string): string {
  counter++;
  return `${prefix}-${Date.now()}-${counter}`;
}

/** Sleep for N milliseconds */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Create a single authenticated TestAgent using test fixture's request (for test bodies) */
export async function createAgent(
  request: APIRequestContext,
  account: SeedAccount,
  baseURL: string,
): Promise<TestAgent> {
  const agent = new TestAgent(request, account, baseURL);
  await agent.login();
  return agent;
}

/** Create multiple authenticated TestAgents using test fixture's request (for test bodies) */
export async function createAgents(
  request: APIRequestContext,
  accounts: SeedAccount[],
  baseURL: string,
): Promise<TestAgent[]> {
  return Promise.all(accounts.map((a) => createAgent(request, a, baseURL)));
}

/** Create a TestAgent with its own APIRequestContext (safe for beforeAll/afterAll) */
export async function createStandaloneAgent(
  account: SeedAccount,
  baseURL: string,
): Promise<TestAgent> {
  return TestAgent.create(account, baseURL);
}

/** Create multiple standalone TestAgents in parallel (safe for beforeAll/afterAll) */
export async function createStandaloneAgents(
  accounts: SeedAccount[],
  baseURL: string,
): Promise<TestAgent[]> {
  return Promise.all(accounts.map((a) => createStandaloneAgent(a, baseURL)));
}
