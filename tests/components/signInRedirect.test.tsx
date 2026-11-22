import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { AuthClient } from "@/client/auth";
import { GoogleSignIn } from "@/components/auth/GoogleSignIn";

const router = { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

function fakeClient(result: Awaited<ReturnType<AuthClient["popup"]>>) {
  return {
    preload: vi.fn(),
    popup: vi.fn(async () => result),
    redirect: vi.fn(async () => null),
    completeRedirect: vi.fn(async () => null),
  } as unknown as AuthClient;
}
const OK = {
  ok: true as const,
  state: { onboarded: false, hasFamily: false },
  pending: { adultConfirmed: true as const, joinCode: null, next: null },
};

/** Sign-in failures never leave "Signing in…" on screen (spec 10.4; review fix). */
describe("Sign-in on a phone", () => {
  it("a phone redirect that cannot start says so instead of spinning (review fix)", async () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue("Mozilla/5.0 (Linux; Android 14; Pixel 7) Mobile Chrome/130");
    const client = fakeClient(OK);
    vi.mocked(client.redirect).mockResolvedValueOnce({ ok: false, reason: "failed" });
    render(<GoogleSignIn lang="en" buttonLabel="Go" client={client} />);
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(screen.getByRole("button", { name: "Go" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Sign-in didn't finish. Try again.");
    vi.mocked(client.redirect).mockRejectedValueOnce(new Error("sdk"));
    await userEvent.click(screen.getByRole("button", { name: "Go" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Sign-in didn't finish. Try again.");
    expect(screen.getByRole("button", { name: "Go" })).toBeEnabled();
    vi.restoreAllMocks();
  });
});
