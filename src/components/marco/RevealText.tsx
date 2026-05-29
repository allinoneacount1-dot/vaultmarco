import { motion } from "framer-motion";

export function RevealText({ text, className }: { text: string; className?: string }) {
  const words = text.split(" ");

  return (
    <h1 className={className}>
      {words.map((word, wordIndex) => (
        <span key={wordIndex} className="inline-block overflow-hidden">
          <motion.span
            className="inline-block"
            initial={{ y: "100%" }}
            whileInView={{ y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{
              duration: 0.6,
              delay: wordIndex * 0.08,
              ease: [0.21, 0.61, 0.35, 1],
            }}
          >
            {word}&nbsp;
          </motion.span>
        </span>
      ))}
    </h1>
  );
}
