import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthClient } from "@/client/auth";
import { GoogleSignIn } from "@/components/auth/GoogleSignIn";
import { SignInView } from "@/components/auth/SignInView";
import { InvitePreviewView } from "@/components/family/InvitePreviewView";
import { JoinForm } from "@/components/family/JoinForm";
import { AccountMenu } from "@/components/shell/AccountMenu";
import { SignedInShell } from "@/components/shell/SignedInShell";
import { installDialog, stubFetch } from "../helpers/dom";

const router = { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));
beforeEach(() => {
  installDialog();
  Object.values(router).forEach((f) => f.mockReset());
});
afterEach(() => {
  document.cookie = "bw-acct=; Max-Age=0";
  vi.unstubAllGlobals();
});

function fakeClient(result: Awaited<ReturnType<AuthClient["popup"]>>) {
  return {
    preload: vi.fn(),
    popup: vi.fn(async () => result),
    redirect: vi.fn(async () => undefined),
    completeRedirect: vi.fn(async () => null),
  } as unknown as AuthClient;
}
const OK = {
  ok: true as const,
  state: { onboarded: false, hasFamily: false },
  pending: { adultConfirmed: true as const, joinCode: null, next: null },
};

describe("Sign-in (spec 10.4)", () => {
  it("keeps Continue disabled until the 18+ tick, with the reason written", async () => {
    const client = fakeClient(OK);
    render(<GoogleSignIn lang="en" buttonLabel="Continue with Google" client={client} />);
    const button = screen.getByRole("button", { name: "Continue with Google" });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription("Tick the box above to continue.");
    expect(screen.getByText("मेरी उम्र 18 या ज़्यादा है")).toHaveAttribute("lang", "hi");
    await userEvent.click(screen.getByRole("checkbox", { name: /I am 18 or older/ }));
    await userEvent.click(button);
    expect(client.popup).toHaveBeenCalledWith(expect.objectContaining({ adultConfirmed: true }));
    expect(router.push).toHaveBeenCalledWith("/onboarding");
  });

  it("'I'm under 18' explains and signs nothing in", async () => {
    const client = fakeClient(OK);
    render(<GoogleSignIn lang="en" buttonLabel="Continue with Google" client={client} />);
    await userEvent.click(screen.getByRole("button", { name: "I'm under 18" }));
    expect(screen.getByText(/Ask a parent to add you to their family/)).toBeInTheDocument();
    expect(client.popup).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeDisabled();
  });

  it("says a failed sign-in did not finish; a blocked popup offers this tab", async () => {
    const failed = fakeClient({ ok: false, reason: "failed" });
    render(<GoogleSignIn lang="en" buttonLabel="Go" client={failed} />);
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(screen.getByRole("button", { name: "Go" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Sign-in didn't finish. Try again.");
    const blocked = fakeClient({ ok: false, reason: "popup_blocked" });
    render(<GoogleSignIn lang="en" buttonLabel="Again" client={blocked} />);
    await userEvent.click(screen.getAllByRole("checkbox")[1]);
    await userEvent.click(screen.getByRole("button", { name: "Again" }));
    await userEvent.click(screen.getByRole("button", { name: "Continue in this tab" }));
    expect(blocked.redirect).toHaveBeenCalled();
  });

  it("opened inside Instagram: Open in Chrome and Copy link, in both languages", () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue("Mozilla/5.0 (Linux; Android 14) Instagram 300");
    render(<GoogleSignIn lang="hi" buttonLabel="Go" client={fakeClient(OK)} />);
    expect(screen.getByRole("heading", { name: "साइन इन के लिए Chrome में खोलें" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Chrome में खोलें · Open in Chrome/ })).toHaveAttribute(
      "href",
      expect.stringMatching(/^intent:\/\//),
    );
    expect(screen.queryByRole("button", { name: "Go" })).toBeNull();
  });

  it("without Firebase says sign-in isn't configured and points to the public pages", () => {
    render(<SignInView lang="en" configured={false} next={null} />);
    expect(screen.getByText("Sign-in isn't configured on this deployment.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See the sample family" })).toHaveAttribute("href", "/demo");
    expect(screen.getByText(/BreatheWell accounts are for adults \(18\+\)/)).toBeInTheDocument();
  });
});

describe("Join (spec 10.7, 5.11)", () => {
  const signedOut = { signedIn: false, onboarded: false, familyName: null };
  const valid = { kind: "valid" as const, code: "K7PM4QXT", familyName: "Sharma family", adminName: "Neha", expiresAt: "x" };

  it("names the family only for a checked code, with the tick and Sign in to join", () => {
    render(<InvitePreviewView preview={valid} viewer={signedOut} error={null} validTill="Tue, 19 Nov, 6:10 pm" lang="en" />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Neha invited you to Sharma family on BreatheWell.");
    expect(screen.getByRole("button", { name: "Sign in with Google to join" })).toBeDisabled();
    expect(screen.getByText("Code K7PM-4QXT · valid till Tue, 19 Nov, 6:10 pm")).toBeInTheDocument();
  });

  it("shows expired, not configured and a returned error", () => {
    const { rerender } = render(
      <InvitePreviewView preview={{ kind: "expired", adminName: "Neha" }} viewer={signedOut} error={null} validTill={null} lang="en" />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("This code has expired. Ask Neha for a new one.");
    rerender(<InvitePreviewView preview={{ kind: "not_configured" }} viewer={signedOut} error={null} validTill={null} lang="en" />);
    expect(screen.getByText("Sign-in isn't configured on this deployment.")).toBeInTheDocument();
    rerender(
      <InvitePreviewView
        preview={valid}
        viewer={{ signedIn: true, onboarded: true, familyName: "Kulkarni family" }}
        error="in_other_family"
        validTill="x"
        lang="en"
      />,
    );
    expect(screen.getByText(/You're already in Kulkarni family/)).toBeInTheDocument();
    expect(screen.getByLabelText("Enter code")).toHaveValue("K7PM-4QXT");
    rerender(
      <InvitePreviewView
        preview={{ kind: "not_found" }}
        viewer={{ signedIn: true, onboarded: true, familyName: null }}
        error={null}
        validTill={null}
        lang="en"
      />,
    );
    expect(screen.getByLabelText("Enter code")).toHaveValue("");
  });

  it("joins with a typed code and shows each server error in place", async () => {
    const fetcher = stubFetch({ kind: "joined", familyName: "Sharma family" });
    const { unmount } = render(<JoinForm lang="en" onboarded={false} />);
    await userEvent.type(screen.getByLabelText("Enter code"), "k7pm-4qx");
    await userEvent.click(screen.getByRole("button", { name: "Join" }));
    expect(screen.getByRole("alert")).toHaveTextContent("We couldn't find that code.");
    expect(fetcher).not.toHaveBeenCalled();
    await userEvent.type(screen.getByLabelText("Enter code"), "t");
    await userEvent.click(screen.getByRole("button", { name: "Join" }));
    expect(router.push).toHaveBeenCalledWith("/onboarding");
    unmount();
    stubFetch({ kind: "full", familyName: "Sharma family", adminName: "Neha" }, 409);
    render(<JoinForm lang="en" initialCode="K7PM-4QXT" onboarded />);
    await userEvent.click(screen.getByRole("button", { name: "Join" }));
    expect(await screen.findByText("Sharma family is full. Ask Neha to make space.")).toBeInTheDocument();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Promise.reject(new Error("offline"))),
    );
    await userEvent.click(screen.getByRole("button", { name: "Join" }));
    expect(await screen.findByText(/couldn't reach BreatheWell/)).toBeInTheDocument();
  });
});

describe("avatar menu and app navigation", () => {
  it("shows Sign in, or the initials with Profile · Family · Privacy · Sign out", async () => {
    const { unmount } = render(<AccountMenu lang="en" />);
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/sign-in");
    unmount();
    document.cookie = "bw-acct=NS";
    render(<AccountMenu lang="en" />);
    const avatar = screen.getByRole("button", { name: "Account menu" });
    await userEvent.click(avatar);
    expect(avatar).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: "Family" })).toHaveAttribute("href", "/family/settings");
    await userEvent.keyboard("{Escape}");
    expect(avatar).toHaveAttribute("aria-expanded", "false");
    expect(avatar).toHaveFocus();
    const fetcher = stubFetch();
    await userEvent.click(avatar);
    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(fetcher).toHaveBeenCalledWith("/api/session", expect.objectContaining({ method: "DELETE" }));
    expect(router.replace).toHaveBeenCalledWith("/");
  });

  it("marks the current section in the app bar", () => {
    render(
      <SignedInShell lang="hi" here="today">
        <p>x</p>
      </SignedInShell>,
    );
    for (const link of screen.getAllByRole("link", { name: "आज" })) expect(link).toHaveAttribute("aria-current", "page");
    // A top nav from 768 px and a bottom bar on phones; CSS shows one, and DOM order stays visual order.
    const [top, bottom] = screen.getAllByRole("navigation", { name: "आपका परिवार" });
    expect(top).toHaveClass("hidden", "md:block");
    expect(bottom).toHaveClass("sticky", "bottom-0", "md:hidden");
    expect(top.compareDocumentPosition(screen.getByText("x")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
