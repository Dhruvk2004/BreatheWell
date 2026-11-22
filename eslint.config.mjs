import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * Code-quality rules from spec 11.1, enforced by the linter so they cannot drift:
 * files <= 200 lines, functions <= 40 lines, no `any`, and no wall clock inside src/domain/
 * (every domain function takes an injected clock).
 */
const WALL_CLOCK = [
  { object: "Date", property: "now", message: "Domain code takes an injected clock (spec 8.3)." },
  { object: "performance", property: "now", message: "Domain code takes an injected clock (spec 8.3)." },
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "max-lines": ["error", { max: 200, skipBlankLines: false, skipComments: false }],
      "max-lines-per-function": ["error", { max: 40, skipBlankLines: true, skipComments: true, IIFEs: true }],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": "error",
      eqeqeq: ["error", "always"],
    },
  },
  {
    files: ["src/domain/**/*.ts", "src/ai/**/*.ts"],
    rules: {
      "no-restricted-properties": ["error", ...WALL_CLOCK],
      "no-restricted-syntax": [
        "error",
        { selector: "NewExpression[callee.name='Date'][arguments.length=0]", message: "Domain code takes an injected clock." },
      ],
    },
  },
  {
    // Test suites are long `describe` blocks and tables; the 200-line file cap still applies.
    files: ["tests/**/*.{ts,tsx}", "e2e/**/*.ts"],
    rules: { "max-lines-per-function": "off" },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "coverage/**", "playwright-report/**", "test-results/**"]),
]);

export default eslintConfig;
