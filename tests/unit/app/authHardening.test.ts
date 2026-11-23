import { describe, expect, it } from "vitest";
import { SessionVerifier } from "@/server/auth/session";
import { loadViewer } from "@/server/app/viewer";
import { deleteAccount, deleteFamily } from "@/server/handlers/account";
import { createFamily, updateFamily } from "@/server/handlers/family";
import { joinFamily } from "@/server/handlers/join";
import { removeMember } from "@/server/handlers/members";
import { tickProgress } from "@/server/handlers/progress";
import { deleteSession } from "@/server/handlers/session";
import { ensureUser } from "@/server/repos/users";
import type { Tx } from "@/server/db/types";
import { nameSchema, UNNAMED_MEMBER } from "@/domain/members/names";
import { familyView } from "@/server/app/familyView";
import { loadFamily } from "@/server/repos/family";
import { FakeAuth, json, request, testApp } from "../../helpers/appDeps";
import { NOW } from "../../helpers/airDeps";
import { HOME, HOME_SETUP, joins, sharmaFamily, signUp } from "../../helpers/family";
import { MemoryDb } from "../../helpers/memoryDb";

/** Stage 7 AUTH-1, AUTH-2, AUTH-3, AUTH-4, AUTH-6 and WEB-6. */
describe("sign-out and disabled accounts end page reads too (AUTH-1, AUTH-6)", () => {
  it("a copied cookie stops loading the family after Sign out everywhere", async () => {
    const app = testApp();
    await sharmaFamily(app);
    expect((await deleteSession(request("/api/session", { method: "DELETE", uid: "neha" }), app.deps)).status).toBe(200);
    app.auth.validAfter.neha = NOW.toUTCString();
    const write = await updateFamily(request("/api/family", { method: "PATCH", uid: "neha", body: { name: "X family" } }), app.deps);
    expect(write.status).toBe(401);
    expect((await loadViewer("session:neha", app.deps)).kind).toBe("signed_out");
  });

  it("refuses a disabled user's cookie for reads and writes, and re-asks after an Auth error", async () => {
    class DisabledAuth extends FakeAuth {
      calls = 0;
      override async getUser(uid: string) {
        this.calls += 1;
        if (this.calls === 1) throw new Error("unavailable");
        return { ...(await super.getUser(uid)), disabled: true };
      }
    }
    const auth = new DisabledAuth();
    const sessions = new SessionVerifier(auth, () => NOW.getTime());
    expect(await sessions.verify("session:abuser", "read")).toBeNull();
    expect(await sessions.verify("session:abuser", "read")).toBeNull();
    expect(await sessions.verify("session:abuser", "write")).toBeNull();
    expect(auth.calls).toBe(3);
  });

  it("writes re-check revocation after 10 s, reads after 60 s", async () => {
    let now = NOW.getTime();
    const auth = new FakeAuth();
    const sessions = new SessionVerifier(auth, () => now);
    expect(await sessions.verify("session:u1", "write")).not.toBeNull();
    expect(await sessions.verify("session:u1", "read")).not.toBeNull();
    auth.validAfter.u1 = new Date(now).toISOString();
    now += 11_000;
    expect(await sessions.verify("session:u1", "write")).toBeNull();
    expect(await sessions.verify("session:u1", "read")).not.toBeNull();
    now += 50_000;
    expect(await sessions.verify("session:u1", "read")).toBeNull();
  });
});

describe("deleting a family closes it at once (AUTH-2)", () => {
  it("a join that lands before the tree is deleted finds no family, and the joiner can start one", async () => {
    const app = testApp();
    const { code } = await sharmaFamily(app);
    await signUp(app, "late", "Late");
    let joined: Response | null = null;
    const realDeleteTree = app.db.deleteTree.bind(app.db);
    app.db.deleteTree = async (path: string) => {
      joined ??= await joinFamily(request("/api/join", { uid: "late", body: { code } }), app.deps);
      return realDeleteTree(path);
    };
    const confirm = { confirmName: "Sharma family" };
    expect((await deleteFamily(request("/api/family", { method: "DELETE", uid: "neha", body: confirm }), app.deps)).status).toBe(200);
    app.db.deleteTree = realDeleteTree;
    expect(joined!.status).toBe(404);
    const body = { name: "Late family", home: HOME, homeSetup: HOME_SETUP };
    expect((await createFamily(request("/api/family", { uid: "late", body }), app.deps)).status).toBe(201);
  });

  it("a solo admin deleting their account removes the family's join codes in the same step", async () => {
    const app = testApp();
    const { code } = await sharmaFamily(app);
    expect((await deleteAccount(request("/api/account", { method: "DELETE", uid: "neha" }), app.deps)).status).toBe(200);
    expect(app.db.docs.get(`joinCodes/${code}`)).toBeUndefined();
  });

  it("a familyId that points at a missing family does not block creating one", async () => {
    const app = testApp();
    await signUp(app, "amit", "Amit");
    app.db.docs.set("users/amit", { ...app.db.docs.get("users/amit"), familyId: "vanished" });
    const body = { name: "Amit family", home: HOME, homeSetup: HOME_SETUP };
    expect((await createFamily(request("/api/family", { uid: "amit", body }), app.deps)).status).toBe(201);
  });
});

