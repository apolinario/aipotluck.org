import { type NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { isDevelopmentEnvironment } from "./lib/constants";

export async function proxy(request: NextRequest) {
  // Password gate (HTTP Basic Auth). Fires whenever PREVIEW_PASSWORD is SET —
  // presence is the switch, independent of VERCEL_ENV, so a gated deploy works
  // whether it's a Vercel "preview" or the personal project's "production"
  // deployment. To open the deployment to the public, REMOVE PREVIEW_PASSWORD.
  // Local dev (no env var) is never gated. Share "any username / <password>".
  // Runs before everything so the whole app (pages + /api) is gated.
  const previewPassword = process.env.PREVIEW_PASSWORD;
  if (previewPassword) {
    const header = request.headers.get("authorization") ?? "";
    let authorized = false;
    if (header.startsWith("Basic ")) {
      const decoded = atob(header.slice(6)); // "user:pass"
      authorized = decoded.slice(decoded.indexOf(":") + 1) === previewPassword;
    }
    if (!authorized) {
      return new Response("Authentication required.", {
        status: 401,
        headers: { "WWW-Authenticate": 'Basic realm="AI Potluck preview"' },
      });
    }
  }

  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/ping")) {
    return new Response("pong", { status: 200 });
  }

  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  // Sign-in is deferred for the guest-only alpha: block the email/password
  // auth pages outright (guests are created via /api/auth/guest, not these).
  if (pathname === "/login" || pathname === "/register") {
    return NextResponse.redirect(
      new URL(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/`, request.url)
    );
  }

  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
    secureCookie: !isDevelopmentEnvironment,
  });

  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

  if (!token) {
    const redirectUrl = encodeURIComponent(new URL(request.url).pathname);

    return NextResponse.redirect(
      new URL(`${base}/api/auth/guest?redirectUrl=${redirectUrl}`, request.url)
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/chat/:id",
    "/api/:path*",
    "/login",
    "/register",

    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|data/).*)",
  ],
};
