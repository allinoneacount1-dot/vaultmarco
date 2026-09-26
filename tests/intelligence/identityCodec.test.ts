import { describe, expect, it } from "vitest";
import { assetKey } from "@/lib/assetIdentity";
import { decodeFocus, encodeFocus, pickFocusSearch } from "@/lib/intelligence/identityCodec";
import { assetFreshness } from "@/lib/intelligence/freshness";
import { createSessionState, ingest } from "@/lib/intelligence/sessionHistory";
import { SOL_PAIR, START, T0, WETH_PAIR, batch, obs } from "./helpers";

const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const HONSE = "46vV3ZpFNLZn1CDRYnAvqPsdW5ejEYn9GK9kPcZFpump";

const roundTrip = (a: { chainId: string; address: string; pairAddress?: string | null }) =>
  decodeFocus(encodeFocus(a) as Record<string, unknown>);

describe("focus-asset URL codec", () => {
  it("EVM: mixed-case input normalises to the lowercase canonical identity", () => {
    const r = decodeFocus({ chain: "Ethereum", address: WETH, pair: WETH_PAIR.pairAddress });
    expect(r).toEqual({
      ok: true,
      asset: {
        assetKey: assetKey("ethereum", WETH),
        chainId: "ethereum",
        address: WETH.toLowerCase(),
        pairAddress: WETH_PAIR.pairAddress!.toLowerCase(),
      },
    });
    expect(encodeFocus({ chainId: "ethereum", address: WETH })).toEqual({
      chain: "ethereum",
      address: WETH.toLowerCase(),
    });
  });

  it("Base58: case preserved exactly through a round trip; a case variant is a different asset", () => {
    const r = roundTrip({ chainId: "solana", address: HONSE, pairAddress: SOL_PAIR.pairAddress });
    expect(r.ok && r.asset.address).toBe(HONSE);
    expect(r.ok && r.asset.pairAddress).toBe(SOL_PAIR.pairAddress);
    const variant = decodeFocus({ chain: "solana", address: HONSE.toLowerCase() });
    expect(variant.ok && variant.asset.assetKey).not.toBe(r.ok && r.asset.assetKey);
  });

  it("rejects symbols, names, malformed and non-string addresses", () => {
    for (const address of [
      "SOL",
      "$PEPE",
      "Wrapped SOL",
      "0x123",
      "0xZZ",
      "46vV3Z…pump",
      "O0Il" + "1".repeat(30),
    ]) {
      expect(decodeFocus({ chain: "solana", address })).toEqual({
        ok: false,
        reason: "INVALID_ADDRESS",
      });
    }
    // A digit-only value the router parsed as a number cannot round-trip exactly → invalid.
    expect(decodeFocus(pickFocusSearch({ chain: "solana", address: 1.111e31 }))).toEqual({
      ok: false,
      reason: "INVALID_ADDRESS",
    });
    expect(decodeFocus({ chain: "sol ana", address: HONSE })).toEqual({
      ok: false,
      reason: "INVALID_CHAIN",
    });
    expect(decodeFocus({ address: HONSE })).toEqual({ ok: false, reason: "MISSING_CHAIN" });
    expect(decodeFocus({ chain: "solana" })).toEqual({ ok: false, reason: "MISSING_ADDRESS" });
    expect(decodeFocus({ chain: "solana", address: HONSE, pair: "SOL/USDC" })).toEqual({
      ok: false,
      reason: "INVALID_PAIR",
    });
    expect(decodeFocus({})).toEqual({ ok: false, reason: "EMPTY" });
    expect(decodeFocus(null)).toEqual({ ok: false, reason: "EMPTY" });
  });

  it("the same symbol on different chains stays two distinct identities", () => {
    const a = decodeFocus({ chain: "solana", address: SOL_PAIR.baseToken.address });
    const b = decodeFocus({ chain: "base", address: "0x4200000000000000000000000000000000000006" });
    expect(a.ok && b.ok && a.asset.assetKey !== b.asset.assetKey).toBe(true);
    expect(
      decodeFocus({ chain: "ethereum", address: "0x4200000000000000000000000000000000000006" }),
    ).not.toEqual(b);
  });

  it("an unknown (valid but unobserved) asset resolves to an honest '—', never a guess", () => {
    const r = decodeFocus({ chain: "solana", address: HONSE });
    expect(r.ok).toBe(true);
    const s = ingest(createSessionState(START), batch("realtime", T0, [obs(SOL_PAIR, T0)]));
    const track = r.ok ? (s.assets.get(r.asset.assetKey) ?? null) : null;
    expect(track).toBeNull();
    expect(assetFreshness(track, s.lanes, T0).state).toBe("unobserved");
  });

  it("pickFocusSearch keeps only focus keys", () => {
    expect(pickFocusSearch({ chain: "solana", address: HONSE, other: "x" })).toEqual({
      chain: "solana",
      address: HONSE,
    });
  });
});
