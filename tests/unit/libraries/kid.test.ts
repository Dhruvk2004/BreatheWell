import { partOfDay } from "@/domain/libraries/kid/words";
import { describe, expect, it } from "vitest";
import { BANDS } from "@/domain/air/bands";
import { devanagariShare } from "@/ai/shared/language";
import {
  insideIdeas,
  INSIDE_IDEAS,
  kidCard,
  kidCardProblems,
  kidForAir,
  kidLine,
  kidShareText,
  kidWhen,
  kidWhy,
  passesKidChecks,
  toneOf,
  type KidItem,
} from "@/domain/libraries/kid";
import { fillSlots, kidLineTemplate, type KidLineKind } from "@/domain/libraries/kid/lines";
import type { ActivityType } from "@/domain/rules/activities";
import type { ActivityPlan, PlanNote, Suggestion } from "@/domain/rules/plan";

const plan = (suggestion: Suggestion, extra: Partial<ActivityPlan> = {}): ActivityPlan => ({
  activityId: "x",
  date: "2024-11-18",
  usualHour: 7,
  verdictAtUsual: "avoid",
  suggestion,
  bestTime: null,
  verdictAtBest: null,
  switchTo: null,
  tomorrowBest: null,
  notes: [],
  ...extra,
});

const KINDS: { kind: KidLineKind; plan: ActivityPlan }[] = [
  { kind: "as_planned", plan: plan("as_planned", { verdictAtUsual: "go" }) },
  { kind: "protect", plan: plan("protect", { verdictAtUsual: "care" }) },
  { kind: "move_time", plan: plan("move_time", { bestTime: 15, verdictAtBest: "care" }) },
  { kind: "switch_mode", plan: plan("switch_mode", { switchTo: "school_bus", verdictAtBest: "care" }) },
  {
    kind: "switch_severe",
    plan: plan("switch_mode", { switchTo: "school_bus", notes: ["essential_protect", "schools_may_close"] as PlanNote[] }),
  },
  { kind: "protect_essential", plan: plan("protect", { notes: ["essential_protect"] as PlanNote[] }) },
  { kind: "indoor", plan: plan("indoor", { tomorrowBest: 15 }) },
];
const TYPES: ActivityType[] = ["school_trip", "tuition", "play", "cycling", "sport"];
const cases = KINDS.flatMap((k) =>
  TYPES.flatMap((type) =>
    (["kid", "teen"] as const).flatMap((tone) => (["en", "hi"] as const).map((lang) => ({ ...k, type, tone, lang }))),
  ),
);

describe("kid library lines (spec 7.2): every verdict × suggestion × activity × tone × language", () => {
  it.each(cases.map((c) => [`${c.kind} ${c.type} ${c.tone} ${c.lang}`, c] as const))("%s passes the kid-card checks", (_, c) => {
    const item: KidItem = { type: c.type, plan: c.plan, mainMode: "cycle" };
    const line = kidLine(item, c.tone, c.lang);
    expect(kidCardProblems(line)).toEqual([]);
    expect(line).not.toMatch(/\{\w+\}/);
    if (c.lang === "en") expect(line.split(/\s+/).length).toBeLessThanOrEqual(12);
    else expect(devanagariShare(line)).toBeGreaterThanOrEqual(0.6);
    if (c.kind === "indoor") expect(line).toMatch(/3 pm|3 बजे/);
  });

  it("matches the design's lines", () => {
    const riya = (p: ActivityPlan, type: ActivityType = "school_trip"): KidItem => ({ type, plan: p, mainMode: "cycle" });
    expect(kidLine(riya(KINDS[3].plan), "kid", "en")).toBe("Take the bus today.");
    expect(kidLine(riya(KINDS[3].plan), "kid", "hi")).toBe("आज बस से जाओ।");
    expect(kidLine(riya(KINDS[6].plan, "play"), "kid", "en")).toBe("Inside today. Tomorrow 3 pm looks better!");
    expect(kidLine(riya(KINDS[6].plan, "play"), "kid", "hi")).toBe("आज अंदर खेलो। कल दोपहर 3 बजे बेहतर लगता है!");
    expect(kidLine(riya(KINDS[4].plan), "kid", "en")).toBe("Only if it's open. Go by bus, windows shut.");
    expect(kidLine(riya(KINDS[3].plan), "teen", "en")).toBe("Bus today, not the cycle.");
    expect(kidLine(riya(KINDS[1].plan, "sport"), "teen", "en")).toBe("Okay today. Take it easy and carry water.");
  });

  it("says mask, never N95, and gives a calm when without a better time", () => {
    for (const lang of ["en", "hi"] as const)
      for (const tone of ["kid", "teen"] as const) expect(kidLineTemplate(tone, lang, "protect_essential", "travel")).not.toMatch(/N95/);
    expect(kidWhen(null, "en")).toBe("Inside is best today.");
    expect(kidWhen(null, "hi")).toBe("आज अंदर ही अच्छा है।");
    expect(toneOf("under13")).toBe("kid");
    expect(toneOf("13to17")).toBe("teen");
  });
});

