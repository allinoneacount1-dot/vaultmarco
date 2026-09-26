import { createLazyFileRoute } from "@tanstack/react-router";
import { IntelligencePlaceholder } from "@/components/marco/intelligence/IntelligenceShell";

export const Route = createLazyFileRoute("/dashboard/trace")({
  component: Page,
});

function Page() {
  return <IntelligencePlaceholder feature="trace" />;
}
