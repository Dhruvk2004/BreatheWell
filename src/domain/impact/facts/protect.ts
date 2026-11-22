import { fact, SOURCES } from "./types";

/** Masks, effort, medicines and the cigarette picture. */
export const PROTECT_FACTS = [
  fact(
    "n95_fit",
    { en: "A well-fitted N95 blocks most of the tiny smoke bits.", hi: "अच्छी तरह फ़िट N95 मास्क धुएँ के ज़्यादातर छोटे कण रोक लेता है।" },
    {
      en: "N95 filters catch at least 95% of fine particles when there are no gaps at the edges.",
      hi: "किनारों पर जगह न हो तो N95 फ़िल्टर कम से कम 95% बारीक कण रोकता है।",
    },
    SOURCES.epaIndoor,
  ),
  fact(
    "cloth_mask_weak",
    { en: "A cloth or surgical mask blocks very little smoke.", hi: "कपड़े या सर्जिकल मास्क से धुआँ बहुत कम रुकता है।" },
    {
      en: "Loose masks let air in around the edges, where most of the smoke gets through.",
      hi: "ढीले मास्क में किनारों से हवा अंदर आती है, और ज़्यादातर धुआँ वहीं से आता है।",
    },
    SOURCES.epaIndoor,
  ),
  fact(
    "effort_breathing",
    {
      en: "Running or hard play means breathing in much more smoke.",
      hi: "दौड़ने या ज़ोर से खेलने पर साँस के साथ कहीं ज़्यादा धुआँ अंदर जाता है।",
    },
    {
      en: "Breathing rate can rise several times during hard exercise; our exposure figure does not adjust for it.",
      hi: "भारी कसरत में साँस कई गुना तेज़ हो सकती है; हमारा अनुमान इसे नहीं जोड़ता।",
    },
    SOURCES.who,
  ),
  fact(
    "inhaler_handy",
    { en: "Smoky days can set off asthma, so keep the inhaler close.", hi: "धुएँ वाले दिन दमा बढ़ा सकते हैं, इसलिए इनहेलर पास रखें।" },
    {
      en: "CPCB: Moderate air can cause breathing discomfort for people with asthma, lung or heart disease.",
      hi: "CPCB: मध्यम हवा भी दमा, फेफड़े या दिल के रोगियों को साँस में तकलीफ़ दे सकती है।",
    },
    SOURCES.cpcb,
  ),
  fact(
    "cigarette_equivalent",
    {
      en: "We compare a whole day of smoke to cigarettes, for adults only.",
      hi: "हम पूरे दिन के धुएँ की तुलना सिगरेट से करते हैं, केवल बड़ों के लिए।",
    },
    {
      en: "About 22 µg/m³ of PM2.5 breathed for a whole day is like one cigarette (Berkeley Earth). For adults only.",
      hi: "पूरे दिन लगभग 22 µg/m³ PM2.5 साँस में लेना एक सिगरेट जैसा है (Berkeley Earth)। केवल बड़ों के लिए।",
    },
    SOURCES.berkeley,
  ),
  fact(
    "plants_myth",
    { en: "House plants are nice, but they do not clean smog.", hi: "घर के पौधे अच्छे हैं, पर वे धुंध साफ़ नहीं करते।" },
    {
      en: "A room would need hundreds of plants to match one small purifier.",
      hi: "एक छोटे प्यूरीफ़ायर जितना काम करने के लिए कमरे में सैकड़ों पौधे चाहिए।",
    },
    SOURCES.epaCleaner,
  ),
];
