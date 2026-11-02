import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySession } from "@/lib/jwt";

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

  // Unauthenticated user attempting to access protected route
  if (!session && !isLoginPage) {
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete("axia_session");
    response.cookies.delete("axia_user");
    response.cookies.delete("axia_role");
    return response;
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

  if (isAdminOnly && session) {
    const isAgustin = session.nombre === "Agustín" || session.nombre === "Agustin";
    if (session.rol !== "admin" || !isAgustin) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|xlsx|xls|csv)$).*)",
  ],
};
