import { createLazyFileRoute } from "@tanstack/react-router";
import { VaultTracePage } from "@/components/marco/intelligence/trace/VaultTrace";

export const Route = createLazyFileRoute("/dashboard/trace")({
  component: VaultTracePage,
});
