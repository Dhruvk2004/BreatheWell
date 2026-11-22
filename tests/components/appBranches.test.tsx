import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthClient } from "@/client/auth";
import { GoogleSignIn } from "@/components/auth/GoogleSignIn";
import { InAppScreen } from "@/components/auth/InAppScreen";
import { SignInView } from "@/components/auth/SignInView";
import { CreateFamily } from "@/components/family/CreateFamily";
import { InviteView, inviteShareText } from "@/components/family/InviteView";
import { JoinForm } from "@/components/family/JoinForm";
import { SettingsView } from "@/components/settings/SettingsView";
import { TodayView } from "@/components/today/TodayView";
import { loadSettingsPage } from "@/server/app/accountPages";
import { loadMember, loadToday } from "@/server/app/todayPage";
import { MemberView } from "@/components/member/MemberView";
import { addRiya, RIYA } from "../helpers/family";
import geocodePune from "../fixtures/api/geocode-pune.json";
import { installDialog, sharmaApp, stubFetch } from "../helpers/dom";

const router = { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));
beforeEach(() => {
  installDialog();
  Object.values(router).forEach((f) => f.mockReset());
});
const openDialog = () => {
  const dialog = screen.getAllByRole("dialog", { hidden: true }).find((d) => d.hasAttribute("open"));
  if (!dialog) throw new Error("no open dialog");
  return dialog;
};

/** The less common states of the signed-in screens (spec 10.4–10.8, 10.14). */
describe("sign-in states", () => {
  it("finishes a redirect that came back, and renders in Hindi with English beside it", async () => {
    const client = {
      preload: vi.fn(),
      popup: vi.fn(),
      redirect: vi.fn(),
      completeRedirect: vi.fn(async () => ({
        ok: true as const,
        state: { onboarded: true, hasFamily: true },
        pending: { adultConfirmed: true as const, joinCode: null, next: "/family/settings" },
      })),
    } as unknown as AuthClient;
    render(<GoogleSignIn lang="hi" buttonLabel="जारी रखें" client={client} />);
    await vi.waitFor(() => expect(router.push).toHaveBeenCalledWith("/family/settings"));
    expect(screen.getByText("I am 18 or older")).toHaveAttribute("lang", "en");
  });

  it("shows the in-app screen in English with Hindi beside it, and sign-in in Hindi", () => {
    render(<InAppScreen lang="en" href="https://bw.app/join/K7PM4QXT" userAgent="WhatsApp/2.0 Android" />);
    expect(screen.getByRole("heading", { name: "Open in Chrome to sign in" })).toBeInTheDocument();
    render(<SignInView lang="hi" configured next={null} />);
    expect(screen.getByRole("checkbox", { name: /मेरी उम्र 18 या ज़्यादा है/ })).toBeInTheDocument();
  });
});

describe("invite and join states", () => {
  it("says when a new code could not be made, and writes the share text in both languages for Hindi", async () => {
    render(<InviteView familyName="Sharma family" code="K7PM4QXT" validTill="x" joinUrl="https://bw.app/join/K7PM4QXT" lang="en" />);
    stubFetch({ error: { code: "x", message: "x" } }, 500);
    await userEvent.click(screen.getByRole("button", { name: "Make a new code" }));
    await userEvent.click(within(openDialog()).getByRole("button", { name: "Make code", hidden: true }));
    expect(await screen.findByText("Something went wrong. Try again.")).toBeInTheDocument();
    const vars = { url: "https://bw.app/join/K7PM4QXT", code: "K7PM-4QXT", time: "x" };
    const [hindi, english] = inviteShareText("hi", vars).split("\n");
    expect(hindi).toMatch(/^BreatheWell पर हमारे परिवार से जुड़ें/);
    expect(english).toBe(inviteShareText("en", vars));
  });

  it("goes to Today for an existing member, and offers Profile when already in another family", async () => {
    stubFetch({ kind: "already_member", familyName: "Sharma family" });
    const { unmount } = render(<JoinForm lang="en" initialCode="K7PM-4QXT" onboarded={false} />);
    await userEvent.click(screen.getByRole("button", { name: "Join" }));
    expect(router.push).toHaveBeenCalledWith("/today");
    unmount();
    stubFetch({ kind: "in_other_family", familyName: "Kulkarni family" }, 409);
    render(<JoinForm lang="en" initialCode="K7PM-4QXT" onboarded />);
    await userEvent.click(screen.getByRole("button", { name: "Join" }));
    expect(await screen.findByText(/Kulkarni family/)).toBeInTheDocument();
  });
});

