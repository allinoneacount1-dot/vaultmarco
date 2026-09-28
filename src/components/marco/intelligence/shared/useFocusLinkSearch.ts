import { useMemo } from "react";
import { useFocusAsset } from "@/hooks/useFocusAsset";
import { type FocusSearch, encodeFocus } from "@/lib/intelligence/identityCodec";

/**
 * The focus identity to carry in links to other views, in its CANONICAL form
 * (EVM lowercase, Base58 exact) — never the URL's raw spelling. Empty when
 * nothing valid is selected.
 */
export function useFocusLinkSearch(): FocusSearch {
  const { focus } = useFocusAsset();
  return useMemo<FocusSearch>(() => (focus ? encodeFocus(focus) : {}), [focus]);
}
