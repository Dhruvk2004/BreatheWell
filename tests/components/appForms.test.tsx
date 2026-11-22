import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DependentForm } from "@/components/dependent/DependentForm";
import { CreateFamily } from "@/components/family/CreateFamily";
import { Onboarding } from "@/components/onboarding/Onboarding";
import { ProfileEditor } from "@/components/profile/ProfileEditor";
import type { OnboardingPage } from "@/view/app";
import geocodePune from "../fixtures/api/geocode-pune.json";
import { PROFILE, RIYA } from "../helpers/family";
import { installDialog, stubFetch } from "../helpers/dom";

const router = { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));
beforeEach(() => {
  installDialog();
  Object.values(router).forEach((f) => f.mockReset());
});

const FRESH: OnboardingPage = { googleName: "Neha", input: null, hasFamily: false, familyName: null, removedFrom: "Verma family" };
const next = () => userEvent.click(screen.getByRole("button", { name: "Next" }));
const bodyOf = (fetcher: ReturnType<typeof stubFetch>, i = 0) =>
  JSON.parse(String((fetcher.mock.calls[i] as unknown as [string, RequestInit])[1].body));

/** Steps 1–2: the name (an empty one is refused) and the age group. */
async function nameAndAge(): Promise<void> {
  await next();
  expect(screen.getByText("Step 1 of 5")).toBeInTheDocument();
  const name = screen.getByLabelText("What does the family call you?");
  await userEvent.clear(name);
  await next();
  expect(screen.getByText("Please write a name, 1 to 30 letters.")).toBeInTheDocument();
  await userEvent.type(name, "Neha");
  await next();
  await next();
  expect(screen.getByText("Step 2 of 5")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("radio", { name: "18–59" }));
  await next();
}

/** Steps 3–5: health, routine (Back keeps the answers) and travel, up to the summary. */
async function healthRoutineTravel(): Promise<void> {
  await userEvent.click(screen.getByRole("checkbox", { name: "Asthma" }));
  await userEvent.click(screen.getByRole("radio", { name: "Family admin" }));
  await next();
  await userEvent.click(screen.getByRole("checkbox", { name: "Office or work trip" }));
  await userEvent.click(screen.getByRole("radio", { name: "Can move a bit (±2 h)" }));
  await userEvent.click(screen.getByRole("button", { name: "Back" }));
  expect(screen.getByRole("checkbox", { name: "Asthma" })).toBeChecked();
  await next();
  expect(screen.getByRole("radio", { name: "Can move a bit (±2 h)" })).toBeChecked();
  await next();
  await userEvent.click(screen.getByRole("radio", { name: "Two-wheeler" }));
  await userEvent.click(screen.getByRole("checkbox", { name: "Metro" }));
  await next();
}

describe("Onboarding (spec 10.5)", () => {
  it("walks the five steps with Back keeping answers, then saves and goes to Create family", async () => {
    const fetcher = stubFetch();
    render(<Onboarding page={FRESH} lang="en" />);
    expect(screen.getByText("You're no longer in Verma family. Start your own family or join one with a code.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Hi Neha!");
    await nameAndAge();
    await healthRoutineTravel();
    expect(screen.getByText("Health: shared with the family admin")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Looks good" }));
    expect(bodyOf(fetcher)).toMatchObject({
      name: "Neha",
      ageGroup: "18to59",
      conditions: ["asthma"],
      shareWith: "admin",
      activities: [{ type: "office_trip", flex: "some" }],
      travel: { main: "two_wheeler", others: ["metro"] },
    });
    expect(router.push).toHaveBeenCalledWith("/family/new");
  });

  it("60+ takes the quick path in Hindi and joins with a code afterwards", async () => {
    const fetcher = stubFetch();
    render(<Onboarding page={{ ...FRESH, googleName: "Ramesh", removedFrom: null }} lang="hi" />);
    await userEvent.click(screen.getByRole("radio", { name: /मेरे पास जुड़ने का कोड है/ }));
    await userEvent.click(screen.getByRole("button", { name: "आगे" }));
    await userEvent.click(screen.getByRole("button", { name: "आगे" }));
    await userEvent.click(screen.getByRole("radio", { name: /60 या उससे ज़्यादा/ }));
    await userEvent.click(screen.getByRole("button", { name: "आगे" }));
    expect(screen.getByText("3 में से 1")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "आगे" }));
    await userEvent.click(screen.getByRole("radio", { name: "शाम 5–8" }));
    await userEvent.click(screen.getByRole("button", { name: "आगे" }));
    await userEvent.click(screen.getByRole("button", { name: "हो गया" }));
    expect(fetcher).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("radio", { name: "मेट्रो" }));
    await userEvent.click(screen.getByRole("button", { name: "हो गया" }));
    expect(bodyOf(fetcher)).toMatchObject({
      name: "Ramesh",
      ageGroup: "60plus",
      textSize: "lg",
      activities: [{ type: "evening_walk" }],
      travel: { main: "metro" },
    });
    expect(router.push).toHaveBeenCalledWith("/join");
  });

  it("goes to Today for someone who joined first, and says when saving failed", async () => {
    stubFetch({ error: { code: "x", message: "x" } }, 500);
    render(<Onboarding page={{ ...FRESH, hasFamily: true, input: PROFILE }} lang="en" />);
    for (let i = 0; i < 5; i++) await next();
    await userEvent.click(screen.getByRole("button", { name: "Looks good" }));
    expect(await screen.findByText("We couldn't save that. Try again.")).toBeInTheDocument();
  });
});

