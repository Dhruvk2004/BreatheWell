import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useBreezy } from "@/components/breezy/useBreezy";

/** The thread's state: one question at a time, and the history leaves out errors and code notes. */
describe("useBreezy", () => {
  it("ignores a second question while one is on its way, and sends only replies and questions as history", async () => {
    let answer: (r: Response) => void = () => {};
    const fetcher = vi
      .fn()
      .mockImplementationOnce(() => Promise.reject(new TypeError("offline")))
      .mockImplementationOnce(() => new Promise<Response>((resolve) => (answer = resolve)))
      .mockImplementation(async () => Response.json({ kind: "basics" }));
    vi.stubGlobal("fetch", fetcher);
    const { result } = renderHook(() => useBreezy());
    act(() => result.current.send("First"));
    await waitFor(() => expect(result.current.entries.at(-1)?.kind).toBe("error"));
    act(() => result.current.send("Second"));
    act(() => result.current.send("Ignored while busy"));
    expect(fetcher).toHaveBeenCalledTimes(2);
    await act(async () => answer(Response.json({ kind: "reply", text: "Hello.", lang: "en", cards: [] })));
    await waitFor(() => expect(result.current.busy).toBe(false));
    act(() => result.current.send("Third"));
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(3));
    const body = JSON.parse(String((fetcher.mock.calls[2] as [string, RequestInit])[1].body));
    expect(body.history).toEqual([
      { role: "user", text: "First" },
      { role: "user", text: "Second" },
      { role: "breezy", text: "Hello." },
    ]);
  });
});
