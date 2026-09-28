import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import type { FocusSearch } from "@/lib/intelligence/identityCodec";
import { type IntelligenceFeature, featureById } from "../features";

type FeatureId = IntelligenceFeature["id"];

const LINK =
  "mv-glass inline-flex min-h-9 items-center gap-2 px-3 font-mono text-[10px] tracking-[0.14em] text-(--muted-2)";

/**
 * Related views for the selected asset, as real links that carry the focus
 * identity (chain + address) in the URL. THE MOMENT reads "OPEN IN THE
 * MOMENT"; the other views are named by their sidebar label.
 */
export function RelatedViews({ search, views }: { search: FocusSearch; views: FeatureId[] }) {
  return (
    <nav
      aria-label="Related views for this asset"
      className="flex flex-wrap items-center gap-2"
      data-testid="cross-links"
    >
      {views.map((id) => {
        const f = featureById(id);
        return (
          <Link key={id} to={f.path} search={search} className={LINK} data-testid={`to-${id}`}>
            {id === "moment" ? "OPEN IN THE MOMENT" : f.label.toUpperCase()}
            <ArrowRight className="size-3" aria-hidden />
          </Link>
        );
      })}
    </nav>
  );
}

/** Inline text link to a full intelligence view (inside a panel), preserving the asset. */
export function ViewLink({
  feature,
  search,
  testId,
}: {
  feature: FeatureId;
  search: FocusSearch;
  testId: string;
}) {
  const f = featureById(feature);
  return (
    <Link
      to={f.path}
      search={search}
      data-testid={testId}
      className="group -my-1 inline-flex min-h-9 items-center gap-1.5 py-1 font-mono text-[9px] tracking-[0.18em] text-(--muted-2) transition-colors duration-(--dur-micro) hover:text-(--gold) focus-visible:text-(--gold) focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-(--gold)"
    >
      OPEN {f.label.toUpperCase()}
      <ArrowRight aria-hidden className="size-3" strokeWidth={1.8} />
    </Link>
  );
}
