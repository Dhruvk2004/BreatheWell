import type { NextConfig } from "next";
import { authEmulatorHost } from "./src/config/env";
import { csp, firebaseHostOf, SECURITY_HEADERS } from "./src/server/csp";

const dev = process.env.NODE_ENV !== "production";

// The Firebase project behind Google sign-in (public web config, inlined at build time).
const firebaseHost = firebaseHostOf(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
// Signed-in E2E builds only (a `demo-*` project with the Auth emulator); empty everywhere else.
const emulatorHost = authEmulatorHost(process.env);
const authEmulator = emulatorHost ? `http://${emulatorHost}` : "";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" },
    },
  },
  // `/__/auth/*` is proxied by src/proxy.ts (a rewrite here would drop its headers).
  async headers() {
    return [
      {
        source: "/((?!__/).*)",
        headers: [...SECURITY_HEADERS, ["Content-Security-Policy", csp({ dev, firebaseHost, authEmulator })]].map(([key, value]) => ({
          key,
          value,
        })),
      },
    ];
  },
};

export default nextConfig;
