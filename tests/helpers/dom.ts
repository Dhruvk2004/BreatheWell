import { vi } from "vitest";
import type { InFamily } from "@/server/app/guards";
import { loadViewer } from "@/server/app/viewer";
import { testApp, type TestApp } from "./appDeps";
import { addRiya, joins, sharmaFamily } from "./family";

/** jsdom has no modal dialogs: open/close set the attribute and fire `close` like a browser. */
export function installDialog(): void {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  });
}

/** A `fetch` that answers every call with one JSON body and status, recording the calls. */
export function stubFetch(body: unknown = { ok: true }, status = 200) {
  const fetcher = vi.fn(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
}

/** The Sharma family in memory: Neha (admin), Rahul, Ramesh still setting up, and Riya added by Rahul. */
export async function sharmaApp(): Promise<{
  app: TestApp;
  fid: string;
  code: string;
  riya: string;
  viewer: (uid: string) => Promise<InFamily>;
}> {
  const app = testApp();
  const { fid, code } = await sharmaFamily(app);
  await joins(app, "rahul", "Rahul", code);
  await joins(app, "dadaji", "Ramesh", code, false);
  const riya = await addRiya(app, "rahul");
  const viewer = async (uid: string) => (await loadViewer(`session:${uid}`, app.deps)) as InFamily;
  return { app, fid, code, riya, viewer };
}
