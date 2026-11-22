import { CircleAlert } from "lucide-react";
import type { InputHTMLAttributes } from "react";

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  readonly id: string;
  readonly label: string;
  readonly hint?: string;
  /** Shown inline with an icon and announced (design 10.5 "inline error, aria-live"). */
  readonly error?: string | null;
}

/** A labelled text input with an optional hint and an inline, announced error. */
export function TextField({ id, label, hint, error, ...input }: TextFieldProps) {
  const described = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  return (
    <div className="grid gap-1">
      <label htmlFor={id} className="text-lg font-bold">
        {label}
      </label>
      {hint && (
        <p id={`${id}-hint`} className="m-0 text-sm text-ink-muted">
          {hint}
        </p>
      )}
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={described}
        className="min-h-12 rounded-xs border-[1.5px] border-rule-strong bg-card px-3.5 text-ink aria-invalid:border-err"
        {...input}
      />
      <p id={`${id}-error`} aria-live="polite" className="m-0 flex items-start gap-1.5 text-sm font-bold text-err empty:hidden">
        {error && <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />}
        {error}
      </p>
    </div>
  );
}
