import { useVendorApi } from '../../lib/vendor-workspace';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CardDesignPicker } from '../../components/BrandingPanel';
import { PageHeader } from '../../components/PageHeader';
import { t } from '../../i18n';
import { useMe, useMyScope, useMyVendor } from '../../layouts/VendorLayout';

import { RulesTab } from '../vendor/RulesTab';

/** The loyalty card itself: how it looks in the customer app, and how many points a bill earns. */
export function MyCard() {
  const vendorApi = useVendorApi();
  const me = useMe();
  const vendor = useMyVendor();
  const scope = useMyScope();
  const qc = useQueryClient();
  const isAdmin = me.role === 'vendor_admin';

  return (
    <>
      <PageHeader title={t('nav.card')} subtitle={isAdmin ? t('card.subtitle') : `${t('card.subtitle')} ${t('sections.onlyAdmin')}`} />
      <Card>
        <CardContent>
          <CardDesignPicker vendor={vendor} canEdit={isAdmin} save={vendorApi.updateProfile} onSaved={(v) => qc.setQueryData(['vendor', 'me'], v)} />
        </CardContent>
      </Card>
      <Card className="mt-5">
        <CardHeader>
          <CardTitle>{t('nav.rule')}</CardTitle>
          <p className="text-sm text-muted-foreground">{t('sections.rule')}</p>
        </CardHeader>
        <CardContent>
          <RulesTab scope={scope} />
        </CardContent>
      </Card>
    </>
  );
}