describe("create family failures", () => {
  it("says when the person is already in a family, or the save failed", async () => {
    const reply = { status: 409, body: { error: { code: "in_family", message: "x" } } };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.includes("geocoding")
          ? new Response(JSON.stringify(geocodePune))
          : new Response(JSON.stringify(reply.body), { status: reply.status }),
      ),
    );
    render(<CreateFamily lang="en" />);
    await userEvent.type(screen.getByLabelText("Family name"), "Sharma family");
    await userEvent.type(screen.getByRole("combobox"), "Pune");
    await userEvent.click((await screen.findAllByRole("option", { name: /Pune/ }))[0]);
    await userEvent.click(screen.getByRole("button", { name: "Create family" }));
    expect(await screen.findByText(/already in a family/)).toBeInTheDocument();
    Object.assign(reply, { status: 500, body: { error: { code: "x", message: "x" } } });
    await userEvent.click(screen.getByRole("button", { name: "Create family" }));
    expect(await screen.findByText("Something went wrong. Try again.")).toBeInTheDocument();
    expect(router.push).not.toHaveBeenCalled();
  });
});

describe("Today and settings for other viewers", () => {
  it("shows the viewer's own 'still setting up' row with You and no Remind", async () => {
    const { app, viewer } = await sharmaApp();
    render(<TodayView page={await loadToday(await viewer("dadaji"), app.deps)} appOrigin="https://app.test" lang="en" />);
    expect(screen.getByText("Ramesh is still setting up")).toBeInTheDocument();
    expect(screen.getByText("You")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Remind/ })).toBeNull();
  });

  it("skips a planned row whose person has just left the family", async () => {
    const { app, viewer } = await sharmaApp();
    const page = await loadToday(await viewer("neha"), app.deps);
    const people = page.family.people.filter((p) => p.id !== "rahul");
    render(<TodayView page={{ ...page, family: { ...page.family, people } }} appOrigin="https://app.test" lang="en" />);
    expect(screen.queryByRole("link", { name: "Rahul's plan" })).toBeNull();
    expect(screen.getByRole("link", { name: "Neha's plan" })).toBeInTheDocument();
  });

  it("reads children as view-only for a member who did not add them, and says a delete failed", async () => {
    const { app, viewer } = await sharmaApp();
    const { page, joinedAt } = await loadSettingsPage(await viewer("dadaji"), app.deps, "en");
    const { unmount } = render(<SettingsView page={page} joinedAt={{}} code={null} lang="en" />);
    expect(screen.getByText(/you can view, tick and add items/)).toBeInTheDocument();
    unmount();
    const neha = await loadSettingsPage(await viewer("neha"), app.deps, "en");
    const alone = { ...neha.page, family: { ...neha.page.family, people: neha.page.family.people.filter((p) => p.id === "neha") } };
    render(<SettingsView page={alone} joinedAt={joinedAt} code={null} lang="en" />);
    await userEvent.click(screen.getByRole("button", { name: "Delete family" }));
    const sheet = openDialog();
    await userEvent.type(sheet.querySelector("input") as HTMLInputElement, "Sharma family");
    stubFetch({ error: { code: "x", message: "x" } }, 500);
    await userEvent.click(screen.getAllByRole("button", { name: "Delete family", hidden: true }).at(-1) as HTMLElement);
    expect(await screen.findByText("Something went wrong. Try again.")).toBeInTheDocument();
  });
});

describe("Member plan headers", () => {
  it("names a teen's guardian, and a Hindi-reading member without the admin tag", async () => {
    const { app, viewer } = await sharmaApp();
    const aarav = await addRiya(app, "neha", { ...RIYA, name: "Aarav", ageGroup: "13to17" });
    const teen = await loadMember(await viewer("rahul"), aarav, app.deps);
    if (!teen) throw new Error("no page");
    const { unmount } = render(<MemberView page={teen} lang="en" />);
    expect(screen.getByText("Teen · added by Neha")).toBeInTheDocument();
    unmount();
    app.db.docs.set("users/rahul/private/health", { conditions: ["none"], shareWith: "family" });
    const rahul = await loadMember(await viewer("neha"), "rahul", app.deps);
    if (!rahul) throw new Error("no page");
    render(<MemberView page={{ ...rahul, person: { ...rahul.person, language: "hi" } }} lang="en" />);
    expect(screen.getByText("18–59 · हिंदी")).toBeInTheDocument();
    expect(screen.queryByText(/^Health:/)).toBeNull();
  });
});
