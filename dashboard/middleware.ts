import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Paths that do not require authentication
const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/auth/accept-invite",
  "/auth/verify-email",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow public auth paths (exact match or with query string)
  if (
    PUBLIC_PATHS.some(
      (p) => pathname === p || pathname.startsWith(p + "?") || pathname.startsWith(p + "/")
    )
  ) {
    return NextResponse.next();
  }

  // Check for auth cookie (written by SessionContext on login)
  const token = request.cookies.get("auth_token")?.value;
  if (!token) {
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") {
      loginUrl.searchParams.set("next", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Run on all paths except Next.js internals, static assets, and API routes
    "/((?!api|_next/static|_next/image|favicon\\.ico).*)",
  ],
};
