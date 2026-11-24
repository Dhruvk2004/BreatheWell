import { Wind } from "lucide-react";
import type { MorningWeather } from "@/domain/air/pollutants";
import { translator, type Lang } from "@/i18n/t";
import { card, h2 } from "../ui/styles";

/** "Why are mornings worst?" with the day's own 6 am wind and temperature. */
export function WhyMornings({ morning, lang }: { morning: MorningWeather; lang: Lang }) {
  const t = translator(lang);
  return (
    <section aria-labelledby="mornings-h" className={card}>
      <h2 id="mornings-h" className={`${h2} flex items-center gap-2`}>
        <Wind className="size-5 text-brand" aria-hidden="true" />
        {t("air.mornings.title")}
      </h2>
      <p className="m-0">
        {t("air.mornings.weather", { wind: morning.windKmh, temp: morning.tempC })} {t(`air.mornings.${morning.why}`)}
      </p>
    </section>
  );
}
