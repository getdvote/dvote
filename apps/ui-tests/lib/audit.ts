import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { expect, type Page, type TestInfo } from '@playwright/test';

export interface Issue {
  check: 'page-overflow' | 'offscreen' | 'overlap' | 'tap-target' | 'clipped-text' | 'dialog-fit';
  where: string;
  detail: string;
}

/** Waits for data to arrive: network quiet and no loading skeletons left (best effort). */
export async function settle(page: Page) {
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await page.waitForFunction(() => !document.querySelector('[data-slot="skeleton"], .animate-pulse'), null, { timeout: 6_000 }).catch(() => undefined);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250); // let entrance animations finish
}

/**
 * Layout checks run inside the page (all coordinates are the visible viewport):
 * - page-overflow: the page scrolls sideways
 * - offscreen: something visible sticks out of the window (unless a scroll / clip box holds it)
 * - overlap: two controls cover each other
 * - tap-target: a control smaller than 24 × 24 px on a touch-size screen (WCAG 2.5.8)
 * - clipped-text: a button / tab / badge cuts its own text without an ellipsis
 * - dialog-fit: an open dialog is taller or wider than the window and can't scroll
 */
export async function audit(page: Page): Promise<Issue[]> {
  return page.evaluate(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const issues: { check: string; where: string; detail: string }[] = [];
    const describe = (el: Element) => {
      const h = el as HTMLElement;
      const id = h.id ? `#${h.id}` : '';
      const cls = typeof h.className === 'string' ? h.className.split(/\s+/).filter((c) => c && !c.includes(':') && !c.includes('[')).slice(0, 3).map((c) => `.${c}`).join('') : '';
      const label = (h.getAttribute('aria-label') || h.innerText || h.getAttribute('placeholder') || '').trim().replace(/\s+/g, ' ').slice(0, 40);
      return `${el.tagName.toLowerCase()}${id}${cls}${label ? ` "${label}"` : ''}`;
    };
    const visible = (el: Element) => {
      const s = getComputedStyle(el);
      if (s.visibility === 'hidden' || s.display === 'none' || Number(s.opacity) === 0) return false;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return false; // sr-only and decorative hairlines
      // hidden by an ancestor (opacity 0 / aria-hidden decorative overlays don't count)
      for (let p = el.parentElement; p; p = p.parentElement) {
        const ps = getComputedStyle(p);
        if (Number(ps.opacity) === 0 || ps.visibility === 'hidden') return false;
      }
      return true;
    };
    /** The part of the element not cut off by scrolling / clipping ancestors (null = none of it shows). */
    const shown = (el: Element) => {
      const r = el.getBoundingClientRect();
      let { left, top, right, bottom } = r;
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const ps = getComputedStyle(p);
        if (ps.overflowX === 'visible' && ps.overflowY === 'visible') continue;
        const c = p.getBoundingClientRect();
        if (ps.overflowX !== 'visible') { left = Math.max(left, c.left); right = Math.min(right, c.right); }
        if (ps.overflowY !== 'visible') { top = Math.max(top, c.top); bottom = Math.min(bottom, c.bottom); }
      }
      return right - left > 1 && bottom - top > 1 ? { left, top, right, bottom, width: right - left, height: bottom - top } : null;
    };
    /** Inside a box that clips or scrolls sideways (then sticking out of the window is that box's job). */
    const clippedX = (el: Element) => {
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const o = getComputedStyle(p).overflowX;
        if (o !== 'visible') {
          const r = p.getBoundingClientRect();
          if (r.right <= vw + 1 && r.left >= -1) return true;
        }
      }
      return false;
    };

    // page-overflow
    const scrollW = document.documentElement.scrollWidth;
    if (scrollW > vw + 1) {
      const culprits = [...document.body.querySelectorAll('*')]
        .filter((el) => visible(el) && el.getBoundingClientRect().right > vw + 1 && !clippedX(el))
        .filter((el, _, all) => !all.some((o) => o !== el && el.contains(o))) // deepest only
        .slice(0, 4)
        .map(describe);
      issues.push({ check: 'page-overflow', where: culprits.join(' | ') || 'document', detail: `page is ${scrollW}px wide in a ${vw}px window` });
    }

    // offscreen
    const out = [...document.body.querySelectorAll('*')].filter((el) => {
      if (!visible(el)) return false;
      const s = getComputedStyle(el);
      if (s.position === 'fixed' && el.closest('[aria-hidden="true"]')) return false;
      const r = el.getBoundingClientRect();
      return (r.right > vw + 2 || r.left < -2) && !clippedX(el);
    });
    for (const el of out.filter((el, _, all) => !all.some((o) => o !== el && el.contains(o))).slice(0, 6)) {
      const r = el.getBoundingClientRect();
      issues.push({ check: 'offscreen', where: describe(el), detail: `spans ${Math.round(r.left)}…${Math.round(r.right)}px of a ${vw}px window` });
    }

    // controls
    const controls = [
      ...document.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea, [role=button], [role=tab], [role=checkbox], [role=switch], [role=combobox], [role=radio]'),
    ].filter((el) => visible(el) && !el.closest('[aria-hidden="true"]') && shown(el));

    // overlap (ignore a control inside another, and controls in different stacking layers like an open dialog vs the page)
    const layer = (el: Element) => el.closest('[role=dialog], [data-radix-popper-content-wrapper], [role=menu], [role=listbox]') ?? document.body;
    const boxes = controls.map((el) => ({ el, r: shown(el)!, layer: layer(el) }));
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i];
        const b = boxes[j];
        if (a.layer !== b.layer || a.el.contains(b.el) || b.el.contains(a.el)) continue;
        // shadcn sidebar: an action button placed on its menu row on purpose
        if (a.el.closest('[data-sidebar=menu-action]') || b.el.closest('[data-sidebar=menu-action]')) continue;
        // a pinned action bar (phone dialogs) over the form that scrolls under it
        if ([a.el, b.el].some((el) => el.closest('[data-mobile-dialog-actions], [data-slot=dialog-footer], [data-slot=alert-dialog-footer]'))) continue;
        // a button placed inside its own field (show password, clear search…)
        const field = [a.el, b.el].find((el) => el.matches('input, textarea'));
        const other = field === a.el ? b.el : a.el;
        if (field && field.parentElement?.contains(other)) continue;
        const w = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
        const h = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
        if (w <= 2 || h <= 2) continue;
        const smaller = Math.min(a.r.width * a.r.height, b.r.width * b.r.height);
        if ((w * h) / smaller > 0.2) issues.push({ check: 'overlap', where: `${describe(a.el)} ⨯ ${describe(b.el)}`, detail: `${Math.round(w)}×${Math.round(h)}px overlap` });
      }
    }

    // tap-target (touch-size screens)
    if (vw < 768) {
      for (const el of controls) {
        if (el.tagName === 'A' && (el.closest('p, li > span') || getComputedStyle(el).display === 'inline')) continue; // links inside a sentence (WCAG exception)
        if ((el as HTMLInputElement).type === 'checkbox' || (el as HTMLInputElement).type === 'radio') continue; // label carries the target
        const r = el.getBoundingClientRect();
        if (r.width < 24 || r.height < 24) issues.push({ check: 'tap-target', where: describe(el), detail: `${Math.round(r.width)}×${Math.round(r.height)}px (min 24×24)` });
      }
    }

    // clipped-text
    for (const el of document.querySelectorAll('button, [role=tab], [data-slot=badge], th, label')) {
      if (!visible(el)) continue;
      const s = getComputedStyle(el);
      const h = el as HTMLElement;
      if (s.textOverflow === 'ellipsis' || h.querySelector('.truncate, [class*="line-clamp"]')) continue;
      if (h.scrollWidth > h.clientWidth + 2 && s.overflowX !== 'visible') {
        issues.push({ check: 'clipped-text', where: describe(el), detail: `content ${h.scrollWidth}px in a ${h.clientWidth}px box` });
      }
    }

    // dialog-fit
    for (const d of document.querySelectorAll('[role=dialog], [role=alertdialog]')) {
      if (!visible(d)) continue;
      const r = d.getBoundingClientRect();
      if (r.width > vw + 1) issues.push({ check: 'dialog-fit', where: describe(d), detail: `${Math.round(r.width)}px wide in a ${vw}px window` });
      if (r.bottom > vh + 1 || r.top < -1) {
        const scrollable = [d, ...d.querySelectorAll('*')].some((el) => {
          const o = getComputedStyle(el).overflowY;
          return (o === 'auto' || o === 'scroll') && el.scrollHeight > el.clientHeight;
        });
        if (!scrollable) issues.push({ check: 'dialog-fit', where: describe(d), detail: `spans ${Math.round(r.top)}…${Math.round(r.bottom)}px of a ${vh}px window and can't scroll` });
      }
    }

    // one entry per (check, where)
    const seen = new Set<string>();
    return issues.filter((i) => {
      const k = `${i.check}|${i.where}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }) as Promise<Issue[]>;
}

/** Runs the audit, attaches a screenshot + the findings to the report, and fails on findings. */
export async function expectGoodLayout(page: Page, testInfo: TestInfo, opts: { ignore?: (i: Issue) => boolean } = {}) {
  await settle(page);
  const issues = (await audit(page)).filter((i) => !opts.ignore?.(i));
  const shot = await page.screenshot({ fullPage: true });
  await testInfo.attach('screenshot', { body: shot, contentType: 'image/png' });
  if (issues.length) {
    await testInfo.attach('layout-issues.json', { body: JSON.stringify(issues, null, 2), contentType: 'application/json' });
    // one line per finding for `npm run summary`
    mkdirSync('test-results', { recursive: true });
    const title = testInfo.titlePath.slice(1).join(' › ');
    for (const i of issues) appendFileSync('test-results/issues.jsonl', JSON.stringify({ test: title, ...i }) + '\n');
    mkdirSync('test-results/shots', { recursive: true });
    writeFileSync(`test-results/shots/${title.replace(/[^\w·-]+/g, '_')}.png`, shot);
  }
  expect(issues.map((i) => `[${i.check}] ${i.where} — ${i.detail}`), 'layout issues').toEqual([]);
}
