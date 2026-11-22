import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BreezyDemo } from "@/components/breezy/BreezyDemo";
import { BreezyView } from "@/components/breezy/BreezyView";
import { Basics } from "@/components/breezy/FixedNotes";
import type { BreezyCard } from "@/domain/breezy/answer";
import { loadBreezyDemo } from "@/server/demo/demoBreezy";
import { installDialog } from "../helpers/dom";

/** Breezy's share card, errors and demo. */
beforeEach(installDialog);

const PAGE = {
  viewerId: "neha",
  viewerName: "Neha",
  isAdmin: false,
  lang: "en" as const,
  place: "Green Park",
  updated: "7:00 am",
  people: [{ id: "dadaji", name: "Dadaji", kind: "adult" as const }],
  basics: [],
  configured: true,
};
const SHARE: BreezyCard = {
  title: "A note for the society",
  forId: null,
  date: "today",
  time: null,
  activity: null,
  verdict: null,
  why: "",
  factId: null,
  action: "share",
  item: { en: "Please don't burn leaves today.", hi: "आज पत्ते न जलाएँ।" },
  onCard: true,
};

async function ask(text: string) {
  await userEvent.type(screen.getByLabelText("Your question for Breezy"), text);
  await userEvent.click(screen.getByRole("button", { name: "Send" }));
}

describe("Breezy cards and errors", () => {
  it("offers Copy on a share card, with no person to pick", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ kind: "reply", text: "Here's a note.", lang: "en", cards: [SHARE] })),
    );
    render(<BreezyView page={PAGE} />);
    await ask("Draft a note");
    expect(await screen.findByRole("button", { name: "Copy" })).toBeInTheDocument();
    expect(screen.queryByText("Who is this for?")).toBeNull();
  });

  it("says the air changed when the server refuses the time, and keeps the sheet open", async () => {
    const card = { ...SHARE, forId: "dadaji", action: "add_checklist" as const, title: "Check inhaler refill" };
    const answers = [
      Response.json({ kind: "reply", text: "A reminder.", lang: "en", cards: [card] }),
      Response.json({ error: { code: "rules_changed", message: "x" } }, { status: 409 }),
      Response.json({ error: { code: "invalid_item", message: "x" } }, { status: 400 }),
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => answers.shift()),
    );
    render(<BreezyView page={PAGE} />);
    await ask("Remind Dadaji");
    await userEvent.click(await screen.findByRole("button", { name: "Add to Dadaji's checklist" }));
    const sheet = screen.getByRole("dialog");
    await userEvent.click(within(sheet).getByRole("button", { name: "Add" }));
    expect(await within(sheet).findByText("The air changed since this suggestion. Ask Breezy again.")).toBeInTheDocument();
    await userEvent.click(within(sheet).getByRole("button", { name: "Add" }));
    expect(await within(sheet).findByText("We couldn't add it. Ask Breezy again.")).toBeInTheDocument();
  });

  it("survives browsers whose scrollIntoView returns a Promise (Chrome 140+)", async () => {
    Element.prototype.scrollIntoView = vi.fn(() => Promise.resolve()) as unknown as Element["scrollIntoView"];
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ kind: "basics" })),
    );
    render(<BreezyView page={PAGE} />);
    await ask("Hi");
    await ask("Again");
    expect(await screen.findAllByText(/Here are today's basics|no air reading/)).not.toHaveLength(0);
    delete (Element.prototype as Partial<Element>).scrollIntoView;
  });

  it("does not send an empty question", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    render(<BreezyView page={PAGE} />);
    await userEvent.type(screen.getByLabelText("Your question for Breezy"), "   {Enter}");
    screen.getByLabelText("Your question for Breezy").closest("form")?.requestSubmit();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("says when BreatheWell can't be reached", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Promise.reject(new TypeError("offline"))),
    );
    render(<BreezyView page={PAGE} />);
    await ask("Hi");
    expect(await screen.findByText("We couldn't reach BreatheWell. Check your connection and try again.")).toBeInTheDocument();
  });

  it("explains that there are no verdicts without air", () => {
    render(<Basics basics={[]} lang="hi" />);
    expect(screen.getByText(/अभी हवा की जानकारी नहीं है/)).toBeInTheDocument();
  });
});

describe("Breezy demo (spec 7.7.2)", () => {
  it("answers chips only, labels the Simple answer, and shows what a card would do without writing", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    render(<BreezyDemo page={loadBreezyDemo({ scenario: "smog-morning", time: 6, view: "neha" }, "en")} />);
    expect(screen.queryByLabelText("Your question for Breezy")).toBeNull();
    expect(screen.getByRole("link", { name: "Sign in to ask your own question." })).toHaveAttribute("href", "/sign-in?next=%2Fask");
    await userEvent.click(screen.getByRole("button", { name: "Plan Dadaji's temple visit" }));
    expect(screen.getByText("The best time for Dadaji's temple visit is 3 pm today.")).toBeInTheDocument();
    expect(screen.getByText("Simple answer · from the safety rules")).toBeInTheDocument();
    expect(screen.getByText("In your own family this would add to Dadaji's plan.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Add to/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Is a cloth mask enough?" }));
    expect(screen.getAllByText("Simple answer · from the safety rules")).toHaveLength(2);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("shows the Hindi chips and the Hindi Simple answer label", async () => {
    const page = loadBreezyDemo({ scenario: "smog-morning", time: 6, view: "neha" }, "hi");
    render(<BreezyDemo page={{ ...page, chips: [{ ...page.chips[2], id: "x" }] }} />);
    await userEvent.click(screen.getByRole("button", { name: "क्या कपड़े का मास्क काफ़ी है?" }));
    expect(screen.getByText("आसान जवाब · सुरक्षा नियमों से")).toBeInTheDocument();
  });
});
