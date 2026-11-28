import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BreezyView } from "@/components/breezy/BreezyView";
import { familyChips } from "@/components/breezy/PromptChips";
import { ApiRequestError } from "@/client/api";
import { failureText } from "@/components/ui/failure";
import type { BreezyCard } from "@/domain/breezy/answer";
import type { BreezyPage } from "@/view/breezy";
import { installDialog } from "../helpers/dom";

/** Breezy page edge cases: refusals, Picture it, chips and the client wait. */
beforeEach(installDialog);
afterEach(() => vi.useRealTimers());

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
  basics: [],
  configured: true,
};
const PICTURE = { lessPercent: 60, thanTime: "07:00", dayOutside: { count: 11, lessThanOne: false } };
const TEMPLE: BreezyCard = {
  title: "Temple visit at 3 pm",
  forId: "dadaji",
  date: "today",
  time: "15:00",
  activity: "temple_errand",
  verdict: "care",
  why: "",
  factId: "morning_inversion",
  action: "add_to_plan",
  item: { en: "Temple visit at 3 pm", hi: "दोपहर 3 बजे मंदिर जाएँ" },
  onCard: true,
  picture: PICTURE,
};

function stub(...bodies: unknown[]) {
  const fetcher = vi.fn(async () => Response.json(bodies.shift() ?? { ok: true }));
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
}
const bodyOf = (fetcher: ReturnType<typeof stub>, i: number) =>
  JSON.parse(String((fetcher.mock.calls[i] as unknown as [string, RequestInit])[1].body));

async function ask(text: string) {
  await userEvent.type(screen.getByLabelText("Your question for Breezy"), text);
  await userEvent.click(screen.getByRole("button", { name: "Send" }));
}

describe("refusals and the status node", () => {
  it("links an admin to Family settings for an admin action, and announces the answer once", async () => {
    stub({ kind: "reply", text: "I can't remove members.", lang: "en", cards: [], refusal: "admin_action" });
    render(<BreezyView page={PAGE} />);
    await ask("Remove Rahul");
    expect(await screen.findByRole("link", { name: "Open Family settings" })).toHaveAttribute("href", "/family/settings");
    expect(screen.getByRole("status")).toHaveTextContent("Breezy answered.");
  });

  it("shows no settings link to a member who is not the admin", async () => {
    stub({ kind: "reply", text: "I can't remove members.", lang: "en", cards: [], refusal: "admin_action" });
    render(<BreezyView page={{ ...PAGE, isAdmin: false }} />);
    await ask("Remove Rahul");
    await screen.findByText("I can't remove members.");
    expect(screen.queryByRole("link", { name: "Open Family settings" })).toBeNull();
  });

  it("keeps the emergency alert out of the status node, and never asks the server", async () => {
    const fetcher = stub();
    render(<BreezyView page={PAGE} />);
    await ask("Dadaji is short of breath");
    expect(screen.getByRole("alert")).toHaveTextContent("call 112");
    expect(screen.getByRole("status")).toHaveTextContent("");
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe("Picture it on a card", () => {
  it("shows the code's exposure and the cigarette figure on an adult's card", async () => {
    stub({ kind: "reply", text: "3 pm is better.", lang: "en", cards: [TEMPLE], refusal: null });
    render(<BreezyView page={PAGE} />);
    await ask("Temple?");
    await userEvent.click(await screen.findByText("Why?"));
    expect(screen.getByText("About 60% less smoke during this than at 7 am.")).toBeInTheDocument();
    expect(screen.getByText(/like smoking about 11 cigarettes/)).toBeInTheDocument();
  });

  it("says less than 1 for a clean day and hides the percent at the smokiest hour", async () => {
    const clean = { ...TEMPLE, factId: null, picture: { lessPercent: 0, thanTime: "15:00", dayOutside: { count: 1, lessThanOne: true } } };
    stub({ kind: "reply", text: "Fine.", lang: "en", cards: [clean], refusal: null });
    render(<BreezyView page={PAGE} />);
    await ask("Temple?");
    await userEvent.click(await screen.findByText("Why?"));
    expect(screen.getByText(/less than 1 cigarette/)).toBeInTheDocument();
    expect(screen.queryByText(/less smoke during this/)).toBeNull();
  });

  it("never shows cigarettes on a dependent's card: the fact panel instead", async () => {
    stub({ kind: "reply", text: "Ideas.", lang: "en", cards: [{ ...TEMPLE, forId: "riya" }], refusal: null });
    render(<BreezyView page={PAGE} />);
    await ask("Riya?");
    await userEvent.click(await screen.findByText("Why?"));
    expect(document.body.textContent).not.toMatch(/cigarette/i);
  });
});

describe("chips and the client wait", () => {
  it("puts the family's names in the chips, above the thread", () => {
    render(<BreezyView page={PAGE} />);
    const group = screen.getByRole("group", { name: "Suggested questions" });
    expect(screen.getByRole("button", { name: "When should Dadaji walk today?" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Plan Riya's evening" })).toBeInTheDocument();
    expect(group.compareDocumentPosition(screen.getByRole("region", { name: "Your conversation with Breezy" }))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    const alone = familyChips([{ id: "neha", name: "Neha", kind: "adult" }], "neha", "hi");
    expect(alone.map((c) => c.id)).toEqual(["walk", "breezy.chip.mask", "breezy.chip.goOut", "breezy.chip.windows", "breezy.chip.sunday"]);
  });

  it("sends the paused question once, not again in the history", async () => {
    const fetcher = stub({ kind: "ask_alias", kin: "papa", word: "Papa" }, { ok: true }, { kind: "basics" });
    render(<BreezyView page={PAGE} />);
    await ask("Papa's inhaler");
    await userEvent.click(await screen.findByRole("button", { name: "Dadaji" }));
    await screen.findAllByText(/no air reading|basics/);
    expect(bodyOf(fetcher, 2)).toEqual({ question: "Papa's inhaler", history: [] });
  });

  it("aborts the request after 12 s and shows the basics", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let signal: AbortSignal | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn((_: string, init: RequestInit) => {
        signal = init.signal ?? undefined;
        return new Promise(() => {});
      }),
    );
    render(<BreezyView page={PAGE} />);
    await userEvent.click(screen.getByRole("button", { name: "Is a cloth mask enough?" }));
    await act(async () => vi.advanceTimersByTime(12_000));
    expect(signal?.aborted).toBe(true);
    expect(await screen.findByText(/no air reading|basics/)).toBeInTheDocument();
  });

  it("says saving is paused when the write quota is used up", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ error: { code: "saving_paused", message: "x" } }, { status: 503 })),
    );
    render(<BreezyView page={PAGE} />);
    await ask("Hi");
    expect(await screen.findByText("Saving is paused until tomorrow; your plan and the air still show.")).toBeInTheDocument();
    expect(failureText(new ApiRequestError(400, "x", "x", {}), "hi", "common.error", { x: "common.gone" })).not.toBe("");
  });
});
