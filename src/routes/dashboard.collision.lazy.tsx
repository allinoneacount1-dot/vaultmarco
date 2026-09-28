import { createLazyFileRoute } from "@tanstack/react-router";
import { CollisionPage } from "@/components/marco/intelligence/collision/CollisionPage";

export const Route = createLazyFileRoute("/dashboard/collision")({
  component: CollisionPage,
});
