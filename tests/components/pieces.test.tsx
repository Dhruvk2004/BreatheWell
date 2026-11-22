import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BandSkeleton } from "@/components/air/AirStates";
import { HourStrip } from "@/components/air/HourStrip";
import { bandRuns } from "@/components/air/hourRuns";
import { KidFace } from "@/components/kid/KidFace";
import { ErrorPanel } from "@/components/system/ErrorPanel";
import { NotFound } from "@/components/system/NotFound";
import { BANDS } from "@/domain/air/bands";
import { airSummary } from "@/domain/air/summary";
import { bandDay, daySeries, istClock } from "../helpers/air";

describe("small pieces", () => {
  it.each(BANDS)("KidFace draws a %s face with its label", (band) => {
    render(<KidFace band={band} label={`face ${band}`} />);
    expect(screen.getByRole("img", { name: `face ${band}` }).querySelector("circle")).toHaveAttribute(
      "fill",
      expect.stringContaining("--band-"),
    );
  });

  it("the loading card says what it is doing, with no band colour", () => {
    render(<BandSkeleton lang="hi" />);
    expect(screen.getByRole("status")).toHaveTextContent("हवा जाँच रहे हैं…");
  });

  it("404 and the error panel lead with Hindi on Hindi pages", () => {
    render(
      <>
        <NotFound lang="hi" />
        <ErrorPanel lang="hi" onRetry={() => {}} />
      </>,
    );
    expect(screen.getByRole("heading", { level: 1, name: "यह पेज नहीं मिला।" })).toBeInTheDocument();
    expect(screen.getByText("We couldn't find this page.")).toHaveAttribute("lang", "en");
    expect(screen.getByRole("button", { name: /कोशिश/ })).toBeInTheDocument();
  });

  it("the hour strip handles gaps and an evening best window", () => {
    const pm = Array.from({ length: 24 }, (_, h) => (h === 3 ? null : h >= 18 && h <= 19 ? 45 : 200));
    const summary = airSummary(daySeries("2024-11-18", pm), istClock("2024-11-18T06:10"));
    render(<HourStrip summary={summary} lang="en" />);
    expect(screen.getByText("Best 6–8 pm")).toHaveStyle({ right: `${(4 / 24) * 100}%` });
    expect(bandRuns(summary.today).map((r) => [r.start, r.end])).toEqual([
      [0, 3],
      [4, 18],
      [18, 20],
      [20, 24],
    ]);
  });

  it("the hour strip has no Now line or marker when the hour and the window are missing", () => {
    const summary = airSummary(bandDay("2024-11-18", "poor"), istClock("2024-11-19T22:10"));
    render(<HourStrip summary={summary} lang="en" />);
    expect(screen.queryByText(/^Now,/)).toBeNull();
    expect(screen.queryByText(/^Best /)).toBeNull();
  });
});
