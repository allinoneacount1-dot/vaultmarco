import logoDark from "@/assets/marcovault-logo-dark.png";

export function Logo({ size = 34, sub = true }: { size?: number; sub?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <img
        src={logoDark}
        alt="MARCOVAULT monogram"
        width={size}
        height={size}
        className="select-none drop-shadow-[0_2px_10px_rgba(0,0,0,0.7)]"
        style={{ width: size, height: size, objectFit: "contain" }}
      />
      <span className="leading-none">
        <span className="block font-display text-[12px] font-semibold tracking-[0.26em] text-[--bone]">
          MARCOVAULT
        </span>
        {sub && (
          <span className="mono-label mt-1.5 block !text-[8px] !tracking-[0.34em]">
            MULTI-CHAIN INTELLIGENCE
          </span>
        )}
      </span>
    </div>
  );
}
