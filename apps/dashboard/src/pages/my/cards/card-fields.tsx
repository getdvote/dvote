import { AltArrowDownIcon, CheckIcon, ClockCircleIcon } from '@solar-icons/react/linear';
import { useEffect, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { t } from '../../../i18n';
import type { Bilingual, CardBackgroundStyle, CardDesign, HoursSlot } from '../../../lib/api';
import { dayName } from '../../../lib/hours';
import { BACKGROUND_STYLES, cardBackground, isHex } from '../../../lib/card-look';

/** A colour: swatch (native picker) + hex text, with an optional switch under it. */
export function ColorField({
  id,
  label,
  value,
  onChange,
  disabled,
  toggle,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (hex: string) => void;
  disabled?: boolean;
  toggle?: {
    label: string;
    checked: boolean;
    onChange: (v: boolean) => void;
    disabled?: boolean;
  };
}) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <div className="grid content-start gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <label
          className={cn('relative size-9 shrink-0 overflow-hidden rounded-md border shadow-xs', disabled && 'cursor-not-allowed')}
          style={{ backgroundColor: value }}
        >
          <span className="sr-only">{label}</span>
          <input
            type="color"
            value={value}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value.toUpperCase())}
            className="absolute inset-0 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
          />
        </label>
        <Input
          id={id}
          dir="ltr"
          value={text}
          disabled={disabled}
          maxLength={7}
          aria-invalid={!isHex(text)}
          onChange={(e) => {
            const v = e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`;
            setText(v);
            if (isHex(v)) onChange(v.toUpperCase());
          }}
          className="font-mono uppercase"
        />
      </div>
      {toggle ? (
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={toggle.checked} disabled={toggle.disabled} onCheckedChange={toggle.onChange} />
          {toggle.label}
        </label>
      ) : null}
    </div>
  );
}

/** The 5 designs as small cards in the chosen colour; the selected one is ringed. */
export function BackgroundPicker({
  design,
  value,
  onChange,
  disabled,
}: {
  design: CardDesign;
  value: CardBackgroundStyle | null;
  onChange: (style: CardBackgroundStyle) => void;
  disabled?: boolean;
}) {
  return (
    <div className="@container">
      <div role="radiogroup" aria-label={t('cards.background.title')} className="grid grid-cols-3 gap-2 @xl:grid-cols-5">
        {BACKGROUND_STYLES.map((style) => {
          const selected = value === style;
          return (
            <button
              key={style}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onChange(style)}
              className={cn(
                'group grid gap-1.5 rounded-xl border p-1.5 text-start text-xs transition duration-100 ease-linear hover:border-foreground/30 disabled:cursor-not-allowed disabled:opacity-50',
                selected && 'border-primary ring-2 ring-primary/30',
              )}
            >
              <span
                className="relative block aspect-[1.6] w-full overflow-hidden rounded-lg"
                style={cardBackground({
                  ...design,
                  background: { style, imageUrl: null, imagePath: null },
                })}
              >
                {selected ? (
                  <span className="absolute end-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-white text-primary shadow">
                    <CheckIcon className="size-3.5" />
                  </span>
                ) : null}
              </span>
              <span className="truncate px-0.5 font-medium">{t(`cards.background.styles.${style}`)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** English + Arabic inputs for one text (Arabic optional: English shows when empty). */
export function BilingualField({
  id,
  label,
  hint,
  value,
  onChange,
  maxLength,
  disabled,
}: {
  id: string;
  label: string;
  hint?: ReactNode;
  value: Bilingual;
  onChange: (v: Bilingual) => void;
  maxLength: number;
  disabled?: boolean;
}) {
  return (
    <fieldset className="@container grid gap-2">
      <legend className="mb-2 text-sm font-medium">{label}</legend>
      <div className="grid gap-3 @md:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-en`} className="text-xs font-normal text-muted-foreground">
            {t('cards.front.english')}
          </Label>
          <Input
            id={`${id}-en`}
            dir="ltr"
            lang="en"
            value={value.en}
            maxLength={maxLength}
            disabled={disabled}
            onChange={(e) => onChange({ ...value, en: e.target.value })}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-ar`} className="text-xs font-normal text-muted-foreground">
            {t('cards.front.arabicOptional')}
          </Label>
          <Input
            id={`${id}-ar`}
            dir="rtl"
            lang="ar"
            value={value.ar}
            maxLength={maxLength}
            disabled={disabled}
            placeholder={value.en}
            onChange={(e) => onChange({ ...value, ar: e.target.value })}
          />
        </div>
      </div>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </fieldset>
  );
}

/** Money for one point, with the currency in front. */
export function SpendInput({ id, currency, value, onChange }: { id: string; currency: string; value: string; onChange: (v: string) => void }) {
  return (
    <div
      className="flex h-9 items-stretch overflow-hidden rounded-md border shadow-xs focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50"
      dir="ltr"
    >
      <span className="flex items-center border-e bg-muted px-3 text-sm text-muted-foreground">{currency}</span>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        min={0.01}
        step={0.01}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full min-w-0 bg-transparent px-3 text-sm outline-none"
      />
    </div>
  );
}

/** A valid money amount for the API (0.01 … 99,999,999.99, two decimals), else null. */
export function spendValue(text: string): number | null {
  const n = Number(text);
  return Number.isFinite(n) && n >= 0.01 && n <= 99_999_999.99 && Math.abs(Math.round(n * 100) - n * 100) < 1e-6 ? Math.round(n * 100) / 100 : null;
}

/** Sunday first; the card shows one opening time per day. */
const CARD_WEEK = [0, 1, 2, 3, 4, 5, 6];

/** Opening hours on the back of the card: tick the open days, one opening and closing time each. */
export function CardHoursEditor({ value, onChange }: { value: HoursSlot[]; onChange: (v: HoursSlot[]) => void }) {
  const slotOf = (day: number) => value.find((s) => s.day === day);
  const setDay = (day: number, slot: Omit<HoursSlot, 'day'> | null) =>
    onChange([...value.filter((s) => s.day !== day), ...(slot ? [{ ...slot, day }] : [])].sort((a, b) => a.day - b.day));
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1 text-sm font-medium">{t('cards.back.hours')}</legend>
      <p className="text-xs text-muted-foreground">{t('cards.back.hoursHint')}</p>
      <ul className="grid divide-y rounded-xl border">
        {CARD_WEEK.map((day) => {
          const slot = slotOf(day);
          return (
            <li key={day} className="flex min-h-12 min-w-0 flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2">
              <label className="flex w-32 items-center gap-2 text-sm">
                <Switch
                  checked={!!slot}
                  onCheckedChange={(on) => setDay(day, on ? (slotOf(day) ?? { opensAt: '09:00', closesAt: '23:00' }) : null)}
                />
                {dayName(day)}
              </label>
              {slot ? (
                <div className="flex min-w-0 items-center gap-2 text-sm" dir="ltr">
                  <TimeField
                    label={`${dayName(day)} · ${t('cards.back.opens')}`}
                    value={slot.opensAt}
                    onChange={(opensAt) => setDay(day, { ...slot, opensAt })}
                  />
                  <span className="text-muted-foreground">–</span>
                  <TimeField
                    label={`${dayName(day)} · ${t('cards.back.closes')}`}
                    value={slot.closesAt}
                    onChange={(closesAt) => setDay(day, { ...slot, closesAt })}
                  />
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">{t('cards.back.closed')}</span>
              )}
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}

const HOURS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0'));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

/** A time ("HH:MM", 5-minute steps), picked in a popover like the dashboard's date picker. */
export function TimeField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [h, m] = draft.split(':');
  const column = (items: string[], current: string, pick: (v: string) => void, name: string) => (
    <div role="listbox" aria-label={name} className="grid max-h-56 w-16 gap-0.5 overflow-y-auto overscroll-contain p-1 [scrollbar-width:thin]">
      {items.map((v) => (
        <button
          key={v}
          type="button"
          role="option"
          aria-selected={v === current}
          ref={
            v === current
              ? (el) => {
                  if (el?.parentElement) el.parentElement.scrollTop = el.offsetTop - el.parentElement.clientHeight / 2 + el.clientHeight / 2;
                }
              : undefined
          }
          onClick={() => pick(v)}
          className={cn(
            'h-8 rounded-md text-sm tabular-nums transition duration-100 ease-linear hover:bg-muted',
            v === current && 'bg-primary text-primary-foreground hover:bg-primary',
          )}
        >
          {v}
        </button>
      ))}
    </div>
  );
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) setDraft(value);
        setOpen(next);
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="outline" aria-label={label} className="h-9 w-28 justify-between gap-2 font-normal tabular-nums" dir="ltr">
          <span className="flex items-center gap-2">
            <ClockCircleIcon className="size-4 text-muted-foreground" />
            {value}
          </span>
          <AltArrowDownIcon className="size-4 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto gap-0 p-0" dir="ltr">
        <div className="flex divide-x">
          {column(HOURS, h, (v) => setDraft(`${v}:${m}`), t('cards.back.hour'))}
          {column(MINUTES.includes(m) ? MINUTES : [...MINUTES, m].sort(), m, (v) => setDraft(`${h}:${v}`), t('cards.back.minute'))}
        </div>
        <div className="flex items-center justify-between gap-3 border-t p-2">
          <span className="rounded-md border px-2 py-1 text-sm font-medium tabular-nums">{draft}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              size="sm"
              onClick={() => {
                onChange(draft);
                setOpen(false);
              }}
            >
              {t('period.apply')}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
