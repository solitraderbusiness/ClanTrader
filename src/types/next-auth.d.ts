import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      isPro: boolean;
      username?: string | null;
      phone?: string | null;
      phoneVerified?: string | null;
      onboardingComplete?: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    role: string;
    isPro: boolean;
    username?: string | null;
    phone?: string | null;
    phoneVerified?: string | null;
    onboardingComplete?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    isPro: boolean;
    username?: string | null;
    phone?: string | null;
    phoneVerified?: string | null;
    onboardingComplete?: boolean;
  }
}
