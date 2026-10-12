import { launch, openViewer } from './harness.mjs';

const device = process.argv[2] || 'keyboard';
const { browser, context } = await launch({ viewport: { width: 1200, height: 600 } });
const { page } = await openViewer(context, `device=${device}&solo=1`);

const ids = device === 'keyboard' ? ['KeyG', 'KeyQ', 'Space', 'Tab', 'CapsLock', 'Backspace', 'Digit6'] : ['btn_left', 'btn_right', 'btn_middle', 'btn_forward'];
const sweeps = JSON.parse(process.argv[3] || '[[0.9,1.6,0.5,0.9]]');

const result = await page.evaluate(
  ([d, idList, sw, dev]) => {
    const v = window.__viewers[d];
    v.setAutoRotate(false);
    v.setView('top', { animate: false });
    const dbg = v.debug;
    const hex = a => a.slice(0, 3).map(x => x.toString(16).padStart(2, '0')).join('');
    return sw.map(([env, key, fill, rim]) => {
      dbg.scene.environmentIntensity = env;
      dbg.keyLight.intensity = key;
      dbg.fillLight.intensity = fill;
      dbg.rimLight.intensity = rim;
      const out = { env, key, fill, rim };
      idList.forEach(id => {
        const p = v.locatePart(id);
        out[id] = p && p.reachable ? hex(v.readPixel(p.x, p.y)) : 'x';
      });
      return out;
    });
  },
  [device, ids, sweeps, device]
);
console.log(JSON.stringify(result, null, 1));
await browser.close();
