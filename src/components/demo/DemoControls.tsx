import Link from "next/link";
import type { ReactNode } from "react";
import { DEMO_VIEWERS, demoPerson } from "@/data/demo/family";
import { DEMO_SCENARIOS, DEMO_TIMES, demoHref, type DemoQuery } from "@/data/demo/query";
import { formatHour } from "@/domain/time/format";
import { translator, type Lang } from "@/i18n/t";
import { segment, segmentItem } from "../ui/styles";

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <nav aria-label={label} className="flex flex-wrap items-center justify-between gap-2">
      <span className="text-sm font-bold text-ink-muted" aria-hidden="true">
        {label}
      </span>
      <span className={segment}>{children}</span>
    </nav>
  );
}

/**
 * Scenario switch, time-of-day stepper and View as (design 10.3). The stepper moves the scenario
 * clock (recorded days only); "View as" shows Dadaji's Hindi card.
 */
export function DemoControls({ query, lang }: { query: DemoQuery; lang: Lang }) {
  const t = translator(lang);
  return (
    <div className="grid gap-3">
      <Group label={t("demo.scenario")}>
        {DEMO_SCENARIOS.map((scenario) => (
          <Link key={scenario} href={demoHref({ ...query, scenario })} aria-current={scenario === query.scenario} className={segmentItem}>
            {t(`demo.scenario.${scenario}`)}
          </Link>
        ))}
      </Group>
      {query.scenario !== "live" && (
        <Group label={t("demo.time")}>
          {DEMO_TIMES.map((time) => (
            <Link key={time} href={demoHref({ ...query, time })} aria-current={time === query.time} className={segmentItem}>
              {formatHour(time, lang)}
            </Link>
          ))}
        </Group>
      )}
      <Group label={t("demo.viewAs")}>
        {DEMO_VIEWERS.map((view) => (
          <Link key={view} href={demoHref({ ...query, view })} aria-current={view === query.view} className={segmentItem}>
            {demoPerson(view)?.name[lang]}
          </Link>
        ))}
      </Group>
    </div>
  );
}
