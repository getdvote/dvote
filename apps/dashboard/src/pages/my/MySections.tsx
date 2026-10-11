import type { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '../../components/PageHeader';
import { t } from '../../i18n';
import { useMe, useMyScope } from '../../layouts/VendorLayout';
import { BranchesTab } from '../vendor/BranchesTab';
import { ImagesTab } from '../vendor/ImagesTab';
import { RewardsTab } from '../vendor/RewardsTab';
import { RulesTab } from '../vendor/RulesTab';
import { StaffTab } from '../vendor/StaffTab';

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

export function MyRule() {
  const scope = useMyScope();
  return (
    <Section title={t('nav.rule')} subtitle={readOnly(scope.can.editVendor, t('sections.rule'))}>
      <RulesTab scope={scope} />
    </Section>
  );
}

export function MyRewards() {
  const scope = useMyScope();
  return (
    <Section title={t('nav.rewards')} subtitle={readOnly(scope.can.editVendor, t('sections.rewards'))}>
      <RewardsTab scope={scope} />
    </Section>
  );
}

export function MyImages() {
  const scope = useMyScope();
  return (
    <Section
      title={t('nav.menu')}
      subtitle={scope.can.editVendor ? t('sections.menuEdit') : t('sections.menuView')}
    >
      <ImagesTab scope={scope} />
    </Section>
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
