import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BreezyView } from "@/components/breezy/BreezyView";
import type { BreezyAnswer, BreezyCard } from "@/domain/breezy/answer";
import type { BreezyPage } from "@/view/breezy";
import { installDialog } from "../helpers/dom";

// Breezy's page: thread, cards behind the confirm sheet, the fixed-text states.
beforeEach(installDialog);
const PAGE: BreezyPage = {
  viewerId: "neha",
  viewerName: "Neha",
  isAdmin: true,
  lang: "en",
  place: "Green Park",
  updated: "7:00 am",
  people: [
    { id: "neha", name: "Neha", kind: "adult" },
    { id: "dadaji", name: "Dadaji", kind: "adult" },
    { id: "riya", name: "Riya", kind: "dependent" },
  ],
  basics: [{ id: "dadaji", name: "Dadaji", verdict: "avoid", line: "Walk in the hall today." }],
  configured: true,
};

const TEMPLE: BreezyCard = {
  title: "Temple visit at 3 pm",
  forId: "dadaji",
  date: "today",
  time: "15:00",
  activity: "temple_errand",
  verdict: "care",
  why: "Afternoon sun lifts the smoke.",
  factId: "morning_inversion",
  action: "add_to_plan",
  item: { en: "Temple visit at 3 pm", hi: "दोपहर 3 बजे मंदिर जाएँ" },
  onCard: true,
};

/** Answers each request in turn: Breezy answers, then action or alias results. */
function stubAnswers(...bodies: unknown[]) {
  const fetcher = vi.fn(async () => {
    const body = bodies.shift() ?? { ok: true };
    const status = typeof body === "object" && body && "status" in body ? Number((body as { status: number }).status) : 200;
    return new Response(JSON.stringify(body), { status });
  });
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
}
const bodyOf = (fetcher: ReturnType<typeof stubAnswers>, i: number) =>
  JSON.parse(String((fetcher.mock.calls[i] as unknown as [string, RequestInit])[1].body));

async function ask(text: string) {
  await userEvent.type(screen.getByLabelText("Your question for Breezy"), text);
  await userEvent.click(screen.getByRole("button", { name: "Send" }));
}

