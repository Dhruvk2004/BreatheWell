import { Users } from "lucide-react";
import { translator, type Lang } from "@/i18n/t";
import { RadioGroup } from "../form/Choice";
import { noteInfo } from "../ui/styles";

export type Intent = "start" | "join";

/** Step 0: only without a family. Start a family | I have a join code. */
export function StartStep({
  intent,
  onChange,
  removedFrom,
  lang,
}: {
  intent: Intent;
  onChange: (i: Intent) => void;
  removedFrom: string | null;
  lang: Lang;
}) {
  const t = translator(lang);
  return (
    <div className="grid gap-4">
      {removedFrom && (
        <p role="status" className={`m-0 ${noteInfo}`}>
          <Users className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden="true" />
          {t("onb.removed", { family: removedFrom })}
        </p>
      )}
      <RadioGroup
        legend={t("onb.metaTitle")}
        name="intent"
        columns={1}
        value={intent}
        onChange={onChange}
        options={[
          { value: "start", label: t("onb.start"), hint: t("onb.startHint") },
          { value: "join", label: t("onb.join"), hint: t("onb.joinHint") },
        ]}
      />
    </div>
  );
}
