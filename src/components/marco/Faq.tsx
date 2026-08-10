import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SectionHeading } from "./shell/SectionHeading";
import { FadeIn, EASE_VAULT } from "./shell/Reveal";

const faqItems = [
  {
    question: "What is MARCOVAULT?",
    answer:
      "MARCOVAULT is a Web3 platform focused on multi-chain intelligence, AI workflow automation, and trading systems to help you navigate the crypto market more intelligently.",
  },
  {
    question: "Is MARCOVAULT free to use?",
    answer:
      "Yes! The community and basic features of MARCOVAULT are free to access. Premium features (coming soon) will be announced later!",
  },
  {
    question: "Which blockchains are supported?",
    answer:
      "We support many major blockchains including Bitcoin, Ethereum, Solana, Base, Hyperliquid, BNB Chain, Sui, and many more!",
  },
  {
    question: "How do I join the community?",
    answer:
      "You can join our Telegram group or follow us on X (Twitter) to get the latest updates and news.",
  },
  {
    question: "Is market data real-time?",
    answer:
      "Yes! We use the CoinGecko API to provide real-time price, volume, and price change data with a refresh every 30 seconds.",
  },
];

export function Faq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="relative bg-[rgba(11,12,14,0.9)]">
      <div className="u-container max-w-[880px] py-28 md:py-36">
        <SectionHeading index="06" sub="QUESTIONS" title="Asked & Answered" />

        <div className="hairline-t">
          {faqItems.map((item, index) => {
            const open = openIndex === index;
            return (
              <FadeIn key={index} delay={index * 0.04}>
                <div className="hairline-b">
                  <button
                    onClick={() => setOpenIndex(open ? null : index)}
                    className="group flex w-full items-baseline gap-6 py-6 text-left focus:outline-none"
                    aria-expanded={open}
                  >
                    <span className="mono-data text-[11px] text-(--gold)">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="flex-1 font-display text-[15.5px] font-medium tracking-[0.02em] text-(--bone) transition-colors duration-300 group-hover:text-(--champagne)">
                      {item.question}
                    </span>
                    <span
                      aria-hidden
                      className="mono-data select-none text-[15px] text-(--faint) transition-transform duration-500"
                      style={{ transform: open ? "rotate(45deg)" : "none" }}
                    >
                      +
                    </span>
                  </button>
                  <AnimatePresence initial={false}>
                    {open && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.55, ease: EASE_VAULT }}
                        className="overflow-hidden"
                      >
                        <p className="max-w-[62ch] pb-7 pl-[42px] text-[14px] leading-relaxed text-(--muted-2)">
                          {item.answer}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </FadeIn>
            );
          })}
        </div>
      </div>
    </section>
  );
}
