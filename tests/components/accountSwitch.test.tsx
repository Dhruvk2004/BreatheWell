import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SignInCta } from "@/components/air/SignInCta";
import { Basics } from "@/components/breezy/FixedNotes";
import { AccountMenu } from "@/components/shell/AccountMenu";
import { apiRequest } from "@/client/api";
import { announceAccountChange } from "@/client/accountEvents";
import { z } from "zod";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }) }));

afterEach(() => {
  document.cookie = "bw-acct=; Max-Age=0";
});

describe("signed-in state follows the cookie without a reload", () => {
  it("the header swaps Sign in for the avatar once sign-in sets the cookie, and back on sign-out", () => {
    render(<AccountMenu lang="en" />);
    expect(screen.getByRole("link", { name: "Sign in" })).toBeInTheDocument();
    act(() => {
      document.cookie = "bw-acct=DK";
      announceAccountChange();
    });
    expect(screen.queryByRole("link", { name: "Sign in" })).toBeNull();
    expect(screen.getByRole("button", { name: /account/i })).toHaveTextContent("DK");
    act(() => {
      document.cookie = "bw-acct=; Max-Age=0";
      announceAccountChange();
    });
    expect(screen.getByRole("link", { name: "Sign in" })).toBeInTheDocument();
  });

  it("re-checks when the tab comes back into view", () => {
    render(<AccountMenu lang="en" />);
    act(() => {
      document.cookie = "bw-acct=NS";
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(screen.getByRole("button", { name: /account/i })).toHaveTextContent("NS");
  });

  it("every write through the API announces a possible change; reads do not", async () => {
    const heard = vi.fn();
    window.addEventListener("bw-account-changed", heard);
    const fetcher = vi.fn(async () => Response.json({}));
    await apiRequest("/api/x", z.unknown(), {}, fetcher);
    expect(heard).not.toHaveBeenCalled();
    await apiRequest("/api/session", z.unknown(), { method: "POST", body: {} }, fetcher);
    expect(heard).toHaveBeenCalledTimes(1);
    window.removeEventListener("bw-account-changed", heard);
  });

  it("Air now's card offers today's plan to a signed-in visitor, and sign-in to everyone else", () => {
    const { unmount } = render(<SignInCta lang="en" />);
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/sign-in");
    expect(screen.getByRole("link", { name: "See a sample family" })).toBeInTheDocument();
    unmount();
    document.cookie = "bw-acct=DK";
    render(<SignInCta lang="hi" />);
    expect(screen.getByRole("heading", { name: "आज की आपकी पारिवारिक योजना" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "आज की योजना खोलें" })).toHaveAttribute("href", "/today");
    expect(screen.queryByRole("link", { name: "साइन इन करें" })).toBeNull();
  });
});

describe("Breezy's basics", () => {
  it("keep the name, verdict and line apart when copied or read aloud", () => {
    const { container } = render(
      <Basics basics={[{ id: "a", name: "Dhruv", verdict: "go", line: "Walk at 8 pm: go as planned." }]} lang="en" />,
    );
    expect(container.querySelector("li")?.textContent).toMatch(/^Dhruv: .*Go.*\. Walk at 8 pm/);
  });
});
