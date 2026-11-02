import { SignJWT, jwtVerify } from "jose";

const DEFAULT_SECRET = "axia_secure_jwt_secret_7313d6ea80d1cc813de6770c754b0429486a2f69";

export function getJwtSecretKey() {
  const secret = process.env.JWT_SECRET || DEFAULT_SECRET;
  return new TextEncoder().encode(secret);
}

export interface UserSession {
  id: string;
  nombre: string;
  rol: string;
}

export async function signSession(payload: UserSession): Promise<string> {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getJwtSecretKey());
}

export async function verifySession(token: string): Promise<UserSession | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecretKey());
    return {
      id: String(payload.id || payload.sub || ""),
      nombre: String(payload.nombre || ""),
      rol: String(payload.rol || ""),
    };
  } catch {
    return null;
  }
}
