import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      isPro: boolean;
      username?: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    role: string;
    isPro: boolean;
    username?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    isPro: boolean;
    username?: string | null;
  }
}
