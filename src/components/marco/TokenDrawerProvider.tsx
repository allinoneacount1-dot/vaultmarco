import { useMemo, useState } from "react";
import {
  type OpenToken,
  OpenTokenContext,
  type TokenDrawerActions,
  TokenDrawerActionsContext,
} from "@/hooks/useTokenDrawer";

/** Holds which token the Token Intelligence Drawer shows; rows get stable actions. */
export function TokenDrawerProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState<OpenToken | null>(null);
  const actions = useMemo<TokenDrawerActions>(
    () => ({
      open: (ref, trigger = null) => setOpen({ ref, trigger }),
      close: () => setOpen(null),
    }),
    [],
  );
  return (
    <TokenDrawerActionsContext.Provider value={actions}>
      <OpenTokenContext.Provider value={open}>{children}</OpenTokenContext.Provider>
    </TokenDrawerActionsContext.Provider>
  );
}
