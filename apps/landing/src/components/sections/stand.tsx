import { SmartphoneVibrationIcon } from '@solar-icons/react/linear';
import { DvoteLogo } from '@/components/dvote-logo';
import { QrGlyph } from '@/components/screens';
import { useI18n } from '@/i18n';

/** "The stand is on us": closes the how-it-works steps. */
export function Stand() {
  const { d } = useI18n();
  const s = d.stand;
  return (
    <div className="mt-12 grid items-center gap-8 rounded-[20px] border border-line p-6 sm:p-8 md:grid-cols-[1fr_auto] md:gap-12">
      <div className="max-w-xl">
        <h3 className="flex flex-wrap items-center gap-3 text-[24px] leading-snug font-semibold sm:text-[28px]">
          {s.title}
          <span className="rounded-full bg-paper px-2.5 py-0.5 text-[13px] font-medium">{s.free}</span>
        </h3>
        <p className="mt-3 text-[16px] leading-relaxed text-muted-foreground">{s.text}</p>
      </div>
      <figure className="w-[190px] rounded-2xl border border-line bg-white p-4 max-md:mx-auto" aria-label={s.standName}>
        <DvoteLogo height={18} markColor="#1F3DFF" className="mx-auto text-ink" />
        <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <QrGlyph className="w-full" seed={11} />
          <span className="h-14 w-px bg-black/10" />
          <span className="flex aspect-square items-center justify-center rounded-full border border-dashed border-black/25 text-ink/70">
            <SmartphoneVibrationIcon className="size-6" aria-hidden />
          </span>
        </div>
        <figcaption className="mt-3 text-center text-[11px] text-muted-foreground">{s.tap}</figcaption>
      </figure>
    </div>
  );
}
