import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Regression: the family settings page called `homeSetupSummary()` from a "use client" file and
 * crashed for every non-admin member. Across the client boundary only components (rendered, not
 * called) may be imported; helpers and constants must live in a plain module.
 */
const SRC = resolve(__dirname, "../../src");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\./.test(name) ? [path] : [];
  });
}

const isClient = (text: string) => /^\s*["']use client["']/.test(text);

function resolveImport(from: string, spec: string): string | null {
  const base = spec.startsWith("@/") ? join(SRC, spec.slice(2)) : spec.startsWith(".") ? resolve(dirname(from), spec) : null;
  if (!base) return null;
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")]) {
    try {
      if (statSync(candidate).isFile()) return candidate;
    } catch {
      /* try the next candidate */
    }
  }
  return null;
}

/** Value imports (not `import type`, not `type X`) as [name, module]. */
function valueImports(text: string): [string, string][] {
  const out: [string, string][] = [];
  for (const m of text.matchAll(/^import\s+(?!type\b)(?:(\w+)\s*,?\s*)?(?:\{([^}]*)\})?\s*from\s+["']([^"']+)["']/gm)) {
    if (m[1]) out.push([m[1], m[3]]);
    for (const part of (m[2] ?? "").split(",")) {
      const name = part.trim();
      if (name && !name.startsWith("type ")) out.push([name.split(/\s+as\s+/)[0].trim(), m[3]]);
    }
  }
  return out;
}

describe("client boundary", () => {
  it("server files import only components from client modules", () => {
    const all = files(SRC);
    const client = new Set(all.filter((f) => isClient(readFileSync(f, "utf8"))));
    const offenders: string[] = [];
    for (const file of all) {
      if (client.has(file)) continue;
      for (const [name, spec] of valueImports(readFileSync(file, "utf8"))) {
        const target = resolveImport(file, spec);
        if (target && client.has(target) && !/^[A-Z][a-z]/.test(name)) offenders.push(`${file.slice(SRC.length)}: ${name} from ${spec}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
