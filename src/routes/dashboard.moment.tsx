import { createFileRoute } from "@tanstack/react-router";
import { pickFocusSearch } from "@/lib/intelligence/identityCodec";

/**
 * /dashboard/moment — critical route config only (focus-asset search params).
 * The page itself is code-split into dashboard.moment.lazy.tsx.
 */
export const Route = createFileRoute("/dashboard/moment")({
  validateSearch: pickFocusSearch,
});
