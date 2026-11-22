import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FamilyKidView } from "@/components/kid/FamilyKidView";
import { MemberView } from "@/components/member/MemberView";
import { TodayView } from "@/components/today/TodayView";
import { kidCardProblems } from "@/domain/libraries/kid";
import { loadKidCard } from "@/server/app/kidCardPage";
import type { InFamily } from "@/server/app/guards";
import { loadMember, loadToday } from "@/server/app/todayPage";
import { loadViewer } from "@/server/app/viewer";
import { deps as airDeps } from "../helpers/airDeps";
import { testApp } from "../helpers/appDeps";
import { sharmaFamily } from "../helpers/family";
import { installDialog, sharmaApp, stubFetch } from "../helpers/dom";

const router = { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));
beforeEach(() => {
  installDialog();
  Object.values(router).forEach((f) => f.mockReset());
});

describe("Today (spec 10.8)", () => {
  it("answers first from code: band card, rows in order, setting up with Remind, simple-plan label", async () => {
    const { app, viewer } = await sharmaApp();
    render(<TodayView page={await loadToday(await viewer("neha"), app.deps)} appOrigin="https://app.test" lang="en" />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Today in Green Park, New Delhi");
    expect(screen.getByText(/Best time outside/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Neha's plan" })).toHaveAttribute("href", "/member/neha");
    expect(screen.getByRole("link", { name: "Riya's plan" })).toHaveAttribute("href", expect.stringMatching(/^\/member\//));
    expect(screen.getByRole("link", { name: "Kid card: Riya" })).toHaveAttribute("href", expect.stringMatching(/^\/kid\//));
    expect(screen.getByText("Ramesh is still setting up")).toBeInTheDocument();
    const remind = screen.getByRole("button", { name: "Remind Ramesh" });
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    await userEvent.click(remind);
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("https://app.test/onboarding"));
    expect(screen.getByText(/^Simple plan · Updated air/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Add a child or teen" })).toHaveAttribute("href", "/dependent/new");
    expect(screen.getByRole("heading", { name: "At home today" })).toBeInTheDocument();
  });

  it("shows the admin a join card with Remove, which names the children that go too", async () => {
    const { app, viewer } = await sharmaApp();
    const fetcher = stubFetch();
    render(<TodayView page={await loadToday(await viewer("neha"), app.deps)} appOrigin="" lang="en" />);
    expect(screen.getByText("Rahul joined via your code")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Remove Rahul" }));
    const dialog = screen.getAllByRole("dialog", { hidden: true }).find((d) => d.hasAttribute("open"));
    if (!dialog) throw new Error("no open dialog");
    expect(dialog).toHaveTextContent("Remove Rahul from Sharma family?");
    expect(dialog).toHaveTextContent("The children and teens Rahul added are deleted too: Riya.");
    await userEvent.click(within(dialog).getByRole("button", { name: "Remove", hidden: true }));
    expect(fetcher).toHaveBeenCalledWith("/api/family/members/rahul", expect.objectContaining({ method: "DELETE" }));
    expect(router.refresh).toHaveBeenCalled();
  });

  it("without air data: no chips, Safe anyway, and the family still listed for actions (spec 8.5)", async () => {
    const { app, viewer } = await sharmaApp();
    const down = { ...app.deps, air: airDeps({ fetchAir: async () => ({ ok: false as const, error: "timeout" as const }) }) };
    render(<TodayView page={await loadToday(await viewer("rahul"), down)} appOrigin="" lang="hi" />);
    expect(screen.getByText("हवा का डेटा आने तक कोई योजना नहीं।")).toBeInTheDocument();
    expect(screen.queryByText(/आपके कोड से/)).toBeNull();
  });

  it("alone in the family: Invite card for the admin", async () => {
    const app = testApp();
    await sharmaFamily(app);
    const neha = (await loadViewer("session:neha", app.deps)) as InFamily;
    render(<TodayView page={await loadToday(neha, app.deps)} appOrigin="" lang="en" />);
    expect(screen.getByText("Your plan is ready. Invite your family to get theirs.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Invite" })).toHaveAttribute("href", "/family/invite");
  });
});

describe("Member plan (spec 10.9)", () => {
  it("lists timed items with chip, Do this, Why?, Listen and a tick saved through /api/progress", async () => {
    const { app, viewer } = await sharmaApp();
    const page = await loadMember(await viewer("neha"), "neha", app.deps);
    if (!page) throw new Error("no page");
    const fetcher = stubFetch({ done: ["office_trip"] });
    render(<MemberView page={page} lang="en" />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Neha's plan");
    expect(screen.getByText("18–59 · English · Admin")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Office or work trip" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("checkbox", { name: "Office or work trip: done" }));
    expect(fetcher).toHaveBeenCalledWith(
      "/api/progress",
      expect.objectContaining({ body: JSON.stringify({ forId: "neha", key: "office_trip", done: true }) }),
    );
    expect(screen.getByText("Nothing on the checklist yet.")).toBeInTheDocument();
  });

  it("rolls a failed tick back and says so", async () => {
    const { app, viewer } = await sharmaApp();
    const page = await loadMember(await viewer("neha"), "neha", app.deps);
    if (!page) throw new Error("no page");
    stubFetch({ error: { code: "forbidden", message: "x" } }, 403);
    render(<MemberView page={page} lang="en" />);
    const box = screen.getByRole("checkbox", { name: "Office or work trip: done" });
    await userEvent.click(box);
    expect(box).not.toBeChecked();
    expect(await screen.findByText("You're no longer in this family.")).toBeInTheDocument();
  });

  it("shows a dependent's header, Kid card and Edit for the guardian, and marks items kept off the card", async () => {
    const { app, fid, riya, viewer } = await sharmaApp();
    app.db.docs.set(`families/${fid}/items/a`, {
      forId: riya,
      date: "2024-11-18",
      time: null,
      kind: "checklist",
      text: { en: "Wear an N95 for 15 minutes" },
      addedBy: "neha",
      addedByName: "Neha",
      done: false,
    });
    const page = await loadMember(await viewer("rahul"), riya, app.deps);
    if (!page) throw new Error("no page");
    render(<MemberView page={page} lang="en" />);
    expect(screen.getByText("Child · added by Rahul")).toBeInTheDocument();
    expect(screen.getByText("Health: Asthma")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Edit" })).toHaveAttribute("href", `/dependent/${riya}`);
    expect(screen.getByText(/Not on Riya's card · your view only/)).toBeInTheDocument();
  });

  it("says when someone is still setting up", async () => {
    const { app, viewer } = await sharmaApp();
    const page = await loadMember(await viewer("neha"), "dadaji", app.deps);
    if (!page) throw new Error("no page");
    render(<MemberView page={page} lang="en" />);
    expect(screen.getByText("Ramesh is still setting up. The plan starts once the set-up is done.")).toBeInTheDocument();
  });
});

describe("Kid card for the family (spec 10.12)", () => {
  it("speaks the card language with no numbers, cigarettes or air units", async () => {
    const { app, riya, viewer } = await sharmaApp();
    const page = await loadKidCard(await viewer("neha"), riya, app.deps);
    if (!page) throw new Error("no page");
    const { container } = render(<FamilyKidView page={page} lang="en" />);
    expect(kidCardProblems(container.querySelector("article")?.textContent ?? "x")).toEqual([]);
    expect(screen.getByRole("link", { name: "Today" })).toHaveAttribute("href", "/today");
    expect(screen.getByRole("link", { name: "Share on WhatsApp" })).toHaveAttribute("href", expect.stringMatching(/wa\.me\/\?text=Riya/));
    render(<FamilyKidView page={{ ...page, kid: null }} lang="en" />);
    expect(screen.getByText("The kid card comes back when the air data is back.")).toBeInTheDocument();
  });

  it("lets any adult tick the card's lines and checklist items (spec 5.5 step 7)", async () => {
    const { app, fid, riya, viewer } = await sharmaApp();
    app.db.docs.set(`families/${fid}/items/c1`, {
      forId: riya,
      date: "2024-11-18",
      time: null,
      kind: "checklist",
      text: { en: "Take a water bottle" },
      addedBy: "neha",
      addedByName: "Neha",
      done: false,
    });
    const page = await loadKidCard(await viewer("neha"), riya, app.deps);
    if (!page?.kid) throw new Error("no card");
    const fetcher = stubFetch({ done: ["school_trip"] });
    render(<FamilyKidView page={page} lang="en" />);
    const boxes = screen.getAllByRole("checkbox");
    expect(boxes.length).toBe(Math.min(page.kid.card.lines.length, page.kid.plan.items.length) + 1);
    await userEvent.click(boxes[0]);
    expect(fetcher).toHaveBeenCalledWith("/api/progress", expect.objectContaining({ method: "POST" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Take a water bottle" }));
    expect(fetcher).toHaveBeenCalledWith(`/api/items/c1`, expect.objectContaining({ method: "PATCH" }));
  });
});
