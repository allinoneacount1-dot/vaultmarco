import { createContext, useContext } from "react";
import type { TokenRef } from "@/lib/tokenDrawer";

export type TokenDrawerActions = { open: (ref: TokenRef) => void; close: () => void };

/**
 * Two contexts on purpose: rows only need the (stable) actions, so opening or
 * closing the drawer re-renders the drawer alone — never the dashboard rows.
 * The provider lives in components/marco/TokenDrawerProvider.tsx.
 */
export const TokenDrawerActionsContext = createContext<TokenDrawerActions | null>(null);
export const OpenTokenRefContext = createContext<TokenRef | null>(null);

const NOOP: TokenDrawerActions = { open: () => {}, close: () => {} };

/** Open/close actions for entry-point rows. Safe outside a provider (no-op). */
export function useTokenDrawerActions(): TokenDrawerActions {
  return useContext(TokenDrawerActionsContext) ?? NOOP;
}

/** The reference the drawer is currently showing, or null when closed. */
export function useOpenTokenRef(): TokenRef | null {
  return useContext(OpenTokenRefContext);
}
