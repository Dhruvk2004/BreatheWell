import type { FirebaseWebConfig } from "@/config/env";
import type { GoogleSignIn } from "@/client/auth";

/**
 * The Firebase web SDK, imported only when someone signs in. `authDomain`
 * is the app's own host: `/__/auth/*` is proxied same-origin. The SDK is signed out
 * right after the cookie exchange: the server's session cookie is the only session.
 */
let emulatorConnected = false;

export async function loadGoogleSignIn(config: FirebaseWebConfig): Promise<GoogleSignIn> {
  const [{ getApps, initializeApp }, sdk] = await Promise.all([import("firebase/app"), import("firebase/auth")]);
  const { emulatorHost, ...webConfig } = config;
  const app = getApps()[0] ?? initializeApp(webConfig);
  const auth = sdk.getAuth(app);
  if (emulatorHost && !emulatorConnected) {
    // Signed-in E2E only (`authEmulatorHost`): the real button, popup and redirect, against the emulator.
    sdk.connectAuthEmulator(auth, `http://${emulatorHost}`, { disableWarnings: true });
    emulatorConnected = true;
  }
  const provider = new sdk.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  return {
    popup: async () => (await sdk.signInWithPopup(auth, provider)).user.getIdToken(),
    redirect: () => sdk.signInWithRedirect(auth, provider),
    redirectResult: async () => {
      const result = await sdk.getRedirectResult(auth);
      return result ? result.user.getIdToken() : null;
    },
    signOut: () => sdk.signOut(auth),
  };
}
