import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { ErrorAlert } from '../../../components/ErrorAlert';
import { t, useI18n } from '../../../i18n';
import type { CardDesign, Vendor } from '../../../lib/api';
import { cardDesign as legacyDesign } from '../../../lib/cardDesigns';
import { defaultDesign, readableInk, softLabel, ltr } from '../../../lib/card-look';
import { useVendorApi } from '../../../lib/vendor-workspace';
import { CardFace } from './card-face';
import { BackgroundPicker, ColorField, SpendInput, spendValue } from './card-fields';

const STEPS = ['name', 'points', 'look', 'review'] as const;

/** The merchant's colour for a first card: brand colour, else the colour its old card had. */
export const startColor = (vendor: Vendor) => vendor.brandPrimary?.toUpperCase() ?? legacyDesign(vendor.id, vendor.cardDesign).colors[0];

/** First card: a 4-step funnel (name → points → look → review) in a modal. */
export function CreateCardDialog({ open, onOpenChange, vendor }: { open: boolean; onOpenChange: (o: boolean) => void; vendor: Vendor }) {
  const api = useVendorApi();
  const { language } = useI18n();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [spend, setSpend] = useState('10');
  const [design, setDesign] = useState<CardDesign>(() => {
    const d = defaultDesign('', startColor(vendor));
    return { ...d, colors: { ...d.colors, useBrand: !!vendor.brandPrimary } };
  });

  const create = useMutation({
    mutationFn: () =>
      api.createLoyaltyCard({
        name: name.trim(),
        spendAmount: spendValue(spend)!,
        design: {
          ...design,
          front: {
            ...design.front,
            title: { en: name.trim().slice(0, 40), ar: '' },
          },
        },
      }),
    onSuccess: (info) => {
      qc.setQueryData(['loyalty-card'], info);
      toast.success(t('cards.funnel.created'));
      onOpenChange(false);
      setStep(0);
    },
  });

  const key = STEPS[step];
  const canNext = key === 'name' ? name.trim().length > 0 : key === 'points' ? spendValue(spend) !== null : true;
  const setBackground = (hex: string, useBrand = design.colors.useBrand) => {
    const ink = readableInk(hex);
    setDesign({
      ...design,
      colors: {
        ...design.colors,
        background: hex,
        text: ink,
        label: softLabel(ink),
        useBrand,
      },
    });
  };
  const preview = {
    ...design,
    front: {
      ...design.front,
      title: { en: name.trim() || vendor.name, ar: '' },
    },
  };
  const amount = ltr(`${spendValue(spend) ?? '…'} ${vendor.currency}`);

  return (
    <Dialog open={open} onOpenChange={(o) => !create.isPending && onOpenChange(o)}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <p className="text-xs font-medium text-muted-foreground">{t('cards.funnel.step', { n: step + 1, total: STEPS.length })}</p>
          <DialogTitle>{t(`cards.funnel.${key}Title`)}</DialogTitle>
          <DialogDescription>{t(`cards.funnel.${key}Text`)}</DialogDescription>
        </DialogHeader>

        <ol className="grid grid-cols-4 gap-1.5" aria-label={t('cards.funnel.title')}>
          {STEPS.map((s, i) => (
            <li key={s} className="grid gap-1">
              <span className={cn('h-1 rounded-full', i <= step ? 'bg-primary' : 'bg-muted')} />
              <span
                className={cn('truncate text-xs', i === step ? 'font-medium' : 'text-muted-foreground')}
                aria-current={i === step ? 'step' : undefined}
              >
                {t(`cards.funnel.steps.${s}`)}
              </span>
            </li>
          ))}
        </ol>

        <form
          id="create-card"
          className="grid gap-4 py-1"
          onSubmit={(e) => {
            e.preventDefault();
            if (!canNext) return;
            if (step < STEPS.length - 1) setStep(step + 1);
            else create.mutate();
          }}
        >
          {key === 'name' ? (
            <div className="grid gap-2">
              <Label htmlFor="card-name">{t('cards.settings.name')}</Label>
              <Input
                id="card-name"
                autoFocus
                maxLength={60}
                value={name}
                placeholder={t('cards.funnel.namePlaceholder')}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          ) : null}

          {key === 'points' ? (
            <div className="grid gap-2">
              <Label htmlFor="card-spend">{t('cards.settings.spend')}</Label>
              <SpendInput id="card-spend" currency={vendor.currency} value={spend} onChange={setSpend} />
              <p className="text-sm text-muted-foreground">{t('cards.settings.sentence', { amount })}</p>
            </div>
          ) : null}

          {key === 'look' ? (
            <div className="grid gap-5 sm:grid-cols-[1fr_auto]">
              <div className="grid content-start gap-4">
                <ColorField
                  id="card-color"
                  label={t('cards.colors.background')}
                  value={design.colors.background}
                  onChange={(hex) => setBackground(hex, false)}
                  disabled={design.colors.useBrand && !!vendor.brandPrimary}
                  toggle={{
                    label: t('cards.colors.useBrand'),
                    checked: design.colors.useBrand && !!vendor.brandPrimary,
                    disabled: !vendor.brandPrimary,
                    onChange: (on) => setBackground(on && vendor.brandPrimary ? vendor.brandPrimary.toUpperCase() : design.colors.background, on),
                  }}
                />
                {!vendor.brandPrimary ? <p className="-mt-2 text-xs text-muted-foreground">{t('cards.colors.noBrand')}</p> : null}
                <BackgroundPicker
                  design={design}
                  value={design.background.style}
                  onChange={(style) =>
                    setDesign({
                      ...design,
                      background: { ...design.background, style },
                    })
                  }
                />
              </div>
              <CardFace design={preview} device="iphone" lang={language} points={0} merchant={vendor} width={170} className="mx-auto" />
            </div>
          ) : null}

          {key === 'review' ? (
            <div className="grid items-center gap-5 sm:grid-cols-[auto_1fr]">
              <CardFace design={preview} device="iphone" lang={language} points={0} merchant={vendor} width={170} className="mx-auto" />
              <dl className="grid gap-3 text-sm">
                <div>
                  <dt className="text-muted-foreground">{t('cards.settings.name')}</dt>
                  <dd className="font-medium">{name.trim()}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t('cards.typePoints')}</dt>
                  <dd className="font-medium">{t('cards.rule', { amount })}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t('cards.background.title')}</dt>
                  <dd className="flex items-center gap-2 font-medium">
                    <span className="size-4 rounded-full border" style={{ backgroundColor: design.colors.background }} />
                    {t(`cards.background.styles.${design.background.style}`)}
                  </dd>
                </div>
              </dl>
            </div>
          ) : null}
          <ErrorAlert error={create.error} />
        </form>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="outline" disabled={step === 0 || create.isPending} onClick={() => setStep(step - 1)}>
            {t('cards.funnel.back')}
          </Button>
          <Button type="submit" form="create-card" disabled={!canNext || create.isPending}>
            {step < STEPS.length - 1 ? t('cards.funnel.next') : t('cards.funnel.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
