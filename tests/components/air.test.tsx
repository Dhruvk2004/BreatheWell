import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AirNowView } from "@/components/air/AirNowView";
import { BestLine } from "@/components/air/BestLine";
import { CareRows } from "@/components/air/CareRows";
import { SwapCard } from "@/components/air/SwapCard";
import { WhyPanel } from "@/components/air/WhyPanel";
import { airSummary } from "@/domain/air/summary";
import { loadAirNowPage } from "@/server/air/airNowPage";
import type { AirNowPage } from "@/view/airNowPage";
import { RateLimiter } from "@/server/rateLimit";
import { airOf, bandDay, istClock, joinSeries, weatherOf } from "../helpers/air";
import { deps, NOW, snapshot } from "../helpers/airDeps";

const headers = new Headers();
const ready = async (query: Record<string, string> = { lat: "28.56", lon: "77.21", place: "Green Park, New Delhi", cc: "IN" }, now = NOW) =>
  loadAirNowPage(query, headers, deps({ now: () => now }), new RateLimiter(99, 1000), "en");

describe("Air now (spec 10.2)", () => {
  it("shows the answer first, the day, the advice, the community card and the source", async () => {
    render(<AirNowView page={await ready()} lang="en" />);
    expect(screen.getByRole("heading", { level: 1, name: "Air now in Green Park, New Delhi" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /^Air quality now \d+, Very poor, very unhealthy$/ })).toBeInTheDocument();
    expect(screen.getByText(/Official stations may read higher/)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Today's hourly air/ })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Next 5 days" })).toBeInTheDocument();
    for (const name of ["Who should take care", "At home today", "One swap for the air today", "Why are mornings worst?"]) {
      expect(screen.getByRole("heading", { name })).toBeInTheDocument();
    }
    expect(screen.getByText(/Simple message/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/sign-in");
    expect(screen.getByText(/Open-Meteo \(CAMS model\) · updated/)).toBeInTheDocument();
  });

  it("keeps the cigarette comparison inside the collapsed For adults panel only 🔒", async () => {
    const { container } = render(<AirNowView page={await ready()} lang="en" />);
    const adults = screen.getByText("For adults: the numbers").closest("details");
    expect(adults).not.toHaveAttribute("open");
    const outside = [...container.querySelectorAll("p, li, span, h2")].filter((el) => !adults?.contains(el));
    expect(outside.some((el) => /cigarette/i.test(el.textContent ?? ""))).toBe(false);
    expect(adults?.textContent).toMatch(/cigarettes/);
  });

  it("says old data's time, and shows no band or verdicts on stale data (spec 8.5)", async () => {
    const later = new Date(NOW.getTime() + 5 * 3_600_000);
    const offline = deps({ now: () => later, fetchAir: vi.fn(async () => ({ ok: false as const, error: "http" as const })) });
    offline.lastGood.set("28.6_77.2", snapshot());
    const page = await loadAirNowPage({ lat: "28.56", lon: "77.21" }, headers, offline, new RateLimiter(9, 1000), "en");
    const { unmount } = render(<AirNowView page={page} lang="en" />);
    expect(screen.getByText(/This air reading is from/)).toBeInTheDocument();
    unmount();
    const muchLater = new Date(NOW.getTime() + 13 * 3_600_000);
    const stale = deps({ now: () => muchLater, fetchAir: offline.fetchAir, lastGood: offline.lastGood });
    render(
      <AirNowView page={await loadAirNowPage({ lat: "28.56", lon: "77.21" }, headers, stale, new RateLimiter(9, 1000), "hi")} lang="hi" />,
    );
    expect(screen.getByText("अभी हवा का डेटा नहीं मिल पा रहा। हम अंदाज़ा नहीं लगाएँगे।")).toBeInTheDocument();
    expect(screen.queryByRole("group")).toBeNull();
    expect(screen.getByRole("link", { name: "फिर कोशिश करें" })).toHaveAttribute("href", expect.stringContaining("/air?"));
  });

  it("outside India: the CPCB-scale label, no station note; a nameless place shows its coordinates", async () => {
    render(<AirNowView page={await ready({ lat: "51.5", lon: "-0.12", cc: "GB" })} lang="en" />);
    expect(screen.getByText("Shown on India's CPCB scale.")).toBeInTheDocument();
    expect(screen.queryByText(/Official stations/)).toBeNull();
    expect(screen.getByText("Near 51.50, -0.12")).toBeInTheDocument();
  });

  it.each([
    [{ kind: "no_place" }, "Choose a place to see its air, hour by hour."],
    [{ kind: "rate_limited" }, /Too many checks/],
    [{ kind: "unavailable", place: { name: "Pune", label: "Pune", lat: 18.52, lon: 73.86 } }, "Safe anyway"],
  ] as [AirNowPage, string | RegExp][])("renders the %j state", (page, text) => {
    render(<AirNowView page={page} lang="en" />);
    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it("opens the hour table from Show as table", async () => {
    render(<AirNowView page={await ready()} lang="en" />);
    await userEvent.click(screen.getByText("Show as table"));
    const table = screen.getByRole("table", { name: "Today's air by hour" });
    expect(within(table).getAllByRole("row").length).toBeGreaterThan(20);
  });
});

describe("air pieces", () => {
  it("BestLine says none, or tomorrow after 9 pm", () => {
    const { rerender } = render(<BestLine summary={airSummary(bandDay("2024-11-18", "poor"), istClock("2024-11-18T19:10"))} lang="en" />);
    expect(screen.getByText("Best time: not available today.")).toBeInTheDocument();
    const twoDays = {
      time: [...bandDay("2024-11-18", "poor").time, ...bandDay("2024-11-19", "poor").time],
      pm25: Array(48).fill(105),
      pm10: Array(48).fill(null),
    };
    rerender(<BestLine summary={airSummary(twoDays, istClock("2024-11-18T21:30"))} lang="en" />);
    expect(screen.getByText(/Best time outside tomorrow:/)).toBeInTheDocument();
  });

  it("CareRows words every verdict with and without a window", () => {
    const rows = [
      { audience: "most", verdict: "go" },
      { audience: "sensitive", verdict: "care" },
    ] as const;
    const { rerender } = render(<CareRows rows={rows} best={null} windowDay="today" lang="en" />);
    expect(screen.getByText("Outdoor plans are fine today.")).toBeInTheDocument();
    expect(screen.getByText("Keep outdoor exercise short and easy.")).toBeInTheDocument();
    rerender(<CareRows rows={[{ audience: "sensitive", verdict: "avoid" }]} best={null} windowDay="today" lang="en" />);
    expect(screen.getByText("Avoid long time outside today.")).toBeInTheDocument();
  });

  it("CareRows and the community message call a window after 9 pm tomorrow's (22:30)", async () => {
    const twoDays = {
      time: [...bandDay("2024-11-18", "very_poor").time, ...bandDay("2024-11-19", "very_poor").time],
      pm25: [...Array(24).fill(210), ...Array(7).fill(210), 70, 70, ...Array(15).fill(210)],
      pm10: Array(48).fill(null),
    };
    const summary = airSummary(twoDays, istClock("2024-11-18T22:30"));
    expect(summary.windowDay).toBe("tomorrow");
    const rows = [
      { audience: "most", verdict: "care" },
      { audience: "sensitive", verdict: "avoid" },
    ] as const;
    const { rerender } = render(<CareRows rows={rows} best={summary.best} windowDay={summary.windowDay} lang="en" />);
    expect(screen.getByText(/^Tomorrow, keep long outdoor exercise for/)).toBeInTheDocument();
    expect(screen.getByText(/if you must go tomorrow, go at/)).toBeInTheDocument();
    rerender(<CareRows rows={rows} best={summary.best} windowDay={summary.windowDay} lang="hi" />);
    expect(screen.getByText(/^कल लंबी कसरत/)).toBeInTheDocument();
    rerender(<CareRows rows={rows} best={summary.best} windowDay="rest_of_today" lang="en" />);
    expect(screen.getByText(/^Keep long outdoor exercise for/)).toBeInTheDocument();
  });

  it("Air now at 22:30 builds a community message about tomorrow's best time", async () => {
    const night = new Date("2024-11-18T17:00:00Z");
    const twoDays = joinSeries(
      bandDay("2024-11-18", "very_poor"),
      bandDay("2024-11-19", "very_poor", { 7: "satisfactory", 8: "satisfactory" }),
    );
    const live = deps({
      now: () => night,
      fetchAir: vi.fn(async () => ({ ok: true as const, value: { air: airOf(twoDays), timeZone: "Asia/Kolkata" } })),
      fetchWeather: vi.fn(async () => ({ ok: true as const, value: weatherOf(twoDays) })),
    });
    const page = await loadAirNowPage({ lat: "28.56", lon: "77.21", place: "Green Park" }, headers, live, new RateLimiter(9, 1000), "en");
    if (page.kind !== "ready") throw new Error(page.kind);
    expect(page.model.summary.windowDay).toBe("tomorrow");
    expect(page.community?.header).toMatch(/Best time outside tomorrow 7/);
    expect(page.community?.body).toContain("Tomorrow, children can play after 7 am.");
  });

  it("SwapCard offers the bus where there is no metro; WhyPanel ignores unknown facts", () => {
    render(<SwapCard mode="auto_bus" co2Kg={1.8} lang="en" />);
    expect(screen.getByText(/Bus instead of the car/)).toBeInTheDocument();
    const { container } = render(<WhyPanel lang="en" factId="nope" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("copies the community message and says so", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<AirNowView page={await ready()} lang="en" />);
    await userEvent.click(screen.getByRole("button", { name: "Copy" }));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("Air in Green Park, New Delhi today"));
    expect(screen.getByRole("status", { name: "" })).toBeDefined();
    expect(await screen.findByText("Copied. Paste it in WhatsApp.")).toBeInTheDocument();
    writeText.mockRejectedValueOnce(new Error("denied"));
    await userEvent.click(screen.getByRole("button", { name: "Copy" }));
    expect(await screen.findByText(/Couldn't copy/)).toBeInTheDocument();
  });
});
