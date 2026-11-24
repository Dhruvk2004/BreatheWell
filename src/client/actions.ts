import { z } from "zod";
import type { DependentInput } from "@/domain/dependents/schema";
import type { FamilyInput } from "@/domain/family/home";
import type { ProfileInput } from "@/domain/members/profile";
import { apiRequest, type Fetch } from "./api";

/**
 * Every signed-in write the pages make, one function per route. The server re-checks
 * everything; these only send JSON and validate the answer.
 */
const ok = z.object({ ok: z.literal(true) });
const code = z.object({ code: z.string(), expiresAt: z.string() });
const joined = z.object({ kind: z.enum(["joined", "already_member"]), familyName: z.string() });

export const saveProfile = (input: ProfileInput, f?: Fetch) => apiRequest("/api/profile", ok, { method: "PUT", body: input }, f);
export const createFamily = (input: FamilyInput, f?: Fetch) =>
  apiRequest("/api/family", code.extend({ familyId: z.string() }), { method: "POST", body: input }, f);
export const updateFamily = (patch: Partial<FamilyInput>, f?: Fetch) => apiRequest("/api/family", ok, { method: "PATCH", body: patch }, f);
export const deleteFamily = (confirmName: string, f?: Fetch) =>
  apiRequest("/api/family", ok, { method: "DELETE", body: { confirmName } }, f);
export const joinFamily = (joinCode: string, f?: Fetch) => apiRequest("/api/join", joined, { method: "POST", body: { code: joinCode } }, f);
export const newCode = (f?: Fetch) => apiRequest("/api/family/code", code, { method: "POST", body: {} }, f);
export const leaveFamily = (f?: Fetch) => apiRequest("/api/family/leave", ok, { method: "POST", body: {} }, f);
export const removeMember = (uid: string, f?: Fetch) =>
  apiRequest(`/api/family/members/${encodeURIComponent(uid)}`, ok, { method: "DELETE" }, f);
export const addDependent = (input: DependentInput, f?: Fetch) =>
  apiRequest("/api/dependent", z.object({ id: z.string() }), { method: "POST", body: input }, f);
export const updateDependent = (id: string, input: DependentInput, f?: Fetch) =>
  apiRequest(`/api/dependent/${encodeURIComponent(id)}`, ok, { method: "PUT", body: input }, f);
export const deleteDependent = (id: string, f?: Fetch) =>
  apiRequest(`/api/dependent/${encodeURIComponent(id)}`, ok, { method: "DELETE" }, f);
export const tickProgress = (forId: string, key: string, done: boolean, f?: Fetch) =>
  apiRequest("/api/progress", z.object({ done: z.array(z.string()) }), { method: "POST", body: { forId, key, done } }, f);
export const tickItem = (id: string, done: boolean, f?: Fetch) =>
  apiRequest(`/api/items/${encodeURIComponent(id)}`, ok, { method: "PATCH", body: { done } }, f);
export const deleteAccount = (f?: Fetch) => apiRequest("/api/account", ok, { method: "DELETE" }, f);
