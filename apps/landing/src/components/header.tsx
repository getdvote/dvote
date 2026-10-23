import { AltArrowRightIcon, GlobalIcon, HamburgerMenuIcon } from '@solar-icons/react/linear';
import { useEffect, useState } from 'react';
import { DvoteLogo } from '@/components/dvote-logo';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useI18n } from '@/i18n';
import { config, signupUrl } from '@/lib/config';
import { cn } from '@/lib/utils';

const SECTIONS = ['how', 'features', 'pricing', 'faq'] as const;

/** Which section is on screen, for the lime pill in the header (like the dashboard sidebar). */
function useActiveSection() {
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    const els = SECTIONS.map((id) => document.getElementById(id)).filter((e): e is HTMLElement => !!e);
    if (!els.length || !('IntersectionObserver' in window)) return;
    const seen = new Map<string, boolean>();
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => seen.set(e.target.id, e.isIntersecting));
        setActive(SECTIONS.find((id) => seen.get(id)) ?? null);
      },
      { rootMargin: '-45% 0px -50% 0px' },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);
  return active;
}

/** The header sits on the ink frame: paper logo, section links, lime "Start free trial". */
export function Header() {
  const { d, language, setLanguage } = useI18n();
  const [open, setOpen] = useState(false);
  const active = useActiveSection();
  const switchLanguage = () => setLanguage(language === 'ar' ? 'en' : 'ar');
  const links = [
    { id: 'how', label: d.nav.how },
    { id: 'features', label: d.nav.features },
    { id: 'pricing', label: d.nav.pricing },
    { id: 'faq', label: d.nav.faq },
  ];

  return (
    <header className="sticky top-0 z-40 bg-ink">
      <div className="mx-auto flex h-16 max-w-[1240px] items-center gap-6 px-3 md:px-5">
        <a href="#top" className="flex shrink-0 items-center py-2" aria-label="dvote">
          <DvoteLogo height={24} spinOnHover className="text-paper" />
        </a>
        <nav className="hidden items-center gap-0.5 lg:flex">
          {links.map((l) => (
            <a
              key={l.id}
              href={`#${l.id}`}
              aria-current={active === l.id ? 'true' : undefined}
              className={cn(
                'rounded-lg px-3 py-1.5 text-[14px] font-medium transition duration-150',
                active === l.id ? 'bg-brand text-ink' : 'text-paper/70 hover:bg-paper/10 hover:text-paper',
              )}
            >
              {l.label}
            </a>
          ))}
        </nav>
        <div className="ms-auto hidden items-center gap-1 lg:flex">
          <button type="button" onClick={switchLanguage} className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-[14px] text-paper/70 transition duration-150 hover:bg-paper/10 hover:text-paper">
            <GlobalIcon className="size-4" aria-hidden />
            {d.nav.language}
          </button>
          <a href={config.merchantUrl} className="flex h-9 items-center rounded-lg px-3 text-[14px] font-medium text-paper transition duration-150 hover:bg-paper/10">
            {d.nav.logIn}
          </a>
          <Button asChild variant="brand" className="ms-1 h-9 rounded-lg px-4 text-[14px] font-semibold">
            <a href={signupUrl()}>{d.nav.getStarted}</a>
          </Button>
        </div>
        <div className="ms-auto flex items-center gap-1 lg:hidden">
          <Button asChild variant="brand" className="hidden h-9 rounded-lg px-4 text-[14px] font-semibold sm:inline-flex">
            <a href={signupUrl()}>{d.nav.getStarted}</a>
          </Button>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <button type="button" className="flex size-11 items-center justify-center rounded-xl text-paper hover:bg-paper/10" aria-label={d.nav.menu}>
                <HamburgerMenuIcon className="size-6" />
              </button>
            </SheetTrigger>
            <SheetContent className="w-full gap-0 border-0 bg-ink p-0 text-paper data-[side=left]:w-full data-[side=right]:w-full sm:max-w-md [&>button]:text-paper">
              <SheetTitle className="sr-only">{d.nav.menu}</SheetTitle>
              <div className="flex h-16 items-center px-5">
                <DvoteLogo height={22} className="text-paper" />
              </div>
              <nav className="flex-1 overflow-y-auto px-5">
                {links.map((l) => (
                  <a key={l.id} href={`#${l.id}`} onClick={() => setOpen(false)} className="flex items-center justify-between border-b-2 border-dotted border-paper/15 py-5 text-2xl font-semibold tracking-tight">
                    {l.label}
                    <AltArrowRightIcon className="size-5 text-paper/50 rtl:rotate-180" aria-hidden />
                  </a>
                ))}
                <button type="button" onClick={switchLanguage} className="flex w-full items-center gap-2 py-5 text-start text-lg text-paper/70">
                  <GlobalIcon className="size-5" aria-hidden />
                  {d.nav.language}
                </button>
              </nav>
              <div className="grid gap-3 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
                <Button asChild size="xl" variant="brand" className="w-full rounded-xl">
                  <a href={signupUrl()}>{d.nav.signUp}</a>
                </Button>
                <Button asChild size="xl" variant="outline" className="w-full rounded-xl border-paper/20 bg-transparent text-paper hover:bg-paper/10 hover:text-paper">
                  <a href={config.merchantUrl}>{d.nav.logIn}</a>
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
