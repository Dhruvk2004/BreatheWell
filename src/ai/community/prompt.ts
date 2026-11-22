import type { CommunityPromptInput } from "./schema";
import { COMMUNITY_CAPS } from "./schema";

/**
 * The community message prompt (spec 7.6): one bilingual, WhatsApp-ready text for a housing
 * society, from code inputs only. The rules' band and windows are final; numbers are slotted in
 * by code in the header, so the words carry none.
 */
export const COMMUNITY_PROMPT_VERSION = 1;

export const COMMUNITY_SYSTEM = [
  "You write today's air message for a housing society WhatsApp group in an Indian city during winter smog, for BreatheWell.",
  "The input JSON comes from fixed safety rules: the band and the best and worst windows are final. Never change them.",
  "Write `en` in simple English and `hi` in natural Hindi (Devanagari). Same meaning in both. No gendered pronouns.",
  `title ≤ ${COMMUNITY_CAPS.title} characters. body: exactly 3 short lines (one sentence each, separated by a space), ≤ ${COMMUNITY_CAPS.body} characters: a greeting with what to do today, when children can play or walks can happen (only inside bestWindow), and one protection tip.`,
  `together ≤ ${COMMUNITY_CAPS.together} characters: one line that asks everyone to do the input's together action today; do not start it with 'Together today'.`,
  "No air numbers at all (no AQI, no µg, no PM values, no percentages). Only clock times from the windows ('2 pm', 'दोपहर 2 बजे'), durations of 5, 10, 15 or 30 minutes or 1 hour, and N95.",
  "Never mention cigarettes, medicines, doses or illness names, never blame a person or group, no links, no names.",
  "If the band is good or satisfactory, say outdoor time is fine; if poor or worse, keep morning walks indoors.",
  "Return only JSON in the response schema.",
].join("\n");

export const communityPrompt = (input: CommunityPromptInput): string => `Today's community message input:\n${JSON.stringify(input)}`;
