import { createLazyFileRoute } from "@tanstack/react-router";
import { MomentView } from "@/components/marco/intelligence/moment/MomentView";

export const Route = createLazyFileRoute("/dashboard/moment")({
  component: MomentView,
});
