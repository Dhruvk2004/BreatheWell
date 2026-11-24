import { basicsRows } from "@/ai/breezy/template";
import { formatInstant } from "@/domain/time/instant";
import type { Lang } from "@/domain/time/format";
import type { BreezyPage } from "@/view/breezy";
import type { AppDeps } from "../deps";
import type { InFamily } from "./guards";
import { namesById } from "../plan/context";
import { planFamilyToday } from "./familyPlan";

/**
 * Breezy: the header's place and air time, the people a card can be for (members and
 * dependents, in the family's order), and the rules' basics the page shows when Gemini cannot
 * answer in time. Code only; nothing here calls Gemini.
 */
export async function loadBreezy(viewer: InFamily, deps: AppDeps, lang: Lang): Promise<BreezyPage> {
  const { bundle } = viewer;
  const planned = await planFamilyToday(bundle, viewer.uid, deps.air);
  const nameOf = namesById(bundle);
  const rows = planned.day?.rows ?? [];
  const basics = basicsRows(rows, lang).map((row) => ({ ...row, name: nameOf[row.id] }));
  const people = rows.map((r) => ({ id: r.person.id, name: nameOf[r.person.id], kind: r.person.kind }));
  const { snapshot } = planned;
  return {
    viewerId: viewer.uid,
    viewerName: viewer.user.name,
    isAdmin: bundle.family.adminUid === viewer.uid,
    lang,
    place: bundle.family.home.placeName,
    updated: snapshot ? formatInstant(snapshot.fetchedAt, snapshot.timeZone, lang) : null,
    people,
    basics,
    configured: deps.gemini !== null,
  };
}
