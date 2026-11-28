import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// The suites send X-Forwarded-For as a trusted proxy would (only then is it believed).
process.env.TRUST_PROXY = "1";

// Server-side suites (data clients, proxy decisions) also run here; only DOM suites need cleanup.
afterEach(() => {
  if (typeof window === "undefined") return;
  cleanup();
  sessionStorage.clear();
  document.documentElement.setAttribute("lang", "en");
});
