import { createFileRoute } from "@tanstack/react-router";
import { DashboardIndex } from "./dashboard";

export const Route = createFileRoute("/dashboard/")({
  component: DashboardIndex,
});
