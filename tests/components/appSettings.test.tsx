import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InviteView } from "@/components/family/InviteView";
import { ProfileView } from "@/components/profile/ProfileView";
import { SettingsView } from "@/components/settings/SettingsView";
import { loadProfile, loadSettingsPage } from "@/server/app/accountPages";
import { loadInvite } from "@/server/app/invitePages";
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
  return within(dialog);
};

describe("Family settings", () => {
  it("gives the admin the details form, members with how they joined, children and the danger zone", async () => {
    const { app, viewer } = await sharmaApp();
    const { page, joinedAt, code } = await loadSettingsPage(await viewer("neha"), app.deps, "en");
    render(<SettingsView page={page} joinedAt={joinedAt} code={code} lang="en" />);
    expect(screen.getByRole("textbox", { name: "Family name" })).toHaveValue("Sharma family");
    expect(screen.getByText("Neha (you) · Admin")).toBeInTheDocument();
    expect(screen.getByText("18–59 · Joined via code, Mon, 18 Nov, 6:10 am")).toBeInTheDocument();
    expect(screen.getByText(/still setting up/)).toBeInTheDocument();
    expect(screen.getByText("Under 13 · added by Rahul")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete family" })).toBeDisabled();
    const fetcher = stubFetch();
    await userEvent.click(screen.getByRole("radio", { name: "In several rooms" }));
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(JSON.parse(String((fetcher.mock.calls[0] as unknown as [string, RequestInit])[1].body))).toMatchObject({
      name: "Sharma family",
      homeSetup: { purifier: "several" },
    });
    expect(await screen.findByText("Saved.")).toBeInTheDocument();
  });

  it("is read-only for other adults, with the home set-up in words", async () => {
    const { app, viewer } = await sharmaApp();
    const { page, joinedAt, code } = await loadSettingsPage(await viewer("rahul"), app.deps, "en");
    render(<SettingsView page={page} joinedAt={joinedAt} code={code} lang="en" />);
    expect(screen.getByText("Only the family admin can change these settings.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Remove/ })).toBeNull();
    expect(screen.getByText(/Air purifier: In one room/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Edit" })).toBeInTheDocument();
  });

  it("deletes the family only after the typed name", async () => {
    const { app, viewer } = await sharmaApp();
    const { page, joinedAt } = await loadSettingsPage(await viewer("neha"), app.deps, "en");
    const alone = { ...page, family: { ...page.family, people: page.family.people.filter((p) => p.id === "neha") } };
    render(<SettingsView page={alone} joinedAt={joinedAt} code={null} lang="en" />);
    await userEvent.click(screen.getByRole("button", { name: "Delete family" }));
    const sheet = openDialog();
    const confirm = sheet.getByRole("button", { name: "Delete family", hidden: true });
    expect(confirm).toBeDisabled();
    await userEvent.type(sheet.getByRole("textbox", { name: "Family name", hidden: true }), "sharma family");
    stubFetch({ error: { code: "name_mismatch", message: "x" } }, 400);
    await userEvent.click(confirm);
    expect(await sheet.findByText("Type the family name exactly to confirm.")).toBeInTheDocument();
    stubFetch();
    await userEvent.click(confirm);
    expect(router.replace).toHaveBeenCalledWith("/onboarding");
  });
});

describe("Profile", () => {
  it("lets a member leave (naming the children that go too) and blocks the admin with members", async () => {
    const { app, viewer } = await sharmaApp();
    const rahul = await loadProfile(await viewer("rahul"), app.deps);
    if (!rahul) throw new Error("no profile");
    const { unmount } = render(<ProfileView page={rahul} lang="en" />);
    expect(screen.getByText("Sharma family · Member")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Riya" })).toHaveAttribute("href", expect.stringMatching(/^\/dependent\//));
    await userEvent.click(screen.getByRole("button", { name: "Leave family" }));
    expect(openDialog().getByText("The children and teens you added are deleted too: Riya.")).toBeInTheDocument();
    const fetcher = stubFetch();
    await userEvent.click(openDialog().getByRole("button", { name: "Leave", hidden: true }));
    expect(fetcher).toHaveBeenCalledWith("/api/family/leave", expect.anything());
    unmount();
    const neha = await loadProfile(await viewer("neha"), app.deps);
    if (!neha) throw new Error("no profile");
    render(<ProfileView page={neha} lang="en" />);
    expect(screen.getByRole("button", { name: "Leave family" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Leave family" })).toHaveAccessibleDescription(
      "You're the admin. Remove the other members first, or delete the family.",
    );
    expect(screen.getByRole("button", { name: "Delete my account" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Delete my account" })).toHaveAccessibleDescription(
      "You're the admin. Remove the other members first, or delete the family.",
    );
  });

  it("a lone admin's delete confirm says the family and the children go too", async () => {
    const { app, viewer } = await sharmaApp();
    const neha = await loadProfile(await viewer("neha"), app.deps);
    if (!neha) throw new Error("no profile");
    render(<ProfileView page={{ ...neha, mustStay: false, dependents: [{ id: "d1", name: "Riya" }] }} lang="en" />);
    await userEvent.click(screen.getByRole("button", { name: "Delete my account" }));
    expect(openDialog().getByText("Sharma family is deleted too, because you're its only adult.")).toBeInTheDocument();
    expect(openDialog().getByText("The children and teens you added are deleted too: Riya.")).toBeInTheDocument();
  });

  it("deletes the account after the confirm and goes home", async () => {
    const { app, viewer } = await sharmaApp();
    const rahul = await loadProfile(await viewer("rahul"), app.deps);
    if (!rahul) throw new Error("no profile");
    render(<ProfileView page={{ ...rahul, familyName: null, dependents: [] }} lang="en" />);
    expect(screen.getByRole("link", { name: "Start or join a family" })).toHaveAttribute("href", "/onboarding");
    stubFetch({ error: { code: "x", message: "x" } }, 500);
    await userEvent.click(screen.getByRole("button", { name: "Delete my account" }));
    await userEvent.click(openDialog().getByRole("button", { name: "Delete my account", hidden: true }));
    expect(await openDialog().findByText("Something went wrong. Try again.")).toBeInTheDocument();
    stubFetch();
    await userEvent.click(openDialog().getByRole("button", { name: "Delete my account", hidden: true }));
    expect(router.replace).toHaveBeenCalledWith("/");
  });
});

describe("Invite", () => {
  it("shows the code, a QR of the link, Copy link, full screen and Make a new code", async () => {
    const { app, viewer } = await sharmaApp();
    const page = await loadInvite(await viewer("neha"), app.deps, "https://app.test");
    expect(page?.joinUrl).toMatch(/^https:\/\/app\.test\/join\/[A-Z0-9]{8}$/);
    if (!page?.code) throw new Error("no invite");
    render(<InviteView {...page} validTill="Tue, 19 Nov, 6:10 am" lang="en" />);
    expect(screen.getAllByText(`${page.code.slice(0, 4)}-${page.code.slice(4)}`)[0]).toBeInTheDocument();
    expect(screen.getAllByText("valid till Tue, 19 Nov, 6:10 am · up to 8 people")).toHaveLength(2);
    const qr = screen.getAllByRole("img", { name: "QR code for the join link" })[0];
    await vi.waitFor(() => expect(qr.querySelector("path")?.getAttribute("d")).toMatch(/^M\d/));
    await userEvent.click(screen.getByRole("button", { name: "Show QR full screen" }));
    expect(openDialog().getByText("Scan to join Sharma family")).toBeInTheDocument();
    await userEvent.click(openDialog().getByRole("button", { name: "Close", hidden: true }));
    const fetcher = stubFetch({ code: "ABCDEFGH", expiresAt: "x" });
    await userEvent.click(screen.getByRole("button", { name: "Make a new code" }));
    expect(openDialog().getByText(/will stop working/)).toBeInTheDocument();
    await userEvent.click(openDialog().getByRole("button", { name: "Make code", hidden: true }));
    expect(fetcher).toHaveBeenCalledWith("/api/family/code", expect.anything());
    expect(router.refresh).toHaveBeenCalled();
  });

  it("says when there is no working code", () => {
    render(<InviteView familyName="Sharma family" code={null} validTill={null} joinUrl={null} lang="hi" />);
    expect(screen.getByText("अभी कोई चालू कोड नहीं है। लोगों को बुलाने के लिए नया कोड बनाएँ।")).toBeInTheDocument();
  });
});
