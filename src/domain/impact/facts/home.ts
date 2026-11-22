import { fact, SOURCES } from "./types";

/** Indoor air: windows, purifier, cooking, incense and smoke at home. */
export const HOME_FACTS = [
  fact(
    "windows_shut_morning",
    { en: "Shut windows keep out most of the morning smoke.", hi: "बंद खिड़कियाँ सुबह का ज़्यादातर धुआँ बाहर रखती हैं।" },
    {
      en: "With windows shut, indoor PM2.5 is often about 70% of outdoors; we use 0.7 in our maths.",
      hi: "खिड़कियाँ बंद हों तो घर के अंदर PM2.5 अक्सर बाहर का लगभग 70% होता है; हम हिसाब में 0.7 लेते हैं।",
    },
    SOURCES.epaIndoor,
  ),
  fact(
    "air_out_short",
    {
      en: "A short airing at the cleanest hour clears cooking smells without letting smog in.",
      hi: "सबसे साफ़ घंटे में थोड़ी देर हवा आने देने से रसोई की गंध निकलती है और धुंध नहीं आती।",
    },
    { en: "15 minutes is enough to swap most of a room's air.", hi: "कमरे की ज़्यादातर हवा बदलने के लिए 15 मिनट काफ़ी हैं।" },
    SOURCES.epaIndoor,
  ),
  fact(
    "purifier_room_door",
    { en: "A purifier works best in one room with the door shut.", hi: "प्यूरीफ़ायर एक कमरे में दरवाज़ा बंद रखकर सबसे अच्छा काम करता है।" },
    {
      en: "With the door shut and the purifier on high, the room's PM2.5 can drop to about a third; we use 0.35.",
      hi: "दरवाज़ा बंद और प्यूरीफ़ायर तेज़ हो तो कमरे का PM2.5 लगभग एक तिहाई रह सकता है; हम 0.35 लेते हैं।",
    },
    SOURCES.epaCleaner,
  ),
  fact(
    "clean_room",
    {
      en: "Without a purifier, make one room the clean room: shut it and keep it free of smoke.",
      hi: "प्यूरीफ़ायर न हो तो एक कमरे को साफ़ कमरा बनाएँ: उसे बंद रखें और वहाँ धुआँ न होने दें।",
    },
    {
      en: "Fewer openings and no indoor sources keep one room cleaner than the rest of the home.",
      hi: "कम खुली जगह और अंदर कोई धुआँ न हो तो एक कमरा बाकी घर से साफ़ रहता है।",
    },
    SOURCES.epaIndoor,
  ),
  fact(
    "incense_pm",
    {
      en: "Incense and dhoop fill the room with the same tiny smoke bits as smog.",
      hi: "अगरबत्ती और धूप से कमरे में धुंध जैसे ही छोटे कण भर जाते हैं।",
    },
    {
      en: "One stick of incense can push indoor PM2.5 far above outdoor levels in a closed room.",
      hi: "बंद कमरे में एक अगरबत्ती भी अंदर का PM2.5 बाहर से कहीं ज़्यादा कर सकती है।",
    },
    SOURCES.epaIndoor,
  ),
  fact(
    "mosquito_coil_pm",
    {
      en: "A mosquito coil gives off a lot of smoke all night; an electric repellent does not.",
      hi: "मच्छर वाली कॉइल रात भर बहुत धुआँ देती है; बिजली वाला रिपेलेंट नहीं।",
    },
    {
      en: "Burning coils release fine particles for hours in the room where people sleep.",
      hi: "जलती कॉइल सोने के कमरे में घंटों तक बारीक कण छोड़ती है।",
    },
    SOURCES.epaIndoor,
  ),
  fact(
    "wet_mop_vs_sweep",
    {
      en: "Wet mopping picks dust up; dry sweeping throws it back into the air.",
      hi: "गीला पोंछा धूल उठा लेता है; सूखी झाड़ू उसे फिर हवा में उड़ा देती है।",
    },
    {
      en: "Settled dust holds fine particles that a broom puts back into the air you breathe.",
      hi: "जमी धूल में बारीक कण होते हैं जो झाड़ू से फिर साँस की हवा में आ जाते हैं।",
    },
    SOURCES.epaIndoor,
  ),
  fact(
    "chimney_on",
    { en: "Run the chimney or exhaust fan whenever you cook.", hi: "खाना बनाते समय हमेशा चिमनी या एग्ज़ॉस्ट फ़ैन चलाएँ।" },
    {
      en: "Frying and tadka add a burst of fine particles; extraction removes them at the source.",
      hi: "तलने और तड़के से बारीक कण अचानक बढ़ते हैं; चिमनी उन्हें वहीं से बाहर निकालती है।",
    },
    SOURCES.epaIndoor,
  ),
  fact(
    "solid_fuel_smoke",
    {
      en: "Wood, coal and dung smoke is the most harmful smoke in a home.",
      hi: "लकड़ी, कोयले और उपले का धुआँ घर का सबसे नुकसानदेह धुआँ है।",
    },
    {
      en: "Household solid fuel is a leading cause of indoor air pollution in India; LPG cuts it sharply.",
      hi: "भारत में घर के अंदर प्रदूषण की बड़ी वजह ठोस ईंधन है; LPG से यह बहुत घटता है।",
    },
    SOURCES.who,
  ),
  fact(
    "indoor_smoking",
    {
      en: "Smoking inside fills every room with smoke that stays for hours.",
      hi: "घर के अंदर धूम्रपान से हर कमरे में धुआँ भर जाता है जो घंटों रहता है।",
    },
    {
      en: "Second-hand smoke is fine particles plus gases; smoking outdoors, away from windows, helps everyone.",
      hi: "दूसरों का धुआँ बारीक कण और गैसें हैं; बाहर, खिड़कियों से दूर पीने से सबको मदद मिलती है।",
    },
    SOURCES.who,
  ),
  fact(
    "fresh_air_vent",
    { en: "An AC fresh-air vent pulls outdoor smoke inside.", hi: "AC का ताज़ी हवा वाला वेंट बाहर का धुआँ अंदर खींचता है।" },
    {
      en: "Switching to recirculation during the worst hours keeps the indoor air from tracking the outdoor peak.",
      hi: "सबसे खराब घंटों में रीसर्कुलेशन पर रखने से अंदर की हवा बाहर जितनी खराब नहीं होती।",
    },
    SOURCES.epaIndoor,
  ),
];
