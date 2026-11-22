import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemberView } from "@/components/member/MemberView";
import { PlanSwap } from "@/components/member/PlanSwap";
import { PlanSlot } from "@/components/plan/PlanSlot";
import { alternativeById } from "@/domain/libraries/alternatives";
import { TodayView } from "@/components/today/TodayView";
import { loadMember, loadToday } from "@/server/app/todayPage";
import { requestPlan } from "@/server/handlers/plan";
import type { PlanWords } from "@/view/app";
import { request } from "../helpers/appDeps";
import { sharmaApp, stubFetch } from "../helpers/dom";
import { fakeModel, replyToPrompt } from "../helpers/planReply";

const router = { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));
beforeEach(() => Object.values(router).forEach((f) => f.mockReset()));

const words = (over: Partial<PlanWords> = {}): PlanWords => ({
  source: "template",
  generatedAt: null,
  pending: false,
  capped: false,
  canRetry: false,
  rows: {},
  items: {},
  swaps: {},
  home: {},
  together: null,
  ...over,
});

async function geminiFamily() {
  const sharma = await sharmaApp();
  const app = { ...sharma.app, deps: { ...sharma.app.deps, gemini: fakeModel((r) => replyToPrompt(r.prompt)) } };
  await requestPlan(request("/api/plan", { uid: "neha", body: {} }), app.deps);
  return { ...sharma, app };
}

/** The slot's visible line: the badge and the source line share one grid cell, only one is shown. */
const slotLine = () => screen.getByRole("status").querySelector('[data-shown="true"]')?.textContent ?? "";

describe("plan slot (design F, G PlanBadge / PlanSourceLine)", () => {
  it("shows the badge while Gemini works, then the Made-by line once the refreshed words arrive", async () => {
    const fetcher = stubFetch({ state: "ready" });
    const { rerender } = render(<PlanSlot words={words({ pending: true })} madeAt={null} airAt="6:00 am" lang="en" />);
    expect(slotLine()).toBe("Personalising today's plan…");
    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
    expect(fetcher).toHaveBeenCalledTimes(1);
    rerender(
      <PlanSlot words={words({ source: "gemini", generatedAt: "2024-11-18T00:35:00Z" })} madeAt="6:05 am" airAt="6:00 am" lang="en" />,
    );
    expect(slotLine()).toBe("Made by BreatheWell assistant (Google Gemini) at 6:05 am · Updated air 6:00 am");
    expect(screen.getByText("Personalising today's plan…")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("Go / Go with care / Avoid are set by fixed safety rules.")).toBeInTheDocument();
  });

  it("keeps the Simple plan with Try again when Gemini could not write it, and hides the badge after a retry", async () => {
    const fetcher = stubFetch({ state: "template" });
    render(<PlanSlot words={words({ pending: true })} madeAt={null} airAt="6:00 am" lang="en" />);
    await screen.findByText(/couldn't write today's plan/);
    expect(slotLine()).toBe("Simple plan · Updated air 6:00 am");
    await act(() => userEvent.click(screen.getByRole("button", { name: "Try again" })));
    expect(fetcher).toHaveBeenLastCalledWith("/api/plan", expect.objectContaining({ body: JSON.stringify({ retry: true }) }));
    expect(router.refresh).not.toHaveBeenCalled();
    expect(slotLine()).toBe("Simple plan · Updated air 6:00 am");
    stubFetch({ state: "ready" });
    await act(() => userEvent.click(screen.getByRole("button", { name: "Try again" })));
    expect(router.refresh).toHaveBeenCalled();
    expect(slotLine()).not.toContain("Personalising");
  });

  it("labels Gemini's plan in Monsoon blue, a Simple plan plainly, and the 3-a-day note", () => {
    const { rerender } = render(<PlanSlot words={words({ source: "gemini" })} madeAt="6:05 am" airAt="6:00 am" lang="en" />);
    expect(slotLine()).toBe("Made by BreatheWell assistant (Google Gemini) at 6:05 am · Updated air 6:00 am");
    rerender(<PlanSlot words={words({ capped: true })} madeAt={null} airAt="6:00 am" lang="hi" />);
    expect(screen.getByText(/3 बार/)).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("says 'Saved plan' offline, without the badge or Try again (F24)", () => {
    const online = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    render(<PlanSlot words={words({ canRetry: true })} madeAt="6:05 am" airAt="6:00 am" lang="en" />);
    expect(slotLine()).toBe("You're offline. Saved plan from 6:05 am · Updated air 6:00 am.");
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    online.mockReturnValue(true);
    act(() => void window.dispatchEvent(new Event("online")));
    expect(slotLine()).toBe("Simple plan · Updated air 6:00 am");
    online.mockRestore();
  });
});

describe("Today and Member plan with Gemini words (spec 10.8, 10.9)", () => {
  it("shows the plan's row lines, Share today's plan and the weekly line", async () => {
    const { app, viewer } = await geminiFamily();
    render(<TodayView page={await loadToday(await viewer("neha"), app.deps)} appOrigin="" lang="en" />);
    expect(screen.getByText(/^Made by BreatheWell assistant \(Google Gemini\) at 6:10 am/)).toBeInTheDocument();
    expect(screen.getAllByText(/^Riya: /).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Copy today's plan" })).toBeInTheDocument();
    expect(screen.getByText(/this week's total starts here/)).toBeInTheDocument();
    expect(screen.getByText("No burning of leaves or rubbish today.")).toBeInTheDocument();
  });

  it("shows the plan's words on the member plan with the Swap card", async () => {
    const { app, viewer } = await geminiFamily();
    const page = await loadMember(await viewer("neha"), "neha", app.deps);
    if (!page) throw new Error("no page");
    render(<MemberView page={page} lang="en" />);
    expect(screen.getAllByText(/^Neha: /).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "Swap" })).toBeInTheDocument();
    expect(screen.getByText("Take the metro instead of the scooter today.")).toBeInTheDocument();
    expect(screen.getByText(/^For the air: about .* kg less CO₂/)).toBeInTheDocument();
  });
});

const FACT = alternativeById("electric_repellent")?.factId;

describe("Swap card (F13)", () => {
  it("shows a home action's own 'for the air' line, and nothing for an unknown alternative", () => {
    const travel = { main: "walk" as const, tripLength: "15to45" as const };
    const { container, rerender } = render(
      <PlanSwap
        swap={{ altId: "electric_repellent", words: { doThis: "Use the plug-in repellent.", why: "Coils make smoke.", factId: FACT } }}
        forId="neha"
        ticked={["swap:electric_repellent"]}
        travel={travel}
        lang="en"
      />,
    );
    expect(screen.getByText("Use the plug-in repellent.")).toBeInTheDocument();
    expect(screen.getByText(/^For the air: /)).toBeInTheDocument();
    expect(screen.getByText("Coils make smoke.")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "I did this swap today" })).toBeChecked();
    rerender(<PlanSwap swap={{ altId: "made_up", words: null }} forId="neha" ticked={[]} travel={travel} lang="en" />);
    expect(container).toBeEmptyDOMElement();
  });
});
