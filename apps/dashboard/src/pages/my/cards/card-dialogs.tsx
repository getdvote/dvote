import { SettingsIcon } from '@solar-icons/react/linear';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ltr } from '../../../lib/card-look';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ErrorAlert } from '../../../components/ErrorAlert';
import { t } from '../../../i18n';
import type { LoyaltyCardInfo, Vendor } from '../../../lib/api';
import { useVendorApi } from '../../../lib/vendor-workspace';
import { SpendInput, spendValue } from './card-fields';

/** "…" → Card settings: only the name and the money for one point. */
export function CardSettingsDialog({
  open,
  onOpenChange,
  info,
  vendor,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  info: LoyaltyCardInfo;
  vendor: Vendor;
}) {
  const api = useVendorApi();
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [spend, setSpend] = useState('');
  useEffect(() => {
    if (!open) return;
    setName(info.card?.name ?? '');
    setSpend(info.rule ? String(Number(info.rule.spendAmount)) : '10');
  }, [open, info]);

  const save = useMutation({
    mutationFn: () =>
      api.updateLoyaltyCardSettings({
        name: name.trim(),
        spendAmount: spendValue(spend)!,
      }),
    onSuccess: (next) => {
      qc.setQueryData(['loyalty-card'], next);
      toast.success(t('cards.settings.saved'));
      onOpenChange(false);
    },
  });
  const valid = name.trim().length > 0 && spendValue(spend) !== null;

  return (
    <Dialog open={open} onOpenChange={(o) => !save.isPending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="items-center text-center">
          <span className="mb-1 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <SettingsIcon className="size-6" />
          </span>
          <DialogTitle>{t('cards.settings.title', { name: info.card?.name ?? '' })}</DialogTitle>
          <DialogDescription className="sr-only">{t('cards.menu.settings')}</DialogDescription>
        </DialogHeader>
        <form
          id="card-settings"
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) save.mutate();
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="settings-name">{t('cards.settings.name')}</Label>
            <Input id="settings-name" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
            <p className="text-xs text-muted-foreground">{t('cards.settings.nameHint')}</p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="settings-spend">{t('cards.settings.spend')}</Label>
            <SpendInput id="settings-spend" currency={vendor.currency} value={spend} onChange={setSpend} />
            <p className="text-xs text-muted-foreground">
              {t('cards.settings.sentence', {
                amount: ltr(`${spendValue(spend) ?? '…'} ${vendor.currency}`),
              })}
            </p>
          </div>
          <ErrorAlert error={save.error} />
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={save.isPending}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="card-settings" disabled={!valid || save.isPending}>
            {t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
