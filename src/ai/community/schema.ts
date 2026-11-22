import { z } from "zod";
import type { Band } from "@/domain/air/bands";
import type { CommunityAction } from "@/domain/libraries/alternatives";

/**
 * The community message's structured output (spec 7.6): per language a title (≤ 60) and a body of
 * 3 short lines (≤ 450), plus the "together" line's words. The code adds the header with the
 * numbers, the "Together today:" label and the source footer. Loose limits here; the validator caps.
 */
const lang = z.object({ title: z.string().max(120), body: z.string().max(900), together: z.string().max(300) });

export const communityOutputSchema = z.object({ en: lang, hi: lang });
export type CommunityOutput = z.infer<typeof communityOutputSchema>;
export type CommunityWords = CommunityOutput["en"];

export const COMMUNITY_CAPS = { title: 60, body: 450, together: 160 } as const;

/** What Gemini gets: code inputs only (spec 7.0: never a visitor's text). */
export interface CommunityPromptInput {
  /** The listed city's name, or "India" (the URL's place name never reaches the prompt). */
  readonly place: string;
  readonly audience: "housing_society";
  readonly band: Band;
  /** "14:00-16:00" or null. */
  readonly bestWindow: string | null;
  readonly worstWindow: string | null;
  readonly windowDay: "today" | "rest_of_today" | "tomorrow";
  readonly together: CommunityAction;
}
