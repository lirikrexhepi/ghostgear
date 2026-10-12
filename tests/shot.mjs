import { launch, openViewer } from './harness.mjs';
import { writeFileSync } from 'node:fs';

const [, , device = 'keyboard', view = 'home', out = 'shot.png', width = '1200', height = '760', theme = 'light'] = process.argv;

const { browser, context } = await launch({ viewport: { width: Number(width), height: Number(height) } });
const { page, errors } = await openViewer(context, `device=${device}&solo=1&theme=${theme}`);
await page.evaluate(
  ([d, v]) => {
    const viewer = window.__viewers[d];
    viewer.setAutoRotate(false);
    viewer.setView(v, { animate: false });
  },
  [device, view]
);
await page.waitForTimeout(500);
await page.screenshot({ path: out });
if (errors.length) console.log('errors', errors.slice(0, 5));
await browser.close();
writeFileSync(out + '.done', '1');
