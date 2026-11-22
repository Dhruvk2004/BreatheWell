import { describe, expect, it } from "vitest";
import { tokeniseQuestion, type NamedPerson } from "@/domain/breezy/names";
import { cleanQuestion } from "@/domain/breezy/question";
import { nearSpelling, withoutHonorific } from "@/domain/names/spelling";
import { foldText } from "@/domain/text/fold";
import { askBreezy } from "@/server/handlers/breezy";
import { request, testApp } from "../../helpers/appDeps";
import { reply } from "../../helpers/breezy";
import { joins, sharmaFamily } from "../../helpers/family";
import { fakeModel } from "../../helpers/planReply";

/** Names never sent (spec 7.0, 7.7.9) 🔒: stage 7 AI-3, AI-8 and PT-2. */
const people: NamedPerson[] = [
  { id: "d2", kind: "dependent", token: "d2", names: ["Riya"] },
  { id: "ramesh", kind: "adult", token: "m3", names: ["Ramesh"] },
  { id: "aarav", kind: "dependent", token: "d1", names: ["Aarav"] },
];
const sent = (q: string) => tokeniseQuestion(cleanQuestion(q), people, {}).text;

describe("unplanned members and the family name (AI-3)", () => {
  it("never sends Pooja Kapoor (joined, no plan yet) or 'Sharma' (the family name) to Gemini, in the question or history", async () => {
    const model = fakeModel(() => reply("3 pm is better than the morning today."));
    const app = testApp({ gemini: model });
    const { fid, code } = await sharmaFamily(app);
    await joins(app, "rahul", "Rahul", code);
    await joins(app, "pooja", "Pooja", code, false);
    const member = `families/${fid}/members/pooja`;
    app.db.docs.set(member, { ...app.db.docs.get(member), name: "Pooja Kapoor" });
    const ask = (question: string, history: object[] = []) =>
      askBreezy(request("/api/breezy", { uid: "rahul", body: { question, history } }), app.deps);
    await ask("Can Pooja go for a walk at 3 pm?", [{ role: "user", text: "Pooja Kapoor has a cough, can Kapoor ji walk?" }]);
    await ask("Is the Sharma family ok to go out?");
    expect(model.calls.length).toBe(2);
    const prompts = model.calls.map((c) => c.prompt).join("\n");
    expect(prompts).not.toMatch(/Pooja|Kapoor|Sharma/);
    expect(prompts).toContain("Can a family member go for a walk at 3 pm?");
    expect(prompts).toContain("Is the family ok to go out?");
  });
});

describe("zero-width, look-alike and fullwidth spellings (AI-8)", () => {
  it.each([
    ["the plain name", "Can Riya play?"],
    ["a zero-width space", "Can Ri​ya play?"],
    ["a Cyrillic і", "Can Rіya play?"],
    ["fullwidth letters", "Can Ｒｉｙａ play?"],
    ["a soft hyphen", "Can Ri­ya play?"],
  ])("tokenises the name with %s", (_, q) => {
    expect(sent(q)).toBe("Can {d2} play?");
  });

  it("folds text to plain Latin and keeps Hindi", () => {
    expect(foldText("Ｒіya‍")).toBe("Riya");
    expect(foldText("Ραμ")).toBe("Paμ");
    expect(foldText("रिया")).toBe("रिया");
  });
});

describe("honorifics and near spellings (PT-2)", () => {
  it.each([
    ["Should Rameshji walk at 4?", "Should {m3} walk at 4?"],
    ["क्या रमेशजी शाम को टहलें?", "क्या {m3} शाम को टहलें?"],
    ["Can Riyu and Riyaa play outside?", "Can {d2} and {d2} play outside?"],
    ["When should Aаrav walk", "When should {d1} walk"],
    ["R­amesh", "{m3}"],
  ])("tokenises %s", (q, expected) => {
    expect(sent(q)).toBe(expected);
  });

  it("leaves kin words for the alias question and short or different words alone", () => {
    expect(sent("Can Dadi walk?")).toBe("Can Dadi walk?");
    expect(sent("Ram and Rita walk")).toBe("Ram and Rita walk");
    expect(nearSpelling("Riyu", "Riya")).toBe(true);
    expect(nearSpelling("Siya", "Riya")).toBe(false);
    expect(nearSpelling("Riy", "Riya")).toBe(false);
    expect(nearSpelling("रिया", "Riya")).toBe(false);
    expect(withoutHonorific("Rameshji")).toBe("Ramesh");
    expect(withoutHonorific("Ji")).toBe("Ji");
  });
});
