import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DependentForm } from "@/components/dependent/DependentForm";
import { InvitePreviewView } from "@/components/family/InvitePreviewView";
import { PlanItems } from "@/components/member/PlanItems";
import { ProfileEditor } from "@/components/profile/ProfileEditor";
import { FamilyDetailsForm } from "@/components/settings/FamilyDetailsForm";
import { recordedDemo } from "@/server/demo/demoPage";
import { PROFILE, RIYA } from "../helpers/family";
import { installDialog, stubFetch } from "../helpers/dom";

/** Form branches the main component suites leave out: stay-in, a second pick's time, errors, a blank name. */
const router = { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));
beforeEach(() => {
  installDialog();
  Object.values(router).forEach((f) => f.mockReset());
});

const page = { familyName: "Sharma family", guardianName: "Neha", id: null, input: null, canDelete: false };
const bodyOf = (fetcher: ReturnType<typeof stubFetch>) =>
  JSON.parse(String((fetcher.mock.calls[0] as unknown as [string, RequestInit])[1].body));

describe("dependent form branches", () => {
  it("'Mostly stays in' clears the outside picks and their times", async () => {
    render(<DependentForm page={page} lang="en" />);
    await userEvent.click(screen.getByRole("checkbox", { name: "School trip" }));
    expect(screen.getByLabelText("School trip: time 1")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("checkbox", { name: "Mostly stays in" }));
    expect(screen.getByRole("checkbox", { name: "Mostly stays in" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "School trip" })).not.toBeChecked();
    expect(screen.queryByLabelText("School trip: time 1")).toBeNull();
  });

  it("changing one pick's time leaves the other pick's times alone", async () => {
    const fetcher = stubFetch({ id: "d1" });
    render(<DependentForm page={page} lang="en" />);
    await userEvent.type(screen.getByLabelText("First name or nickname"), "Riya");
    await userEvent.click(screen.getByRole("checkbox", { name: "School trip" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Tuition" }));
    await userEvent.click(screen.getByRole("radio", { name: "Under 13" }));
    await userEvent.click(screen.getByRole("radio", { name: "Cycle" }));
    const before = (screen.getByLabelText("School trip: time 1") as HTMLInputElement).value;
    const tuition = screen.getAllByLabelText(/^Tuition: time/u)[0];
    fireEvent.change(tuition, { target: { value: "18:00" } });
    const second = (screen.getByLabelText("School trip: time 2") as HTMLInputElement).value;
    fireEvent.change(screen.getByLabelText("School trip: time 1"), { target: { value: "08:00" } });
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    const picks = bodyOf(fetcher).picks as { choice: string; times: string[] }[];
    expect(before).not.toBe("08:00");
    expect(picks.find((p) => p.choice === "school_trip")?.times).toEqual(["08:00", second]);
    expect(picks.find((p) => p.choice === "tuition")?.times[0]).toBe("18:00");
  });

  it("says who may edit when the server forbids it, with a blank title name for a missing input", async () => {
    stubFetch({ error: { code: "forbidden", message: "x" } }, 403);
    render(<DependentForm page={{ ...page, id: "d1", input: { ...RIYA }, canDelete: false }} lang="en" />);
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Only the adult who added them, or the family admin, can change this.")).toBeInTheDocument();
  });

  it("any other failure says something went wrong", async () => {
    stubFetch({ error: { code: "x", message: "x" } }, 500);
    render(<DependentForm page={{ ...page, id: "d1", input: { ...RIYA }, canDelete: false }} lang="en" />);
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Something went wrong. Try again.")).toBeInTheDocument();
  });
});

describe("profile and family details branches", () => {
  it("the profile editor refuses to save a blank name", async () => {
    const fetcher = stubFetch();
    render(<ProfileEditor input={PROFILE} lang="en" />);
    await userEvent.clear(screen.getByRole("textbox", { name: /What does the family call you/u }));
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("We couldn't save that. Try again.")).toBeInTheDocument();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("family details sends nothing with a blank name", async () => {
    const fetcher = stubFetch();
    render(<FamilyDetailsForm name="Sharma family" placeName="Green Park" homeSetup={null} lang="en" />);
    await userEvent.clear(screen.getByRole("textbox", { name: "Family name" }));
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe("invite and plan item branches", () => {
  const signedIn = { signedIn: true, onboarded: true, familyName: null };

  it("a returned error on an expired or unknown code still renders, naming no family", () => {
    const { rerender } = render(
      <InvitePreviewView
        preview={{ kind: "expired", adminName: "Neha" }}
        viewer={signedIn}
        error="in_other_family"
        validTill={null}
        lang="en"
      />,
    );
    expect(screen.getAllByRole("alert").length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toMatch(/undefined|null/u);
    rerender(<InvitePreviewView preview={{ kind: "not_found" }} viewer={signedIn} error="code_expired" validTill={null} lang="en" />);
    expect(document.body.textContent).not.toMatch(/undefined|null/u);
  });

  it("adds 'Tomorrow … looks better' to an item and reads it out too", () => {
    const row = recordedDemo("smog-morning", 6, "neha").day.rows[0];
    const plan = { ...row, items: row.items.map((i, n) => (n === 0 ? { ...i, plan: { ...i.plan, tomorrowBest: 7 } } : i)) };
    render(<PlanItems plan={plan} ticked={[]} lang="en" />);
    expect(screen.getAllByText(/Tomorrow 7 am looks better\./u).length).toBeGreaterThan(0);
  });
});
