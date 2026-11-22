import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DependentForm } from "@/components/dependent/DependentForm";
import { HomePicker } from "@/components/family/HomePicker";
import { BLANK_HOME, homeSetupSummary } from "@/components/family/HomeSetupFields";
import { InvitePreviewView } from "@/components/family/InvitePreviewView";
import { KidCardView } from "@/components/kid/KidCardView";
import { MemberView } from "@/components/member/MemberView";
import { Onboarding } from "@/components/onboarding/Onboarding";
import { Summary } from "@/components/onboarding/Summary";
import { FamilyDetailsForm } from "@/components/settings/FamilyDetailsForm";
import { TodayView } from "@/components/today/TodayView";
import { removalOf } from "@/components/today/removal";
import { loadKidCard } from "@/server/app/kidCardPage";
import { loadMember, loadToday } from "@/server/app/todayPage";
import reverseDelhi from "../fixtures/api/reverse-delhi.json";
import { PROFILE, RIYA } from "../helpers/family";
import { installDialog, sharmaApp, stubFetch } from "../helpers/dom";

const router = { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));
beforeEach(() => {
  installDialog();
  Object.values(router).forEach((f) => f.mockReset());
});

const geolocation = (ok: boolean) =>
  vi.stubGlobal("navigator", {
    ...navigator,
    geolocation: {
      getCurrentPosition: (yes: (p: unknown) => void, no: (e: unknown) => void) =>
        ok ? yes({ coords: { latitude: 28.5594, longitude: 77.2066 } }) : no(new Error("denied")),
    },
  });

describe("form edges", () => {
  it("about step: language, text size and the name hint", async () => {
    render(<Onboarding page={{ googleName: "Neha", input: null, hasFamily: true, familyName: "F", removedFrom: null }} lang="en" />);
    await userEvent.click(screen.getByRole("radio", { name: "हिंदी" }));
    await userEvent.click(screen.getByRole("radio", { name: "Extra large" }));
    expect(document.documentElement.getAttribute("data-text")).toBe("xl");
    expect(screen.getByText('This name goes into your plan: "Add to Neha\'s plan".')).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await userEvent.click(screen.getByRole("radio", { name: "18–59" }));
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Pick up to 4.", { selector: "p[aria-live]" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("checkbox", { name: "I mostly stay in" }));
    expect(screen.getByRole("checkbox", { name: "Evening walk" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await userEvent.click(screen.getByRole("radio", { name: "Work or study from home" }));
    expect(screen.queryByRole("radiogroup", { name: "Typical one-way trip" })).toBeNull();
    await userEvent.click(screen.getByRole("checkbox", { name: "Car" }));
    stubFetch();
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Work or study from home")).toBeInTheDocument();
    expect(screen.getByText("Could also take: Car")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByText("Step 5 of 5")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await userEvent.click(screen.getByRole("button", { name: "Looks good" }));
    expect(router.push).toHaveBeenCalledWith("/today");
  });

  it("summary lines for travel and health", () => {
    render(<Summary input={{ ...PROFILE, conditions: ["asthma"], shareWith: "family" }} lang="en" />);
    expect(screen.getByText("Two-wheeler, 15–45 min")).toBeInTheDocument();
    expect(screen.getByText("Health: shared with the whole family")).toBeInTheDocument();
  });

  it("dependent form: changed times, the name error and a forbidden edit", async () => {
    const page = { familyName: "Sharma family", guardianName: "Neha", id: "d1", input: RIYA, canDelete: false };
    stubFetch({ error: { code: "forbidden", message: "x" } }, 403);
    render(<DependentForm page={page} lang="en" />);
    const time = screen.getByLabelText("Play in the colony: time 1");
    await userEvent.clear(time);
    await userEvent.type(time, "16:30");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Only the adult who added them, or the family admin, can change this.")).toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText("First name or nickname"));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByText("Please write a name, 1 to 20 letters.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Delete/ })).toBeNull();
  });

  it("home picker: my location names the place; refused or nameless goes to the search", async () => {
    const onChange = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(reverseDelhi))),
    );
    geolocation(true);
    const { unmount } = render(<HomePicker value={null} onChange={onChange} lang="en" />);
    await userEvent.click(screen.getByRole("button", { name: "Use my location" }));
    await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ lat: 28.5594, countryCode: "IN" })));
    unmount();
    geolocation(false);
    render(<HomePicker value={{ name: "Green Park", lat: 1, lon: 1, countryCode: null }} onChange={onChange} lang="en" error="x" />);
    await userEvent.click(screen.getByRole("button", { name: "Use my location" }));
    expect(await screen.findByText("We'll use the area you pick. You can change it any time.")).toBeInTheDocument();
    expect(screen.getByText("Home area: Green Park")).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toHaveFocus();
  });

  it("family details: a home change, a bad name and a failed save", async () => {
    stubFetch({ error: { code: "x", message: "x" } }, 500);
    render(<FamilyDetailsForm name="Sharma family" placeName="Green Park" homeSetup={null} lang="en" />);
    await userEvent.click(within(screen.getByRole("group", { name: "AC or fan with fresh-air vent" })).getByRole("radio", { name: "Yes" }));
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("Something went wrong. Try again.")).toBeInTheDocument();
    await userEvent.clear(screen.getByRole("textbox", { name: "Family name" }));
    expect(screen.getByText("Please write a family name, 1 to 40 letters.")).toBeInTheDocument();
    expect(homeSetupSummary({ ...BLANK_HOME, roadFacing: "yes" }, "en")).toContain("Windows face a busy road: Yes");
  });
});

