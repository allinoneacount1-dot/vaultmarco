import { createLazyFileRoute } from "@tanstack/react-router";
import { EdgeClockPage } from "@/components/marco/intelligence/edgeClock/EdgeClock";

export const Route = createLazyFileRoute("/dashboard/edge-clock")({
  component: EdgeClockPage,
});
