import type { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '../../components/PageHeader';
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

const readOnly = (canEdit: boolean, text: string) => (canEdit ? text : `${text} Only your merchant admin can change it.`);

export function MyBranches() {
  const scope = useMyScope();
  return (
    <Section title="Branches" subtitle={readOnly(scope.can.editVendor, 'Your shops, as customers see them.')}>
      <BranchesTab scope={scope} />
    </Section>
  );
}

export function MyRule() {
  const scope = useMyScope();
  return (
    <Section title="Points rule" subtitle={readOnly(scope.can.editVendor, 'How many points a bill earns.')}>
      <RulesTab scope={scope} />
    </Section>
  );
}

export function MyRewards() {
  const scope = useMyScope();
  return (
    <Section title="Rewards" subtitle={readOnly(scope.can.editVendor, 'What customers can get with their points.')}>
      <RewardsTab scope={scope} />
    </Section>
  );
}

export function MyImages() {
  const scope = useMyScope();
  return (
    <Section
      title="Menu"
      subtitle={scope.can.editVendor ? 'Menu pages shown on your shop page in the dvote app. Branch photos are on the Branches page.' : 'Your menu as customers see it. Branch photos are on the Branches page.'}
    >
      <ImagesTab scope={scope} />
    </Section>
  );
}

export function MyStaff() {
  const me = useMe();
  const scope = useMyScope();
  return (
    <Section title="Staff" subtitle={me.role === 'vendor_admin' ? 'Everyone working at your shops.' : `The team at ${me.branch?.name ?? 'your branch'}.`}>
      <StaffTab scope={scope} selfId={me.id} />
    </Section>
  );
}
