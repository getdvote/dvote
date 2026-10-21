// Builds docs/Coffee_Loyalty_Platform_Documentation.pdf from docs/src/documentation.html
// using a locally installed Chromium browser (Edge or Chrome) in headless mode.
//   node docs/src/build-pdf.mjs
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const source = join(here, 'documentation.html');
const output = resolve(here, '..', 'Coffee_Loyalty_Platform_Documentation.pdf');

const candidates = [
  process.env.CHROME_PATH,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);
const browser = candidates.find((p) => existsSync(p));
if (!browser) {
  console.error('No Edge/Chrome found. Set CHROME_PATH to a Chromium-based browser.');
  process.exit(1);
}

execFileSync(browser, [
  '--headless',
  '--disable-gpu',
  '--no-pdf-header-footer',
  '--virtual-time-budget=5000',
  `--print-to-pdf=${output}`,
  pathToFileURL(source).href,
], { stdio: 'inherit' });
console.log(`Wrote ${output}`);
