import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

/** A recorded demo answer: shown with the assistant label instead of "Simple answer". */
vi.mock("@/data/demo/storedBreezy", () => ({
  storedBreezyKey: (s: string, c: string, l: string) => `${s}:${c}:${l}`,
  storedBreezyFor: (key: string) =>
    key === "smog-morning:mask:en"
      ? { recordedOn: "2026-11-24", model: "m", promptVersion: 1, lang: "en", text: "A cloth mask blocks little smoke.", cards: [] }
      : null,
}));

const { BreezyDemo } = await import("@/components/breezy/BreezyDemo");
const { loadBreezyDemo } = await import("@/server/demo/demoBreezy");

describe("Breezy demo with a stored answer", () => {
  it("labels it as made by the assistant", async () => {
    render(<BreezyDemo page={loadBreezyDemo({ scenario: "smog-morning", time: 6, view: "neha" }, "en")} />);
    await userEvent.click(screen.getByRole("button", { name: "Is a cloth mask enough?" }));
    expect(screen.getByText("A cloth mask blocks little smoke.")).toBeInTheDocument();
    expect(screen.getByText("Made by BreatheWell assistant (Google Gemini) · checked by safety rules")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Which day is best for the park?" }));
    expect(screen.getByText("Simple answer · from the safety rules")).toBeInTheDocument();
  });
});
