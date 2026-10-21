import { Link, createSearchParams, useSearchParams, type SetURLSearchParams, type LinkProps } from 'react-router';
import { createContext, useCallback, useContext, type ReactNode } from 'react';
import { vendorApi, type createVendorApi, type StaffMe } from './api';

export type VendorClient = ReturnType<typeof createVendorApi>;
const Workspace = createContext<{ client: VendorClient; me: StaffMe } | null>(null);
export function VendorWorkspaceProvider({ client, me, children }: { client: VendorClient; me: StaffMe; children: ReactNode }) {
  return <Workspace.Provider value={{ client, me }}>{children}</Workspace.Provider>;
}
export const useWorkspace = () => useContext(Workspace);
export const useVendorApi = () => useWorkspace()?.client ?? vendorApi;

/** Keep merchant links in the selected platform workspace without changing vendor navigation. */
export function WorkspaceLink({ to, ...props }: LinkProps) {
  const workspace = useWorkspace();
  if (workspace && typeof to === 'string' && to.startsWith('/')) {
    const url = new URL(to, window.location.origin);
    url.pathname =
      (
        {
          '/': '/merchant-home',
          '/customers': '/members',
          '/feedback': '/customer-feedback',
          '/staff': '/team',
        } as Record<string, string>
      )[url.pathname] ?? url.pathname;
    url.searchParams.set('vendor', workspace.me.vendorId);
    if (url.pathname === '/activity') url.searchParams.delete('staff');
    to = url.pathname + url.search;
  }
  return <Link to={to} {...props} />;
}

/** Page tabs and filters retain their merchant; sidebar navigation may clear it explicitly. */
export function useWorkspaceSearchParams() {
  const [params, setParams] = useSearchParams();
  const vendorId = useWorkspace()?.me.vendorId;
  const update = useCallback<SetURLSearchParams>((next, options) => {
    setParams(previous => {
      const result = createSearchParams(typeof next === 'function' ? next(previous) : next);
      if (vendorId) result.set('vendor', vendorId);
      return result;
    }, options);
  }, [setParams, vendorId]);
  return [params, update] as const;
}
