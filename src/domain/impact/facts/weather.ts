import { fact, SOURCES } from "./types";

/** Why winter mornings are worst, and the official scale. */
export const WEATHER_FACTS = [
  fact(
    "morning_inversion",
    { en: "Cold, still morning air traps smoke near the ground.", hi: "ठंडी और रुकी हुई सुबह की हवा धुएँ को ज़मीन के पास रोक लेती है।" },
    {
      en: "On winter nights a layer of warm air sits over cold air and acts like a lid (an inversion).",
      hi: "सर्दियों की रात में ठंडी हवा के ऊपर गर्म हवा की परत ढक्कन की तरह बैठ जाती है।",
    },
    SOURCES.safar,
  ),
  fact(
    "afternoon_mixing",
    {
      en: "The afternoon sun warms the air and lifts some of the smoke.",
      hi: "दोपहर की धूप हवा को गर्म करती है और कुछ धुआँ ऊपर उठ जाता है।",
    },
    {
      en: "The mixing layer is deepest in the early afternoon, so the same smoke is spread through more air.",
      hi: "दोपहर में हवा की मिलने वाली परत सबसे गहरी होती है, इसलिए वही धुआँ ज़्यादा हवा में फैल जाता है।",
    },
    SOURCES.safar,
  ),
  fact(
    "calm_wind",
    { en: "With almost no wind, smoke stays where it is made.", hi: "हवा लगभग न चले तो धुआँ वहीं रुका रहता है जहाँ बनता है।" },
    {
      en: "Below about 5 km/h of wind, pollution builds up hour by hour.",
      hi: "लगभग 5 किमी प्रति घंटे से धीमी हवा में प्रदूषण हर घंटे बढ़ता जाता है।",
    },
    SOURCES.safar,
  ),
  fact(
    "pm25_size",
    { en: "The tiny smoke bits (PM2.5) go deep into the lungs.", hi: "धुएँ के बहुत छोटे कण (PM2.5) फेफड़ों में गहराई तक जाते हैं।" },
    {
      en: "PM2.5 is particles under 2.5 micrometres, about 30 times thinner than a hair.",
      hi: "PM2.5 यानी 2.5 माइक्रोमीटर से छोटे कण, बाल से लगभग 30 गुना पतले।",
    },
    SOURCES.who,
  ),
  fact(
    "pm_standards",
    { en: "Even a Moderate day is above the health guideline.", hi: "मध्यम दिन भी सेहत की तय सीमा से ऊपर होता है।" },
    {
      en: "India's 24-hour PM2.5 standard is 60 µg/m³; the WHO 2021 guideline is 15 µg/m³.",
      hi: "भारत का 24 घंटे का PM2.5 मानक 60 µg/m³ है; WHO 2021 की सलाह 15 µg/m³ है।",
    },
    SOURCES.who,
  ),
  fact(
    "aqi_method",
    { en: "We turn PM2.5 and PM10 into India's AQI scale.", hi: "हम PM2.5 और PM10 से भारत का AQI निकालते हैं।" },
    {
      en: "CPCB AQI from PM2.5/PM10 breakpoints; hourly values are model estimates. Severe (401–500) runs PM2.5 251–380 and PM10 431–510 µg/m³, the CPCB calculator's upper bounds; above them we show 500+.",
      hi: "CPCB के PM2.5/PM10 ब्रेकपॉइंट से AQI निकाला गया; घंटे के आँकड़े मॉडल के अनुमान हैं। गंभीर (401–500) यानी PM2.5 251–380 और PM10 431–510 µg/m³, CPCB कैलकुलेटर की ऊपरी सीमा; इससे ऊपर हम 500+ दिखाते हैं।",
    },
    SOURCES.cpcb,
  ),
  fact(
    "model_vs_station",
    {
      en: "Model data can read lower than city stations during smog.",
      hi: "धुंध के दिनों में मॉडल के आँकड़े शहर के स्टेशनों से कम दिख सकते हैं।",
    },
    {
      en: "Open-Meteo uses the CAMS model on a grid about 40 km wide, so local smoke is averaged out.",
      hi: "Open-Meteo लगभग 40 किमी के ग्रिड पर CAMS मॉडल लेता है, इसलिए पास का धुआँ औसत में घट जाता है।",
    },
    SOURCES.openMeteo,
  ),
  fact(
    "grap_delhi",
    {
      en: "On Severe days Delhi brings in emergency steps; schools may close.",
      hi: "गंभीर दिनों में दिल्ली में आपात कदम उठाए जाते हैं; स्कूल बंद हो सकते हैं।",
    },
    {
      en: "GRAP stages are announced by CAQM; check official notices for school and office closures.",
      hi: "GRAP के चरण CAQM घोषित करता है; स्कूल और दफ़्तर बंद होने की ख़बर सरकारी सूचना में देखें।",
    },
    SOURCES.caqm,
  ),
];
