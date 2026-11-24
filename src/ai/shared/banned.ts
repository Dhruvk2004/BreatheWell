import { containsPhrase } from "@/domain/names/words";
import { mentionsCigarette } from "@/domain/safety/cigarette";
import { harmfulAdvice, hasLink } from "./harmful";
import { nfc, nfcRegExp } from "./text";

/**
 * Banned content, by pattern and whole word, so "diet" and "indie" pass.
 * "Inhaler" is allowed: the plan uses it.
 */
export type BanProblem = "diagnosis" | "medicine" | "dosing" | "fear_word" | "cigarette" | "url" | "name_leak" | "harmful" | "system_leak";

const CONDITIONS = String.raw`(?:asthma|copd|a lung disease|lung disease|heart disease|a heart condition|bronchitis|pneumonia|an infection|allergies|an allergy)`;
const DIAGNOSIS = [
  new RegExp(String.raw`\byou\s+(?:have|may have|might have|probably have|could have)\s+${CONDITIONS}\b`, "iu"),
  /\byou\s+(?:are|seem to be)\s+suffering\s+from\b/iu,
  /\b(?:cure|cures|cured)\b/iu,
  nfcRegExp("आपको[^।.!?]{0,24}(?:दमा|अस्थमा|सीओपीडी|दिल की बीमारी|फेफड़ों की बीमारी|एलर्जी|संक्रमण)[^।.!?]{0,12}है"),
  nfcRegExp("इलाज"),
];
const MEDICINES = [
  "salbutamol",
  "albuterol",
  "asthalin",
  "levolin",
  "budesonide",
  "budecort",
  "foracort",
  "seroflo",
  "montelukast",
  "prednisolone",
  "steroid",
  "steroids",
  "antibiotic",
  "antibiotics",
  "paracetamol",
  "cetirizine",
  "azithromycin",
  "स्टेरॉयड",
  "एंटीबायोटिक",
  "पैरासिटामोल",
];
const DOSING = [
  /\d+\s*puffs?\b/iu,
  /\b\d*\s*mg\b/iu,
  /\btablets?\s+(?:a|per|each)\s+day\b/iu,
  nfcRegExp("खुराक"),
  nfcRegExp("\\d+\\s*पफ"),
  /\bdose\b|\bdosage\b/iu,
];
const FEAR = ["die", "dies", "dying", "death", "dead", "cancer", "kill", "kills", "poison", "मौत", "मरना", "मर", "कैंसर", "ज़हर", "जहर"];
const URL = /https?:\/\/|\bwww\.|\b[\w-]+\.(?:com|in|org|net|io)\b/iu;
const HARMFUL = [
  "skip inhaler",
  "skip the inhaler",
  "skip your inhaler",
  "stop medicine",
  "stop the medicine",
  "stop your medicine",
  "no mask needed",
  "don't need a mask",
  "do not need a mask",
  "mask is not needed",
];
const HARMFUL_HI = [
  nfcRegExp("इनहेलर[^।]{0,12}(?:छोड़|न लें|बंद)"),
  nfcRegExp("दवा[^।]{0,12}(?:बंद|छोड़)"),
  nfcRegExp("मास्क की (?:ज़|ज)रूरत नहीं"),
];
const SYSTEM = ["system prompt", "api key", "my instructions", "other families", "सिस्टम प्रॉम्प्ट"];

const anyPhrase = (text: string, phrases: readonly string[]) => phrases.some((p) => containsPhrase(text, p));

export interface BanContext {
  /** Every member's and dependent's name and alias; Gemini never received one. */
  readonly names: readonly string[];
  /** The text is for a dependent: fear words are banned too. */
  readonly forDependent: boolean;
}

/** Every banned-content problem in a text. */
export function banProblems(raw: string, ctx: BanContext): BanProblem[] {
  const text = nfc(raw);
  const problems: BanProblem[] = [];
  if (DIAGNOSIS.some((re) => re.test(text))) problems.push("diagnosis");
  if (anyPhrase(text, MEDICINES)) problems.push("medicine");
  if (DOSING.some((re) => re.test(text))) problems.push("dosing");
  if (ctx.forDependent && anyPhrase(text, FEAR)) problems.push("fear_word");
  if (mentionsCigarette(text)) problems.push("cigarette");
  if (URL.test(text) || hasLink(text)) problems.push("url");
  if (anyPhrase(text, ctx.names)) problems.push("name_leak");
  if (anyPhrase(text, HARMFUL) || HARMFUL_HI.some((re) => re.test(text)) || harmfulAdvice(text)) problems.push("harmful");
  if (anyPhrase(text, SYSTEM)) problems.push("system_leak");
  return problems;
}
