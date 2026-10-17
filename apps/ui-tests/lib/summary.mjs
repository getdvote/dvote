// Groups the findings of the last run: node lib/summary.mjs (npm run summary)
import { readFileSync, existsSync } from 'node:fs';
const file = 'test-results/issues.jsonl';
if (!existsSync(file)) { console.log('No layout issues recorded.'); process.exit(0); }
const rows = readFileSync(file, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const groups = new Map();
for (const r of rows) {
  const key = `[${r.check}] ${r.where.replace(/"[^"]*"/g, (m) => (m.length > 30 ? m.slice(0, 30) + '…"' : m))}`;
  const g = groups.get(key) ?? { count: 0, tests: new Set(), detail: r.detail };
  g.count++; g.tests.add(r.test.split(' › ').slice(0, 2).join(' › ')); groups.set(key, g);
}
const sorted = [...groups].sort((a, b) => b[1].count - a[1].count);
console.log(`${rows.length} findings, ${sorted.length} distinct\n`);
for (const [key, g] of sorted) console.log(`${String(g.count).padStart(4)}× ${key}\n       e.g. ${g.detail} — ${[...g.tests].slice(0, 3).join('; ')}${g.tests.size > 3 ? ` (+${g.tests.size - 3})` : ''}`);
