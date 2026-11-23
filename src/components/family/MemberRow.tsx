import Link from "next/link";
import type { ReactNode } from "react";
import type { Verdict } from "@/domain/rules/verdict";
import type { Lang } from "@/i18n/t";
import { VerdictChip } from "../air/VerdictChip";

interface MemberRowProps {
  readonly lang: Lang;
  readonly initials: string;
  readonly name: string;
  readonly tags: readonly { readonly label: string; readonly outlined?: boolean }[];
  /** The chip is the verdict at the usual time (design D); no chip at all without fresh air data. */
  readonly verdict: Verdict;
  readonly line: ReactNode;
  readonly me?: boolean;
  /** Children and teens get the neutral avatar. */
  readonly dependent?: boolean;
  /** A sibling action (Kid card), never nested inside a link. */
  readonly action?: ReactNode;
  /** The member plan; the whole row is the link's target (design 10.8 chevron), the action sits above it. */
  readonly href?: string;
  readonly linkLabel?: string;
  /** Today on desktop: each row is its own card in a 2-column grid (spec 10, design 10.8). */
  readonly tile?: boolean;
}

/** One person's row on Today and the demo (design D): avatar, name and tags, verdict chip, one line. */
export function MemberRow({
  lang,
  initials,
  name,
  tags,
  verdict,
  line,
  me = false,
  dependent = false,
  action,
  href,
  linkLabel,
  tile = false,
}: MemberRowProps) {
  const card = tile ? "md:rounded-[16px] md:border md:bg-card md:first:border-t" : "";
  return (
    <li
      className={`relative grid grid-cols-[2.75em_1fr] items-start gap-3 border-t border-rule px-4 py-3.5 first:border-t-0 ${card} ${me ? "shadow-[inset_3px_0_0_var(--color-primary)]" : ""}`}
    >
      <span
        aria-hidden="true"
        className={`grid size-11 place-items-center rounded-full text-[0.9375em] font-bold ${dependent ? "bg-card-2 text-ink" : "bg-brand-tint text-brand"}`}
      >
        {initials}
      </span>
      <span className="grid min-w-0 gap-1.5">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[1.0625em] leading-snug font-bold">
          <Name name={name} href={href} label={linkLabel} />
          <Tags tags={tags} />
        </span>
        <VerdictChip verdict={verdict} lang={lang} />
        {/* Reserved for two lines (design F), so Gemini's wording swaps in without moving the rows. */}
        <span className="min-h-[2lh] text-lg leading-snug">{line}</span>
        {action}
      </span>
    </li>
  );
}

/** The name, as the row's link to the member plan when there is one (the whole row is its target). */
function Name({ name, href, label }: { name: string; href?: string; label?: string }) {
  if (!href) return name;
  return (
    <Link href={href} aria-label={label} className="text-ink no-underline after:absolute after:inset-0 after:content-['']">
      {name}
    </Link>
  );
}

function Tags({ tags }: { tags: MemberRowProps["tags"] }) {
  return tags.map((tag) => (
    <span
      key={tag.label}
      className={`rounded-xs px-2 text-sm leading-normal font-bold ${tag.outlined ? "bg-card text-ink shadow-[inset_0_0_0_1.5px_var(--color-line-strong)]" : "bg-card-2 text-ink-muted"}`}
    >
      {tag.label}
    </span>
  ));
}