describe("page edges", () => {
  it("Today with an old reading and a Severe hour ahead shows both notes", async () => {
    const { app, viewer } = await sharmaApp();
    const page = await loadToday(await viewer("neha"), app.deps);
    const day = page.air.day;
    if (!day) throw new Error("no day");
    render(
      <TodayView
        page={{ ...page, joinCards: [], air: { ...page.air, stationNote: false, day: { ...day, freshness: "old", severeDay: true } } }}
        appOrigin=""
        lang="en"
      />,
    );
    expect(screen.getByText(/This air reading is from/)).toBeInTheDocument();
    expect(screen.getByText(/GRAP/)).toBeInTheDocument();
    expect(removalOf(page.family, "ghost")).toEqual({ uid: "ghost", name: "", familyName: "Sharma family", dependents: [] });
  });

  it("member plan: mostly stays in with the best window, and no data", async () => {
    const { app, viewer } = await sharmaApp();
    const page = await loadMember(await viewer("neha"), "neha", app.deps);
    if (!page?.plan || !page.air.day) throw new Error("no page");
    const { unmount } = render(<MemberView page={{ ...page, plan: { ...page.plan, items: [] } }} lang="en" />);
    expect(screen.getByText(/Neha mostly stays in\. Good time to step out:/)).toBeInTheDocument();
    unmount();
    render(
      <MemberView
        page={{ ...page, plan: null, air: { ...page.air, day: { ...page.air.day, summary: { ...page.air.day.summary, best: null } } } }}
        lang="en"
      />,
    );
    expect(screen.getByText("Neha mostly stays in.")).toBeInTheDocument();
    render(<MemberView page={{ ...page, air: { ...page.air, setupVerdict: null } }} lang="en" />);
    expect(screen.getByText("We can't get the air data right now. We won't guess.")).toBeInTheDocument();
  });

  it("kid card shows checklist items that passed the kid-card checks", async () => {
    const { app, riya, viewer } = await sharmaApp();
    const page = await loadKidCard(await viewer("neha"), riya, app.deps);
    if (!page?.kid) throw new Error("no card");
    render(
      <KidCardView
        kid={{ ...page.kid, checklist: [{ id: "a", text: "Carry your water bottle", addedByName: "Rahul", done: false, onCard: true }] }}
        lang="hi"
        pageLang="en"
      />,
    );
    expect(screen.getByText("Carry your water bottle")).toBeInTheDocument();
    expect(screen.getByText("· Rahul ने जोड़ा")).toBeInTheDocument();
  });

  it("invite page: too many looks from one network, and Sign in for an unknown code", () => {
    const out = { signedIn: false, onboarded: false, familyName: null };
    const { rerender } = render(
      <InvitePreviewView preview={{ kind: "rate_limited" }} viewer={out} error={null} validTill={null} lang="en" />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Too many tries from this network.");
    rerender(<InvitePreviewView preview={{ kind: "not_found" }} viewer={out} error={null} validTill={null} lang="en" />);
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/sign-in");
    rerender(
      <InvitePreviewView
        preview={{ kind: "valid", code: "K7PM4QXT", familyName: "Sharma family", adminName: "Neha", expiresAt: "x" }}
        viewer={out}
        error="full"
        validTill={null}
        lang="en"
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Sharma family is full. Ask Neha to make space.");
  });
});
