import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DemoFamily } from "@/components/demo/DemoFamily";
import { KidView } from "@/components/kid/KidView";
import { kidCardProblems } from "@/domain/libraries/kid";
import { loadDemo, recordedDemo } from "@/server/demo/demoPage";
import { loadKidPage } from "@/server/demo/kidPage";
import { deps } from "../helpers/airDeps";

describe("Demo family (spec 10.3)", () => {
  // F24 (slice 2 M7) is built as the browser's saved plan and tested in offlinePlan.test.tsx; stored plans (H1) in demoStored.test.tsx.

  it("opens on the Smog morning with the banner, switches, rows, rules caption and Simple plan label", () => {
    render(<DemoFamily data={recordedDemo("smog-morning", 6, "neha")} lang="en" />);
    expect(screen.getByText("Sample family. Sign in to make your own.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Smog morning" })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("link", { name: "4 pm" })).toHaveAttribute("href", "/demo?scenario=smog-morning&time=16&view=neha");
    expect(screen.getByText(/Recorded sample day · shown as at 6:10 am/)).toBeInTheDocument();
    expect(screen.getByText("Delhi, 18 Nov 2024, Open-Meteo model data")).toBeInTheDocument();
    const rows = within(screen.getByRole("heading", { name: "Your family today" }).parentElement as HTMLElement).getAllByRole("listitem");
    expect(rows).toHaveLength(5);
    expect(screen.getAllByText("Avoid").length).toBeGreaterThan(0);
    expect(screen.getByText("Take the school bus at 7 am, not the cycle.")).toBeInTheDocument();
    expect(screen.getByText(/^Simple plan · Updated air/)).toBeInTheDocument();
    expect(screen.getByText("Go / Go with care / Avoid are set by fixed safety rules.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Kid card: Riya" })).toHaveAttribute(
      "href",
      "/demo/kid/riya?scenario=smog-morning&time=6&view=neha",
    );
    expect(screen.queryByText(/Made by BreatheWell assistant/)).toBeNull();
  });

  it("the Severe day shows the GRAP note; Dadaji's view is all Hindi at extra large below an English caption", () => {
    render(<DemoFamily data={recordedDemo("severe-day", 6, "dadaji")} lang="en" />);
    expect(screen.getByText("What Dadaji sees: Hindi, extra large text.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "The Sharma family, Green Park, Delhi" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "View as" })).toBeInTheDocument();
    const scope = screen.getByRole("heading", { name: "नमस्ते, दादाजी" }).closest(".text-scope-xl");
    expect(scope).toHaveAttribute("lang", "hi");
    expect(scope?.textContent).toContain("कल दोपहर 3 बजे बेहतर लगता है।");
    expect(scope?.textContent).toContain("इनहेलर");
    const inScope = within(scope as HTMLElement);
    expect(inScope.getByRole("heading", { name: "आज आपका परिवार" })).toBeInTheDocument();
    expect(inScope.getAllByRole("listitem").length).toBeGreaterThanOrEqual(5);
    expect(inScope.queryByText(/GRAP rules apply/)).toBeNull();
    expect(scope?.textContent).toMatch(/GRAP/);
  });

  it("in Hindi, Dadaji's caption is in Hindi; an unknown viewer falls back to the family view", () => {
    const data = recordedDemo("smog-morning", 6, "dadaji");
    const { unmount } = render(<DemoFamily data={data} lang="hi" />);
    expect(screen.getByText("दादाजी को यह दिखता है: हिंदी, बहुत बड़े अक्षर।")).toBeInTheDocument();
    unmount();
    const odd = { ...data, query: { ...data.query, view: "nobody" as "dadaji" } };
    const { container } = render(<DemoFamily data={odd} lang="en" />);
    expect(container.querySelector(".text-scope-xl")).toBeNull();
    expect(screen.getByRole("heading", { name: "Your family today" })).toBeInTheDocument();
  });

  it("Live today drops the stepper and shows the station note; the fallback says it is a saved reading", async () => {
    render(
      <DemoFamily
        data={await loadDemo(
          { scenario: "live", time: 6, view: "neha" },
          deps({ fetchAir: vi.fn(async () => ({ ok: false as const, error: "http" as const })) }),
        )}
        lang="en"
      />,
    );
    expect(screen.queryByRole("navigation", { name: "Time of day" })).toBeNull();
    expect(screen.getByText(/Official stations may read higher/)).toBeInTheDocument();
    expect(screen.getByText(/Showing the saved reading from 20 Nov 2026/)).toBeInTheDocument();
  });

  it("without air data shows the no-data card and no rows", async () => {
    const empty = deps({
      fetchAir: vi.fn(async () => ({
        ok: true as const,
        value: { air: { time: [], pm25: [], pm10: [], no2: [], o3: [], co: [], so2: [] }, timeZone: "Asia/Kolkata" },
      })),
    });
    render(<DemoFamily data={await loadDemo({ scenario: "live", time: 6, view: "neha" }, empty)} lang="hi" />);
    expect(screen.getByText("अभी हवा का डेटा नहीं मिल पा रहा। हम अंदाज़ा नहीं लगाएँगे।")).toBeInTheDocument();
    expect(screen.queryByText("आज घर में")).toBeNull();
  });
});

describe("kid card (spec 10.12) 🔒", () => {
  it("shows a face, one line per activity, no numbers but clock times, and the three actions", async () => {
    const kid = await loadKidPage("riya", { scenario: "smog-morning", time: 6, view: "neha" }, "en", deps());
    if (!kid) throw new Error("no card");
    const { container } = render(<KidView kid={kid} lang="en" />);
    expect(screen.getByRole("img", { name: "Red face: the air is very unhealthy" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Riya's air card" })).toBeInTheDocument();
    const card = container.querySelector("article");
    expect(kidCardProblems(card?.textContent ?? "x")).toEqual([]);
    expect(card?.textContent).not.toMatch(/cigarette|µg|AQI/i);
    expect(screen.getByRole("link", { name: "Share on WhatsApp" })).toHaveAttribute(
      "href",
      expect.stringMatching(/^https:\/\/wa\.me\/\?text=Riya/),
    );
  });

  it("opens and closes the full-screen card, returning focus to the button", async () => {
    HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    });
    HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
      this.removeAttribute("open");
      this.dispatchEvent(new Event("close"));
    });
    const kid = await loadKidPage("aarav", { scenario: "severe-day", time: 6, view: "neha" }, "hi", deps());
    if (!kid) throw new Error("no card");
    render(<KidView kid={kid} lang="hi" />);
    const open = screen.getByRole("button", { name: "पूरी स्क्रीन पर दिखाएँ" });
    await userEvent.click(open);
    expect(screen.getByRole("dialog", { hidden: true })).toHaveAttribute("open");
    await userEvent.click(screen.getByRole("button", { name: "बंद करें", hidden: true }));
    expect(open).toHaveFocus();
  });
});
