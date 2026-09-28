import { createLazyFileRoute } from "@tanstack/react-router";
import { DivergencePage } from "@/components/marco/intelligence/divergence/DivergencePage";

export const Route = createLazyFileRoute("/dashboard/divergence")({
  component: DivergencePage,
});
