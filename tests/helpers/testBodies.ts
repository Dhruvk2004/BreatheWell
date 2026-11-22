import { readFileSync } from "node:fs";
import ts from "typescript";

/**
 * The lines of every `it` / `test` body in a test file (blank and comment-only lines skipped, as
 * ESLint's max-lines-per-function counts them). `describe` callbacks are exempt by design
 * (eslint.config.mjs); single test bodies are not (stage 6 audit B2).
 */
const TEST_CALL = /^(?:it|test)(?:\.(?:each|only|skip|concurrent))?$/u;

function calleeName(call: ts.CallExpression): string {
  const callee = ts.isCallExpression(call.expression) ? call.expression.expression : call.expression;
  return callee.getText();
}

function bodyLines(source: ts.SourceFile, fn: ts.Node, text: string): number {
  const lines = text.slice(fn.getStart(source), fn.getEnd()).split("\n");
  return lines.filter((l) => l.trim() && !/^\s*(\/\/|\/\*|\*)/u.test(l)).length;
}

export function testBodySizes(file: string): { line: number; lines: number }[] {
  const text = readFileSync(file, "utf8");
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const found: { line: number; lines: number }[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && TEST_CALL.test(calleeName(node))) {
      const fn = node.arguments.find((a) => ts.isArrowFunction(a) || ts.isFunctionExpression(a));
      if (fn)
        found.push({ line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1, lines: bodyLines(source, fn, text) });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}
