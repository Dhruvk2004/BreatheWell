import { defineConfig } from "vitest/config";

/**
 * Firestore security-rule suites (spec 9.2) on the emulator, started by `npm run test:emulator`
 * (firebase.e2e.json). Not part of `npm test` or its coverage gate.
 */
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["tests/emulator/**/*.test.ts"],
    restoreMocks: true,
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    env: { FIRESTORE_EMULATOR_HOST: process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:3480" },
  },
});
