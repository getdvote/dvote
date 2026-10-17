import {
  BillListIcon,
  CopyIcon as Copy,
  PaletteIcon,
  SettingsIcon,
  UsersGroupRoundedIcon,
} from '@solar-icons/react/linear';
import type { ComponentType } from 'react';
import { useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '../../components/PageHeader';
import { useMe, useMyScope } from '../../layouts/VendorLayout';
import { t } from '../../i18n';
import { StaffTab } from '../vendor/StaffTab';
import { GeneralSettings } from './general-settings';
import { ProfileEditor } from './MyProfile';

const TABS: { key: SettingsTab; icon: ComponentType<{ className?: string }> }[] = [
  { key: 'general', icon: SettingsIcon },
  { key: 'team', icon: UsersGroupRoundedIcon },
  { key: 'branding', icon: PaletteIcon },
  { key: 'billing', icon: BillListIcon },
];
type SettingsTab =
  | 'general'
  | 'team'
  | 'branding'
  | 'billing';

/**
 * Settings, in tabs (?tab=…). Team is the team page (invite with a role, the sign-in link) and
 * Branding the shop profile (merchant admins only), General the account-wide choices; Billing is
 * empty for now. Viewers
 * (read-only) don't get Team.
 */
export function MySettings() {
  const me = useMe();
  const scope = useMyScope();
  const [params, setParams] = useSearchParams();
  const tabs = TABS.filter(
    (x) => (x.key !== 'team' || me.role !== 'viewer') && (x.key !== 'branding' || me.role === 'vendor_admin'),
  );
  const tab = tabs.find((x) => x.key === params.get('tab'))?.key ?? 'general';
  const go = (v: string) => setParams(v === 'general' ? {} : { tab: v }, { replace: true });

  return (
    <>
      <PageHeader title={t('nav.settings')} subtitle={t('settings.subtitle')} />
      <Tabs value={tab} onValueChange={go}>
        <div className="mb-4 overflow-x-auto [scrollbar-width:none]">
          <TabsList className="w-max">
            {tabs.map((x) => (
              <TabsTrigger key={x.key} value={x.key}>
                {t(`settings.tabs.${x.key}`)}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        {tabs.map((x) => (
          <TabsContent key={x.key} value={x.key}>
            {x.key === 'team' ? (
              <div className="grid gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>{t('settings.tabs.team')}</CardTitle>
                    <CardDescription>
                      {me.branchId === null ? t('sections.staffAll') : t('sections.staffBranch', { branch: me.branch?.name ?? '' })}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <StaffTab scope={scope} selfId={me.id} />
                  </CardContent>
                </Card>
                <TeamSignInLink />
              </div>
            ) : x.key === 'general' ? (
              <GeneralSettings />
            ) : x.key === 'branding' ? (
              <ProfileEditor />
            ) : (
              <Soon title={t(`settings.tabs.${x.key}`)} icon={x.icon} />
            )}
          </TabsContent>
        ))}
      </Tabs>
    </>
  );
}

function Soon({ title, icon: Icon }: { title: string; icon: ComponentType<{ className?: string }> }) {
  return (
    <Empty className="rounded-xl border border-dashed py-16">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon />
        </EmptyMedia>
        <EmptyTitle>{t('settings.soonTitle', { tab: title })}</EmptyTitle>
        <EmptyDescription>{t('settings.soonText')}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

/** Where the team signs in (this dashboard): to open on the till device or share. */
function TeamSignInLink() {
  const link = `${window.location.origin}/`;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('staff.signInTitle')}</CardTitle>
        <CardDescription>{t('staff.signInText')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <code dir="ltr" className="min-w-0 flex-1 truncate rounded-lg bg-muted px-3 py-2 font-mono text-sm">
          {link}
        </code>
        <Button
          onClick={() =>
            void navigator.clipboard.writeText(link).then(
              () => toast.success(t('staff.copied')),
              () => toast.error(t('common.somethingWrong')),
            )
          }
        >
          <Copy /> {t('staff.copy')}
        </Button>
      </CardContent>
    </Card>
  );
}
