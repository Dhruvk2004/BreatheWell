import { describe, expect, it } from "vitest";
import {
  dependentBody,
  dependentDraft,
  pickOutside,
  STAY_IN as KID_STAY_IN,
  toggleDependentConditions,
} from "@/components/dependent/dependentDraft";
import { joinMessage, problemOf } from "@/components/family/joinMessages";
import { qrPath } from "@/components/family/qrPath";
import { accountInitials } from "@/components/shell/AccountMenu";
import { dayTime } from "@/components/ui/dateTime";
import { initialDraft, pickActivities, STAY_IN, stepReady, stepsFor, toggleConditions, toInput } from "@/components/onboarding/draft";
import { PROFILE, RIYA } from "../../helpers/family";

const blank = initialDraft(null, "Ramesh", "hi");

describe("onboarding draft (spec 10.5, 5.6)", () => {
  it("starts from Google's first name and the page language, nothing else assumed", () => {
    expect(blank).toMatchObject({ name: "Ramesh", language: "hi", ageGroup: null, activities: [], stayIn: false, travel: { main: null } });
    expect(initialDraft(PROFILE, "x", "en")).toMatchObject({
      name: "Neha",
      ageGroup: "18to59",
      stayIn: false,
      travel: { main: "two_wheeler" },
    });
    expect(initialDraft({ ...PROFILE, activities: [] }, "x", "en").stayIn).toBe(true);
  });

  it("asks the five steps, or the quick path for 60+; Start only without a family", () => {
    expect(stepsFor(blank, true)).toEqual(["start", "about", "age", "health", "activities", "travel", "summary"]);
    expect(stepsFor({ ...blank, ageGroup: "60plus" }, false)).toEqual(["about", "age", "quickHealth", "quickWalk", "quickTravel"]);
  });

  it("fills activity defaults, keeps answers on re-pick, and lets stay-in stand alone", () => {
    const one = { ...blank, ...pickActivities(blank, ["office_trip"]) };
    expect(one.activities).toEqual([{ type: "office_trip", band: "morning", flex: "fixed", duration: "15to60" }]);
    const changed = { ...one, activities: [{ ...one.activities[0], band: "early" as const }] };
    expect({ ...changed, ...pickActivities(changed, ["office_trip", "sport"]) }.activities.map((a) => [a.type, a.band])).toEqual([
      ["office_trip", "early"],
      ["sport", "evening"],
    ]);
    expect(pickActivities(changed, ["office_trip", STAY_IN])).toEqual({ stayIn: true, activities: [] });
    expect(pickActivities({ ...blank, stayIn: true }, [])).toEqual({ stayIn: false, activities: [] });
    expect(toggleConditions(["asthma", "none"], ["asthma"])).toEqual(["none"]);
    expect(toggleConditions(["none", "heart"], ["none"])).toEqual(["heart"]);
  });

  it("only builds a valid profile, standard or quick", () => {
    expect(toInput(blank)).toBeNull();
    const standard = {
      ...blank,
      name: "Neha",
      ageGroup: "18to59" as const,
      activities: PROFILE.activities,
      travel: { main: "two_wheeler" as const, tripLength: "15to45" as const, others: ["two_wheeler", "metro"] as const },
    };
    expect(toInput(standard)?.travel.others).toEqual(["metro"]);
    expect(toInput({ ...standard, travel: { ...standard.travel, main: null } })).toBeNull();
    expect(toInput({ ...standard, name: "" })).toBeNull();
    const quick = {
      ...blank,
      name: "दादाजी",
      ageGroup: "60plus" as const,
      textSize: "xl" as const,
      quickWalk: "early" as const,
      quickTravel: "auto_bus" as const,
    };
    expect(toInput(quick)).toMatchObject({
      ageGroup: "60plus",
      activities: [{ type: "morning_walk" }],
      travel: { main: "auto_bus" },
    });
    expect(toInput({ ...quick, quickTravel: null })).toBeNull();
    expect(toInput({ ...quick, travel: { main: "metro", tripLength: "under15", others: [] } }, true)).toMatchObject({
      ageGroup: "60plus",
      activities: [],
    });
  });

  it("stops Next until the step's required answer is there", () => {
    expect(stepReady("about", { ...blank, name: " " })).toBe(false);
    expect(stepReady("about", blank)).toBe(true);
    expect(stepReady("age", blank)).toBe(false);
    expect(stepReady("activities", blank)).toBe(false);
    expect(stepReady("activities", { ...blank, stayIn: true })).toBe(true);
    expect(stepReady("travel", blank)).toBe(false);
    expect(stepReady("quickTravel", blank)).toBe(false);
    expect(stepReady("health", blank)).toBe(true);
  });
});

