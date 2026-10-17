import { GlobeIcon } from '@solar-icons/react/linear';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LANGUAGES, useI18n, type Language } from '../i18n';

/** English / العربية, saved in this browser. */
export function LanguageToggle() {
  const { language, setLanguage, t } = useI18n();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t('common.language')}>
          <GlobeIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup value={language} onValueChange={(v) => setLanguage(v as Language)}>
          {LANGUAGES.map((l) => (
            <DropdownMenuRadioItem key={l.code} value={l.code} lang={l.code}>
              {l.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The same choice as a small EN | ع pill, for the sidebar footer. */
export function LanguageSwitch() {
  const { language, setLanguage, t } = useI18n();
  return (
    <div role="group" aria-label={t('common.language')} className="flex items-center rounded-full bg-foreground/[0.06] p-0.5">
      {LANGUAGES.map((l) => (
        <button
          key={l.code}
          type="button"
          lang={l.code}
          title={l.label}
          aria-pressed={language === l.code}
          onClick={() => setLanguage(l.code)}
          className="h-7 min-w-9 rounded-full px-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground aria-pressed:bg-card aria-pressed:text-foreground aria-pressed:shadow-xs"
        >
          {l.short}
        </button>
      ))}
    </div>
  );
}
