import { createFileRoute } from "@tanstack/react-router";
import { pickFocusSearch } from "@/lib/intelligence/identityCodec";

/**
 * /dashboard/change-queue — critical route config only (focus-asset search params).
 * The page itself is code-split into dashboard.change-queue.lazy.tsx.
 */
export const Route = createFileRoute("/dashboard/change-queue")({
  validateSearch: pickFocusSearch,
});
