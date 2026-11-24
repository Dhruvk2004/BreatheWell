/**
 * An id from a URL or a document is used as one path segment only: Firestore auto-ids, Auth uids
 * and join codes (stage 7 PT-8: "..%2F..%2F{otherFid}" or "x/y/z" must never reach Firestore).
 */
const ID = /^[A-Za-z0-9_-]{1,128}$/u;

/** Thrown for an id that is not one path segment; `pausedOnQuota` answers it with 404. */
export class InvalidPathId extends Error {
  constructor() {
    super("invalid_path_id");
    this.name = "InvalidPathId";
  }
}

/** The id when it is a single safe segment, else `InvalidPathId`. */
export function segment(id: string): string {
  if (!ID.test(id)) throw new InvalidPathId();
  return id;
}

const f = (fid: string) => `families/${segment(fid)}`;

/** Firestore document paths, in one place. */
export const paths = {
  user: (uid: string) => `users/${segment(uid)}`,
  health: (uid: string) => `users/${segment(uid)}/private/health`,
  family: (fid: string) => f(fid),
  home: (fid: string) => `${f(fid)}/private/home`,
  members: (fid: string) => `${f(fid)}/members`,
  member: (fid: string, uid: string) => `${f(fid)}/members/${segment(uid)}`,
  dependents: (fid: string) => `${f(fid)}/dependents`,
  dependent: (fid: string, did: string) => `${f(fid)}/dependents/${segment(did)}`,
  items: (fid: string) => `${f(fid)}/items`,
  item: (fid: string, id: string) => `${f(fid)}/items/${segment(id)}`,
  progressAll: (fid: string) => `${f(fid)}/progress`,
  progress: (fid: string, date: string, id: string) => `${f(fid)}/progress/${date}_${segment(id)}`,
  plans: (fid: string) => `${f(fid)}/plans`,
  plan: (fid: string, date: string) => `${f(fid)}/plans/${date}`,
  planSections: (fid: string, date: string) => `${f(fid)}/plans/${date}/members`,
  planSection: (fid: string, date: string, id: string) => `${f(fid)}/plans/${date}/members/${segment(id)}`,
  joinCodes: "joinCodes",
  joinCode: (code: string) => `joinCodes/${segment(code)}`,
  rateLimit: (key: string) => `rateLimits/${key}`,
  quota: (date: string) => `quota/${date}`,
  /** Breezy's daily counts per user and per family, under the day's quota doc. */
  breezyCount: (date: string, key: string) => `quota/${date}/breezy/${key}`,
  communityCache: (key: string) => `communityCache/${key}`,
} as const;
