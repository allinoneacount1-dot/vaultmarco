import { SectionHeading } from "./shell/SectionHeading";
import { FadeIn } from "./shell/Reveal";
import { ContactForm } from "./ContactForm";

const CHANNELS = [
  {
    n: "01",
    name: "Community Group",
    desc: "Live discussions, setups and alpha among operators.",
    meta: "T.ME/DXMZONE",
    href: "https://t.me/DxmZone",
  },
  {
    n: "02",
    name: "Alpha Channel",
    desc: "Broadcast-only updates, curated narratives and high-signal intel.",
    meta: "T.ME/DEXMULTICHAIN",
    href: "https://t.me/DexMultichain",
  },
  {
    n: "03",
    name: "X / Twitter",
    desc: "Announcements and public signal from the vault.",
    meta: "@VAULTMARCO",
    href: "https://x.com/vaultmarco",
  },
];

/** SCENE 07 — access: three doors and one desk. */
export function Contact() {
  return (
    <section id="access" className="relative bg-(--void)">
      <div className="u-container py-28 md:py-36">
        <SectionHeading
          index="05"
          sub="ACCESS"
          title="Join the Operation"
          right={<span className="mono-label">DIRECT LINE · NO GATEKEEPERS</span>}
        />

        <div className="hairline-t">
          {CHANNELS.map((c, i) => (
            <FadeIn key={c.n} delay={i * 0.05}>
              <a
                href={c.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group hairline-b grid grid-cols-[44px_1fr_auto] items-center gap-4 py-7 transition-colors duration-500 hover:bg-(--graphite) md:grid-cols-[72px_minmax(200px,0.8fr)_1.2fr_180px_40px] md:gap-6"
              >
                <span className="mono-data pl-1 text-[12px] text-(--gold)">{c.n}</span>
                <span className="font-display text-[17px] font-medium tracking-[0.02em] text-(--bone)">
                  <span className="group-hover:chrome-text">{c.name}</span>
                </span>
                <span className="col-start-2 row-start-2 text-[13px] leading-relaxed text-(--faint) md:col-start-3 md:row-start-1 md:pr-8">
                  {c.desc}
                </span>
                <span className="mono-label hidden justify-self-end text-[9px]! md:block">{c.meta}</span>
                <span
                  aria-hidden
                  className="justify-self-end pr-1 text-(--faint) transition-all duration-500 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-(--gold)"
                >
                  ↗
                </span>
              </a>
            </FadeIn>
          ))}
        </div>

        <FadeIn delay={0.15} className="mt-16 md:mt-20">
          <div className="mb-8 flex items-baseline justify-between gap-6">
            <h3 className="font-display text-[clamp(18px,2vw,24px)] font-medium text-(--bone)">
              Or write to the desk
            </h3>
            <span className="mono-label hidden sm:block">PARTNERSHIPS · COLLABS · PRESS</span>
          </div>
          <ContactForm />
        </FadeIn>
      </div>
    </section>
  );
}
