import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic route protection: if there's no session cookie at all, send the
 * visitor to login before rendering anything. This only checks presence — the
 * real validation (expiry, revocation, account status) happens server-side in
 * the profile layout, pages and actions.
 */
const SESSION_COOKIES = ["__Host-rocksms_session", "rocksms_session"];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSession = SESSION_COOKIES.some((name) => request.cookies.get(name)?.value);

  if (!hasSession) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname + search);
    return NextResponse.redirect(login);
  }

  // Let server components know the requested path (for accurate return URLs).
  const headers = new Headers(request.headers);
  headers.set("x-pathname", pathname + search);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/profile", "/profile/:path*", "/admin", "/admin/:path*"],
};
