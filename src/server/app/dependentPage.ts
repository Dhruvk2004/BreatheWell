import { DEPENDENT_DEFAULTS, type DependentChoice } from "@/domain/dependents/defaults";
import { DEPENDENT_CONDITIONS, type DependentInput } from "@/domain/dependents/schema";
import { canManageDependent } from "@/domain/family/permissions";
import type { DependentPage } from "@/view/app";
import type { DependentRecord } from "../repos/records";
import type { InFamily } from "./guards";

/** A stored dependent back to the form's answers: one pick per activity choice with its times. */
function inputOf(record: DependentRecord): DependentInput {
  const choices = [...new Set(record.activities.map((a) => a.type as DependentChoice))].filter((c) => c in DEPENDENT_DEFAULTS);
  return {
    name: record.name,
    ageGroup: record.ageGroup,
    conditions: record.conditions.filter((c): c is DependentInput["conditions"][number] =>
      (DEPENDENT_CONDITIONS as readonly string[]).includes(c),
    ),
    picks: choices.map((choice) => ({ choice, times: record.activities.filter((a) => a.type === choice).map((a) => a.usual) })),
    travel: {
      main: record.travel.main as DependentInput["travel"]["main"],
      others: record.travel.others as DependentInput["travel"]["others"],
    },
    cardLanguage: record.cardLanguage,
  };
}

/**
 * Add a child or teen (spec 10.12): a blank form for any member; edit for the guardian or the
 * admin. Null when the id is not one of the family's dependents or the viewer may not edit it.
 */
export function loadDependent(viewer: InFamily, id: string | null): DependentPage | null {
  const { bundle } = viewer;
  const self = bundle.members.find((m) => m.uid === viewer.uid)?.record.name ?? viewer.user.name;
  if (id === null) return { familyName: bundle.family.name, guardianName: self, id: null, input: null, canDelete: false };
  const found = bundle.dependents.find((d) => d.id === id);
  if (!found || !canManageDependent(bundle.family, found.record.guardianUid, viewer.uid)) return null;
  return { familyName: bundle.family.name, guardianName: self, id, input: inputOf(found.record), canDelete: true };
}
