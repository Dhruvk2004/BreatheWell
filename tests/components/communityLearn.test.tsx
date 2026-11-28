import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CommunityLoading, CommunityView } from "@/components/community/CommunityView";
import { Learn } from "@/components/learn/Learn";
import type { CommunityPage } from "@/view/community";

/** The Community page (10.13) and Learn's "Your choices today" (10.11). */
const READY: CommunityPage = {
  kind: "ready",
  place: "Green Park",
  band: "very_poor",
  avg24: 341,
  source: "gemini",
  messages: {
    en: {
      title: "Smog morning",
      header: "Air in Green Park today: Very poor (24-h average ≈ 341)",
      body: "Keep walks indoors.",
      together: "Together today: no burning.",
      footer: "Open-Meteo model data, 7:00 am · Shared via BreatheWell",
    },
    hi: {
      title: null,
      header: "ग्रीन पार्क में आज की हवा: बहुत खराब",
      body: "सैर घर के अंदर करें।",
      together: "आज मिलकर: कुछ न जलाएँ।",
      footer: "Open-Meteo मॉडल डेटा",
    },
  },
};

describe("CommunityView", () => {
  it("shows both languages with lang, the copy buttons, WhatsApp and the AI label", () => {
    render(<CommunityView page={READY} lang="en" />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Today's message for Green Park");
    expect(screen.getByText("Very poor · 24-h average 341")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Hindi" })).toHaveAttribute("lang", "hi");
    for (const name of ["Copy English", "Copy Hindi", "Copy both"]) expect(screen.getByRole("button", { name })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Send on WhatsApp" }).getAttribute("href")).toContain("wa.me");
    expect(screen.getByText("Made by BreatheWell assistant (Google Gemini) · header and footer from code")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/cigarette/i);
  });

  it("labels the template, and covers the empty states and the skeleton", () => {
    const { rerender } = render(<CommunityView page={{ ...READY, source: "template" }} lang="en" />);
    expect(screen.getByText(/^Simple message/)).toBeInTheDocument();
    rerender(<CommunityView page={{ kind: "unavailable", place: "Pune" }} lang="en" />);
    expect(screen.getByText(/We can't get the air data for Pune/)).toBeInTheDocument();
    rerender(<CommunityView page={{ kind: "rate_limited" }} lang="en" />);
    expect(screen.getByText(/Too many requests/)).toBeInTheDocument();
    rerender(<CommunityView page={{ kind: "no_place" }} lang="hi" />);
    expect(screen.getByRole("link", { name: "जगह चुनें" })).toHaveAttribute("href", "/");
    rerender(<CommunityLoading lang="en" />);
    expect(screen.getByRole("status")).toHaveTextContent("Writing today's message…");
  });
});

describe("Learn, signed in", () => {
  it("leads with your choices today, in whole-day cigarettes, and the CO₂ for the air", () => {
    const day = { outside: { count: 11, lessThanOne: false }, withPlan: { count: 1, lessThanOne: true }, co2Kg: 0.4 };
    render(<Learn lang="en" yourDay={day} />);
    expect(screen.getByRole("heading", { name: "Your choices today" })).toBeInTheDocument();
    expect(screen.getByText("≈ 11 cigarettes' worth of smoke")).toBeInTheDocument();
    expect(screen.getByText("less than 1 cigarette's worth of smoke")).toBeInTheDocument();
    expect(screen.getByText(/about 0.4 kg less CO₂/)).toBeInTheDocument();
    expect(screen.queryByText("Sign in to see your own numbers.")).toBeNull();
  });
});