describe("dependent draft (spec 6.2)", () => {
  const draft = dependentDraft(null, "hi");
  it("defaults the other ways to School bus + Car and the card to the guardian's language", () => {
    expect(draft).toMatchObject({ others: ["school_bus", "car"], cardLanguage: "hi", picks: [] });
    expect(dependentDraft(RIYA, "en")).toMatchObject({
      name: "Riya",
      picks: [
        { choice: "school_trip", times: ["07:00", "13:00"] },
        { choice: "play", times: ["17:00"] },
      ],
    });
  });

  it("adds default times on pick, keeps changed times, and builds the request", () => {
    const picked = { ...draft, ...pickOutside(draft, ["play"]) };
    expect(picked.picks).toEqual([{ choice: "play", times: ["17:00"] }]);
    const moved = { ...picked, picks: [{ choice: "play" as const, times: ["16:30"] }] };
    expect({ ...moved, ...pickOutside(moved, ["play", "tuition"]) }.picks).toEqual([
      { choice: "play", times: ["16:30"] },
      { choice: "tuition", times: ["19:00"] },
    ]);
    expect(pickOutside(moved, ["play", KID_STAY_IN])).toEqual({ stayIn: true, picks: [] });
    expect(dependentBody(moved)).toBeNull();
    const ready = { ...moved, name: "Riya", ageGroup: "under13" as const, main: "school_bus" as const };
    expect(dependentBody(ready)).toMatchObject({
      picks: [{ choice: "play", times: ["16:30"] }],
      travel: { main: "school_bus", others: ["car"] },
    });
    expect(dependentBody({ ...ready, picks: [], stayIn: true })?.picks).toEqual([]);
    expect(dependentBody({ ...ready, name: "evil.example" })).toBeNull();
    expect(toggleDependentConditions(["asthma", "not_sure"], ["asthma"])).toEqual(["not_sure"]);
    expect(toggleDependentConditions(["none", "heart"], ["none"])).toEqual(["heart"]);
  });
});

describe("join messages, QR, dates and the avatar", () => {
  it("says each join error with the names the server revealed", () => {
    expect(joinMessage({ code: "expired", adminName: "Neha" }, "en")).toBe("This code has expired. Ask Neha for a new one.");
    expect(joinMessage({ code: "expired" }, "en")).toBe("This code has expired. Ask for a new one.");
    expect(joinMessage({ code: "full", familyName: "Sharma family", adminName: "Neha" }, "en")).toBe(
      "Sharma family is full. Ask Neha to make space.",
    );
    expect(joinMessage({ code: "in_other_family", familyName: "Kulkarni family" }, "hi")).toContain("Kulkarni family");
    for (const code of ["already_member", "too_many_tries", "rate_limited", "network", "not_found", "weird"])
      expect(joinMessage({ code }, "en").length).toBeGreaterThan(10);
    expect(problemOf("full", { familyName: "F", adminName: 3 })).toEqual({ code: "full", familyName: "F", adminName: undefined });
  });

  it("draws dark modules as one path, formats code times, and reads only initials from the cookie", () => {
    const qr = qrPath({ getModuleCount: () => 2, isDark: (r, c) => r === c });
    expect(qr).toEqual({ size: 2, d: "M0 0h1v1h-1zM1 1h1v1h-1z" });
    expect(dayTime("2024-11-19T12:40:00Z", "Asia/Kolkata", "en")).toBe("Tue, 19 Nov, 6:10 pm");
    expect(dayTime("2024-11-19T12:40:00Z", "Asia/Kolkata", "hi")).toMatch(/शाम 6:10 बजे$/);
    expect(accountInitials("a=1; bw-acct=NS")).toBe("NS");
    expect(accountInitials("bw-acct=%E0%A4%A6")).toBe("द");
    expect(accountInitials("bw-acct=<script>")).toBeNull();
    expect(accountInitials("")).toBeNull();
  });
});
