import { describe, expect, it } from "vitest";
import { DEFAULT_OTHER_MODES, DEPENDENT_DEFAULTS, dependentActivities, dependentTravel } from "@/domain/dependents/defaults";
import { gridIdOf, isValidCoordinate, round2 } from "@/domain/geo/grid";
import { kinForms, kinOf, kinWordsIn, unmappedKin } from "@/domain/names/kin";
import { containsPhrase, replacePhrases, wordsOf } from "@/domain/names/words";
import { intensityOf } from "@/domain/rules/activities";
import { isEmergency } from "@/domain/safety/emergency";

describe("dependent defaults", () => {
  it.each([
    ["school_trip", "fixed", "15to60"],
    ["tuition", "fixed", "15to60"],
    ["play", "any", "15to60"],
    ["sport", "any", "over60"],
    ["cycling", "some", "15to60"],
  ] as const)("%s → %s, %s", (choice, flex, duration) => {
    expect(DEPENDENT_DEFAULTS[choice]).toMatchObject({ flex, duration });
  });

  it("gives each activity its type: play moderate, sports hard, trips by mode", () => {
    const acts = dependentActivities([{ choice: "school_trip" }, { choice: "play" }, { choice: "sport" }]);
    expect(acts.map((a) => [a.id, a.usual])).toEqual([
      ["school_trip-1", "07:00"],
      ["school_trip-2", "13:00"],
      ["play-1", "17:00"],
      ["sport-1", "16:00"],
    ]);
    expect(intensityOf(acts[2].type, acts[2].duration, "walk")).toBe("moderate");
    expect(intensityOf(acts[3].type, acts[3].duration, "walk")).toBe("hard");
    expect(intensityOf(acts[0].type, acts[0].duration, "school_bus")).toBe("light");
  });

  it("keeps a parent's changed times and an empty pick means mostly stays in", () => {
    expect(dependentActivities([{ choice: "play", times: ["16:30"] }])[0].usual).toBe("16:30");
    expect(dependentActivities([])).toEqual([]);
  });

  it("fills travel: 15–45 min trips, other modes default to School bus + Car", () => {
    expect(dependentTravel("cycle")).toEqual({ main: "cycle", tripLength: "15to45", others: [...DEFAULT_OTHER_MODES] });
    expect(dependentTravel("car", [])).toEqual({ main: "car", tripLength: "15to45", others: ["school_bus"] });
    expect(dependentTravel("walk", ["auto_van"]).others).toEqual(["auto_van"]);
  });
});

describe("kin words and aliases", () => {
  it("matches Latin, Hinglish case and Devanagari forms to one key", () => {
    expect(["Dadaji", "dadaji", "दादाजी", "DADA"].map((w) => kinOf(w)?.key)).toEqual(["dadaji", "dadaji", "dadaji", "dadaji"]);
    expect(kinOf("Riya")).toBeUndefined();
    expect(kinForms("papa")).toEqual(["papa", "पापा"]);
    expect(kinForms("unknown")).toEqual(["unknown"]);
  });

  it("finds kin words in a question, once each, and which are still unmapped", () => {
    expect(kinWordsIn("Papa wants to go to the temple at 7 am, is it okay for papa?")).toEqual(["papa"]);
    expect(kinWordsIn("dadaji ko walk kab karni chahiye")).toEqual(["dadaji"]);
    expect(kinWordsIn("पापा और मम्मी")).toEqual(["papa", "mummy"]);
    expect(unmappedKin("Papa and Mummy", { papa: "uid1" })).toEqual(["mummy"]);
  });

  it("matches whole words only, in any script", () => {
    expect(containsPhrase("Eat a good diet", "die")).toBe(false);
    expect(containsPhrase("Indie music", "indie")).toBe(true);
    expect(containsPhrase("दादाजी को बताओ", "दादाजी")).toBe(true);
    expect(containsPhrase("anything", "")).toBe(false);
    expect(wordsOf("Can't  breathe!")).toEqual(["can", "t", "breathe"]);
  });

  it("swaps names and aliases for tokens, longest first", () => {
    expect(replacePhrases("Ask Dadaji and dada, not Dadajiyo", ["Dada", "Dadaji"], "{m1}")).toBe("Ask {m1} and {m1}, not Dadajiyo");
    expect(replacePhrases("पापा से पूछो", ["पापा"], "{m2}")).toBe("{m2} से पूछो");
    expect(replacePhrases("Riya (12)", ["", "Riya"], "{d1}")).toBe("{d1} (12)");
  });
});

describe("breathing emergencies, EN, Devanagari and Hinglish", () => {
  it.each([
    "Dadaji has chest pain",
    "I can't breathe",
    "I can’t breathe",
    "साँस नहीं आ रही",
    "seene mein dard ho raha hai",
    "saans nahi aa rahi",
    "mujhe chakkar aa raha hai",
    "Papa fainted",
  ])("%s is an emergency", (text) => expect(isEmergency(text)).toBe(true));

  it.each(["Can we open the windows?", "Is a cloth mask enough?", "breathe easy at 3 pm", "dadaji ko walk kab karni chahiye"])(
    "%s is not",
    (text) => {
      expect(isEmergency(text)).toBe(false);
    },
  );
});

describe("location rounding", () => {
  it("rounds homes to 2 decimals and the cache grid to 0.1°", () => {
    expect(round2(28.56789, 77.21234)).toEqual({ lat2: 28.57, lon2: 77.21 });
    expect(gridIdOf(28.56, 77.21)).toBe("28.6_77.2");
    expect(gridIdOf(-0.04, 77)).toBe("0.0_77.0");
  });

  it("validates coordinates", () => {
    expect(isValidCoordinate(28.6, 77.2)).toBe(true);
    expect(isValidCoordinate(91, 0)).toBe(false);
    expect(isValidCoordinate(Number.NaN, 0)).toBe(false);
  });
});
