import { useMemo } from "react";
import { useFocusAsset } from "@/hooks/useFocusAsset";
import { useAssetFreshness, useAssetTrack } from "@/hooks/useIntelligence";
import type { AssetTrack } from "@/lib/intelligence/facts";
import type { AssetFreshness } from "@/lib/intelligence/freshness";
import { type FocusSearch, encodeFocus } from "@/lib/intelligence/identityCodec";

/**
 * Shared by DIVERGENCE and COLLISION: the focus asset's session track and
 * freshness, and the honest states before any evidence exists. No market
 * logic lives here.
 */
export function useFocusEvidence(): {
  assetKey: string | null;
  track: AssetTrack | null;
  fresh: AssetFreshness;
  search: FocusSearch;
} {
  const { focus } = useFocusAsset();
  // Carry the canonical identity (EVM lowercase, Base58 exact) to other views.
  const search = useMemo<FocusSearch>(() => (focus ? encodeFocus(focus) : {}), [focus]);
  const key = focus?.assetKey ?? null;
  const track = useAssetTrack(key);
  const fresh = useAssetFreshness(key);
  return { assetKey: key, track, fresh, search };
}
