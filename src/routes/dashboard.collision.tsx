import { createFileRoute } from "@tanstack/react-router";
import { pickFocusSearch } from "@/lib/intelligence/identityCodec";

/**
 * /dashboard/collision — critical route config only (focus-asset search params).
 * The page itself is code-split into dashboard.collision.lazy.tsx.
 */
export const Route = createFileRoute("/dashboard/collision")({
  validateSearch: pickFocusSearch,
});
