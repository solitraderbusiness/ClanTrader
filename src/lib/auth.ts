import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { db } from "@/lib/db";
import { redis } from "@/lib/redis";
import { verifyPassword } from "@/lib/auth-utils";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      id: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email = credentials?.email as string | undefined;
        const username = credentials?.username as string | undefined;
        const password = credentials?.password as string | undefined;

        if (!password) return null;

        let user;
        if (username) {
          // Username login (EA users) — no emailVerified requirement
          user = await db.user.findUnique({ where: { username } });
        } else if (email) {
          // Email login — require emailVerified
          user = await db.user.findUnique({ where: { email } });
          if (user && !user.emailVerified) return null;
        } else {
          return null;
        }

        if (!user?.passwordHash) return null;

        const valid = verifyPassword(password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.avatar,
          role: user.role,
          isPro: user.isPro,
          username: user.username,
          phone: user.phone,
          phoneVerified: user.phoneVerified?.toISOString() ?? null,
          onboardingComplete: user.onboardingComplete,
        };
      },
    }),
    // Phone provider removed — code preserved in git history. PhoneOtpForm still used in settings for adding phone.
    Credentials({
      id: "ea",
      credentials: {
        token: { label: "Token", type: "text" },
      },
      authorize: async (credentials) => {
        const token = credentials?.token as string | undefined;
        if (!token) return null;

        const loginTokenKey = `ea-login-token:${token}`;
        const userId = await redis.get(loginTokenKey);
        if (!userId) return null;

        // Delete token (one-time use)
        await redis.del(loginTokenKey);

        const user = await db.user.findUnique({ where: { id: userId } });
        if (!user) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.avatar,
          role: user.role,
          isPro: user.isPro,
          username: user.username,
          phone: user.phone,
          phoneVerified: user.phoneVerified?.toISOString() ?? null,
          onboardingComplete: user.onboardingComplete,
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id as string;
        token.role = (user as { role: string }).role;
        token.isPro = (user as { isPro: boolean }).isPro;
        token.username = (user as { username?: string | null }).username ?? null;
        token.phone = (user as { phone?: string | null }).phone ?? null;
        token.phoneVerified = (user as { phoneVerified?: string | null }).phoneVerified ?? null;
        token.onboardingComplete = (user as { onboardingComplete?: boolean }).onboardingComplete ?? false;
      }

      // Refresh token from DB when client calls update()
      if (trigger === "update" && token.id) {
        const freshUser = await db.user.findUnique({
          where: { id: token.id as string },
          select: { username: true, name: true, role: true, isPro: true, avatar: true, phone: true, phoneVerified: true, onboardingComplete: true },
        });
        if (freshUser) {
          token.username = freshUser.username;
          token.name = freshUser.name;
          token.role = freshUser.role;
          token.isPro = freshUser.isPro;
          token.picture = freshUser.avatar;
          token.phone = freshUser.phone;
          token.phoneVerified = freshUser.phoneVerified?.toISOString() ?? null;
          token.onboardingComplete = freshUser.onboardingComplete;
        }
      }

      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role as string;
      session.user.isPro = token.isPro as boolean;
      session.user.username = token.username as string | null;
      session.user.phone = token.phone as string | null;
      session.user.phoneVerified = token.phoneVerified as string | null;
      session.user.onboardingComplete = token.onboardingComplete as boolean;
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  trustHost: true,
});
