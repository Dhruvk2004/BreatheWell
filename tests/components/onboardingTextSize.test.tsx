import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Onboarding } from "@/components/onboarding/Onboarding";
import type { OnboardingPage } from "@/view/app";
import { installDialog, stubFetch } from "../helpers/dom";

const router = { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));
beforeEach(() => installDialog());
afterEach(() => document.documentElement.setAttribute("data-text", "md"));

const FRESH: OnboardingPage = { googleName: "Neha", input: null, hasFamily: false, familyName: null, removedFrom: null };
const next = () => userEvent.click(screen.getByRole("button", { name: "Next" }));
const bodyOf = (fetcher: ReturnType<typeof stubFetch>, i = 0) =>
  JSON.parse(String((fetcher.mock.calls[i] as unknown as [string, RequestInit])[1].body));

/** Text size in onboarding (spec 6.1 item 2, 10.5 "one question per screen in large-text mode"). */
describe("Onboarding text size", () => {
  it("large text asks one question per screen and keeps an explicit Normal (review fix)", async () => {
    document.documentElement.setAttribute("data-text", "lg");
    const fetcher = stubFetch();
    render(<Onboarding page={{ ...FRESH, hasFamily: true, input: null }} lang="en" />);
    expect(screen.getByRole("group", { name: "Language" })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Text size" })).toBeNull();
    expect(screen.getByText("Step 1 of 5")).toBeInTheDocument();
    await next();
    expect(screen.getByRole("radio", { name: "Large" })).toBeChecked();
    expect(screen.queryByLabelText("What does the family call you?")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    await next();
    await userEvent.click(screen.getByRole("radio", { name: "Normal" }));
    expect(document.documentElement.getAttribute("data-text")).toBe("md");
    // Back to the combined screen at Normal size, at the same place (step 1).
    expect(screen.getByLabelText("What does the family call you?")).toBeInTheDocument();
    await next();
    await userEvent.click(screen.getByRole("radio", { name: "18–59" }));
    await next();
    await next();
    await userEvent.click(screen.getByRole("checkbox", { name: "I mostly stay in" }));
    await next();
    await userEvent.click(screen.getByRole("radio", { name: "Metro" }));
    await next();
    await userEvent.click(screen.getByRole("button", { name: "Looks good" }));
    expect(bodyOf(fetcher)).toMatchObject({ textSize: "md" });
  });

  it("60+ makes the screen Large at once (spec 6.1 item 2)", async () => {
    document.documentElement.setAttribute("data-text", "md");
    render(<Onboarding page={{ ...FRESH, hasFamily: true }} lang="en" />);
    await next();
    await userEvent.click(screen.getByRole("radio", { name: /60 or older/ }));
    expect(document.documentElement.getAttribute("data-text")).toBe("lg");
    document.documentElement.setAttribute("data-text", "md");
  });
});
