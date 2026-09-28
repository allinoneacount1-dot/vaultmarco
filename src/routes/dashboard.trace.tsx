import { createFileRoute } from "@tanstack/react-router";
import { pickFocusSearch } from "@/lib/intelligence/identityCodec";

/**
 * /dashboard/trace — critical route config only (focus-asset search params).
 * The page itself is code-split into dashboard.trace.lazy.tsx.
 */
export const Route = createFileRoute("/dashboard/trace")({
  validateSearch: pickFocusSearch,
});
