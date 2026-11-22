import { describe, expect, it } from "vitest";
import { canSeeHealth } from "@/domain/family/permissions";
import { namedConditions } from "@/domain/rules/conditionTicks";
import { visibleConditions } from "@/server/app/sharedHealth";
import { loadMember } from "@/server/app/todayPage";
import { sharmaApp } from "../../helpers/dom";

/** Health sharing (spec 6.4, F8): names only as the member chose; a child's ticks for every adult. */
describe("shared health condition names", () => {
  const family = { adminUid: "neha" };

  it("follows the share choice, like the security rules (pure)", () => {
    expect(canSeeHealth("self", "rahul", "rahul", family)).toBe(true);
    expect(canSeeHealth("self", "rahul", "neha", family)).toBe(false);
    expect(canSeeHealth("admin", "rahul", "neha", family)).toBe(true);
    expect(canSeeHealth("admin", "rahul", "dadaji", family)).toBe(false);
    expect(canSeeHealth("family", "rahul", "dadaji", family)).toBe(true);
    expect(namedConditions(["none", "asthma", "not_sure", "prefer_not", "heart"])).toEqual(["asthma", "heart"]);
  });

  it("shows Rahul's asthma to the admin only when shared with the admin, and Riya's to everyone", async () => {
    const { app, riya, viewer } = await sharmaApp();
    app.db.docs.set("users/rahul/private/health", { conditions: ["asthma", "allergies"], shareWith: "admin" });
    expect(await visibleConditions(await viewer("neha"), "rahul", app.deps)).toEqual(["asthma", "allergies"]);
    expect(await visibleConditions(await viewer("dadaji"), "rahul", app.deps)).toEqual([]);
    expect(await visibleConditions(await viewer("rahul"), "rahul", app.deps)).toEqual(["asthma", "allergies"]);
    expect(await visibleConditions(await viewer("dadaji"), riya, app.deps)).toEqual(["asthma"]);
    expect(await visibleConditions(await viewer("neha"), "dadaji", app.deps)).toEqual([]);
    expect((await loadMember(await viewer("neha"), "rahul", app.deps))?.conditions).toEqual(["asthma", "allergies"]);
  });
});
