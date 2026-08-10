import type { ReactNode } from "react";
import { Reveal, DrawnLine } from "./Reveal";

/** Numbered chapter head: `01 —— TITLE` with a drawn hairline. */
export function SectionHeading({
  index,
  title,
  sub,
  right,
}: {
  index: string;
  title: string;
  sub?: string;
  right?: ReactNode;
}) {
  return (
    <div className="mb-12 md:mb-16">
      <div className="flex items-baseline justify-between gap-6">
        <div>
          <div className="mono-label flex items-center gap-4 !text-[--gold]">
            <span>{index}</span>
            <span className="inline-block h-px w-10 bg-[--gold] align-middle" />
            <span className="!text-[--faint]">{sub}</span>
          </div>
          <Reveal className="mt-4">
            <h2 className="font-display text-[clamp(26px,3.4vw,44px)] font-semibold uppercase tracking-[0.04em] text-[--bone]">
              {title}
            </h2>
          </Reveal>
        </div>
        {right ? <div className="hidden md:block">{right}</div> : null}
      </div>
      <DrawnLine className="mt-8" />
    </div>
  );
}
