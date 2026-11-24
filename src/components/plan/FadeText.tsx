"use client";

import { useState } from "react";

/**
 * Plan text that fades in when it changes on screen (Gemini's wording replaces the
 * template with a ~300 ms cross-fade, none under reduced motion). The first render never fades,
 * so the answer is visible at once.
 */
export function FadeText({ text }: { text: string }) {
  const [first] = useState(text);
  return (
    <span key={text} className={text === first ? undefined : "plan-text-in"}>
      {text}
    </span>
  );
}
