import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import jsxA11y from "eslint-plugin-jsx-a11y";

/**
 * Code-quality rules, enforced by the linter so they cannot drift: files <= 200 lines,
 * functions <= 40 lines, no `any`, and no wall clock inside src/domain/ or src/ai/ (every
 * domain function takes an injected clock, so tests are deterministic).
 */
const WALL_CLOCK = [
  { object: "Date", property: "now", message: "Domain code takes an injected clock." },
  { object: "performance", property: "now", message: "Domain code takes an injected clock." },
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // The strict accessibility rule set (Next.js enables only a few jsx-a11y rules by default).
    files: ["src/**/*.tsx"],
    rules: {
      ...jsxA11y.flatConfigs.strict.rules,
      // Label text sits in nested spans (the tick shows both languages).
      "jsx-a11y/label-has-associated-control": ["error", { depth: 3 }],
      // A combobox's suggestions are a <ul role="listbox"> of <li role="option">.
      "jsx-a11y/no-noninteractive-element-to-interactive-role": ["error", { ul: ["listbox"], li: ["option"] }],
    },
  },
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
