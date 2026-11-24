import type { Lang } from "../../time/format";

const b = (en: string, hi: string) => ({ en, hi });

/** "Things to do inside" (about 15). The card shows 3, rotating by day. */
export const INSIDE_IDEAS = [
  b("Carrom", "कैरम"),
  b("Paper planes", "कागज़ के जहाज़"),
  b("Dance to two songs", "दो गानों पर डांस"),
  b("Ludo or snakes and ladders", "लूडो या साँप-सीढ़ी"),
  b("Draw your dream house", "अपने सपनों का घर बनाओ"),
  b("Balloon volleyball", "गुब्बारे से वॉलीबॉल"),
  b("Treasure hunt at home", "घर में ख़ज़ाने की खोज"),
  b("Read a story aloud", "ज़ोर से कहानी पढ़ो"),
  b("Clay or dough shapes", "मिट्टी या आटे से आकार बनाओ"),
  b("Paper folding", "काग़ज़ मोड़कर चीज़ें बनाओ"),
  b("Stretch like animals", "जानवरों की तरह स्ट्रेच करो"),
  b("Hopscotch with tape", "टेप से स्टापू"),
  b("A jigsaw puzzle", "जिगसॉ पहेली"),
  b("Antakshari", "अंताक्षरी"),
  b("Build a cushion fort", "गद्दियों का क़िला बनाओ"),
] as const;

/** Three ideas for a date, rotating through the list (same ideas all day, new ones tomorrow). */
export function insideIdeas(date: string, lang: Lang, count = 3): string[] {
  const [y, m, d] = date.split("-").map(Number);
  const dayNumber = Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
  return Array.from({ length: count }, (_, i) => INSIDE_IDEAS[(dayNumber * count + i) % INSIDE_IDEAS.length][lang]);
}

/** One kid "Why?" line per fact; unknown facts use the sponge line. */
const KID_WHY: Readonly<Record<string, { en: string; hi: string }>> = {
  morning_inversion: b(
    "Cold, still mornings keep the smoke low. The afternoon sun lifts it.",
    "ठंडी, रुकी सुबह धुएँ को नीचे रखती है। दोपहर की धूप उसे ऊपर उठाती है।",
  ),
  afternoon_mixing: b("The afternoon sun lifts the smoke up high.", "दोपहर की धूप धुएँ को ऊपर उठा देती है।"),
  calm_wind: b("There is no wind to blow the smoke away today.", "आज धुआँ उड़ाने के लिए हवा नहीं चल रही।"),
  effort_breathing: b("Running fast means breathing in more smoke.", "तेज़ दौड़ने से साँस में ज़्यादा धुआँ जाता है।"),
  metro_exposure: b("Inside the bus or metro, less smoke gets to you.", "बस या मेट्रो के अंदर तुम तक कम धुआँ पहुँचता है।"),
  windows_shut_morning: b("Shut windows keep the smoke outside.", "बंद खिड़कियाँ धुएँ को बाहर रखती हैं।"),
};

const SPONGE = b(
  "Your lungs are like a sponge. Playing inside today keeps your sponge clean.",
  "तुम्हारे फेफड़े स्पंज जैसे हैं। आज अंदर खेलने से स्पंज साफ़ रहता है।",
);

/** The kid "Why?" line for a fact id. */
export const kidWhy = (factId: string | null, lang: Lang): string => (factId ? (KID_WHY[factId] ?? SPONGE) : SPONGE)[lang];

/** Kid "For the air" lines: what the choice does for the air, in kid words. */
const KID_FOR_AIR = {
  shared_ride: b("Your bus ride means fewer cars puffing smoke today.", "तुम्हारी बस की सवारी से आज कम कारें धुआँ छोड़ेंगी।"),
  stay_in: b("Playing inside adds no smoke to the air.", "अंदर खेलने से हवा में कोई धुआँ नहीं जुड़ता।"),
  no_burning: b("No burning leaves means cleaner air for your street.", "पत्ते न जलाने से तुम्हारी गली की हवा साफ़ रहती है।"),
} as const;

export type KidForAir = keyof typeof KID_FOR_AIR;

/** A kid "For the air" line. */
export const kidForAir = (kind: KidForAir, lang: Lang): string => KID_FOR_AIR[kind][lang];
