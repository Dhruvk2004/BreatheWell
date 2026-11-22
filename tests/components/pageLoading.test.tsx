import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PageLoading } from "@/components/shell/PageLoading";

vi.mock("@/i18n/server", () => ({ currentLang: async () => "hi" }));

describe("signed-in page fallback", () => {
  it("says it is loading, in words, in the page language", async () => {
    render(await PageLoading());
    expect(screen.getByRole("status")).toHaveTextContent("हवा जाँच रहे हैं…");
  });
});
