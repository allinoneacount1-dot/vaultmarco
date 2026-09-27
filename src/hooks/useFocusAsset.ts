import { useCallback, useMemo } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import {
  type DecodeResult,
  type FocusAsset,
  type FocusSearch,
  decodeFocus,
  encodeFocus,
  pickFocusSearch,
} from "@/lib/intelligence/identityCodec";

/**
 * The selected asset of the intelligence views, shared through the URL
 * (?chain=…&address=…; a legacy `pair` is ignored and dropped on the next write) so it survives refresh, back/forward and
 * moving between views. Identity only — chain + address, never a symbol.
 */
export function useFocusAsset(): {
  focus: FocusAsset | null;
  /** Why the URL's asset was rejected (null when absent or valid). */
  invalid: Exclude<DecodeResult, { ok: true }>["reason"] | null;
  /** The focus keys of the current URL, to carry to another view. */
  search: FocusSearch;
  setFocus: (asset: { chainId: string; address: string } | null) => void;
} {
  const raw = useSearch({ strict: false }) as Record<string, unknown>;
  const { chain, address } = raw;
  const search = useMemo(() => pickFocusSearch({ chain, address }), [chain, address]);
  const result = useMemo(() => decodeFocus(search as Record<string, unknown>), [search]);
  const navigate = useNavigate();
  const setFocus = useCallback(
    (asset: { chainId: string; address: string } | null) => {
      void navigate({
        to: ".",
        search: (prev: Record<string, unknown>) => {
          const { chain: _c, address: _a, pair: _p, ...rest } = prev;
          return asset ? { ...rest, ...encodeFocus(asset) } : rest;
        },
      } as never);
    },
    [navigate],
  );
  return {
    focus: result.ok ? result.asset : null,
    invalid: result.ok || result.reason === "EMPTY" ? null : result.reason,
    search,
    setFocus,
  };
}
