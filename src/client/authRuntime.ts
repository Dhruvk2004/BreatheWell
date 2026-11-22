import { firebaseWebConfig, publicEnv } from "@/config/env";
import { loadGoogleSignIn } from "@/firebase/client";
import { AuthClient } from "./auth";

let client: AuthClient | null = null;

/** The browser's one sign-in client, or null when the Firebase web config is not set. */
export function browserAuthClient(): AuthClient | null {
  const config = firebaseWebConfig(publicEnv());
  if (!config) return null;
  client ??= new AuthClient(() => loadGoogleSignIn(config), window.sessionStorage);
  return client;
}
