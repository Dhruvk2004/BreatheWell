import type { FamilyView } from "@/view/app";
import type { RemovalCopy } from "./JoinCard";

/** What the remove confirm says about a member: their name and the dependents that go with them. */
export function removalOf(family: FamilyView, uid: string): RemovalCopy {
  const person = family.people.find((p) => p.id === uid);
  const dependents = family.people.filter((p) => p.kind === "dependent" && p.guardianUid === uid).map((p) => p.name);
  return { uid, name: person?.name ?? "", familyName: family.name, dependents };
}
