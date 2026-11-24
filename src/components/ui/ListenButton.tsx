"use client";

import { Volume2 } from "lucide-react";
import { useEffect, useSyncExternalStore, useState } from "react";
import { translator, type Lang } from "@/i18n/t";

const VOICE_LANG: Readonly<Record<Lang, string>> = { en: "en-IN", hi: "hi-IN" };

const subscribe = (onChange: () => void) => {
  if (typeof speechSynthesis === "undefined") return () => {};
  const synth = speechSynthesis;
  synth.addEventListener("voiceschanged", onChange);
  return () => synth.removeEventListener("voiceschanged", onChange);
};

/** The browser's en-IN / hi-IN voice ("hi_IN" on some Android builds), if it has one. */
export function voiceFor(lang: Lang): SpeechSynthesisVoice | null {
  if (typeof speechSynthesis === "undefined") return null;
  const wanted = VOICE_LANG[lang].toLowerCase();
  return speechSynthesis.getVoices().find((v) => v.lang.replace("_", "-").toLowerCase() === wanted) ?? null;
}

/** True when the browser has an en-IN / hi-IN voice; other English or Hindi voices do not count. */
export const hasVoice = (lang: Lang): boolean => voiceFor(lang) !== null;

const stopSpeaking = () => {
  if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
};

/**
 * सुनें / Listen: reads the text aloud with the browser's speechSynthesis, no
 * permission and no network. Rendered only when a matching voice exists; shows Stop while speaking.
 */
export function ListenButton({ text, lang, label }: { text: string; lang: Lang; label: string }) {
  const available = useSyncExternalStore(
    subscribe,
    () => hasVoice(lang),
    () => false,
  );
  const [speaking, setSpeaking] = useState(false);
  // Leaving the page (or the card) stops the voice; it must not keep talking over the next screen.
  useEffect(() => () => stopSpeaking(), []);
  if (!available) return null;
  const t = translator(lang);
  const toggle = () => {
    speechSynthesis.cancel();
    if (speaking) return setSpeaking(false);
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = VOICE_LANG[lang];
    utterance.voice = voiceFor(lang);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    setSpeaking(true);
    speechSynthesis.speak(utterance);
  };
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={speaking}
      aria-label={speaking ? t("listen.stop") : label}
      className="inline-flex min-h-11 w-max items-center gap-1.5 rounded-pill border-[1.5px] border-rule-strong bg-card px-3.5 text-[0.9375em] font-bold text-ink aria-pressed:border-brand aria-pressed:bg-brand-tint"
    >
      <Volume2 className="size-5 text-brand" aria-hidden="true" />
      {speaking ? t("listen.stop") : t("listen.button")}
    </button>
  );
}
