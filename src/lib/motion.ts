/**
 * MOTION TOKENS — the dashboard's single motion system (mirrors the CSS
 * custom properties in styles.css). Seconds, for framer-motion.
 *
 *   micro       press · hover · icon swap · copy confirmation · selection
 *   standard    tabs · filters · row / card state · status change · drawer content
 *   structural  drawer / sheet · sidebar · page-level entry
 *
 * Easing: `snap` (fast-out) answers an interaction, `vault` (smooth-out)
 * brings structure in, `shift` (in-out) moves layout. No springs: nothing in a
 * market desk should bounce.
 */
export const DUR = { micro: 0.12, standard: 0.2, structural: 0.3, exit: 0.18 } as const;

export const EASE = {
  snap: [0.2, 0, 0, 1],
  vault: [0.16, 1, 0.3, 1],
  shift: [0.4, 0, 0.2, 1],
} as const;

/**
 * Page entry: three groups (context · feeds · intelligence modules), not
 * twenty cards. Short distance, short total (< 0.4 s) — readable at once.
 */
export const enterGroup = (index: number) => ({
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: DUR.structural, ease: EASE.vault, delay: index * 0.05 },
});
