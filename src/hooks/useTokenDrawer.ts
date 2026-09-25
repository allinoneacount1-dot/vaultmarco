import { createContext, useContext } from "react";
import type { TokenRef } from "@/lib/tokenDrawer";

export type TokenDrawerActions = {
  /** `trigger` is the row that opened the drawer; focus returns to it on close. */
  open: (ref: TokenRef, trigger?: HTMLElement | null) => void;
  close: () => void;
};

/** What the drawer is showing, and the element that opened it. */
export type OpenToken = { ref: TokenRef; trigger: HTMLElement | null };

/**
 * Two contexts on purpose: rows only need the (stable) actions, so opening or
 * closing the drawer re-renders the drawer alone — never the dashboard rows.
 * The provider lives in components/marco/TokenDrawerProvider.tsx.
 */
export const TokenDrawerActionsContext = createContext<TokenDrawerActions | null>(null);
export const OpenTokenContext = createContext<OpenToken | null>(null);

const NOOP: TokenDrawerActions = { open: () => {}, close: () => {} };

/** Open/close actions for entry-point rows. Safe outside a provider (no-op). */
export function useTokenDrawerActions(): TokenDrawerActions {
  return useContext(TokenDrawerActionsContext) ?? NOOP;
}

/** The token the drawer is currently showing (and its trigger), or null when closed. */
export function useOpenToken(): OpenToken | null {
  return useContext(OpenTokenContext);
}
