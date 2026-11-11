import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySession, signSession, SESSION_MAX_AGE } from "@/lib/jwt";

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isLoginPage = path.startsWith("/login");
  const isApiAuth = path.startsWith("/api/auth");

  // Allow auth API routes to proceed freely
  if (isApiAuth) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get("axia_session")?.value;
  const session = sessionCookie ? await verifySession(sessionCookie) : null;

  // Unauthenticated user attempting to access protected route (or session expired after 1h)
  if (!session && !isLoginPage) {
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete("axia_session");
    response.cookies.delete("axia_user");
    response.cookies.delete("axia_role");
    return response;
  }

  // Clear stale UI cookies when landing on /login without a valid session
  if (!session && isLoginPage) {
    const hasStale =
      request.cookies.has("axia_session") ||
      request.cookies.has("axia_user") ||
      request.cookies.has("axia_role");
    if (hasStale) {
      const response = NextResponse.next();
      response.cookies.delete("axia_session");
      response.cookies.delete("axia_user");
      response.cookies.delete("axia_role");
      return response;
    }
  }

  // Authenticated user attempting to access /login
  if (session && isLoginPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Strict role check for admin-only sections
  const isAdminOnly =
    path.startsWith("/rentabilidad") ||
    path.startsWith("/equipo") ||
    path.startsWith("/analisis-tiempos");

  if (isAdminOnly && session && session.rol !== "admin") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Rolling session refresh: extend 1 hour of activity on each navigation
  const response = NextResponse.next();
  if (session) {
    const isProd = process.env.NODE_ENV === "production";
    const refreshedToken = await signSession(session);
    response.cookies.set("axia_session", refreshedToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });
    response.cookies.set("axia_user", session.nombre, {
      httpOnly: false,
      secure: isProd,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });
    response.cookies.set("axia_role", session.rol, {
      httpOnly: false,
      secure: isProd,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|xlsx|xls|csv)$).*)",
  ],
};
