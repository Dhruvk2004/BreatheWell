import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { House, Sun, Bus } from "lucide-react";
import { AirReading } from "@/components/air/AirReading";
import { PollutantDetails } from "@/components/air/PollutantDetails";
import { WhyPanel } from "@/components/air/WhyPanel";
import { FamilyRows } from "@/components/demo/FamilyRows";
import { rowView } from "@/components/demo/rowView";
import { ViewerCard } from "@/components/demo/ViewerCard";
import { kidIcon } from "@/components/kid/KidCardView";
import { LandingCards } from "@/components/landing/LandingCards";
import { LandingPreview } from "@/components/landing/LandingPreview";
import { ShareButton } from "@/components/ui/ShareButton";
import { demoPerson } from "@/data/demo/family";
import type { PlannedActivity } from "@/domain/family/people";
import { airNow } from "@/domain/public/airNow";
import { recordedDemo } from "@/server/demo/demoPage";
import { airOf, bandDay, istClock, weatherOf } from "../helpers/air";

/** The rare states each component must still handle (review M5): no headline, unknown people, gaps. */
const demo = recordedDemo("smog-morning", 6, "neha");
const neha = demo.day.rows.find((r) => r.person.id === "neha");
if (!neha) throw new Error("demo has no Neha");
const noHeadline = { ...neha, headline: null };

describe("demo rows and viewer card without a headline", () => {
  it("ViewerCard and rowView render nothing without a headline", () => {
    const { container } = render(<ViewerCard plan={noHeadline} name="Neha" mainMode="car" lang="en" />);
    expect(container).toBeEmptyDOMElement();
    const person = demoPerson("neha");
    expect(person && rowView(noHeadline, person, "neha", "en")).toBeNull();
  });

  it("ViewerCard leaves out the inhaler line for someone who does not need it", () => {
    render(<ViewerCard plan={neha} name="Neha" mainMode="two_wheeler" lang="en" />);
    expect(screen.getByRole("heading", { name: "Hello, Neha" })).toBeInTheDocument();
    expect(screen.queryByText(/inhaler/)).toBeNull();
  });

  it("FamilyRows skips a person who is not in the demo family", () => {
    const ghost = { ...neha, person: { ...neha.person, id: "ghost" } };
    render(<FamilyRows rows={[ghost, neha]} query={demo.query} lang="en" />);
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });
});

describe("landing with gaps in the recording", () => {
  it("LandingCards draws a missing hour as an empty bar and leaves out a chip without a headline", () => {
    const today = demo.day.summary.today.map((p, h) => (h === 8 ? null : p));
    const gappy = { ...demo, day: { ...demo.day, rows: [noHeadline], summary: { ...demo.day.summary, today } } };
    const { container } = render(<LandingCards demo={gappy} lang="en" />);
    expect(container.querySelectorAll('i[style*="height: 0"]').length).toBeGreaterThan(0);
    expect(screen.queryByText("Avoid")).toBeNull();
  });

  it("LandingPreview hides without a reading and skips rows it cannot show", () => {
    const empty = { ...demo, day: { ...demo.day, summary: { ...demo.day.summary, now: null } } };
    const { container } = render(<LandingPreview demo={empty} lang="en" />);
    expect(container).toBeEmptyDOMElement();
    const dadaji = demo.day.rows.find((r) => r.person.id === "dadaji");
    if (!dadaji) throw new Error("demo has no Dadaji");
    const ghost = { ...dadaji, person: { ...dadaji.person, id: "ghost" } };
    const odd = { ...demo, day: { ...demo.day, rows: [ghost, { ...dadaji, headline: null }] } };
    render(<LandingPreview demo={odd} lang="en" />);
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });
});

describe("air pieces in rare states", () => {
  it("AirReading leaves out the 24-hour average when there is none", () => {
    const clock = istClock("2024-11-18T06:10");
    const model = airNow({
      air: airOf(bandDay("2024-11-18", "poor")),
      weather: weatherOf(bandDay("2024-11-18", "poor")),
      fetchedAt: clock.now,
      clock,
      region: "igp",
      city: null,
    });
    const noAvg = { ...model, summary: { ...model.summary, avg24: null } };
    if (!model.reading) throw new Error("no reading");
    render(<AirReading model={noAvg} reading={model.reading} fetchedAt={clock.now} timeZone="Asia/Kolkata" lang="en" />);
    expect(screen.queryByText(/24-h average/)).toBeNull();
  });

  it("PollutantDetails says less than 1 cigarette, never 0; WhyPanel can show Do this", () => {
    render(<PollutantDetails values={[]} cigarettes={{ count: 0, lessThanOne: true }} lang="en" />);
    expect(screen.getByText(/less than 1/)).toBeInTheDocument();
    render(<WhyPanel lang="en" factId="n95_fit" doThis="Wear the mask outside." />);
    expect(screen.getByText("Wear the mask outside.")).toBeInTheDocument();
  });
});

describe("kid card icons follow the plan (review: no house on an outdoor line)", () => {
  const item = (type: PlannedActivity["activity"]["type"], suggestion: PlannedActivity["plan"]["suggestion"]) =>
    ({ activity: { type }, plan: { suggestion } }) as unknown as PlannedActivity;
  it("a house only for indoor plans, a bus for a switch, else the activity's own icon", () => {
    expect(kidIcon(item("play", "indoor"))).toBe(House);
    expect(kidIcon(item("play", "move_time"))).toBe(Sun);
    expect(kidIcon(item("cycling", "switch_mode"))).toBe(Bus);
    expect(kidIcon(undefined)).toBe(House);
  });
});

describe("Web Share", () => {
  it("is hidden without navigator.share and opens the share sheet with it, ignoring a cancel", async () => {
    const { container, unmount } = render(<ShareButton text="Riya: play inside" label="Share" />);
    expect(container).toBeEmptyDOMElement();
    unmount();
    const share = vi.fn().mockRejectedValue(new DOMException("cancelled", "AbortError"));
    Object.assign(navigator, { share });
    const shown = render(<ShareButton text="Riya: play inside" label="Share" />);
    await act(async () => screen.getByRole("button", { name: "Share" }).click());
    expect(share).toHaveBeenCalledWith({ text: "Riya: play inside" });
    shown.unmount();
    // @ts-expect-error: test double only
    delete navigator.share;
  });
});