describe("BreezyView", () => {
  it("shows the header line, chips, disclaimer and the 300-character counter", async () => {
    render(<BreezyView page={PAGE} />);
    expect(screen.getByText("Breezy uses today's air for Green Park, 7:00 am")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Suggested questions" })).toBeInTheDocument();
    expect(screen.getByText("Breezy gives general tips, not medical advice.")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Your question for Breezy"), "Hi");
    expect(screen.getByText("2 / 300")).toBeInTheDocument();
    expect(screen.getByLabelText("Your question for Breezy")).toHaveAttribute("maxLength", "300");
  });

  it("replies with a card, confirms the add naming the person, then offers WhatsApp", async () => {
    const reply: BreezyAnswer = { kind: "reply", text: "3 pm is much better for Dadaji.", lang: "en", cards: [TEMPLE], refusal: null };
    const fetcher = stubAnswers(reply, { ok: true, onCard: true, whatsapp: "Dadaji, a reminder for today: Temple visit at 3 pm – Neha" });
    render(<BreezyView page={PAGE} />);
    await ask("Can Dadaji go to the temple at 7 am?");
    expect(await screen.findByText("3 pm is much better for Dadaji.")).toBeInTheDocument();
    expect(screen.getByText("For: Dadaji · Today, 3 pm")).toBeInTheDocument();
    expect(screen.getByText("Go with care")).toBeInTheDocument();
    expect(screen.getByText("Made by BreatheWell assistant (Google Gemini) · checked by safety rules")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Add to Dadaji's plan" }));
    const sheet = screen.getByRole("dialog");
    expect(within(sheet).getByText('Add "Temple visit at 3 pm" to Dadaji\'s plan for today?')).toBeInTheDocument();
    expect(within(sheet).getByText("Dadaji will see it on Today, and can tick it or remove it.")).toBeInTheDocument();
    await userEvent.click(within(sheet).getByRole("button", { name: "Add" }));
    expect(await screen.findByText("Added to Dadaji's plan. Dadaji will see it in BreatheWell.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Send on WhatsApp" })).toHaveAttribute(
      "href",
      expect.stringMatching(/^https:\/\/wa\.me\/\?text=Dadaji/),
    );
    expect(bodyOf(fetcher, 1)).toMatchObject({ type: "add_to_plan", forId: "dadaji", time: "15:00", activity: "temple_errand" });
    expect(bodyOf(fetcher, 0)).toEqual({ question: "Can Dadaji go to the temple at 7 am?", history: [] });
  });

  it("says when a dependent's item stays off the kid card, and offers the kid card otherwise", async () => {
    const masks = {
      ...TEMPLE,
      forId: "riya",
      title: "Pack 2 masks",
      action: "add_checklist" as const,
      time: null,
      activity: null,
      verdict: null,
      onCard: false,
      factId: null,
    };
    const bottle = { ...masks, title: "Water bottle", onCard: true };
    stubAnswers({ kind: "reply", text: "Ideas for Riya.", lang: "en", cards: [masks, bottle] }, { ok: true, onCard: true, whatsapp: null });
    render(<BreezyView page={PAGE} />);
    await ask("What should Riya carry?");
    await screen.findByText("Ideas for Riya.");
    expect(screen.queryByText("Go with care")).toBeNull();
    const [first, second] = screen.getAllByRole("button", { name: "Add to Riya's checklist" });
    await userEvent.click(first);
    expect(within(screen.getAllByRole("dialog")[0]).getByText("This will show on your view only, not on Riya's card.")).toBeInTheDocument();
    await userEvent.click(second);
    const sheet = screen.getAllByRole("dialog")[1];
    expect(within(sheet).getByText("It shows on Riya's kid card.")).toBeInTheDocument();
    await userEvent.click(within(sheet).getByRole("button", { name: "Add" }));
    expect(await screen.findByText("Added to Riya's checklist. It's on Riya's kid card.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Riya's kid card" })).toHaveAttribute("href", "/kid/riya");
    expect(screen.queryByRole("link", { name: "Send on WhatsApp" })).toBeNull();
  });

  it("asks 'Who is this for?' and uses that person's rule slot (or says it cannot be added)", async () => {
    const open: BreezyCard = {
      ...TEMPLE,
      forId: null,
      slots: { neha: { time: "15:00", verdict: "go" }, dadaji: null, riya: { time: "16:00", verdict: "care" } },
    };
    stubAnswers({ kind: "reply", text: "A walk idea.", lang: "en", cards: [open] }, { ok: true, onCard: true, whatsapp: null });
    render(<BreezyView page={PAGE} />);
    await ask("Walk?");
    await screen.findByText("Who is this for?");
    await userEvent.click(screen.getByRole("button", { name: "Dadaji" }));
    expect(screen.getByText("No safe time for Dadaji today, so this can't be added.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Neha" }));
    expect(screen.getByText("For: Neha · Today, 3 pm")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Add to my plan" }));
    expect(screen.getByText("It shows on your Today, where you can tick it or remove it.")).toBeInTheDocument();
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Add" }));
    expect(await screen.findByText("Added to your plan.")).toBeInTheDocument();
  });

  it("shows the emergency note with Call 112, the basics, the daily limit and errors", async () => {
    const fetcher = stubAnswers({ kind: "basics" }, { kind: "quota" }, { status: 429, error: { code: "rate_limited", message: "x" } });
    render(<BreezyView page={PAGE} />);
    await ask("chest pain");
    expect(await screen.findByRole("alert")).toHaveTextContent("call 112 or see a doctor now");
    expect(screen.getByRole("link", { name: "Call 112" })).toHaveAttribute("href", "tel:112");
    expect(fetcher).not.toHaveBeenCalled();
    await ask("hi");
    expect(await screen.findByText("I can't think right now. Here are today's basics:")).toBeInTheDocument();
    expect(screen.getByText("Walk in the hall today.")).toBeInTheDocument();
    await ask("hi");
    expect(await screen.findByRole("link", { name: "Open today's plan" })).toHaveAttribute("href", "/today");
    await ask("hi");
    expect(await screen.findByText("That's a lot of questions at once. Wait a minute and try again.")).toBeInTheDocument();
  });

  it("asks who 'Papa' is, saves the pick, then sends the same question", async () => {
    const fetcher = stubAnswers(
      { kind: "ask_alias", kin: "papa", word: "Papa" },
      { ok: true },
      { kind: "reply", text: "Done.", lang: "en", cards: [] },
    );
    render(<BreezyView page={PAGE} />);
    await ask("Papa's inhaler is almost finished");
    expect(await screen.findByText('Who do you mean by "Papa"?')).toBeInTheDocument();
    expect(screen.getByText('We\'ll remember "Papa" for you only. Nothing is sent until you pick.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Dadaji" }));
    expect(await screen.findByText("Done.")).toBeInTheDocument();
    expect(bodyOf(fetcher, 1)).toEqual({ key: "papa", forId: "dadaji" });
    expect(bodyOf(fetcher, 2).question).toBe("Papa's inhaler is almost finished");
  });

  it("says when the alias could not be saved, and a failed add keeps the sheet open", async () => {
    stubAnswers({ kind: "ask_alias", kin: "papa", word: "Papa" }, { status: 500, error: { code: "x", message: "x" } });
    render(<BreezyView page={PAGE} />);
    await ask("Papa?");
    await userEvent.click(await screen.findByRole("button", { name: "Dadaji" }));
    expect(await screen.findByText("We couldn't save that. Try again.")).toBeInTheDocument();
  });

  it("shows the basics when the answer takes longer than the client waits", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {})),
    );
    render(<BreezyView page={{ ...PAGE, updated: null }} />);
    expect(screen.getByText("Breezy has no air reading for Green Park right now.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Is a cloth mask enough?" }));
    expect(screen.getByText(/Breezy is thinking/)).toBeInTheDocument();
    await act(async () => vi.advanceTimersByTime(12_000));
    expect(await screen.findByText("I can't think right now. Here are today's basics:")).toBeInTheDocument();
    vi.useRealTimers();
  });
});
