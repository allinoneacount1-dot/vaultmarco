import {
  Combine,
  Crosshair,
  GitCommitVertical,
  ListOrdered,
  Split,
  Timer,
  type LucideIcon,
} from "lucide-react";

/**
 * The six intelligence views: one route, one question each. Shared by the
 * sidebar and the page shell so labels, paths and questions never drift.
 */
export type IntelligenceFeature = {
  id: "moment" | "trace" | "edge-clock" | "divergence" | "collision" | "change-queue";
  path:
    | "/dashboard/moment"
    | "/dashboard/trace"
    | "/dashboard/edge-clock"
    | "/dashboard/divergence"
    | "/dashboard/collision"
    | "/dashboard/change-queue";
  label: string;
  question: string;
  icon: LucideIcon;
  /** Whether the view is about one selected asset (shows the asset bar). */
  focused: boolean;
};

export const INTELLIGENCE_FEATURES: readonly IntelligenceFeature[] = [
  {
    id: "moment",
    path: "/dashboard/moment",
    label: "The Moment",
    question: "What just changed?",
    icon: Crosshair,
    focused: true,
  },
  {
    id: "trace",
    path: "/dashboard/trace",
    label: "Vault Trace",
    question: "What moved first?",
    icon: GitCommitVertical,
    focused: true,
  },
  {
    id: "edge-clock",
    path: "/dashboard/edge-clock",
    label: "Edge Clock",
    question: "How old is this move?",
    icon: Timer,
    focused: true,
  },
  {
    id: "divergence",
    path: "/dashboard/divergence",
    label: "Divergence",
    question: "What doesn't fit?",
    icon: Split,
    focused: true,
  },
  {
    id: "collision",
    path: "/dashboard/collision",
    label: "Collision",
    question: "What changed together?",
    icon: Combine,
    focused: true,
  },
  {
    id: "change-queue",
    path: "/dashboard/change-queue",
    label: "Change Queue",
    question: "What deserves attention now?",
    icon: ListOrdered,
    focused: false,
  },
];

export function featureById(id: IntelligenceFeature["id"]): IntelligenceFeature {
  return INTELLIGENCE_FEATURES.find((f) => f.id === id)!;
}
