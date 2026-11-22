import { demoPerson } from "@/data/demo/family";
import type { DemoQuery } from "@/data/demo/query";
import { kidCardFor } from "@/domain/family/kidCardFor";
import { kidShareText } from "@/domain/libraries/kid";
import type { Lang } from "@/domain/time/format";
import type { KidPage } from "@/view/demoPage";
import type { AirDeps } from "../air/service";
import { loadDemo } from "./demoPage";

/**
 * Loads the demo at the query's scenario and time and builds one dependent's card in the card
 * language. Null for an id that is not a demo dependent, or when there is no air data.
 */
export async function loadKidPage(id: string, query: DemoQuery, lang: Lang, deps: AirDeps): Promise<KidPage | null> {
  const person = demoPerson(id);
  if (!person || person.kind !== "dependent") return null;
  const data = await loadDemo(query, deps);
  const plan = data.day.rows.find((r) => r.person.id === id);
  const now = data.day.summary.now;
  if (!plan || !now) return null;
  const card = kidCardFor(plan, now.band, lang, data.day.summary.hour, data.day.summary.date);
  return { data, person, plan, band: now.band, card, shareText: kidShareText(person.name[lang], now.band, card, lang) };
}
