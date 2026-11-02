import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { comparePassword, hashPassword, signSession } from "@/lib/auth";

// Simple in-memory rate limiting for login attempts
const failedAttempts = new Map<string, { count: number; lockUntil: number }>();

function checkRateLimit(key: string): { allowed: boolean; remainingSec: number } {
  const now = Date.now();
  const record = failedAttempts.get(key);

  if (!record) return { allowed: true, remainingSec: 0 };

  if (record.lockUntil > now) {
    const remainingSec = Math.ceil((record.lockUntil - now) / 1000);
    return { allowed: false, remainingSec };
  }

  if (record.lockUntil <= now && record.count >= 5) {
    failedAttempts.delete(key);
    return { allowed: true, remainingSec: 0 };
  }

  return { allowed: true, remainingSec: 0 };
}

function recordFailedAttempt(key: string) {
  const now = Date.now();
  const record = failedAttempts.get(key) || { count: 0, lockUntil: 0 };
  record.count += 1;

  if (record.count >= 5) {
    // Lock for 15 minutes
    record.lockUntil = now + 15 * 60 * 1000;
  }

  failedAttempts.set(key, record);
}

function clearFailedAttempts(key: string) {
  failedAttempts.delete(key);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { nombre, password } = body;

    if (!nombre || !password) {
      return NextResponse.json(
        { error: "Por favor completá usuario y contraseña" },
        { status: 400 }
      );
    }

    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rateLimitKey = `${clientIp}:${nombre}`;

    const { allowed, remainingSec } = checkRateLimit(rateLimitKey);
    if (!allowed) {
      const minutes = Math.ceil(remainingSec / 60);
      return NextResponse.json(
        { error: `Demasiados intentos fallidos. Cuenta temporalmente bloqueada por ${minutes} minuto(s).` },
        { status: 429 }
      );
    }

    // Query user securely from database
    const { data: user, error: dbError } = await supabase
      .from("equipo")
      .select("id, nombre, rol, password")
      .eq("nombre", nombre)
      .single();

    if (dbError || !user) {
      recordFailedAttempt(rateLimitKey);
      return NextResponse.json(
        { error: "Usuario o contraseña incorrectos" },
        { status: 401 }
      );
    }

    const { isValid, needsRehash } = await comparePassword(password, user.password);

    if (!isValid) {
      recordFailedAttempt(rateLimitKey);
      return NextResponse.json(
        { error: "Usuario o contraseña incorrectos" },
        { status: 401 }
      );
    }

    // Password is valid -> clear failed attempts
    clearFailedAttempts(rateLimitKey);

    // If password was stored in plain text, migrate it automatically to bcrypt hash
    if (needsRehash) {
      try {
        const hashed = await hashPassword(password);
        await supabase.from("equipo").update({ password: hashed }).eq("id", user.id);
      } catch (err) {
        console.error("Error migrating password to bcrypt hash:", err);
      }
    }

    // Sign cryptographic JWT session
    const token = await signSession({
      id: user.id,
      nombre: user.nombre,
      rol: user.rol,
    });

    const isProd = process.env.NODE_ENV === "production";
    const maxAge = 60 * 60 * 24 * 7; // 7 days

    const response = NextResponse.json({
      success: true,
      user: { nombre: user.nombre, rol: user.rol },
    });

    // 1. Secure, HttpOnly cookie (cannot be accessed or stolen via JS)
    response.cookies.set("axia_session", token, {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      path: "/",
      maxAge,
    });

    // 2. Client-readable UI cookies (for display in Navbar/Sidebar)
    response.cookies.set("axia_user", user.nombre, {
      httpOnly: false,
      secure: isProd,
      sameSite: "lax",
      path: "/",
      maxAge,
    });

    response.cookies.set("axia_role", user.rol, {
      httpOnly: false,
      secure: isProd,
      sameSite: "lax",
      path: "/",
      maxAge,
    });

    return response;
  } catch (err: any) {
    console.error("Login API error:", err);
    return NextResponse.json(
      { error: "Error interno del servidor al procesar el inicio de sesión" },
      { status: 500 }
    );
  }
}
