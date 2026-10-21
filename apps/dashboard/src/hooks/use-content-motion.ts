import { useEffect, type RefObject } from 'react';
import autoAnimate, { type AnimationController } from '@formkit/auto-animate';

/** Animate structural content changes, leaving controls, charts and table rows alone. */
export function useContentMotion(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const controllers = new Map<HTMLElement, AnimationController>();
    const selector = '[data-page-content], [data-slot="tabs"], [data-slot="tabs-content"], [data-slot="card-content"], .grid:has(> [data-slot="card"]), [data-animate-layout]';
    let frame = 0;
    const scan = () => {
      for (const [node, controller] of controllers) {
        if (!root.contains(node)) {
          controller.disable();
          controllers.delete(node);
        }
      }
      root.querySelectorAll<HTMLElement>(selector).forEach((node) => {
        if (controllers.has(node)) return;
        const controller = autoAnimate(node, { duration: 240, easing: 'ease-out' });
        controllers.set(node, controller);
        if (preference.matches) controller.disable();
      });
    };
    const updatePreference = () => {
      controllers.forEach((controller) => preference.matches ? controller.disable() : controller.enable());
    };
    scan();
    const observer = new MutationObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(scan);
    });
    observer.observe(root, { childList: true, subtree: true });
    preference.addEventListener('change', updatePreference);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      preference.removeEventListener('change', updatePreference);
      controllers.forEach((controller) => controller.disable());
    };
  }, [ref]);
}
