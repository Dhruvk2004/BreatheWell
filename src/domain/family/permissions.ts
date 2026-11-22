/**
 * Server-side permission rules (spec 9.3), as pure predicates the route handlers call and the
 * Firestore rules mirror (spec 9.2). Every caller is a member of the family; that is checked first.
 */
export interface FamilyRoles {
  readonly adminUid: string;
}

export const isAdmin = (family: FamilyRoles, uid: string): boolean => family.adminUid === uid;

/** Edit or delete a dependent: the guardian who added them, or the admin. */
export const canManageDependent = (family: FamilyRoles, guardianUid: string, uid: string): boolean =>
  guardianUid === uid || isAdmin(family, uid);

/** Tick an item or a plan: the member for themself; any member for a dependent. */
export const canTick = (forId: string, uid: string, forDependent: boolean): boolean => forDependent || forId === uid;

/** Delete an item: the target member, the adder, the dependent's guardian, or the admin. */
export function canDeleteItem(
  family: FamilyRoles,
  item: { readonly forId: string; readonly addedBy: string },
  guardianUid: string | null,
  uid: string,
): boolean {
  return item.forId === uid || item.addedBy === uid || guardianUid === uid || isAdmin(family, uid);
}

/**
 * Who sees a member's health condition names (spec 6.4): the member; the admin when shared with
 * the admin or the family; other adults only when shared with the whole family.
 */
export function canSeeHealth(shareWith: "self" | "admin" | "family", owner: string, viewer: string, family: FamilyRoles): boolean {
  if (owner === viewer || shareWith === "family") return true;
  return shareWith === "admin" && isAdmin(family, viewer);
}

/** An admin can leave or delete their account only when alone (spec 5.10); hand-over is S7. */
export const mustStay = (family: FamilyRoles & { readonly memberUids: readonly string[] }, uid: string): boolean =>
  isAdmin(family, uid) && family.memberUids.length > 1;
