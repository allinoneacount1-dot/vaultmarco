import { createFileRoute } from "@tanstack/react-router";
import { pickFocusSearch } from "@/lib/intelligence/identityCodec";

/**
 * /dashboard/divergence — critical route config only (focus-asset search params).
 * The page itself is code-split into dashboard.divergence.lazy.tsx.
 */
export const Route = createFileRoute("/dashboard/divergence")({
  validateSearch: pickFocusSearch,
});
