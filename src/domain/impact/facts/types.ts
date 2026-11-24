/** A text in both app languages. */
export interface Bilingual {
  readonly en: string;
  readonly hi: string;
}

/** Where a fact comes from (every fact cites its source). */
export interface Source {
  readonly name: string;
  readonly url: string;
}

/**
 * One entry of the facts library. Gemini may only reference a fact by `id`; it never
 * writes level-3 content. `checkedOn` is null until QA has checked the fact against its source.
 */
export interface Fact {
  readonly id: string;
  /** Level 2 everyday picture for adults. */
  readonly text: Bilingual;
  /** Level 3 "The numbers": the method or figure behind it. */
  readonly level3: Bilingual;
  readonly source: Source;
  readonly checkedOn: string | null;
}

export const SOURCES = {
  who: { name: "WHO global air quality guidelines (2021)", url: "https://www.who.int/publications/i/item/9789240034228" },
  cpcb: { name: "CPCB National Air Quality Index and AQI calculator", url: "https://cpcb.nic.in/national-air-quality-index/" },
  caqm: { name: "CAQM Graded Response Action Plan (GRAP)", url: "https://caqm.nic.in/" },
  epaIndoor: { name: "US EPA, Indoor Air Quality", url: "https://www.epa.gov/indoor-air-quality-iaq" },
  epaCleaner: {
    name: "US EPA, Guide to Air Cleaners in the Home",
    url: "https://www.epa.gov/indoor-air-quality-iaq/guide-air-cleaners-home",
  },
  berkeley: {
    name: "Berkeley Earth, air pollution and cigarette equivalence",
    url: "https://berkeleyearth.org/air-pollution-and-cigarette-equivalence/",
  },
  safar: { name: "SAFAR-India (IITM Pune)", url: "https://safar.tropmet.res.in/" },
  openMeteo: { name: "Open-Meteo Air Quality API (CAMS)", url: "https://open-meteo.com/en/docs/air-quality-api" },
} as const satisfies Record<string, Source>;

/** Builds a fact with `checkedOn: null` (not yet checked by QA). */
export function fact(id: string, text: Bilingual, level3: Bilingual, source: Source): Fact {
  return { id, text, level3, source, checkedOn: null };
}
