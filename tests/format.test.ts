import { describe, expect, it } from "vitest";
import { changeTone, priceParts, signedPct } from "@/lib/format";

describe("desk number typography", () => {
  it("unknown is never a number; zero is a real zero", () => {
    expect(priceParts(null)).toEqual({ kind: "unknown", text: "—" });
    expect(priceParts(undefined).text).toBe("—");
    expect(priceParts(Number.NaN).text).toBe("—");
    expect(priceParts(0)).toEqual({ kind: "plain", text: "$0.00" });
    expect(signedPct(null)).toBe("—");
    expect(signedPct(0)).toBe("0.0%");
    expect(signedPct(0.04)).toBe("0.0%"); // rounds to zero → no sign
  });

  it("prices ≥ $1 are grouped with 2 decimals; sub-dollar keeps 4 decimals", () => {
    expect(priceParts(2481.04).text).toBe("$2,481.04");
    expect(priceParts(103.27).text).toBe("$103.27");
    expect(priceParts(0.5507).text).toBe("$0.5507");
    expect(priceParts(0.0012).text).toBe("$0.0012");
  });

  it("micro prices use subscript-zero notation with 4 significant digits", () => {
    expect(priceParts(0.00001862)).toEqual({
      kind: "subscript",
      text: "$0.00001862",
      head: "$0.0",
      zeros: 4,
      tail: "1862",
    });
    expect(priceParts(0.00005702)).toMatchObject({ zeros: 4, tail: "5702" });
    expect(priceParts(0.0009)).toMatchObject({ zeros: 3, tail: "9000" });
    // rounding carry: 9.99995e-6 → 0.00001000
    expect(priceParts(0.00000999995)).toMatchObject({ zeros: 4, tail: "1000" });
  });

  it("signed percentages use a typographic minus", () => {
    expect(signedPct(53.3)).toBe("+53.3%");
    expect(signedPct(-0.7)).toBe("−0.7%");
    expect(signedPct(1.234, 2)).toBe("+1.23%");
  });

  it("tone is neutral for unknown and flat", () => {
    expect([changeTone(null), changeTone(0), changeTone(2), changeTone(-1)]).toEqual([
      "unknown",
      "flat",
      "up",
      "down",
    ]);
  });
});
