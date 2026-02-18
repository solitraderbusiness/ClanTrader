import { hashSync, compareSync } from "bcryptjs";

const SALT_ROUNDS = 10;

export function hashPassword(password: string): string {
  return hashSync(password, SALT_ROUNDS);
}

export function verifyPassword(
  password: string,
  passwordHash: string
): boolean {
  return compareSync(password, passwordHash);
}

export function generateToken(): string {
  const array = new Uint8Array(32);
  globalThis.crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}
