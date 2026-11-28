import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CommunityView } from "@/components/community/CommunityView";
import { ListenButton } from "@/components/ui/ListenButton";

/** Listen's exact voices and error reset, and the community page's call to action. */
afterEach(() => {
  // @ts-expect-error: test doubles only
  delete globalThis.speechSynthesis;
  // @ts-expect-error: test doubles only
  delete globalThis.SpeechSynthesisUtterance;
});

describe("Listen and the community link", () => {
  it("needs an exact en-IN / hi-IN voice and resets after a speech error", async () => {
    const synth = {
      voices: [{ lang: "hi" }, { lang: "en-US" }] as { lang: string }[],
      getVoices() {
        return this.voices;
      },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      cancel: vi.fn(),
      speak: vi.fn(),
    };
    Object.assign(globalThis, {
      speechSynthesis: synth,
      SpeechSynthesisUtterance: class {
        lang = "";
        voice: unknown = null;
        onend: (() => void) | null = null;
        onerror: (() => void) | null = null;
        constructor(public text: string) {}
      },
    });
    const { unmount } = render(<ListenButton text="Stay in." lang="en" label="Listen to Breezy's answer" />);
    expect(screen.queryByRole("button")).toBeNull();
    unmount();
    synth.voices = [{ lang: "hi_IN" }, { lang: "en-IN" }];
    render(<ListenButton text="Stay in." lang="en" label="Listen to Breezy's answer" />);
    await userEvent.click(screen.getByRole("button", { name: "Listen to Breezy's answer" }));
    const utterance = synth.speak.mock.calls[0][0];
    expect(utterance.voice).toEqual({ lang: "en-IN" });
    act(() => utterance.onerror());
    expect(screen.getByRole("button", { name: "Listen to Breezy's answer" })).toHaveAttribute("aria-pressed", "false");
  });

  it("sends a signed-in viewer to Today from the community page", () => {
    render(<CommunityView page={{ kind: "no_place" }} lang="en" signedIn />);
    expect(screen.getByRole("link", { name: "Make your own family plan" })).toHaveAttribute("href", "/today");
  });
});
