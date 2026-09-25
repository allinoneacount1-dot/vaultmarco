import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * RUNTIME ADAPTER BOUNDARY. The pure recorder (src/lib/history) and everything
 * it reaches must be platform-independent: no Supabase / Neon SDK, no React,
 * no hooks or UI component values, no Vite env, no browser globals.
 * Type-only imports are erased at build time and are allowed.
 */

const SRC = fileURLToPath(new URL("../../src", import.meta.url));
const HISTORY = join(SRC, "lib/history");

function resolveImport(from: string, spec: string): string | null {
  const base = spec.startsWith("@/")
    ? join(SRC, spec.slice(2))
    : spec.startsWith(".")
      ? resolve(dirname(from), spec)
      : null;
  if (!base) return null;
  for (const c of [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts")]) {
    if ((existsSync(c) && c.endsWith(".ts")) || (existsSync(c) && c.endsWith(".tsx"))) return c;
  }
  return null;
}

/** Value imports only (type-only imports are erased). */
function valueImports(src: string): string[] {
  const out: string[] = [];
  const re = /import\s+(type\s+)?([^"';]*?)\s*from\s*["']([^"']+)["']/g;
  for (const m of src.matchAll(re)) {
    if (m[1]) continue; // import type ...
    const clause = m[2].trim();
    // `import { type A, type B } from` is type-only too
    const inner = clause.match(/^\{([\s\S]*)\}$/)?.[1];
    if (inner && inner.split(",").every((p) => p.trim() === "" || p.trim().startsWith("type ")))
      continue;
    out.push(m[3]);
  }
  for (const m of src.matchAll(/^\s*import\s+["']([^"']+)["']/gm)) out.push(m[1]);
  return out;
}

/** Source without comments, so prose like "the window." is not mistaken for code. */
const code = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

function reachable(): Map<string, string[]> {
  const seen = new Map<string, string[]>();
  const stack = readdirSync(HISTORY)
    .filter((f) => f.endsWith(".ts"))
    .map((f) => join(HISTORY, f));
  while (stack.length) {
    const f = stack.pop()!;
    if (seen.has(f)) continue;
    const specs = valueImports(readFileSync(f, "utf8"));
    seen.set(f, specs);
    for (const s of specs) {
      const r = resolveImport(f, s);
      if (r) stack.push(r);
    }
  }
  return seen;
}

describe("Signal History import boundary", () => {
  const graph = reachable();
  const rel = (f: string) => relative(SRC, f).split("\\").join("/");

  it("reaches the existing engine (reused, not copied)", () => {
    const files = [...graph.keys()].map(rel);
    expect(files).toContain("lib/providers/universe.ts");
    expect(files).toContain("lib/signals/radar.ts");
    expect(files).toContain("lib/signals/history.ts");
  });

  it("no platform SDK, React, hooks, UI component values, config or Vite env anywhere it reaches", () => {
    const offenders: string[] = [];
    for (const [f, specs] of graph) {
      for (const s of specs) {
        if (/^(react|react-dom|@supabase\/|@neondatabase\/|pg$|postgres$)/.test(s))
          offenders.push(`${rel(f)} → ${s}`);
        if (/^@\/(hooks|components|routes)\//.test(s)) offenders.push(`${rel(f)} → ${s}`);
        if (s === "@/lib/config" || s.endsWith("/config")) offenders.push(`${rel(f)} → ${s}`);
      }
      const body = code(readFileSync(f, "utf8"));
      if (/import\.meta\.env/.test(body)) offenders.push(`${rel(f)} uses import.meta.env`);
    }
    expect(offenders).toEqual([]);
  });

  it("no browser globals in the recorder itself", () => {
    const offenders = [...graph.keys()]
      .filter((f) => f.startsWith(HISTORY))
      .filter((f) =>
        /\b(window|document|localStorage|sessionStorage|navigator)\./.test(
          code(readFileSync(f, "utf8")),
        ),
      )
      .map(rel);
    expect(offenders).toEqual([]);
  });
});
