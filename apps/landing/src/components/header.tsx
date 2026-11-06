import { AltArrowRightIcon, GlobalIcon, HamburgerMenuIcon } from '@solar-icons/react/linear';
import { useEffect, useState } from 'react';
import { DvoteLogo } from '@/components/dvote-logo';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useI18n } from '@/i18n';
import { config, signupUrl } from '@/lib/config';
import { cn } from '@/lib/utils';

const SECTIONS = ['how', 'features', 'pricing', 'faq'] as const;

/** Which section is on screen, for the quiet highlight in the header. */
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

/** A floating white pill: logo, section links, language, log in, and the one blue action. */
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
    <header className="sticky top-3 z-40 mx-auto mt-3 max-w-[1200px] px-3 md:px-5">
      <div className="flex h-14 items-center gap-5 rounded-full border border-line bg-white/90 ps-5 pe-2 backdrop-blur">
        <a href="#top" className="flex shrink-0 items-center py-2" aria-label="dvote">
          <DvoteLogo height={22} markColor="#1F3DFF" spinOnHover className="text-ink" />
        </a>
        <nav className="hidden items-center gap-0.5 lg:flex">
          {links.map((l) => (
            <a
              key={l.id}
              href={`#${l.id}`}
              aria-current={active === l.id ? 'true' : undefined}
              className={cn(
                'rounded-full px-3 py-1.5 text-[14px] font-medium transition duration-150',
                active === l.id ? 'bg-paper text-ink' : 'text-muted-foreground hover:text-ink',
              )}
            >
              {l.label}
            </a>
          ))}
        </nav>
        <div className="ms-auto hidden items-center gap-1 lg:flex">
          <button type="button" onClick={switchLanguage} className="flex h-10 items-center gap-1.5 rounded-full px-3 text-[14px] text-muted-foreground transition duration-150 hover:text-ink">
            <GlobalIcon className="size-4" aria-hidden />
            {d.nav.language}
          </button>
          <a href={config.merchantUrl} className="flex h-10 items-center rounded-full border border-line px-4 text-[14px] font-medium transition duration-150 hover:border-ink/30">
            {d.nav.logIn}
          </a>
          <Button asChild size="md" variant="brand" className="ms-1 px-5 text-[14px]">
            <a href={signupUrl()}>{d.nav.getStarted}</a>
          </Button>
        </div>
        <div className="ms-auto flex items-center gap-1 lg:hidden">
          <Button asChild size="md" variant="brand" className="px-4 text-[14px]">
            <a href={signupUrl()}>{d.nav.getStarted}</a>
          </Button>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <button type="button" className="flex size-10 items-center justify-center rounded-full hover:bg-paper" aria-label={d.nav.menu}>
                <HamburgerMenuIcon className="size-5" />
              </button>
            </SheetTrigger>
            <SheetContent className="w-full gap-0 border-0 bg-white p-0 data-[side=left]:w-full data-[side=right]:w-full sm:max-w-md">
              <SheetTitle className="sr-only">{d.nav.menu}</SheetTitle>
              <div className="flex h-16 items-center px-5">
                <DvoteLogo height={22} markColor="#1F3DFF" className="text-ink" />
              </div>
              <nav className="flex-1 overflow-y-auto px-5">
                {links.map((l) => (
                  <a key={l.id} href={`#${l.id}`} onClick={() => setOpen(false)} className="flex items-center justify-between border-b border-line py-5 text-[22px] font-semibold">
                    {l.label}
                    <AltArrowRightIcon className="size-5 text-muted-foreground rtl:rotate-180" aria-hidden />
                  </a>
                ))}
                <button type="button" onClick={switchLanguage} className="flex w-full items-center gap-2 py-5 text-start text-[17px] text-muted-foreground">
                  <GlobalIcon className="size-5" aria-hidden />
                  {d.nav.language}
                </button>
              </nav>
              <div className="grid gap-3 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
                <Button asChild size="xl" variant="brand" className="w-full">
                  <a href={signupUrl()}>{d.nav.signUp}</a>
                </Button>
                <Button asChild size="xl" variant="outline" className="w-full">
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
