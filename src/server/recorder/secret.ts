import { sha256Hex } from "@/lib/history/sha256";

/**
 * Constant-time shared-secret check. Both values are hashed first so the
 * comparison never depends on where they differ or on the presented length.
 * An unset / empty expected secret rejects everything.
 */
export function secretMatches(presented: string | null, expected: string | undefined): boolean {
  if (!expected || presented == null) return false;
  const a = sha256Hex(presented);
  const b = sha256Hex(expected);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
