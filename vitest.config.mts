import react from "@vitejs/plugin-react";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
    // Emulator suites need the Firebase emulators: `npm run test:emulator` (vitest.emulator.config.mts).
    exclude: [...configDefaults.exclude, "tests/emulator/**"],
    restoreMocks: true,
    unstubGlobals: true,
    testTimeout: 15_000,
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      // Closed list: thin Next.js shells (kept thin by tests/architecture.test.ts), the proxy
      // entry, whose decision (`firebaseHelperUrl`) is unit-tested, and the Firestore adapter.
      exclude: [
        "src/app/**/{page,layout,loading,error,global-error,not-found}.tsx",
        "src/app/**/route.ts",
        "src/app/manifest.ts",
        "src/proxy.ts",
        // The Admin SDK adapter is thin delegation; it runs against real Firestore in the emulator
        // suite (tests/emulator/family.test.ts), where it belongs.
        "src/firebase/firestoreDb.ts",
      ],
      reporter: ["text", "html", "json-summary"],
      thresholds: { lines: 95, functions: 95, statements: 95, branches: 95 },
    },
  },
});
