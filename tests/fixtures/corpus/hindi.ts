import type { CorpusCase } from "./types";

const good = (text: string, rule?: CorpusCase["rule"]): CorpusCase => ({ text, lang: "hi", rule, expect: [] });

export const HINDI_GOOD: CorpusCase[] = [
  good("आज सैर घर के अंदर करें, बाहर नहीं।", "walkIndoor"),
  good("सुबह 6:30 की सैर छोड़ें। दोपहर 3 बजे चलें।", "walkMove"),
  good("{m1}, आज सुबह 6:30 बजे की सैर छोड़ें, दोपहर 3 बजे जाएँ।", "walkMove"),
  good("आज स्कूल बस से जाएँ, साइकिल से नहीं।", "schoolSwitch"),
  good("अच्छी तरह फ़िट N95 मास्क पहनें।"),
  good("15 मिनट खिड़कियाँ खोलें, फिर बंद कर दें।"),
  good("इनहेलर साथ रखें।"),
  good("दोपहर 2–4 बजे बाहर जाना सबसे अच्छा है।"),
  good("साँस लेने में दिक्कत हो तो 112 पर फ़ोन करें।"),
  good("आज अगरबत्ती या कॉइल न जलाएँ।"),
  good("झाड़ू की जगह गीला पोंछा लगाएँ।"),
  good("शाम 5 बजे टहलें, मज़े करें।", "goPlan"),
  good("पाँच परिवार मिलकर कार छोड़ें।"),
  good("आज सैर हॉल में करें, कल दोपहर 3 बजे बाहर जाएँ।", "walkIndoor"),
  good("{m1} के साथ मेट्रो से जाएँ।"),
  good("एक कमरे में प्यूरीफ़ायर चलाएँ।"),
  good("PM2.5 के छोटे कण फेफड़ों में जाते हैं।"),
  good("दोपहर तक खिड़कियाँ बंद रखें।"),
  good("खाना बनाते समय चिमनी चलाएँ।"),
  good("२ काम एक ही बार में निपटाएँ।"),
  good("आज ऑफ़िस मेट्रो से जाएँ, ज़्यादा आराम रहेगा।"),
  { text: "आज अंदर खेलें, कल धूप में खेलें।", lang: "hi", forDependent: true, expect: [] },
  good("सुबह 6:30 बजे बाहर न जाएँ, दोपहर 3 बजे टहलें।", "walkMove"),
  good("सुबह 6:30 बजे के बजाय दोपहर 3 बजे जाएँ।", "walkMove"),
];

export const HINDI_BAD: CorpusCase[] = [
  { text: "आज AQI ३६८ है।", lang: "hi", expect: ["air_unit", "number_leak"] },
  { text: "हवा में तीन सौ से ज़्यादा धुआँ है।", lang: "hi", expect: ["number_leak"] },
  { text: "आपको दमा है, इसलिए घर में रहें।", lang: "hi", expect: ["diagnosis"] },
  { text: "दो पफ लें।", lang: "hi", expect: ["dosing"] },
  { text: "आज की हवा 11 सिगरेट जैसी है।", lang: "hi", expect: ["cigarette", "number_leak"] },
  { text: "दादाजी, आज सैर छोड़ें।", lang: "hi", expect: ["name_leak"] },
  { text: "सुबह 6:30 बजे सैर पर जाएँ, मज़े करें।", lang: "hi", rule: "walkIndoor", expect: ["go_word_on_avoid"] },
  { text: "दोपहर 3 बजे की सैर आपके लिए बेहतर है।", lang: "hi", rule: "walkIndoor", expect: ["time_on_indoor"] },
  { text: "इनहेलर छोड़ दें।", lang: "hi", expect: ["harmful"] },
  { text: "सुबह 6:30 बजे की सैर करें, कोई चिंता नहीं।", lang: "hi", rule: "walkIndoor", expect: ["go_word_on_avoid", "time_on_indoor"] },
  { text: "सुबह 6:30 बजे टहलें, यह ज़्यादा बुरा नहीं है।", lang: "hi", rule: "walkIndoor", expect: ["go_word_on_avoid"] },
  { text: "सुबह 6:30 बजे और दोपहर 3 बजे टहलें, कोई जल्दी नहीं।", lang: "hi", rule: "walkMove", expect: ["usual_time_without_skip"] },
  { text: "सुबह 6:30 बजे टहलना बुरा नहीं है।", lang: "hi", rule: "walkMove", expect: ["usual_time_without_skip"] },
  { text: "सुबह 6:30 बजे टहलें, चिंता न करें।", lang: "hi", rule: "walkIndoor", expect: ["go_word_on_avoid"] },
  { text: "मास्क की ज़रूरत नहीं है।", lang: "hi", expect: ["harmful"] },
  { text: "धुएँ से मौत हो सकती है।", lang: "hi", forDependent: true, expect: ["fear_word"] },
  { text: "Skip the walk today.", lang: "hi", expect: ["wrong_language"] },
  { text: "शाम 7 बजे सैर करें।", lang: "hi", rule: "walkMove", expect: ["missing_best_time", "time_not_allowed"] },
  { text: "आज साइकिल से स्कूल जाओ।", lang: "hi", rule: "schoolSwitch", expect: ["missing_switch_mode"] },
  { text: "कैंसर का खतरा है।", lang: "hi", forDependent: true, expect: ["fear_word"] },
  { text: "यह इलाज है।", lang: "hi", expect: ["diagnosis"] },
];

/** Hinglish (Hindi typed in Latin script) in a Hindi field fails the Devanagari check. */
export const HINGLISH_BAD: CorpusCase[] = [
  "dadaji ko walk kab karni chahiye",
  "aaj bahar mat jao",
  "saans nahi aa rahi to doctor ko dikhao",
  "bachchon ko bus se bhejo",
  "khidki band rakho",
  "mask pehen lo",
  "inhaler check kar lo",
  "aaj hawa kharab hai",
  "shaam ko park chalein?",
  "chimney chala do",
].map((text) => ({ text, lang: "hi" as const, expect: ["wrong_language" as const] }));
