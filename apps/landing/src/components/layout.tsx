import { useEffect, type ReactNode } from 'react';
import { useLocation } from 'react-router';
import { Footer } from '@/components/footer';
import { Header } from '@/components/header';

/**
 * Same frame as the merchant dashboard: an ink surround (the sidebar colour) holding a white page.
 * The header and footer live on the ink; the sections live on the white page.
 */
export function Layout({ children }: { children: ReactNode }) {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      const el = document.getElementById(hash.slice(1));
      if (el) {
        requestAnimationFrame(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }));
        return;
      }
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);
  return (
    <div className="min-h-dvh bg-ink px-1.5 md:px-3">
      <Header />
      <main className="overflow-x-clip rounded-[22px] bg-white md:rounded-[28px]">{children}</main>
      <Footer />
    </div>
  );
}
