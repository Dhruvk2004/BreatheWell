import { currentLang } from "@/i18n/server";
import { translator } from "@/i18n/t";

/** The signed-in pages' fallback while the session and the family load: words, never a band colour. */
export async function PageLoading() {
  const t = translator(await currentLang());
  return (
    <div aria-busy="true" className="grid gap-3">
      <p role="status" className="m-0 font-bold">
        {t("air.loading")}
      </p>
      <span className="block h-24 rounded-[16px] bg-card-2" />
      <span className="block h-40 rounded-[16px] bg-card-2" />
    </div>
  );
}
