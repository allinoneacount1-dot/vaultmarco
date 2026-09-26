import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Step B boundaries:
 *   • core (src/lib/**) never depends on platform code (src/server/**)
 *   • nothing in the client app imports src/server — the dashboard bundle cannot reach it
 *   • src/server has no React / browser / Vite-env / Supabase SDK dependency
 *   • the Deno entry files import only the generated bundle and npm:postgres
 *   • the Edge bundle builds with zero external imports and exposes the handlers
 *   • no credential-shaped value is committed in the Step B files
 */

const ROOT = fileURLToPath(new URL("../..", import.meta.url));

function files(dir: string, exts = [".ts", ".tsx", ".mjs", ".sql", ".md", ".js"]): string[] {
  const out: string[] = [];
  for (const name of readdirSync(join(ROOT, dir))) {
    const p = join(ROOT, dir, name);
    if (statSync(p).isDirectory()) {
      if (name === "_shared" || name === "node_modules") continue;
      out.push(...files(relative(ROOT, p), exts));
    } else if (exts.some((e) => name.endsWith(e))) out.push(p);
  }
  return out;
}

const read = (p: string) => readFileSync(p, "utf8");
const code = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
const imports = (p: string) =>
  [
    ...code(p).matchAll(
      /(?:import|export)\s[^;]*?from\s+["']([^"']+)["']|import\s+["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g,
    ),
  ].map((m) => m[1] ?? m[2] ?? m[3]);

describe("Step B import boundaries", () => {
  it("core never imports platform code", () => {
    for (const f of files("src/lib", [".ts", ".tsx"])) {
      for (const i of imports(f))
        expect({ f, i, server: /(^|\/)server\//.test(i) }).toMatchObject({ server: false });
    }
  });

  it("no client/app module imports src/server", () => {
    const client = files("src", [".ts", ".tsx"]).filter(
      (f) => !f.includes(`${join("src", "server")}`),
    );
    for (const f of client) {
      for (const i of imports(f))
        expect({ f, i, server: /(^|\/|@\/)server\//.test(i) }).toMatchObject({ server: false });
    }
  });

  it("src/server depends only on core, its own modules and Web-standard APIs", () => {
    for (const f of files("src/server", [".ts"])) {
      for (const i of imports(f)) {
        expect({ f, i, ok: i.startsWith("./") || i.startsWith("@/lib/history/") }).toMatchObject({
          ok: true,
        });
      }
      const src = code(f);
      for (const banned of [
        "import.meta.env",
        "window.",
        "document.",
        "localStorage",
        "react",
        "@supabase/",
      ]) {
        expect({ f, banned, found: src.includes(banned) }).toMatchObject({ found: false });
      }
    }
  });

  it("Deno entry files import only the generated bundle and a pinned npm:postgres", () => {
    for (const fn of ["recorder", "health"]) {
      const f = join(ROOT, "supabase/functions", fn, "index.ts");
      expect(imports(f).sort()).toEqual(["../_shared/recorder-core.js", "npm:postgres@3.4.9"]);
      expect(code(f)).not.toMatch(/Deno\.env\.get\("SUPABASE_SERVICE_ROLE_KEY"\)/);
    }
  });
});

describe("Edge bundle", () => {
  it("builds platform-neutral with zero external imports and exposes both handlers", async () => {
    const out = join(mkdtempSync(join(tmpdir(), "recorder-bundle-")), "recorder-core.js");
    const log = execFileSync("node", [join(ROOT, "scripts/recorder/bundle.mjs"), out], {
      encoding: "utf8",
    });
    expect(log).toMatch(/0 external imports/);
    const mod = await import(pathToFileURL(out).href);
    expect(typeof mod.createRecorderHandler).toBe("function");
    expect(typeof mod.createHealthHandler).toBe("function");
    expect(typeof mod.PgRecorderStore).toBe("function");
    // Misconfigured runtime answers 401 before anything else when unauthenticated.
    const handler = mod.createRecorderHandler({ sql: null, secret: "s", log: () => {} });
    expect((await handler(new Request("http://x/", { method: "POST" }))).status).toBe(401);
  }, 60_000);
});

describe("no committed credentials in Step B files", () => {
  const scanned = [
    ...files("supabase"),
    ...files("src/server"),
    ...files("scripts/recorder"),
    ...files("tests/server").filter((f) => !f.endsWith("boundary.test.ts")),
  ];
  const patterns: Array<[string, RegExp]> = [
    ["password in a connection URL", /postgres(?:ql)?:\/\/[^\s:@/<>]+:[^\s@<>]+@/i],
    ["Supabase secret key", new RegExp("sb_" + "secret_[A-Za-z0-9]{8,}")],
    ["JWT", new RegExp("eyJ" + "hbGciOi")],
    ["Supabase project URL", /https:\/\/[a-z0-9]{20}\.supabase\.co/],
    ["private key block", new RegExp("-----BEGIN " + "[A-Z ]*PRIVATE KEY")],
  ];
  it("scans every Step B file", () => {
    expect(scanned.length).toBeGreaterThan(8);
    for (const f of scanned) {
      const text = read(f);
      for (const [name, re] of patterns)
        expect({ f, name, hit: re.test(text) }).toMatchObject({ hit: false });
    }
  });
});
