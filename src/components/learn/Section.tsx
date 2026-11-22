import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { accordion, summaryRow } from "../ui/styles";

/** A collapsible Learn section with its heading in the summary (design 10.11 accordions). */
export function Section({ title, open = false, id, children }: { title: string; open?: boolean; id?: string; children: ReactNode }) {
  return (
    <details id={id} open={open} className={`group ${accordion}`}>
      <summary className={summaryRow}>
        <h2 className="m-0 text-base font-bold">{title}</h2>
        <ChevronDown className="size-5 transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="grid gap-2 pb-3.5 text-[0.9375em]">{children}</div>
    </details>
  );
}
