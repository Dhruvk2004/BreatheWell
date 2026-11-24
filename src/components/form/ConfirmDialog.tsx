"use client";

import { Trash2 } from "lucide-react";
import { useId, useRef, useState, type ReactNode } from "react";
import { btn } from "../ui/styles";

interface ConfirmDialogProps {
  /** The content of the button that opens the sheet. */
  readonly trigger: ReactNode;
  readonly triggerClassName?: string;
  readonly triggerLabel?: string;
  /** The id of the note that says why the button is disabled (design round 2, PM-M2). */
  readonly triggerDescribedBy?: string;
  readonly disabled?: boolean;
  readonly title: string;
  readonly children: ReactNode;
  readonly cancel: string;
  readonly confirm: string;
  /** Runs the action; a returned message is shown in the sheet and keeps it open. */
  readonly onConfirm: () => Promise<string | null>;
  readonly destructive?: boolean;
  /** Extra condition for the confirm button (a typed family name). */
  readonly canConfirm?: boolean;
}

function useSheet(onConfirm: () => Promise<string | null>) {
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const run = async () => {
    setBusy(true);
    const problem = await onConfirm();
    setBusy(false);
    setMessage(problem);
    if (!problem) dialog.current?.close();
  };
  return { dialog, opener, busy, message, run };
}

/**
 * The confirm sheet: a native modal dialog, so focus is trapped and
 * Escape closes it; Cancel comes first, the destructive verb is on the ink button, and focus goes
 * back to the button that opened it.
 */
export function ConfirmDialog(props: ConfirmDialogProps) {
  const { triggerClassName = `${btn.secondary} ${btn.small}`, destructive, canConfirm } = props;
  const sheetClass =
    "m-auto mb-0 w-full max-w-[32rem] rounded-t-[20px] border-0 bg-card p-5 text-ink shadow-sheet backdrop:bg-[var(--color-scrim)] sm:mb-auto sm:rounded-[20px]";
  const headingId = useId();
  const { dialog, opener, busy, message, run } = useSheet(props.onConfirm);
  return (
    <>
      <button
        ref={opener}
        type="button"
        disabled={props.disabled}
        aria-label={props.triggerLabel}
        aria-describedby={props.triggerDescribedBy}
        onClick={() => dialog.current?.showModal()}
        className={triggerClassName}
      >
        {props.trigger}
      </button>
      <dialog ref={dialog} aria-labelledby={headingId} onClose={() => opener.current?.focus()} className={sheetClass}>
        <h2 id={headingId} className="m-0 text-xl font-bold">
          {props.title}
        </h2>
        <div className="mt-3 grid gap-2">{props.children}</div>
        <p role="alert" className="m-0 mt-2 font-bold text-err empty:hidden">
          {message}
        </p>
        <SheetButtons
          cancel={props.cancel}
          confirm={props.confirm}
          destructive={destructive}
          disabled={busy || canConfirm === false}
          onCancel={() => dialog.current?.close()}
          onConfirm={run}
        />
      </dialog>
    </>
  );
}

interface SheetButtonsProps {
  readonly cancel: string;
  readonly confirm: string;
  readonly destructive?: boolean;
  readonly disabled: boolean;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}

/** Cancel first (it has the focus), then the verb. */
function SheetButtons({ cancel, confirm, destructive, disabled, onCancel, onConfirm }: SheetButtonsProps) {
  return (
    <div className="mt-4 grid grid-cols-2 gap-2">
      <button type="button" autoFocus onClick={onCancel} className={btn.secondary}>
        {cancel}
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={onConfirm}
        className={`${destructive ? btn.ink : btn.primary} disabled:opacity-60`}
      >
        {destructive && <Trash2 className="size-5" aria-hidden="true" />}
        {confirm}
      </button>
    </div>
  );
}