describe("names copied into the family pass nameSchema (AUTH-3, WEB-6)", () => {
  it("a link-like name in the users doc is not copied into the member doc", async () => {
    const app = testApp();
    const { fid, code } = await sharmaFamily(app);
    await signUp(app, "eve", "Eve");
    app.db.docs.set("users/eve", { ...app.db.docs.get("users/eve"), name: "Pay at bit.ly/x9‮" });
    expect((await joinFamily(request("/api/join", { uid: "eve", body: { code } }), app.deps)).status).toBe(200);
    expect((app.db.docs.get(`families/${fid}/members/eve`) as { name: string }).name).toBe("");
  });

  it.each(["https://evil.example/x Smith", "wa.me/919999999999 X", "<b>hi</b> there"])(
    "does not store the Google name %s",
    async (google) => {
      const user = await ensureUser(new MemoryDb(), "u1", google, NOW);
      expect(user.name === "" || nameSchema(30).safeParse(user.name).success).toBe(true);
      expect(user.name).toBe("");
    },
  );

  it.each(["R.K. Laxman", "R.K.", "A. K. Singh", "Dr. Mehta", "दादाजी"])("accepts the Indian name %s (stage 8 QA8-5)", (name) => {
    expect(nameSchema(30).safeParse(name).success).toBe(true);
  });

  it.each(["evil.com", "a.co", "Visit site.in", "x.yz Smith"])("still refuses the domain-like name %s", (name) => {
    expect(nameSchema(30).safeParse(name).success).toBe(false);
  });

  it("keeps an initialled Google name, and shows the family a fallback for an unusable one (QA8-5, QA8-6)", async () => {
    expect((await ensureUser(new MemoryDb(), "u1", "R.K. Laxman", NOW)).name).toBe("R.K.");
    const app = testApp();
    const { fid, code } = await sharmaFamily(app);
    await signUp(app, "eve", "Eve");
    app.db.docs.set("users/eve", { ...app.db.docs.get("users/eve"), name: "😀" });
    expect((await joinFamily(request("/api/join", { uid: "eve", body: { code } }), app.deps)).status).toBe(200);
    const bundle = await loadFamily(app.db, fid);
    expect(familyView(bundle!, "neha").people.find((p) => p.id === "eve")?.name).toBe(UNNAMED_MEMBER);
  });

  it("keeps a plain Google first name", async () => {
    expect((await ensureUser(new MemoryDb(), "u1", "Neha Sharma", NOW)).name).toBe("Neha");
  });
});

describe("a removed member's tick in flight writes nothing (AUTH-4)", () => {
  it("re-checks membership inside the progress transaction", async () => {
    const app = testApp();
    const { fid, code } = await sharmaFamily(app);
    expect((await joins(app, "rahul", "Rahul", code)).status).toBe(200);
    const realTx = app.db.transaction.bind(app.db);
    let armed = true;
    app.db.transaction = (async <T>(fn: (tx: Tx) => Promise<T>): Promise<T> => {
      if (armed) {
        armed = false;
        await removeMember(request("/api/family/members/rahul", { method: "DELETE", uid: "neha" }), app.deps, "rahul");
      }
      return realTx(fn);
    }) as typeof app.db.transaction;
    const tick = await tickProgress(
      request("/api/progress", { uid: "rahul", body: { forId: "rahul", key: "office_trip", done: true } }),
      app.deps,
    );
    app.db.transaction = realTx;
    expect(tick.status).toBe(403);
    expect(await json(tick)).toMatchObject({ error: { code: "forbidden" } });
    expect(app.db.docs.get(`families/${fid}/progress/2024-11-18_rahul`)).toBeUndefined();
  });
});
