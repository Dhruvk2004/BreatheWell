import type { Lang } from "@/i18n/t";
import type { Draft } from "../draft";

/** Every answer screen gets the draft, a way to change it, and the page language. */
export interface StepProps {
  readonly draft: Draft;
  readonly set: (patch: Partial<Draft>) => void;
  readonly lang: Lang;
  /** Show inline errors (after a Next that could not leave the step). */
  readonly showErrors?: boolean;
}
