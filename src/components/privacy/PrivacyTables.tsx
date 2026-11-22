import type { MessageKey } from "@/i18n/t";
import { translator, type Lang } from "@/i18n/t";
import { h2 } from "../ui/styles";

const WHO = ["family", "you", "adults", "admin"] as const;
const KEEP = ["air", "community", "plans", "items", "codes", "stats", "profile", "dependents", "chats"] as const;

const CELL = "border-b border-rule py-2 pr-3 align-top";

interface RowsTableProps {
  readonly id: string;
  readonly title: string;
  readonly rows: readonly { readonly head: string; readonly body: string }[];
}

/** A titled two-column table: the row header names who or what, the cell says the rule. */
function RowsTable({ id, title, rows }: RowsTableProps) {
  return (
    <section aria-labelledby={id} className="grid gap-1.5">
      <h2 id={id} className={h2}>
        {title}
      </h2>
      <table className="w-full border-collapse text-left text-[0.9375em]">
        <tbody>
          {rows.map((row) => (
            <tr key={row.head}>
              <th scope="row" className={`${CELL} w-[38%] font-bold`}>
                {row.head}
              </th>
              <td className={CELL}>{row.body}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/** "Who sees what" (spec 6.4) and "How long we keep it" (spec 9.4), simplified, as real tables. */
export function PrivacyTables({ lang }: { lang: Lang }) {
  const t = translator(lang);
  const who = WHO.map((k) => ({ head: t(`privacy.who.${k}` satisfies MessageKey), body: t(`privacy.who.${k}.what` satisfies MessageKey) }));
  const keep = KEEP.map((k) => ({
    head: t(`privacy.keep.${k}` satisfies MessageKey),
    body: t(`privacy.keep.${k}.how` satisfies MessageKey),
  }));
  return (
    <>
      <RowsTable id="privacy-who" title={t("privacy.who.title")} rows={who} />
      <RowsTable id="privacy-keep" title={t("privacy.keep.title")} rows={keep} />
    </>
  );
}
