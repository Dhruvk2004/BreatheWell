import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LearnShell } from "@/components/learn/LearnShell";
import { saveAlias } from "@/server/handlers/aliases";
import { askBreezy } from "@/server/handlers/breezy";
import { breezyAction } from "@/server/handlers/breezyAction";
import { json, request, testApp } from "../helpers/appDeps";
import { sharmaFamily } from "../helpers/family";
import { fakeModel } from "../helpers/planReply";

/** The edges of the Breezy routes: sign-in, CSRF, bad bodies; and the Learn shell. */
vi.mock("next/navigation", () => ({ usePathname: () => "/learn" }));

describe("Breezy route edges", () => {
  it("needs a session and our own origin, and a JSON body of the right shape", async () => {
    const app = testApp({ gemini: fakeModel(() => "{}") });
    await sharmaFamily(app);
    for (const [handler, path] of [
      [askBreezy, "/api/breezy"],
      [breezyAction, "/api/breezy/action"],
      [saveAlias, "/api/aliases"],
    ] as const) {
      expect((await handler(request(path, { body: {} }), app.deps)).status).toBe(401);
      expect((await handler(request(path, { uid: "neha", body: {}, origin: "https://evil.test" }), app.deps)).status).toBe(403);
      expect((await handler(request(path, { uid: "neha", body: { nope: 1 } }), app.deps)).status).toBe(400);
    }
  });

  it("keeps the kin word as typed in Hindi", async () => {
    const app = testApp({ gemini: fakeModel(() => "{}") });
    await sharmaFamily(app);
    const answer = await json(await askBreezy(request("/api/breezy", { uid: "neha", body: { question: "पापा कब टहलें?" } }), app.deps));
    expect(answer).toEqual({ kind: "ask_alias", kin: "papa", word: "पापा" });
  });
});

describe("LearnShell", () => {
  it("adds the app nav only for a family member", () => {
    const { rerender } = render(
      <LearnShell lang="en" inFamily={false}>
        <p>Body</p>
      </LearnShell>,
    );
    expect(screen.queryByRole("navigation")).toBeNull();
    rerender(
      <LearnShell lang="en" inFamily>
        <p>Body</p>
      </LearnShell>,
    );
    expect(screen.getAllByRole("link", { name: "Breezy" })[0]).toHaveAttribute("href", "/ask");
  });
});
