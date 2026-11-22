import { t, type Lang } from "@/i18n/t";

/**
 * The required "I am 18 or older" tick (spec 7.0, 10.4), in both languages so a grandparent can
 * read it before choosing a language. Nothing is signed in, stored or joined until it is ticked.
 */
export function AdultTick({ checked, onChange, lang }: { checked: boolean; onChange: (checked: boolean) => void; lang: Lang }) {
  const other: Lang = lang === "en" ? "hi" : "en";
  return (
    <label className="flex min-h-12 cursor-pointer items-start gap-3 rounded-sm border-[1.5px] border-rule-strong bg-card px-3.5 py-3 has-[:checked]:border-brand has-[:checked]:bg-brand-tint">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 size-5 shrink-0 accent-[var(--color-primary)]"
      />
      <span className="grid gap-0.5">
        <span className="font-bold">{t(lang, "auth.adult")}</span>
        <span lang={other} className="text-ink-muted">
          {t(other, "auth.adult")}
        </span>
      </span>
    </label>
  );
}
