import { useEffect, type ReactNode } from 'react';
import { useLocation } from 'react-router';
import { Footer } from '@/components/footer';
import { Header } from '@/components/header';

/** A white page: the floating header, the sections, the footer. */
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
    <div className="min-h-dvh bg-white">
      <Header />
      <main className="overflow-x-clip">{children}</main>
      <Footer />
    </div>
  );
}
