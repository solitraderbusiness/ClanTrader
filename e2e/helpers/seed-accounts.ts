/** Seed user credentials matching prisma/seed.ts */

export interface SeedAccount {
  email: string;
  password: string;
  name: string;
  role: "ADMIN" | "TRADER" | "SPECTATOR";
}

export const ADMIN: SeedAccount = {
  email: "admin@clantrader.ir",
  password: "password123",
  name: "Admin User",
  role: "ADMIN",
};

export const TRADER1: SeedAccount = {
  email: "trader1@clantrader.ir",
  password: "password123",
  name: "Ali Trader",
  role: "TRADER",
};

export const TRADER2: SeedAccount = {
  email: "trader2@clantrader.ir",
  password: "password123",
  name: "Sara Forex",
  role: "TRADER",
};

export const TRADER3: SeedAccount = {
  email: "trader3@clantrader.ir",
  password: "password123",
  name: "Reza Gold",
  role: "TRADER",
};

export const SPECTATOR: SeedAccount = {
  email: "spectator@clantrader.ir",
  password: "password123",
  name: "New User",
  role: "SPECTATOR",
};

export const ALL_ACCOUNTS = [ADMIN, TRADER1, TRADER2, TRADER3, SPECTATOR] as const;

/** The pre-seeded clan */
export const SEED_CLAN_NAME = "Golden Eagles";
