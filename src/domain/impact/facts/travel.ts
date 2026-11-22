import { fact, SOURCES } from "./types";

/** Travel and community facts. */
export const TRAVEL_FACTS = [
  fact(
    "metro_exposure",
    {
      en: "On the metro you breathe about half the smoke of the same trip in the open.",
      hi: "मेट्रो में उसी सफ़र के मुक़ाबले लगभग आधा धुआँ साँस में जाता है।",
    },
    {
      en: "Enclosed travel factor 0.5 against open travel 1.0 in our exposure model.",
      hi: "हमारे हिसाब में बंद सफ़र का गुणांक 0.5 और खुले सफ़र का 1.0 है।",
    },
    SOURCES.epaIndoor,
  ),
  fact(
    "car_recirculation",
    { en: "In a car, keep the windows up and the air on recirculate.", hi: "कार में शीशे बंद रखें और हवा रीसर्कुलेट पर रखें।" },
    {
      en: "Recirculation keeps cabin PM2.5 well below the road outside; we use 0.5.",
      hi: "रीसर्कुलेशन से केबिन का PM2.5 सड़क से काफ़ी कम रहता है; हम 0.5 लेते हैं।",
    },
    SOURCES.epaIndoor,
  ),
  fact(
    "two_wheeler_exposure",
    {
      en: "On a scooter or cycle you breathe the traffic smoke right at exhaust level.",
      hi: "स्कूटर या साइकिल पर आप ट्रैफ़िक का धुआँ ठीक साइलेंसर की ऊँचाई पर साँस में लेते हैं।",
    },
    {
      en: "Open travel in traffic counts as factor 1.0 and Moderate effort in our rules.",
      hi: "ट्रैफ़िक में खुले सफ़र को हमारे नियम गुणांक 1.0 और मध्यम मेहनत मानते हैं।",
    },
    SOURCES.epaIndoor,
  ),
  fact(
    "idling_engine",
    { en: "A waiting engine makes smoke and goes nowhere; switch it off.", hi: "खड़ा इंजन धुआँ बनाता है और कहीं नहीं जाता; उसे बंद करें।" },
    {
      en: "Switching off at signals and school gates removes smoke where people stand and wait.",
      hi: "सिग्नल और स्कूल गेट पर इंजन बंद करने से वहीं धुआँ घटता है जहाँ लोग खड़े होकर इंतज़ार करते हैं।",
    },
    SOURCES.who,
  ),
  fact(
    "vehicles_share_winter",
    {
      en: "Traffic is one of the biggest sources of Delhi's winter smoke.",
      hi: "दिल्ली के सर्दियों के धुएँ का एक बड़ा स्रोत गाड़ियाँ हैं।",
    },
    {
      en: "Source studies give vehicles a large share of winter PM2.5 in Delhi; fewer car trips help directly.",
      hi: "अध्ययनों के अनुसार सर्दियों में दिल्ली के PM2.5 में गाड़ियों का बड़ा हिस्सा है; कम कार यात्राओं से सीधी मदद मिलती है।",
    },
    SOURCES.safar,
  ),
  fact(
    "leaf_burning_winter",
    {
      en: "Burning leaves or garbage puts thick smoke right into your street.",
      hi: "पत्ते या कचरा जलाने से गाढ़ा धुआँ सीधे आपकी गली में आता है।",
    },
    {
      en: "Open burning is banned under GRAP; composting leaves avoids the smoke entirely.",
      hi: "GRAP में खुले में जलाना मना है; पत्तों की खाद बनाने से धुआँ होता ही नहीं।",
    },
    SOURCES.caqm,
  ),
];
