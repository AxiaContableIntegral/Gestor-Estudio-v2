import bcrypt from "bcryptjs";
export * from "./jwt";

export async function hashPassword(plain: string): Promise<string> {
  return await bcrypt.hash(plain, 10);
}

export async function comparePassword(
  plain: string,
  stored: string
): Promise<{ isValid: boolean; needsRehash: boolean }> {
  if (!stored) return { isValid: false, needsRehash: false };

  // Check if already a bcrypt hash ($2a$, $2b$, or $2y$)
  if (stored.startsWith("$2a$") || stored.startsWith("$2b$") || stored.startsWith("$2y$")) {
    const isValid = await bcrypt.compare(plain, stored);
    return { isValid, needsRehash: false };
  }

  // Legacy plain text check
  const isValid = plain === stored;
  return { isValid, needsRehash: isValid };
}
