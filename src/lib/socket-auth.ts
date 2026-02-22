import { decode } from "next-auth/jwt";
import type { Socket } from "socket.io";

const COOKIE_NAMES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
];

export interface SocketUser {
  id: string;
  name: string | null;
  email: string;
  role: string;
  isPro: boolean;
  username: string | null;
}

export async function authenticateSocket(
  socket: Socket,
  next: (err?: Error) => void
) {
  try {
    const cookieHeader = socket.handshake.headers.cookie || "";
    const cookies = parseCookies(cookieHeader);

    let token: string | undefined;
    let cookieName: string | undefined;
    for (const name of COOKIE_NAMES) {
      if (cookies[name]) {
        token = cookies[name];
        cookieName = name;
        break;
      }
    }

    if (!token || !cookieName) {
      return next(new Error("Authentication required"));
    }

    const secret = process.env.AUTH_SECRET;
    if (!secret) {
      return next(new Error("Server misconfiguration"));
    }

    const decoded = await decode({
      token,
      secret,
      salt: cookieName,
    });

    if (!decoded || !decoded.id) {
      return next(new Error("Invalid session"));
    }

    (socket as Socket & { user: SocketUser }).user = {
      id: decoded.id as string,
      name: (decoded.name as string) || null,
      email: decoded.email as string,
      role: decoded.role as string,
      isPro: decoded.isPro as boolean,
      username: (decoded.username as string) || null,
    };

    next();
  } catch (error) {
    console.error("Socket auth error:", error);
    next(new Error("Authentication failed"));
  }
}

function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  cookieHeader.split(";").forEach((cookie) => {
    const [key, ...vals] = cookie.split("=");
    if (key) {
      cookies[key.trim()] = decodeURIComponent(vals.join("=").trim());
    }
  });
  return cookies;
}
