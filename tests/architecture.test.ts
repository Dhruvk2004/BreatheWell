import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { testBodySizes } from "./helpers/testBodies";

/**
 * The code layout rules, checked on the source tree: no file over 200 lines, no
 * wall clock in domain/, domain/ free of I/O, components presentational (they never reach into
 * server/) and server code free of components, view models type-only, and route shells (excluded from coverage) kept thin.
 */
const SRC = join(process.cwd(), "src");

function files(dir: string, pattern: RegExp): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return files(path, pattern);
    return pattern.test(entry.name) ? [path] : [];
  });
}

const code = files(SRC, /\.(ts|tsx)$/);
const domain = files(join(SRC, "domain"), /\.ts$/);
const components = files(join(SRC, "components"), /\.(ts|tsx)$/);
const views = files(join(SRC, "view"), /\.ts$/);
const server = [...files(join(SRC, "server"), /\.ts$/), join(SRC, "proxy.ts")];
const shells = files(join(SRC, "app"), /^(page|layout|loading|error|not-found)\.tsx$/);
const suites = [...files(join(process.cwd(), "tests"), /\.test\.tsx?$/), ...files(join(process.cwd(), "e2e"), /\.spec\.ts$/)];

describe("architecture", () => {
  it.each(code.map((f) => [relative(process.cwd(), f), f]))("%s has at most 200 lines", (_, file) => {
    expect(readFileSync(file, "utf8").split("\n").length).toBeLessThanOrEqual(200);
  });

  it.each(domain.map((f) => [relative(process.cwd(), f), f]))("%s is pure: no wall clock, no I/O", (_, file) => {
    const source = readFileSync(file, "utf8");
    expect(source).not.toMatch(/Date\.now\(|new Date\(\)|performance\.now/);
    expect(source).not.toMatch(/\bfetch\(|from "(node:|fs|firebase|next|react|@\/data|@\/ai)/);
  });

  it.each(shells.map((f) => [relative(process.cwd(), f), f]))("%s is a thin shell", (_, file) => {
    const source = readFileSync(file, "utf8");
    expect(source.split("\n").length).toBeLessThanOrEqual(60);
    expect(source).not.toMatch(/\bif\s*\(|\bswitch\s*\(/);
  });

  it.each(components.map((f) => [relative(process.cwd(), f), f]))("%s is presentational: no server/ imports", (_, file) => {
    expect(readFileSync(file, "utf8")).not.toMatch(/from "@\/server\//);
  });

  it.each(server.map((f) => [relative(process.cwd(), f), f]))("%s does not reach into components/", (_, file) => {
    expect(readFileSync(file, "utf8")).not.toMatch(/from "@\/components\//);
  });

  it.each(views.map((f) => [relative(process.cwd(), f), f]))("%s holds types only", (_, file) => {
    const source = readFileSync(file, "utf8");
    expect(source).not.toMatch(/^import (?!type )/m);
    expect(source).not.toMatch(/^export (const|function|class|let|default)/m);
  });

  it.each(suites.map((f) => [relative(process.cwd(), f), f]))("%s: every single test body is at most 40 lines", (_, file) => {
    expect(testBodySizes(file).filter((b) => b.lines > 40)).toEqual([]);
  });
});
