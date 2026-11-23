import { render, screen, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SiteFooter } from "@/components/shell/SiteFooter";
import { SiteHeader } from "@/components/shell/SiteHeader";
import { SkipLink } from "@/components/shell/SkipLink";
import { Main } from "@/components/shell/Main";
import { ErrorPanel } from "@/components/system/ErrorPanel";
import { NotFound } from "@/components/system/NotFound";
import GlobalError from "@/app/global-error";

const params = vi.hoisted(() => ({ lang: "hi" as string | undefined }));
vi.mock("next/navigation", () => ({ useParams: () => params }));

afterEach(() => {
  document.cookie = "bw-lang=; Max-Age=0; Path=/";
});

describe("header (design header pattern)", () => {
  it("offers the other language in its own script, saves it and reloads into it", async () => {
    const reload = vi.fn();
    vi.stubGlobal("location", { protocol: "http:", reload });
    render(<SiteHeader lang="en" />);
    const toHindi = screen.getByRole("button", { name: /^Switch to Hindi/ });
    expect(within(toHindi).getByText("हिंदी")).toHaveAttribute("lang", "hi");
    await userEvent.click(toHindi);
    expect(document.cookie).toContain("bw-lang=hi");
    expect(reload).toHaveBeenCalledOnce();
  });

  it("renders in Hindi with the switch back to English", () => {
    render(<SiteHeader lang="hi" />);
    expect(screen.getByRole("link", { name: "साइन इन करें" })).toHaveAttribute("href", "/sign-in");
    expect(within(screen.getByRole("button", { name: /^अंग्रेज़ी में देखें/ })).getByText("English")).toHaveAttribute("lang", "en");
  });

  it("has no text-size control; the wordmark and the language switch are the only header items", () => {
    render(<SiteHeader lang="en" />);
    expect(screen.getByRole("link", { name: "BreatheWell home" }).querySelector(".wordmark")).toHaveTextContent("BreatheWell");
    expect(screen.queryByRole("button", { name: /Text size/ })).toBeNull();
    expect(screen.queryByText("Aa")).toBeNull();
  });
});

describe("footer, skip link and main", () => {
  it("lists Privacy, About the data, the Open-Meteo credit and the 18+ note", () => {
    render(<SiteFooter lang="en" />);
    const footer = screen.getByRole("navigation", { name: "Footer" });
    expect(within(footer).getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/privacy");
    expect(within(footer).getByRole("link", { name: "Data: Open-Meteo" })).toHaveAttribute("rel", "noopener noreferrer");
    expect(footer).toHaveTextContent("For adults (18+)");
    // On phones the header hides its page links, so the footer carries them (hidden from md up).
    expect(within(footer).getByRole("link", { name: "Sample family" })).toHaveClass("md:hidden");
    expect(within(footer).getByRole("link", { name: "Air now" })).toHaveAttribute("href", "/air");
  });

  it("skips to the main landmark", () => {
    render(
      <>
        <SkipLink lang="en" />
        <Main>content</Main>
      </>,
    );
    expect(screen.getByRole("link", { name: "Skip to main content" })).toHaveAttribute("href", "#main");
    expect(screen.getByRole("main")).toHaveAttribute("id", "main");
  });
});

describe("system pages", () => {
  it("renders the 404 and the error boundary with Try again", async () => {
    const retry = vi.fn();
    render(
      <>
        <NotFound lang="en" />
        <ErrorPanel lang="en" onRetry={retry} />
      </>,
    );
    expect(screen.getByRole("heading", { name: "We couldn't find this page." })).toBeInTheDocument();
    expect(screen.getByText("यह पेज नहीं मिला।")).toHaveAttribute("lang", "hi");
    expect(screen.getByRole("link", { name: /Check the air/ })).toHaveAttribute("href", "/air");
    expect(screen.getByRole("alert")).toHaveTextContent("Your data is safe.");
    expect(screen.getByRole("alert")).toHaveTextContent("आपका डेटा सुरक्षित है।");
    await userEvent.click(screen.getByRole("button", { name: /Try again/ }));
    expect(retry).toHaveBeenCalledOnce();
  });
});

describe("global error (root layout failed, spec 10.17)", () => {
  it("brings its own document in the URL's language with both languages' message", () => {
    const html = renderToString(<GlobalError error={new Error("x")} retry={() => undefined} />);
    expect(html).toMatch(/^<html lang="hi"/);
    expect(html).toContain("आपका डेटा सुरक्षित है।");
    expect(html).toContain("Your data is safe.");
    params.lang = undefined;
    expect(renderToString(<GlobalError error={null} retry={() => undefined} />)).toMatch(/^<html lang="en"/);
  });
});
