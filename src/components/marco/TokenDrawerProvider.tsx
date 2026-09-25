import { useMemo, useState } from "react";
import {
  OpenTokenRefContext,
  type TokenDrawerActions,
  TokenDrawerActionsContext,
} from "@/hooks/useTokenDrawer";
import type { TokenRef } from "@/lib/tokenDrawer";

/** Holds which token the Token Intelligence Drawer shows; rows get stable actions. */
export function TokenDrawerProvider({ children }: { children: React.ReactNode }) {
  const [ref, setRef] = useState<TokenRef | null>(null);
  const actions = useMemo<TokenDrawerActions>(
    () => ({ open: (r) => setRef(r), close: () => setRef(null) }),
    [],
  );
  return (
    <TokenDrawerActionsContext.Provider value={actions}>
      <OpenTokenRefContext.Provider value={ref}>{children}</OpenTokenRefContext.Provider>
    </TokenDrawerActionsContext.Provider>
  );
}
