import { launch, openViewer } from './harness.mjs';

const [, , device = 'keyboard', az = '0', el = '45', out = 'shot.png', width = '1200', height = '760', fov = '28', theme = 'light'] = process.argv;
const { browser, context } = await launch({ viewport: { width: Number(width), height: Number(height) } });
const { page, errors } = await openViewer(context, `device=${device}&solo=1&theme=${theme}`);
await page.evaluate(
  ([d, a, e, f]) => {
    const v = window.__viewers[d];
    v.setAutoRotate(false);
    v.debug.camera.fov = Number(f);
    v.debug.camera.updateProjectionMatrix();
    v.setView({ az: Number(a), el: Number(e) }, { animate: false });
  },
  [device, az, el, fov]
);
await page.waitForTimeout(500);
await page.screenshot({ path: out });
console.log(errors.filter(e => !e.includes('favicon')).slice(0, 3));
await browser.close();
