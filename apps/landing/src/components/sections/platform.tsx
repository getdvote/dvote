import { BranchingPathsUpIcon, ChartIcon, GiftIcon, ScannerIcon, UserIdIcon, UsersGroupRoundedIcon } from '@solar-icons/react/linear';
import { Container, IconTile, Section, SectionHeading } from '@/components/common';
import { useI18n } from '@/i18n';

const ICONS = [GiftIcon, UserIdIcon, UsersGroupRoundedIcon, ScannerIcon, BranchingPathsUpIcon, ChartIcon];

/** What the dashboard holds: six plain cards. The live dashboard itself is in the hero. */
export function Platform() {
  const { d } = useI18n();
  const p = d.platform;
  return (
    <Section id="features" className="pt-0 sm:pt-0">
      <Container>
        <SectionHeading title={p.title} lead={p.lead} />
        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {p.items.map((it, i) => (
            <li key={it.title} className="rounded-[20px] border border-line p-6">
              <IconTile icon={ICONS[i]} />
              <h3 className="mt-5 text-[18px] font-semibold">{it.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{it.text}</p>
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  );
}
