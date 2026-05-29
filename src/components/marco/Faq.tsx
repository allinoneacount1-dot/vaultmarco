import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp } from "lucide-react";

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
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section id="faq" className="relative py-24 sm:py-32">
      <div className="relative mx-auto max-w-4xl px-4 sm:px-6">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 text-[10px] font-mono tracking-[0.35em] text-primary mb-4">
            <span className="size-1 rounded-full bg-primary animate-pulse-glow" />
            07 / FAQ
          </div>
          <h2 className="text-chrome font-display text-3xl sm:text-5xl font-semibold">
            Frequently Asked Questions
          </h2>
        </div>

        <div className="space-y-4">
          {faqItems.map((item, index) => (
            <motion.div
              key={index}
              className="glass border-glow rounded-2xl overflow-hidden"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.05 }}
            >
              <button
                onClick={() => toggleFaq(index)}
                className="w-full flex items-center justify-between p-6 text-left focus:outline-none"
              >
                <span className="text-lg font-display text-foreground">{item.question}</span>
                {openIndex === index ? (
                  <ChevronUp className="size-5 text-primary" />
                ) : (
                  <ChevronDown className="size-5 text-muted-foreground" />
                )}
              </button>
              <AnimatePresence>
                {openIndex === index && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <div className="px-6 pb-6 text-muted-foreground">{item.answer}</div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
