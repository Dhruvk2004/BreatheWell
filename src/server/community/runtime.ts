import { airDeps } from "../air/runtime";
import { currentViewer } from "../app/guards";
import { appDeps } from "../runtime";
import type { CommunityDeps } from "./page";

/** The community page's live deps: the app's Firestore and Gemini, the shared air, 20 per hour per IP. */
export function communityDeps(): CommunityDeps {
  const app = appDeps();
  return { db: app.db, gemini: app.gemini, now: app.now, log: app.log, air: airDeps(), limiter: app.limits.community };
}

export interface CommunityViewer {
  readonly signedIn: boolean;
  /** The family home cell, which may also use Gemini; null without a family. */
  readonly homeCell: string | null;
}

/** Whether someone is signed in (the call to action then opens Today) and their family's home cell. */
export async function communityViewer(): Promise<CommunityViewer> {
  const viewer = await currentViewer();
  if (viewer.kind !== "signed_in") return { signedIn: false, homeCell: null };
  return { signedIn: true, homeCell: viewer.bundle?.family.home.gridId ?? null };
}