describe("kid card and share text (spec 10.12)", () => {
  const items: KidItem[] = [
    { type: "school_trip", plan: KINDS[3].plan, mainMode: "cycle" },
    { type: "play", plan: KINDS[6].plan, mainMode: "cycle" },
  ];

  it("builds the card with a headline, lines, a kid why and 3 ideas", () => {
    const card = kidCard({ band: "very_poor", tone: "kid", lang: "en", hour: 7, date: "2024-11-18", items, factId: "morning_inversion" });
    expect(card.headline).toBe("The air is very unhealthy this morning");
    expect(card.lines).toEqual([
      { label: "School", text: "Take the bus today." },
      { label: "Play", text: "Inside today. Tomorrow 3 pm looks better!" },
    ]);
    expect(card.why).toBe("Cold, still mornings keep the smoke low. The afternoon sun lifts it.");
    expect(card.ideas).toHaveLength(3);
    const hi = kidCard({ band: "very_poor", tone: "kid", lang: "hi", hour: 15, date: "2024-11-18", items, factId: null });
    expect(hi.headline).toBe("आज हवा बहुत खराब है");
    const hiMorning = kidCard({ band: "poor", tone: "teen", lang: "hi", hour: 7, date: "2024-11-18", items: [], factId: null });
    expect(hiMorning.headline).toBe("आज सुबह हवा खराब है");
    expect(fillSlots("Go {nope} now", {})).toBe("Go now");
  });

  it("shares first name, band word, lines and the when, with the band emoji", () => {
    const card = kidCard({ band: "very_poor", tone: "kid", lang: "en", hour: 7, date: "2024-11-18", items, factId: null });
    const text = kidShareText("Riya", "very_poor", card, "en");
    expect(text).toBe(
      "Riya's air card for today 🔴 The air is very unhealthy. Take the bus today. Inside today. Tomorrow 3 pm looks better! – BreatheWell",
    );
    expect(passesKidChecks(text)).toBe(true);
    const severe = kidCard({ band: "severe", tone: "kid", lang: "hi", hour: 7, date: "2024-11-18", items, factId: null });
    expect(kidShareText("रिया", "severe", severe, "hi")).toMatch(/^रिया का आज का हवा कार्ड 🟤 हवा में बहुत धुआँ है। घर में रहो।/);
  });

  it("has a headline for every band in both languages that passes the checks", () => {
    for (const band of BANDS)
      for (const lang of ["en", "hi"] as const)
        expect(passesKidChecks(kidCard({ band, tone: "kid", lang, hour: 9, date: "2024-11-18", items: [], factId: null }).headline)).toBe(
          true,
        );
  });
});

describe("part of the day in kid words", () => {
  it("says this morning before noon and today after, in both languages", () => {
    expect([partOfDay(9, "en"), partOfDay(9, "hi"), partOfDay(15, "en"), partOfDay(15, "hi")]).toEqual([
      "this morning",
      "आज सुबह",
      "today",
      "आज",
    ]);
  });
});

describe("kid-card checks (spec 7.7.6, 11.4)", () => {
  it.each([
    ["Wear an N95 for 15 minutes", ["digits"]],
    ["The AQI is very high", ["air_units"]],
    ["Like smoking a cigarette", ["cigarette"]],
    ["Smog can kill", ["fear"]],
    ["Keep your inhaler", ["health"]],
    ["हवा ३०० है", ["digits"]],
    ["PM2.5 is high", ["digits", "air_units"]],
    ["Play 10 amazing games inside", ["digits"]],
    ["It is 45 amazing minutes", ["digits"]],
    ["5 बजेगा", ["digits"]],
  ])("%s → %j", (text, problems) => expect(kidCardProblems(text)).toEqual(problems));

  it.each(["Play at 3 pm", "Cycle 2–4 pm today", "शाम 5 बजे खेलो", "Carry your water bottle", "Eat a good diet", "Tuition at 7 pm"])(
    "allows %s",
    (text) => {
      expect(passesKidChecks(text)).toBe(true);
    },
  );
});

describe("kid extras", () => {
  it("rotates 15 inside ideas by day", () => {
    expect(INSIDE_IDEAS.length).toBe(15);
    expect(insideIdeas("2024-11-18", "en")).not.toEqual(insideIdeas("2024-11-19", "en"));
    expect(insideIdeas("2024-11-18", "hi").every((i) => devanagariShare(i) >= 0.6)).toBe(true);
  });

  it("has kid why and for-the-air lines that pass the checks", () => {
    for (const lang of ["en", "hi"] as const) {
      expect(passesKidChecks(kidWhy("unknown_fact", lang))).toBe(true);
      expect(kidWhy("calm_wind", lang)).not.toBe(kidWhy(null, lang));
      for (const kind of ["shared_ride", "stay_in", "no_burning"] as const) expect(passesKidChecks(kidForAir(kind, lang))).toBe(true);
    }
  });
});
