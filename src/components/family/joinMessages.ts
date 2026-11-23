import { translator, type Lang } from "@/i18n/t";

/** What the join answer said, with the names the server chose to reveal (spec 5.11). */
export interface JoinProblem {
  readonly code: string;
  readonly familyName?: string;
  readonly adminName?: string;
}

/** The join error line for a server code (spec 5.11, design 10.7 "other messages"). */
export function joinMessage(problem: JoinProblem, lang: Lang): string {
  const t = translator(lang);
  const family = problem.familyName ?? "";
  const admin = problem.adminName ?? "";
  switch (problem.code) {
    case "expired":
      return admin ? t("join.err.expired", { admin }) : t("join.err.expiredAnon");
    case "removed":
      return admin ? t("join.err.removed", { admin }) : t("join.err.removedAnon");
    case "full":
      return t("join.err.full", { family, admin });
    case "in_other_family":
      return t("join.err.in_other_family", { family });
    case "already_member":
      return t("join.err.already_member");
    case "too_many_tries":
      return t("join.err.too_many_tries");
    case "rate_limited":
      return t("join.err.rate_limited");
    case "network":
      return t("common.offline");
    default:
      return t("join.err.not_found");
  }
}

/** A problem from a thrown API error's body. */
export function problemOf(code: string, body: Record<string, unknown>): JoinProblem {
  const text = (key: string) => (typeof body[key] === "string" ? (body[key] as string) : undefined);
  return { code, familyName: text("familyName"), adminName: text("adminName") };
}
