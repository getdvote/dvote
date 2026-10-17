import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '../../components/PageHeader';
import { t } from '../../i18n';
import { useMe, useMyScope } from '../../layouts/VendorLayout';
import { BranchesTab } from '../vendor/BranchesTab';
import { RewardsTab } from '../vendor/RewardsTab';
import { StaffTab } from '../vendor/StaffTab';
import { MyRedemptions } from './MyRedemptions';

/** The same tabs the platform admin uses, fed with my vendor's scope (/api/vendor only). */
function Section({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <>
      <PageHeader title={title} subtitle={subtitle} />
      <Card>
        <CardContent>{children}</CardContent>
      </Card>
    </>
  );
}

const readOnly = (canEdit: boolean, text: string) => (canEdit ? text : `${text} ${t('sections.onlyAdmin')}`);

export function MyBranches() {
  const scope = useMyScope();
  return (
    <Section title={t('nav.branches')} subtitle={readOnly(scope.can.editVendor, t('sections.branches'))}>
      <BranchesTab scope={scope} />
    </Section>
  );
}

/** Rewards: the catalogue, and the rewards given (?tab=redemptions), on one page. */
export function MyRewards() {
  const scope = useMyScope();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'redemptions' ? 'redemptions' : 'rewards';
  return (
    <>
      <PageHeader title={t('nav.rewards')} subtitle={readOnly(scope.can.editVendor, t('sections.rewards'))} />
      <Tabs value={tab} onValueChange={(v) => setParams(v === 'redemptions' ? { tab: v } : {}, { replace: true })}>
        <TabsList className="mb-4">
          <TabsTrigger value="rewards">{t('nav.rewards')}</TabsTrigger>
          <TabsTrigger value="redemptions">{t('nav.redemptions')}</TabsTrigger>
        </TabsList>
        <TabsContent value="rewards">
          <Card>
            <CardContent>
              <RewardsTab scope={scope} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="redemptions">
          <MyRedemptions embedded />
        </TabsContent>
      </Tabs>
    </>
  );
}

export function MyStaff() {
  const me = useMe();
  const scope = useMyScope();
  return (
    <Section title={t('nav.staff')} subtitle={me.role === 'vendor_admin' ? t('sections.staffAll') : t('sections.staffBranch', { branch: me.branch?.name ?? '' })}>
      <StaffTab scope={scope} selfId={me.id} />
    </Section>
  );
}