describe("Create family (spec 10.6)", () => {
  it("needs a name and a home, then saves the rounded place and goes to Invite", async () => {
    const fetcher = vi.fn(
      async (url: string) =>
        new Response(JSON.stringify(url.includes("geocoding") ? geocodePune : { familyId: "f1", code: "K7PM4QXT", expiresAt: "x" })),
    );
    vi.stubGlobal("fetch", fetcher);
    render(<CreateFamily lang="en" />);
    await userEvent.click(screen.getByRole("button", { name: "Create family" }));
    expect(screen.getByText("Please write a family name, 1 to 40 letters.")).toBeInTheDocument();
    expect(screen.getByText("Choose your home area.")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Family name"), "Sharma family");
    await userEvent.type(screen.getByRole("combobox"), "Pune");
    await userEvent.click((await screen.findAllByRole("option", { name: /Pune/ }))[0]);
    expect(screen.getByText(/Home area: Pune/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: "In several rooms" }));
    await userEvent.click(screen.getByRole("button", { name: "Create family" }));
    const sent = JSON.parse(String((fetcher.mock.calls.at(-1) as unknown as [string, RequestInit])[1].body));
    expect(sent).toMatchObject({
      name: "Sharma family",
      home: { name: expect.stringMatching(/^Pune/), countryCode: "IN" },
      homeSetup: { purifier: "several", fuel: "lpg" },
    });
    expect(router.push).toHaveBeenCalledWith("/family/invite");
  });
});

describe("Add a child or teen (spec 10.12)", () => {
  const page = { familyName: "Sharma family", guardianName: "Neha", id: null, input: null, canDelete: false };

  it("fills defaults, shows the guardian note, and saves", async () => {
    const fetcher = stubFetch({ id: "d1" });
    render(<DependentForm page={page} lang="en" />);
    await userEvent.type(screen.getByLabelText("First name or nickname"), "Riya");
    expect(screen.getByText(/You are adding Riya as a parent or guardian/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: "Under 13" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "School trip" }));
    expect(screen.getByLabelText("School trip: time 2")).toHaveValue("13:00");
    await userEvent.click(screen.getByRole("radio", { name: "Cycle" }));
    expect(screen.getByRole("checkbox", { name: "School bus" })).toBeChecked();
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(bodyOf(fetcher)).toMatchObject({
      name: "Riya",
      ageGroup: "under13",
      picks: [{ choice: "school_trip", times: ["07:00", "13:00"] }],
      travel: { main: "cycle", others: ["school_bus", "car"] },
    });
    expect(router.push).toHaveBeenCalledWith("/today");
  });

  it("explains a fifth child, and the edit form deletes after a confirm", async () => {
    stubFetch({ error: { code: "too_many", message: "x" } }, 409);
    render(<DependentForm page={{ ...page, id: "d1", input: RIYA, canDelete: true }} lang="en" />);
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("A family can add up to 4 children or teens in v1.")).toBeInTheDocument();
    const fetcher = stubFetch();
    await userEvent.click(screen.getByRole("button", { name: "Delete Riya's profile" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete", hidden: true }));
    expect(fetcher).toHaveBeenCalledWith("/api/dependent/d1", expect.objectContaining({ method: "DELETE" }));
  });
});

describe("Profile editor (spec 10.15)", () => {
  it("edits with the onboarding editors and saves the full answers", async () => {
    const fetcher = stubFetch();
    render(<ProfileEditor input={{ ...PROFILE, ageGroup: "60plus" }} lang="en" />);
    await userEvent.click(screen.getByRole("checkbox", { name: "Evening walk" }));
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(bodyOf(fetcher).activities.map((a: { type: string }) => a.type)).toEqual(["office_trip", "evening_walk"]);
    expect(await screen.findByText("Saved.")).toBeInTheDocument();
  });
});
