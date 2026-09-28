import { DeskTip } from "@/components/marco/desk";

/**
 * The rule behind a piece of evidence, one keystroke / hover / tap away: a
 * small focusable "RULE" mark next to the fact, with the thresholds, horizons
 * and provenance in the desk's tooltip. Keeps rows to the evidence itself.
 */
export function RuleTip({
  children,
  label = "RULE",
  testId,
}: {
  children: React.ReactNode;
  label?: string;
  testId?: string;
}) {
  return (
    <DeskTip tip={<span className="block space-y-1 whitespace-normal">{children}</span>}>
      <span
        tabIndex={0}
        className="inline-flex min-h-6 cursor-help items-center border-b border-dotted border-(--hairline-strong) font-mono text-[9px] tracking-[0.14em] text-(--muted-2) focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-(--gold)"
        data-testid={testId}
      >
        {label}
      </span>
    </DeskTip>
  );
}
