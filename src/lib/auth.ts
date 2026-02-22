import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth-utils";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;

        if (!email || !password) return null;

        const user = await db.user.findUnique({ where: { email } });
        if (!user) return null;

        if (!user.emailVerified) return null;

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
      }

      // Refresh token from DB when client calls update()
      if (trigger === "update" && token.id) {
        const freshUser = await db.user.findUnique({
          where: { id: token.id as string },
          select: { username: true, name: true, role: true, isPro: true, avatar: true },
        });
        if (freshUser) {
          token.username = freshUser.username;
          token.name = freshUser.name;
          token.role = freshUser.role;
          token.isPro = freshUser.isPro;
          token.picture = freshUser.avatar;
        }
      }

      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role as string;
      session.user.isPro = token.isPro as boolean;
      session.user.username = token.username as string | null;
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  trustHost: true,
});
