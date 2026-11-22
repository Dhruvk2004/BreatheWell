import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Link from "next/link";
import { afterEach, describe, expect, it, vi } from "vitest";
import ErrorBoundary from "@/app/[lang]/error";
import { parseSavedPlan, readSavedRaw, SAVED_PLAN_KEY, savePlan, type SavedPlan } from "@/client/savedPlan";
import { FadeText } from "@/components/plan/FadeText";
import { OfflinePlan } from "@/components/plan/OfflinePlan";
import { RememberPlan } from "@/components/plan/RememberPlan";
import { SavedPlanCard } from "@/components/plan/SavedPlanCard";
import { savedPlanOf } from "@/components/today/savedPlanOf";
import { TodayView } from "@/components/today/TodayView";
import { loadToday } from "@/server/app/todayPage";
import { sharmaApp } from "../helpers/dom";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }), useParams: () => ({ lang: "en" }) }));

/** F24: the last Today plan is kept in this browser and shown, labelled "Saved plan", while offline. */
const PLAN: SavedPlan = {
  lang: "en",
  place: "Green Park",
  madeAt: "6:05 am",
  airAt: "6:00 am",
  fetchedAt: "2024-11-18T00:30:00.000Z",
  rows: [{ name: "Neha", verdict: "care", line: "Take the metro today, not the scooter." }],
};
const AT = new Date("2024-11-18T02:00:00.000Z");

const goOffline = () => {
  const spy = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
  act(() => void window.dispatchEvent(new Event("offline")));
  return spy;
};

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("saved plan storage", () => {
  it("round-trips a plan, ignores malformed text and survives blocked storage", () => {
    savePlan(PLAN);
    expect(parseSavedPlan(readSavedRaw())).toEqual(PLAN);
    localStorage.setItem(SAVED_PLAN_KEY, "{");
    expect(parseSavedPlan(readSavedRaw())).toBeNull();
    localStorage.setItem(SAVED_PLAN_KEY, JSON.stringify({ ...PLAN, rows: "x" }));
    expect(parseSavedPlan(readSavedRaw())).toBeNull();
    expect(parseSavedPlan(null)).toBeNull();
    const blocked = { getItem: () => raise(), setItem: () => raise() };
    expect(() => savePlan(PLAN, blocked)).not.toThrow();
    expect(readSavedRaw(blocked)).toBeNull();
    expect(readSavedRaw(null)).toBeNull();
  });
});

describe("saved plan on screen", () => {
  it("shows nothing without a saved plan, and the plan with chips while the reading is under 12 h", () => {
    const { container, unmount } = render(<SavedPlanCard now={() => AT} />);
    expect(container).toBeEmptyDOMElement();
    unmount();
    savePlan(PLAN);
    render(<SavedPlanCard now={() => AT} />);
    expect(screen.getByText("You're offline. Saved plan from 6:05 am · Updated air 6:00 am.")).toBeInTheDocument();
    expect(screen.getByText("Go with care")).toBeInTheDocument();
    expect(screen.getByText("Take the metro today, not the scooter.")).toBeInTheDocument();
  });

  it("drops the chips once the saved reading is over 12 h old (spec 8.5)", () => {
    savePlan({ ...PLAN, lang: "hi" });
    render(<SavedPlanCard now={() => new Date("2024-11-18T13:00:00.000Z")} />);
    expect(screen.getByRole("heading").closest("section")).toHaveAttribute("lang", "hi");
    expect(screen.queryByText("ध्यान से जाएँ")).toBeNull();
    expect(screen.getByText(/12 घंटे से पुरानी/)).toBeInTheDocument();
  });

  it("appears offline on other signed-in pages and keeps app links from leaving", async () => {
    savePlan(PLAN);
    render(
      <>
        <OfflinePlan />
        <Link href="/learn">Learn</Link>
        <a href="https://example.org/">Elsewhere</a>
      </>,
    );
    expect(screen.queryByText(/Saved plan from/)).toBeNull();
    goOffline();
    expect(screen.getByRole("status")).toHaveTextContent("Saved plan from 6:05 am");
    const click = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
    screen.getByText("Learn").dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
    expect(screen.getByRole("status")).toHaveFocus();
    const away = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
    screen.getByText("Elsewhere").dispatchEvent(away);
    expect(away.defaultPrevented).toBe(false);
    const newTab = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, metaKey: true });
    screen.getByText("Learn").dispatchEvent(newTab);
    expect(newTab.defaultPrevented).toBe(false);
  });

  it("is shown under the error panel when a page fails", async () => {
    savePlan(PLAN);
    render(<ErrorBoundary error={new Error("x")} retry={vi.fn()} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Take the metro today, not the scooter.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button"));
  });
});

describe("Today keeps its plan (F24)", () => {
  it("saves names, verdicts and lines from Today, never a health tag", async () => {
    const { app, viewer, riya } = await sharmaApp();
    const page = await loadToday(await viewer("neha"), app.deps);
    render(<TodayView page={page} appOrigin="" lang="en" />);
    const saved = parseSavedPlan(readSavedRaw());
    expect(saved?.rows.map((r) => r.name)).toEqual(expect.arrayContaining(["Neha", "Rahul", "Riya"]));
    for (const secret of ["Extra care", "asthma", riya]) expect(JSON.stringify(saved)).not.toContain(secret);
    expect(savedPlanOf({ ...page, air: { ...page.air, day: null } }, "en")).toBeNull();
  });

  it("RememberPlan writes once per change and renders nothing", () => {
    const { container, rerender } = render(<RememberPlan plan={PLAN} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<RememberPlan plan={{ ...PLAN, madeAt: "6:20 am" }} />);
    expect(parseSavedPlan(readSavedRaw())?.madeAt).toBe("6:20 am");
  });

  it("FadeText fades only text that changed after the first render", () => {
    const { rerender } = render(<FadeText text="Template line." />);
    expect(screen.getByText("Template line.")).not.toHaveClass("plan-text-in");
    rerender(<FadeText text="Gemini line." />);
    expect(screen.getByText("Gemini line.")).toHaveClass("plan-text-in");
  });
});

function raise(): never {
  throw new Error("blocked");
}
