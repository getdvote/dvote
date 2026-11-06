import { CalendarIcon, QrCodeIcon, ShieldCheckIcon } from '@solar-icons/react/linear';
import { Container, IconTile } from '@/components/common';
import { fill, useI18n } from '@/i18n';
import { usePlans } from '@/lib/plans';

const ICONS = [CalendarIcon, QrCodeIcon, ShieldCheckIcon];

/** The risk taken away, right before the prices. */
export function Trust() {
  const { d } = useI18n();
  const { trialDays } = usePlans();
  const t = d.trust;
  return (
    <section>
      <Container>
        <div className="rounded-[28px] bg-paper p-6 sm:p-10 lg:p-12">
          <h2 className="text-[30px] leading-[1.15] font-semibold tracking-[-0.02em] text-balance sm:text-[40px]">{t.title}</h2>
          <ul className="mt-8 grid gap-4 md:grid-cols-3">
            {t.items.map((it, i) => (
              <li key={it.title} className="rounded-[20px] bg-white p-6">
                <IconTile icon={ICONS[i]} />
                <h3 className="mt-5 text-[18px] font-semibold">{fill(it.title, { days: trialDays })}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{it.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </section>
  );
}
