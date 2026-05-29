import logoUrl from "@/assets/marcovault-logo.png";

export function Logo({ size = 36 }: { size?: number }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="relative grid place-items-center"
        style={{ width: size, height: size }}
      >
        <img
          src={logoUrl}
          alt="MARCOVAULT - Multi-Chain Alpha & Web3 Intelligence Logo"
          width={size}
          height={size}
          className="relative z-10 drop-shadow-[0_0_8px_rgba(0,240,255,0.35)]"
          style={{ width: size, height: size, objectFit: "contain" }}
        />
      </div>
      <div className="leading-none">
        <div className="text-chrome font-display font-semibold tracking-[0.2em] text-[13px]">
          MARCOVAULT
        </div>
        <div className="text-[9px] tracking-[0.35em] text-muted-foreground mt-1">
          MULTI-CHAIN · ALPHA
        </div>
      </div>
    </div>
  );
}
