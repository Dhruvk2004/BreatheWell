import { addDays } from "@/domain/time/clock";
import type { WeekTotals } from "@/view/app";
import type { Db } from "../db/types";
import { paths } from "./paths";
import { parsed, progressRecord } from "./records";

const WEEK_DAYS = 7;

/**
 * The family's last 7 days of ticked swaps (spec 7.5, F21 weekly line): the CO₂ and car trips the
 * server stored on each `progress` doc, summed. One `date in [7 dates]` query (spec 11.3: few reads
 * per Today open); a single-field filter, so no composite index is needed.
 */
export async function weekTotals(db: Db, fid: string, today: string): Promise<WeekTotals> {
  const dates = Array.from({ length: WEEK_DAYS }, (_, i) => addDays(today, -i));
  const docs = await db.query(paths.progressAll(fid), [{ field: "date", in: dates }]);
  return docs.reduce(
    (sum, { data }) => {
      const progress = parsed(progressRecord, data);
      return progress ? { co2Kg: sum.co2Kg + progress.co2AvoidedKg, carTrips: sum.carTrips + progress.carTrips } : sum;
    },
    { co2Kg: 0, carTrips: 0 },
  );
}
