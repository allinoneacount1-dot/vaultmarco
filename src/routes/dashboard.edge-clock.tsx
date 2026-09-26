import { createFileRoute } from "@tanstack/react-router";
import { pickFocusSearch } from "@/lib/intelligence/identityCodec";

/**
 * /dashboard/edge-clock — critical route config only (focus-asset search params).
 * The page itself is code-split into dashboard.edge-clock.lazy.tsx.
 */
export const Route = createFileRoute("/dashboard/edge-clock")({
  validateSearch: pickFocusSearch,
});
