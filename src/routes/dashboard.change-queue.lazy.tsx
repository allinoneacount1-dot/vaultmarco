import { createLazyFileRoute } from "@tanstack/react-router";
import { IntelligenceShell } from "@/components/marco/intelligence/IntelligenceShell";
import { ChangeQueue } from "@/components/marco/intelligence/changeQueue/ChangeQueue";

export const Route = createLazyFileRoute("/dashboard/change-queue")({
  component: Page,
});

function Page() {
  return (
    <IntelligenceShell feature="change-queue">
      <ChangeQueue />
    </IntelligenceShell>
  );
}
