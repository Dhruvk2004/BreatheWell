import { Bike, Bus, Footprints, House, MessageCircle, Sun, type LucideIcon } from "lucide-react";
import type { PlannedActivity } from "@/domain/family/people";
import type { ActivityType } from "@/domain/rules/activities";
import { translator, type Lang } from "@/i18n/t";
import type { KidCardData } from "@/view/app";
import { TickBox } from "../member/TickBox";
import { CopyButton } from "../ui/CopyButton";
import { ShareButton } from "../ui/ShareButton";
import { btn } from "../ui/styles";
import { KidFace } from "./KidFace";
import { KidFullScreen } from "./KidFullScreen";

/** The activity's own picture when it goes ahead outside or on the way. */
const ICON: Readonly<Record<ActivityType, LucideIcon>> = {
  school_trip: Bus,
  tuition: Bus,
  office_trip: Bus,
  play: Sun,
  morning_walk: Footprints,
  evening_walk: Footprints,
  errands: Footprints,
  sport: Sun,
  cycling: Bike,
};

/** The icon follows what the line says: a house only when the plan moves the activity indoors. */
export function kidIcon(item: PlannedActivity | undefined): LucideIcon {
  if (!item || item.plan.suggestion === "indoor") return House;
  return item.plan.suggestion === "switch_mode" ? Bus : ICON[item.activity.type];
}

/**
 * The kid card (spec 10.12, design D): a face in the band colour, one line per activity, a kid
 * "Why?", three things to do inside, then Show full screen · Share on WhatsApp · Copy. The card
 * speaks the card language; no numbers except clock times, no cigarettes, nothing scary (tested).
 */
export function KidCardView({ kid, lang, pageLang }: { kid: KidCardData; lang: Lang; pageLang: Lang }) {
  const t = translator(lang);
  const ui = translator(pageLang);
  const name = kid.name;
  const faceLabel = t(`kid.face.${kid.band}`);
  return (
    <article aria-labelledby="kid-h" className="overflow-hidden rounded-[22px] border border-rule bg-card shadow-card">
      <div lang={lang}>
        <header className="grid grid-cols-[5em_1fr] items-center gap-4 px-5 pt-5 pb-4">
          <KidFace band={kid.band} label={faceLabel} />
          <div>
            <h1 id="kid-h" className="m-0 text-[0.9375em] font-bold text-ink-muted">
              {t("kid.title", { name })}
            </h1>
            <p className="m-0 text-[1.375em] leading-tight font-bold">{kid.card.headline}</p>
          </div>
        </header>
        <KidLines kid={kid} lang={lang} />
        {kid.checklist && kid.checklist.length > 0 && <KidChecklist kid={kid} lang={lang} />}
        <details className="border-t border-dashed border-rule-strong px-5 py-2">
          <summary className="flex min-h-11 cursor-pointer items-center font-bold text-brand">{t("why.open")}</summary>
          <p className="m-0 pb-2">{kid.card.why}</p>
        </details>
        <div className="px-5 pb-4">
          <h2 className="m-0 text-base font-bold">{t("kid.ideas")}</h2>
          <ul className="mt-1.5 flex list-none flex-wrap gap-1.5 p-0">
            {kid.card.ideas.map((idea) => (
              <li key={idea} className="rounded-pill bg-brand-tint px-3 py-1 text-[0.9375em] font-bold text-brand">
                {idea}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <KidActions kid={kid} name={name} faceLabel={faceLabel} lang={lang} ui={ui} />
    </article>
  );
}

function KidLines({ kid, lang }: { kid: KidCardData; lang: Lang }) {
  const t = translator(lang);
  return (
    <ul className="m-0 grid list-none gap-2 px-5 pb-4">
      {kid.card.lines.map((line, i) => {
        const item = kid.plan.items[i];
        const Icon = kidIcon(item);
        return (
          <li
            key={`${line.label}-${i}`}
            className="grid grid-cols-[2.5em_1fr] items-center gap-3 rounded-[14px] bg-canvas p-3 text-[1.0625em]"
          >
            <span className="grid size-10 place-items-center rounded-[12px] bg-brand-tint text-brand" aria-hidden="true">
              <Icon className="size-5" />
            </span>
            <span className="grid gap-1">
              <span>
                <b className="block text-sm text-ink-muted">{line.label}</b>
                {line.text}
              </span>
              {kid.ticks && item && (
                <TickBox
                  target={{ kind: "plan", forId: kid.ticks.forId, key: item.activity.id }}
                  label={t("member.tick", { activity: line.label })}
                  done={kid.ticks.done.includes(item.activity.id)}
                  lang={lang}
                />
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Checklist items that passed the kid-card checks (spec 7.7.6), "added by Rahul". */
function KidChecklist({ kid, lang }: { kid: KidCardData; lang: Lang }) {
  const t = translator(lang);
  return (
    <div className="px-5 pb-4">
      <h2 className="m-0 text-base font-bold">{t("kid.checklist")}</h2>
      <ul className="mt-1.5 grid list-none gap-1.5 p-0">
        {kid.checklist?.map((item) => (
          <li key={item.id} className="rounded-[12px] bg-canvas px-3 py-2">
            {kid.ticks ? <TickBox target={{ kind: "item", id: item.id }} label={item.text} done={item.done} lang={lang} /> : item.text}{" "}
            <span className="text-sm text-ink-muted">· {t("member.addedBy", { name: item.addedByName })}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface KidActionsProps {
  readonly kid: KidCardData;
  readonly name: string;
  readonly faceLabel: string;
  readonly lang: Lang;
  readonly ui: ReturnType<typeof translator>;
}

function KidActions({ kid, name, faceLabel, lang, ui }: KidActionsProps) {
  return (
    <div className="grid grid-cols-2 gap-2 bg-card-2 px-5 pt-4 pb-5">
      <KidFullScreen openLabel={ui("kid.fullScreen")} closeLabel={ui("kid.close")} title={ui("kid.fullTitle", { name })} lang={lang}>
        <KidFace band={kid.band} label={faceLabel} className="size-36" />
        <p className="m-0 text-[2em] leading-tight font-bold">{`${name}: ${kid.card.headline}`}</p>
        {kid.card.lines.map((line, i) => (
          <p key={`${line.label}-${i}`} className="m-0 text-[1.5em] leading-snug font-bold">
            {line.text}
          </p>
        ))}
      </KidFullScreen>
      <a
        href={`https://wa.me/?text=${encodeURIComponent(kid.shareText)}`}
        target="_blank"
        rel="noopener noreferrer"
        className={`${btn.secondary} ${btn.small}`}
      >
        <MessageCircle className="size-5" aria-hidden="true" />
        {ui("kid.whatsapp")}
      </a>
      <ShareButton text={kid.shareText} label={ui("share.native")} />
      <CopyButton text={kid.shareText} label={ui("share.copy")} done={ui("share.copied")} failed={ui("share.copyFailed")} />
    </div>
  );
}
