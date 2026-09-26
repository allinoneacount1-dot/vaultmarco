/**
 * NUMBER TYPOGRAPHY for the desk. Pure and deterministic: every function only
 * re-presents a real value; unknown stays unknown ("—"), a real zero stays 0.
 *
 * Micro prices use crypto-native subscript-zero notation so significant digits
 * stay readable and columns stay narrow: 0.00001862 → $0.0₄1862.
 */

export type PriceParts =
  | { kind: "unknown"; text: "—" }
  | { kind: "plain"; text: string }
  /** `head` + subscript `zeros` + `tail`; `text` is the full value for a11y / copy. */
  | { kind: "subscript"; text: string; head: string; zeros: number; tail: string };

const grouped = (n: number, digits: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });

export function priceParts(n: number | null | undefined): PriceParts {
  if (n == null || !Number.isFinite(n)) return { kind: "unknown", text: "—" };
  const sign = n < 0 ? "−" : "";
  const a = Math.abs(n);
  if (a === 0) return { kind: "plain", text: "$0.00" };
  if (a >= 1) return { kind: "plain", text: `${sign}$${grouped(a, 2)}` };
  if (a >= 0.001) return { kind: "plain", text: `${sign}$${a.toFixed(4)}` };
  // a < 0.001: count the zeros after "0." and keep 4 significant digits.
  const zeros = Math.floor(-Math.log10(a)); // e.g. 1.862e-5 → 4
  const sig = Math.round(a * 10 ** (zeros + 4));
  // Rounding can carry into one more digit (e.g. 9.99995e-6): renormalise.
  const carry = sig >= 10_000;
  const z = carry ? zeros - 1 : zeros;
  const tail = String(carry ? Math.round(sig / 10) : sig).padStart(4, "0");
  return {
    kind: "subscript",
    text: `${sign}$${a.toFixed(z + 4)}`,
    head: `${sign}$0.0`,
    zeros: z,
    tail,
  };
}

/** Signed percentage with a typographic minus; unknown is "—", never "+0.0%". */
export function signedPct(n: number | null | undefined, digits = 1): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const v = Number(n.toFixed(digits));
  if (v === 0) return `${(0).toFixed(digits)}%`;
  return `${v > 0 ? "+" : "−"}${Math.abs(v).toFixed(digits)}%`;
}

/** Direction tone for a KNOWN change; unknown and exactly-zero stay neutral. */
export function changeTone(n: number | null | undefined): "up" | "down" | "flat" | "unknown" {
  if (n == null || !Number.isFinite(n)) return "unknown";
  if (n > 0) return "up";
  if (n < 0) return "down";
  return "flat";
}
