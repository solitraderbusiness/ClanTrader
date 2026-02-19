import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const token =
    request.cookies.get("authjs.session-token")?.value ||
    request.cookies.get("__Secure-authjs.session-token")?.value;

  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/home/:path*",
    "/dashboard/:path*",
    "/clans/:path*",
    "/discover/:path*",
    "/explore/:path*",
    "/leaderboard/:path*",
    "/profile/:path*",
    "/settings/:path*",
    "/stories/:path*",
    "/statements/:path*",
    "/admin/:path*",
  ],
};
