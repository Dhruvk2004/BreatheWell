import type { Lang } from "@/domain/time/format";
import type { ShownMessage } from "@/view/community";

/** The message as plain text for Copy and WhatsApp: header, title, body, together, footer. */
export const messageText = (m: ShownMessage): string => [m.header, m.title, m.body, m.together, m.footer].filter(Boolean).join("\n");

/** One language's message in a box: header from code, the middle, "Together today" highlighted. */
export function MessageBox({ message, lang, label }: { message: ShownMessage; lang: Lang; label: string }) {
  return (
    <section lang={lang} aria-label={label} className="grid gap-2 rounded-[12px] border border-rule bg-card px-4 py-3.5">
      <p className="m-0 text-sm font-bold tracking-wide text-ink-muted uppercase">{label}</p>
      <p className="m-0 font-bold">{message.header}</p>
      {message.title && <p className="m-0 font-bold">{message.title}</p>}
      <p className="m-0">{message.body}</p>
      <p className="m-0 rounded-sm bg-brand-tint px-3 py-2 font-bold">{message.together}</p>
      <p className="m-0 text-sm text-ink-muted">{message.footer}</p>
    </section>
  );
}
