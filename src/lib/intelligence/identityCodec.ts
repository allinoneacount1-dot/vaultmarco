import { assetKey, isEvmHexAddress } from "@/lib/assetIdentity";

/**
 * FOCUS-ASSET URL CODEC — the selected asset lives in the URL as
 *   ?chain=<provider chain slug>&address=<base token address>[&pair=<pair address>]
 *
 * Identity is chain + ADDRESS, never a symbol:
 *   - chain is a provider slug, lowercased ("solana", "base", "hyperliquid").
 *   - 0x-hex addresses are case-insensitive and are written lowercased (the
 *     same rule as assetKey), so a mixed-case paste and its lowercase form
 *     are the same asset and the same URL.
 *   - every other address (Solana/Base58, …) is case-SENSITIVE and kept
 *     exactly; a case-variant is a different asset.
 *   - anything that is not address-shaped (a symbol like "SOL" or "$PEPE",
 *     a name, a number) is rejected — there is no symbol lookup.
 */

export type FocusAsset = {
  /** Canonical assetKey(chain, address). */
  assetKey: string;
  chainId: string;
  address: string;
  pairAddress: string | null;
};

export type FocusSearch = { chain?: string; address?: string; pair?: string };

export type DecodeResult =
  | { ok: true; asset: FocusAsset }
  | {
      ok: false;
      reason:
        | "EMPTY"
        | "MISSING_CHAIN"
        | "MISSING_ADDRESS"
        | "INVALID_CHAIN"
        | "INVALID_ADDRESS"
        | "INVALID_PAIR";
    };

const CHAIN = /^[a-z0-9][a-z0-9-]{0,31}$/;
/** 0x + hex: EVM (40), Hyperliquid-style (32) and other hex ids up to 64. */
const HEX = /^0x[0-9a-fA-F]{32,64}$/;
/** Base58 (no 0 O I l), Solana-length. */
const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
/** Move-style coin types, e.g. 0x…::coin::COIN (Sui/Aptos). */
const MOVE = /^0x[0-9a-fA-F]{1,64}::[A-Za-z_][A-Za-z0-9_]*::[A-Za-z_][A-Za-z0-9_]*$/;
/** TON user-friendly (base64url, 48 chars). */
const TON = /^[A-Za-z0-9_-]{48}$/;

/** True when `s` has the syntax of a token/pair address on a supported format. */
export function isAddressLike(s: string): boolean {
  return HEX.test(s) || BASE58.test(s) || MOVE.test(s) || TON.test(s);
}

/** Canonical URL form of an address: 0x-hex lowercased, everything else exact. */
export function canonicalUrlAddress(address: string): string {
  return isEvmHexAddress(address) ? address.toLowerCase() : address;
}

/** Search params for a focus asset (only these three keys). */
export function encodeFocus(a: {
  chainId: string;
  address: string;
  pairAddress?: string | null;
}): FocusSearch {
  const out: FocusSearch = {
    chain: a.chainId.toLowerCase(),
    address: canonicalUrlAddress(a.address),
  };
  if (a.pairAddress) out.pair = canonicalUrlAddress(a.pairAddress);
  return out;
}

const str = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim() !== "" ? v.trim() : undefined;

/**
 * Parse raw search params. Non-string values are rejected rather than
 * coerced: a digit-only value the router parsed as a number can no longer be
 * trusted to round-trip exactly.
 */
export function decodeFocus(search: Record<string, unknown> | null | undefined): DecodeResult {
  const rawChain = search?.chain;
  const rawAddress = search?.address;
  const rawPair = search?.pair;
  if (rawChain == null && rawAddress == null && rawPair == null)
    return { ok: false, reason: "EMPTY" };
  const chain = str(rawChain);
  const address = str(rawAddress);
  if (rawChain != null && chain == null) return { ok: false, reason: "INVALID_CHAIN" };
  if (rawAddress != null && address == null) return { ok: false, reason: "INVALID_ADDRESS" };
  if (!chain) return { ok: false, reason: "MISSING_CHAIN" };
  if (!address) return { ok: false, reason: "MISSING_ADDRESS" };
  const chainId = chain.toLowerCase();
  if (!CHAIN.test(chainId)) return { ok: false, reason: "INVALID_CHAIN" };
  if (!isAddressLike(address)) return { ok: false, reason: "INVALID_ADDRESS" };
  let pairAddress: string | null = null;
  if (rawPair != null) {
    const pair = str(rawPair);
    if (!pair || !isAddressLike(pair)) return { ok: false, reason: "INVALID_PAIR" };
    pairAddress = canonicalUrlAddress(pair);
  }
  const canonical = canonicalUrlAddress(address);
  return {
    ok: true,
    asset: { assetKey: assetKey(chainId, canonical), chainId, address: canonical, pairAddress },
  };
}

/**
 * Keep only the focus keys of an arbitrary search object (route
 * validateSearch). Strings pass through untouched; any other present value
 * (e.g. a digit-only address the router parsed as a number) is stringified so
 * decodeFocus reports it as INVALID rather than silently dropping it.
 */
export function pickFocusSearch(search: Record<string, unknown>): FocusSearch {
  const out: FocusSearch = {};
  for (const k of ["chain", "address", "pair"] as const) {
    const v = search[k];
    if (v == null) continue;
    out[k] = typeof v === "string" ? v : `!${String(v)}`;
  }
  return out;
}

/** Same asset under the identity rule (pair ignored). */
export function sameFocus(a: FocusAsset | null, b: FocusAsset | null): boolean {
  if (!a || !b) return a === b;
  return a.assetKey === b.assetKey;
}
