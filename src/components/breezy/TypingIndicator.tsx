import { translator, type Lang } from "@/i18n/t";
import { BreezyMark } from "./BreezyMark";

/** "Breezy is thinking…" with three dots (the only loop in the app; static under reduced motion). */
export function TypingIndicator({ lang }: { lang: Lang }) {
  const t = translator(lang);
  return (
    <div className="flex items-start gap-2">
      <BreezyMark />
      <p className="m-0 rounded-[16px] rounded-tl-[4px] bg-ai-tint px-3.5 py-2.5 text-ink">
        {t("breezy.thinking")}{" "}
        <span aria-hidden="true" className="inline-flex gap-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="typing-dot inline-block size-1.5 rounded-full bg-ai motion-reduce:animate-none motion-reduce:opacity-70"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </span>
      </p>
    </div>
  );
}
