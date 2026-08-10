import { useState } from "react";
import { SectionHeading } from "./shell/SectionHeading";
import { FadeIn } from "./shell/Reveal";
import { scrollToId } from "./shell/SmoothScroll";
import { PartnerDashboardModal } from "./PartnerDashboardModal";

const PARTNERS = [
  { name: "Community Alpha", tag: "NETWORK", marks: ["SOL", "TG", "DC"] },
  { name: "Web3 Builders", tag: "BUILDERS", marks: ["ETH", "SOL", "BNB"] },
  { name: "AI Infrastructure", tag: "AI", marks: ["NV", "OAI", "CG"] },
  { name: "Trading Ecosystem", tag: "TRADING", marks: ["UNI", "JUP", "PF"] },
  { name: "Launch Partners", tag: "LAUNCHPADS", marks: ["CL", "DAO", "TS"] },
  { name: "Strategic Networks", tag: "STRATEGY", marks: ["SOL", "ETH", "BNB", "BASE"] },
];

/** SCENE 06 — allied networks: an engraved registry, not a logo carousel. */
export function Partnerships() {
  const [openPartner, setOpenPartner] = useState<string | null>(null);
  return (
    <section id="partnerships" className="relative bg-(--void)">
      <div className="u-container py-28 md:py-36">
        <SectionHeading
          index="04"
          sub="ALLIED NETWORKS"
          title="The Registry"
          right={<span className="mono-label">FUTURE-PROOF COLLABORATIONS ONLY</span>}
        />

        <div className="hairline grid sm:grid-cols-2 lg:grid-cols-3">
          {PARTNERS.map((p, i) => (
            <FadeIn key={p.name} delay={(i % 3) * 0.06}>
              <button
                type="button"
                onClick={() => setOpenPartner(p.name)}
                className="group flex h-full w-full flex-col justify-between border-(--hairline) p-7 text-left transition-colors duration-500 hover:bg-(--graphite) sm:border-r sm:border-b"
              >
                <div>
                  <div className="mono-label text-[9px]! text-(--gold)!">{p.tag}</div>
                  <div className="mt-3 font-display text-[17px] font-medium tracking-[0.02em] text-(--bone)">
                    <span className="group-hover:chrome-text">{p.name}</span>
                  </div>
                </div>
                <div className="mt-8 flex items-center justify-between">
                  <div className="flex gap-2">
                    {p.marks.map((m) => (
                      <span
                        key={m}
                        className="mono-data hairline grid size-8 place-items-center text-[8.5px] text-(--muted-2) transition-colors duration-300 group-hover:text-(--bone)"
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                  <span
                    aria-hidden
                    className="text-(--faint) transition-all duration-500 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-(--gold)"
                  >
                    ↗
                  </span>
                </div>
              </button>
            </FadeIn>
          ))}
        </div>

        <FadeIn delay={0.15}>
          <div className="hairline mt-px flex flex-col items-start justify-between gap-6 border-t-0 p-8 sm:flex-row sm:items-center md:p-10">
            <div>
              <div className="font-display text-[clamp(20px,2.4vw,28px)] font-medium text-(--bone)">
                Interested in partnership?
              </div>
              <p className="mt-2 text-[13.5px] text-(--muted-2)">
                Communities, AI projects, launchpads, KOL networks — the vault door is listening.
              </p>
            </div>
            <button
              onClick={() => scrollToId("access")}
              className="chrome-fill shrink-0 px-6 py-3.5 font-mono text-[11px] font-semibold tracking-[0.18em] transition-[filter] duration-300 hover:brightness-110"
            >
              CONTACT THE DESK
            </button>
          </div>
        </FadeIn>

        <PartnerDashboardModal partnerName={openPartner} onClose={() => setOpenPartner(null)} />
      </div>
    </section>
  );
}
