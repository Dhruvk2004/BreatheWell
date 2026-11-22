import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Landing } from "@/components/landing/Landing";
import { airHref } from "@/components/place/airHref";
import { recordedDemo } from "@/server/demo/demoPage";
import geocodePune from "../fixtures/api/geocode-pune.json";
import reverseDelhi from "../fixtures/api/reverse-delhi.json";

const demo = recordedDemo("smog-morning", 6, "neha");
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const respond = (body: unknown, ok = true) => Promise.resolve(new Response(JSON.stringify(body), { status: ok ? 200 : 500 }));

beforeEach(() => push.mockReset());
afterEach(() => vi.useRealTimers());

describe("landing (spec 10.1)", () => {
  // Deferred Must items, tracked here so the 25 Nov freeze cannot miss them (build review slice 2, M7).
  it.todo("shows the 'For your society or school' card linking to the community message (10.1 item 6, F14, slice 5)");

  it("shows the question, the location note, both ways in and real sample chips", () => {
    render(<Landing demo={demo} lang="en" />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Can your family go out today?");
    expect(screen.getByText(/We don't store it/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Check the air near me" })).toBeEnabled();
    expect(screen.getByRole("link", { name: "See a sample family" })).toHaveAttribute("href", "/demo");
    expect(screen.getByRole("heading", { name: "How BreatheWell works" })).toBeInTheDocument();
    expect(screen.getByText(/Sample family on a recorded smog morning/)).toBeInTheDocument();
  });

  it("in Hindi, keeps the same structure", () => {
    render(<Landing demo={demo} lang="hi" />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("क्या आज आपका परिवार बाहर जा सकता है?");
    expect(screen.getByRole("combobox", { name: "या अपना शहर लिखें" })).toBeInTheDocument();
  });
});

describe("check the air near me (spec 5.1 steps 2–4)", () => {
  it("goes to Air now with the place name and rounded coordinates", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => respond(reverseDelhi)),
    );
    const getCurrentPosition = vi.fn((ok: PositionCallback) =>
      ok({ coords: { latitude: 28.56123, longitude: 77.21456 } } as GeolocationPosition),
    );
    Object.defineProperty(navigator, "geolocation", { value: { getCurrentPosition }, configurable: true });
    render(<Landing demo={demo} lang="en" />);
    await userEvent.click(screen.getByRole("button", { name: "Check the air near me" }));
    expect(push).toHaveBeenCalledWith(expect.stringMatching(/^\/air\?place=.+&lat=28\.56&lon=77\.21&cc=IN$/));
  });

  it("on denial says so, moves focus to the search and offers Use my location", async () => {
    const getCurrentPosition = vi.fn((_ok: PositionCallback, fail: PositionErrorCallback) => fail({ code: 1 } as GeolocationPositionError));
    Object.defineProperty(navigator, "geolocation", { value: { getCurrentPosition }, configurable: true });
    render(<Landing demo={demo} lang="en" />);
    await userEvent.click(screen.getByRole("button", { name: "Check the air near me" }));
    expect(screen.getByText("We'll use the city you pick. You can change it any time.")).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toHaveFocus();
    expect(screen.getByRole("button", { name: "Use my location" })).toBeInTheDocument();
  });

  it("treats a browser without geolocation as denied, and still navigates when the place name fails", async () => {
    Object.defineProperty(navigator, "geolocation", { value: undefined, configurable: true });
    // @ts-expect-error: remove the API entirely for this case
    delete navigator.geolocation;
    render(<Landing demo={demo} lang="en" />);
    await userEvent.click(screen.getByRole("button", { name: "Check the air near me" }));
    expect(screen.getByRole("button", { name: "Use my location" })).toBeInTheDocument();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => respond({}, false)),
    );
    Object.defineProperty(navigator, "geolocation", {
      value: { getCurrentPosition: (ok: PositionCallback) => ok({ coords: { latitude: 18.5, longitude: 73.8 } } as GeolocationPosition) },
      configurable: true,
    });
    await userEvent.click(screen.getByRole("button", { name: "Use my location" }));
    expect(push).toHaveBeenCalledWith("/air?place=&lat=18.5&lon=73.8");
  });
});

describe("city search combobox (spec 10.1 item 4)", () => {
  const type = async (text: string) => {
    fireEvent.change(screen.getByRole("combobox"), { target: { value: text } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
  };

  it("suggests places after 3 letters and opens the chosen one with the keyboard", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(() => respond(geocodePune));
    vi.stubGlobal("fetch", fetchMock);
    render(<Landing demo={demo} lang="en" />);
    await type("Pu");
    expect(fetchMock).not.toHaveBeenCalled();
    await type("Pun");
    expect(screen.getByRole("listbox", { name: "City suggestions" })).toBeVisible();
    expect(screen.getByText(/places found/)).toBeInTheDocument();
    const box = screen.getByRole("combobox");
    fireEvent.keyDown(box, { key: "ArrowDown" });
    expect(box).toHaveAttribute("aria-activedescendant", "place-option-0");
    fireEvent.keyDown(box, { key: "ArrowUp" });
    fireEvent.keyDown(box, { key: "ArrowUp" });
    fireEvent.keyDown(box, { key: "Escape" });
    expect(box).not.toHaveAttribute("aria-activedescendant");
    expect(box).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("listbox", { hidden: true })).not.toBeVisible();
    fireEvent.keyDown(box, { key: "Tab" });
    fireEvent.keyDown(box, { key: "ArrowDown" });
    fireEvent.keyDown(box, { key: "Enter" });
    expect(push).toHaveBeenCalledWith(expect.stringMatching(/^\/air\?place=Pune%2C\+Maharashtra%2C\+India&lat=18\.52/));
    fireEvent.click(screen.getAllByRole("option")[0]);
    expect(push).toHaveBeenCalledTimes(2);
  });

  it("Enter or submitting the form opens the first suggestion; typing reopens a closed list", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => respond(geocodePune)),
    );
    render(<Landing demo={demo} lang="en" />);
    await type("Pun");
    const box = screen.getByRole("combobox");
    expect(box.closest("form")).toHaveAttribute("action", "/air");
    expect(box).toHaveAttribute("name", "place");
    fireEvent.keyDown(box, { key: "Enter" });
    expect(push).toHaveBeenLastCalledWith(expect.stringMatching(/^\/air\?place=Pune/));
    fireEvent.keyDown(box, { key: "Escape" });
    fireEvent.submit(box.closest("form") as HTMLFormElement);
    expect(push).toHaveBeenCalledTimes(2);
    await type("Pune");
    expect(box).toHaveAttribute("aria-expanded", "true");
  });

  it("submitting with no suggestions stays on the page", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => respond({})),
    );
    render(<Landing demo={demo} lang="en" />);
    fireEvent.submit(screen.getByRole("combobox").closest("form") as HTMLFormElement);
    expect(push).not.toHaveBeenCalled();
  });

  it("says when nothing matches or the search fails", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => respond({})),
    );
    render(<Landing demo={demo} lang="en" />);
    await type("Zzzq");
    expect(screen.getByText("No places found. Try another spelling.")).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "ArrowDown" });
    vi.stubGlobal(
      "fetch",
      vi.fn(() => respond({}, false)),
    );
    await type("Zzzqq");
    expect(screen.getByText(/can't search right now/)).toBeInTheDocument();
  });

  it("airHref rounds coordinates and drops a malformed country code", () => {
    expect(airHref({ name: "X", lat: 1.23456, lon: 2.34567, countryCode: "INDIA" })).toBe("/air?place=X&lat=1.23&lon=2.35");
  });
});
