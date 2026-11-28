import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Learn } from "@/components/learn/Learn";
import { Privacy } from "@/components/privacy/Privacy";
import { ListenButton } from "@/components/ui/ListenButton";

afterEach(() => {
  // @ts-expect-error: test doubles only
  delete globalThis.speechSynthesis;
  // @ts-expect-error: test doubles only
  delete globalThis.SpeechSynthesisUtterance;
});

describe("Learn, signed out 🔒", () => {
  it("lists the top five actions with three levels, and keeps cigarettes in the adults panel", () => {
    const { container } = render(<Learn lang="en" />);
    expect(screen.getByRole("heading", { level: 1, name: "What helps most in winter smog" })).toBeInTheDocument();
    expect(container.querySelectorAll("ol > li")).toHaveLength(5);
    expect(screen.getAllByText("Picture it").length).toBe(5);
    const adults = screen.getByText("For adults: the numbers").closest("details");
    const outside = [...container.querySelectorAll("p, li, dd")].filter((el) => !adults?.contains(el));
    expect(outside.some((el) => /cigarette/i.test(el.textContent ?? ""))).toBe(false);
    expect(container.querySelector("#numbers")).not.toBeNull();
    expect(screen.getByRole("table", { name: /CO₂ per person per km/ })).toBeInTheDocument();
  });
});

describe("Privacy", () => {
  it("covers storage, Gemini, location, who sees what and retention in either language", () => {
    const { unmount } = render(<Privacy lang="en" />);
    for (const name of ["What we store", "Google Gemini", "Your location", "Who sees what", "How long we keep it"]) {
      expect(screen.getByRole("heading", { name })).toBeInTheDocument();
    }
    expect(screen.getByRole("rowheader", { name: "Air readings" })).toBeInTheDocument();
    unmount();
    render(<Privacy lang="hi" />);
    expect(screen.getByRole("heading", { level: 1, name: "आपका डेटा, आसान शब्दों में" })).toBeInTheDocument();
  });
});

describe("Listen button (read aloud)", () => {
  it("is hidden without a matching voice", () => {
    const { container, unmount } = render(<ListenButton text="x" lang="hi" label="सुनें: x" />);
    expect(container).toBeEmptyDOMElement();
    unmount();
  });

  it("speaks in hi-IN, shows Stop while speaking, and stops", async () => {
    const listeners: (() => void)[] = [];
    const synth = {
      voices: [] as { lang: string }[],
      getVoices() {
        return this.voices;
      },
      addEventListener: (_: string, l: () => void) => listeners.push(l),
      removeEventListener: vi.fn(),
      cancel: vi.fn(),
      speak: vi.fn(),
    };
    Object.assign(globalThis, {
      speechSynthesis: synth,
      SpeechSynthesisUtterance: class {
        lang = "";
        onend: (() => void) | null = null;
        constructor(public text: string) {}
      },
    });
    const { unmount } = render(<ListenButton text="आज सैर घर के अंदर करें।" lang="hi" label="सुनें: आज सैर" />);
    expect(screen.queryByRole("button")).toBeNull();
    synth.voices = [{ lang: "hi-IN" }];
    act(() => listeners.forEach((l) => l()));
    await userEvent.click(screen.getByRole("button", { name: "सुनें: आज सैर" }));
    expect(synth.speak).toHaveBeenCalledWith(expect.objectContaining({ lang: "hi-IN", text: "आज सैर घर के अंदर करें।" }));
    expect(screen.getByRole("button", { name: "रोकें" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(screen.getByRole("button", { name: "रोकें" }));
    expect(screen.getByRole("button", { name: "सुनें: आज सैर" })).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(screen.getByRole("button", { name: "सुनें: आज सैर" }));
    act(() => synth.speak.mock.calls.at(-1)?.[0].onend());
    expect(screen.getByRole("button", { name: "सुनें: आज सैर" })).toBeInTheDocument();
    synth.cancel.mockClear();
    unmount();
    expect(synth.cancel).toHaveBeenCalledOnce();
  });
});
