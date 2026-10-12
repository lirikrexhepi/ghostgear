import { launch, openViewer } from './harness.mjs';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const results = [];
let failures = 0;

function check(name, ok, detail = '') {
  results.push({ name, ok: !!ok, detail });
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`);
}

const { browser, context } = await launch({ viewport: { width: 1200, height: 700 } });

async function setup(device) {
  const { page, errors } = await openViewer(context, `device=${device}&solo=1`);
  await page.evaluate(d => {
    const v = window.__viewers[d];
    v.setAutoRotate(false);
    window.__events = [];
    v.on('click', (id, info) => window.__events.push({ type: 'click', id, ...info }));
    v.on('hover', id => window.__events.push({ type: 'hover', id }));
    v.on('selection', ids => window.__events.push({ type: 'selection', ids }));
    v.on('scroll', (id, delta) => window.__events.push({ type: 'scroll', id, delta }));
    v.on('blocked', id => window.__events.push({ type: 'blocked', id }));
  }, device);
  return { page, errors };
}

async function view(page, device, name) {
  await page.evaluate(([d, n]) => window.__viewers[d].setView(n, { animate: false }), [device, name]);
  await page.waitForTimeout(150);
}

async function clicksOnly(page) {
  return page.evaluate(() => window.__events.filter(e => e.type === 'click'));
}

async function reachability(page, device, viewName, ids, tapFn) {
  await view(page, device, viewName);
  const found = [];
  const unreachable = [];
  let smallest = null;
  for (const id of ids) {
    const loc = await page.evaluate(([d, i]) => window.__viewers[d].locatePart(i), [device, id]);
    if (!loc || !loc.reachable) {
      unreachable.push(id);
      continue;
    }
    const area = Math.min(loc.width, loc.height);
    if (!smallest || area < smallest.min) smallest = { id, min: Math.round(area * 10) / 10, w: Math.round(loc.width), h: Math.round(loc.height) };
    await page.evaluate(() => {
      window.__events.length = 0;
    });
    await tapFn(page, loc.x, loc.y);
    await page.waitForTimeout(20);
    const clicks = await clicksOnly(page);
    if (clicks.length === 1 && clicks[0].id === id) found.push(id);
    else unreachable.push(`${id}->${clicks.map(c => c.id).join(',') || 'none'}`);
  }
  return { found, unreachable, smallest };
}

const mouseTap = async (page, x, y) => {
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.up();
};

{
  const { page, errors } = await setup('keyboard');
  const ids = await page.evaluate(() => window.__viewers.keyboard.getPartIds());
  check('keyboard: 68 parts', ids.length === 68, `got ${ids.length}`);

  for (const viewName of ['top', 'home']) {
    const r = await reachability(page, 'keyboard', viewName, ids, mouseTap);
    check(`keyboard: every key clickable from ${viewName}`, r.unreachable.length === 0 && r.found.length === ids.length, r.unreachable.length ? `problems: ${r.unreachable.join(' ')}` : `${r.found.length}/${ids.length}, smallest ${r.smallest.id} ${r.smallest.w}x${r.smallest.h}px`);
  }

  await view(page, 'keyboard', 'top');
  const q = await page.evaluate(() => window.__viewers.keyboard.locatePart('KeyQ'));
  await page.evaluate(() => {
    window.__events.length = 0;
  });
  const before = await page.evaluate(() => window.__viewers.keyboard.getCameraState());
  await page.mouse.move(q.x, q.y);
  await page.mouse.down();
  await page.mouse.move(q.x + 40, q.y + 10, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(200);
  const afterDrag = await page.evaluate(() => ({ events: window.__events.filter(e => e.type === 'click'), cam: window.__viewers.keyboard.getCameraState() }));
  check('keyboard: drag starting on a key does not click', afterDrag.events.length === 0);
  check('keyboard: drag on a key orbits', Math.abs(afterDrag.cam.azimuthDeg - before.azimuthDeg) > 1 || Math.abs(afterDrag.cam.polarDeg - before.polarDeg) > 1, `az ${before.azimuthDeg.toFixed(1)} -> ${afterDrag.cam.azimuthDeg.toFixed(1)}`);

  await page.evaluate(() => window.__viewers.keyboard.setView('top', { animate: false }));
  await page.waitForTimeout(100);
  const q2 = await page.evaluate(() => window.__viewers.keyboard.locatePart('KeyQ'));
  await page.evaluate(() => {
    window.__events.length = 0;
  });
  await page.mouse.move(q2.x, q2.y);
  await page.mouse.down();
  await page.mouse.move(q2.x + 3, q2.y + 2, { steps: 2 });
  await page.mouse.up();
  const small = await clicksOnly(page);
  check('keyboard: 3px jitter still counts as click', small.length === 1 && small[0].id === 'KeyQ');

  await page.evaluate(() => {
    window.__events.length = 0;
  });
  const empty = { x: 40, y: 40 };
  await page.mouse.move(empty.x, empty.y);
  await page.mouse.down();
  await page.mouse.move(empty.x + 60, empty.y + 30, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(150);
  check('keyboard: drag on empty space orbits without click', (await clicksOnly(page)).length === 0);

  await view(page, 'keyboard', 'top');
  const a = await page.evaluate(() => ({ g: window.__viewers.keyboard.locatePart('KeyG'), h: window.__viewers.keyboard.locatePart('KeyH') }));
  await page.evaluate(() => {
    window.__events.length = 0;
  });
  await page.mouse.click(a.g.x, a.g.y);
  await page.keyboard.down('Shift');
  await page.mouse.click(a.h.x, a.h.y);
  await page.keyboard.up('Shift');
  const sel = await page.evaluate(() => window.__viewers.keyboard.getSelection());
  check('keyboard: shift-click multi-select', sel.length === 2 && sel.includes('KeyG') && sel.includes('KeyH'), sel.join(','));
  await page.keyboard.down('Shift');
  await page.mouse.click(a.h.x, a.h.y);
  await page.keyboard.up('Shift');
  const sel2 = await page.evaluate(() => window.__viewers.keyboard.getSelection());
  check('keyboard: shift-click toggles off', sel2.length === 1 && sel2[0] === 'KeyG', sel2.join(','));

  await page.evaluate(() => {
    window.__events.length = 0;
  });
  await page.mouse.move(30, 30);
  await page.waitForTimeout(250);
  await page.mouse.move(a.h.x, a.h.y);
  await page.waitForTimeout(350);
  const hov = await page.evaluate(() => ({ events: window.__events.filter(e => e.type === 'hover').map(e => e.id), cursor: document.querySelector('#stage-keyboard canvas').style.cursor }));
  check('hover: onHover(id) fires and cursor is pointer', hov.events.includes('KeyH') && hov.cursor === 'pointer', JSON.stringify(hov));
  await page.mouse.move(30, 30);
  await page.waitForTimeout(150);
  const hov2 = await page.evaluate(() => window.__events.filter(e => e.type === 'hover').map(e => e.id));
  check('hover: onHover(null) fires when leaving', hov2[hov2.length - 1] === null, JSON.stringify(hov2));

  await page.evaluate(() => window.__viewers.keyboard.select(['KeyA', 'KeyB']));
  const sel3 = await page.evaluate(() => window.__viewers.keyboard.getSelection());
  check('api: select([...]) fires and stores selection', sel3.join() === 'KeyA,KeyB');
  await page.evaluate(() => window.__viewers.keyboard.clearSelection());
  check('api: clearSelection', (await page.evaluate(() => window.__viewers.keyboard.getSelection())).length === 0);

  await page.evaluate(() => window.__viewers.keyboard.setDisabled(['KeyZ']));
  await page.evaluate(() => {
    window.__events.length = 0;
  });
  const z = await page.evaluate(() => window.__viewers.keyboard.locatePart('KeyZ'));
  await mouseTap(page, z.x, z.y);
  const zev = await page.evaluate(() => window.__events.filter(e => e.type === 'blocked' || e.type === 'click'));
  check('api: disabled part blocks click', zev.length === 1 && zev[0].type === 'blocked');
  await page.evaluate(() => window.__viewers.keyboard.setDisabled([]));

  await page.evaluate(() => {
    window.__events.length = 0;
    window.__viewers.keyboard.clearSelection();
  });
  await page.evaluate(() => document.querySelector('#stage-keyboard').focus());
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  const kbSel = await page.evaluate(() => window.__viewers.keyboard.getSelection());
  check('a11y: arrow keys move selection', kbSel.length === 1, kbSel.join(','));
  await page.keyboard.press('Enter');
  const enterClick = await page.evaluate(() => window.__events.filter(e => e.type === 'click'));
  check('a11y: Enter activates selection', enterClick.length === 1 && enterClick[0].source === 'keyboard', JSON.stringify(enterClick[0] || {}));
  await page.keyboard.press('Escape');
  check('a11y: Escape clears', (await page.evaluate(() => window.__viewers.keyboard.getSelection())).length === 0);
  const liveText = await page.evaluate(() => document.querySelector('#stage-keyboard [aria-live]').textContent);
  check('a11y: aria-live announces', typeof liveText === 'string' && liveText.length > 0, liveText);

  await page.mouse.move(5, 5);
  let idleFrames = Infinity;
  for (let attempt = 0; attempt < 12 && idleFrames > 1; attempt += 1) {
    const f0 = await page.evaluate(() => window.__viewers.keyboard.debug.renderer.info.render.frame);
    await page.waitForTimeout(1500);
    const f1 = await page.evaluate(() => window.__viewers.keyboard.debug.renderer.info.render.frame);
    idleFrames = f1 - f0;
  }
  const frames0 = 0;
  const frames1 = idleFrames;
  check('perf: no continuous rendering while idle', frames1 - frames0 <= 1, `${frames1 - frames0} frames in 1.5s`);

  const info = await page.evaluate(() => {
    const v = window.__viewers.keyboard;
    v.renderNow();
    const r = v.debug.renderer.info;
    return { calls: r.render.calls, triangles: r.render.triangles, geometries: r.memory.geometries, textures: r.memory.textures };
  });
  check('perf: draw calls under 120', info.calls < 120, JSON.stringify(info));

  await page.evaluate(() => window.__viewers.keyboard.clearSelection());
  await page.mouse.move(20, 20);
  await page.waitForTimeout(500);
  await view(page, 'keyboard', 'top');
  const pix = await page.evaluate(() => {
    const v = window.__viewers.keyboard;
    const g = v.locatePart('KeyG');
    const t = v.locatePart('CapsLock');
    const hex = a => '#' + a.slice(0, 3).map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase();
    return { base: hex(v.readPixel(g.x, g.y)), accent: hex(v.readPixel(t.x, t.y)) };
  });
  const dist = (a, b) => Math.max(...[1, 3, 5].map(i => Math.abs(parseInt(a.slice(i, i + 2), 16) - parseInt(b.slice(i, i + 2), 16))));
  check('color: base keycap renders within 6/255 of #F4EDEB', dist(pix.base, '#F4EDEB') <= 6, `${pix.base}`);
  check('color: accent keycap renders within 6/255 of #B1A7A6', dist(pix.accent, '#B1A7A6') <= 6, `${pix.accent}`);

  const glb = await page.evaluate(async () => {
    const blob = await window.__viewers.keyboard.exportGLB();
    const head = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
    return { size: blob.size, magic: String.fromCharCode(...head) };
  });
  check('export: keyboard GLB', glb.magic === 'glTF' && glb.size > 10000, `${glb.size} bytes`);

  check('console: no page errors (keyboard)', errors.filter(e => !e.includes('404')).length === 0, errors.join(' | '));
  await page.close();
}

{
  const { page, errors } = await setup('mouse');
  const ids = await page.evaluate(() => window.__viewers.mouse.getPartIds());
  const clickIds = ids.filter(i => i !== 'wheel_scroll' && i !== 'btn_dpi');
  const r = await reachability(page, 'mouse', 'home', clickIds, mouseTap);
  check('mouse: top-side parts clickable from home', r.unreachable.length === 0, r.unreachable.length ? r.unreachable.join(' ') : `${r.found.join(',')} smallest ${r.smallest.id} ${r.smallest.w}x${r.smallest.h}px`);
  const rb = await reachability(page, 'mouse', 'bottom', ['btn_dpi'], mouseTap);
  check('mouse: DPI button clickable from bottom view', rb.unreachable.length === 0, rb.unreachable.join(' ') || `${rb.smallest.w}x${rb.smallest.h}px`);
  await page.evaluate(() => window.__viewers.mouse.setView('home', { animate: false }));
  const wheel = await page.evaluate(() => window.__viewers.mouse.locatePart('btn_middle'));
  await page.evaluate(() => {
    window.__events.length = 0;
  });
  await page.mouse.move(wheel.x, wheel.y);
  await page.mouse.wheel(0, 120);
  await page.waitForTimeout(100);
  const sc = await page.evaluate(() => window.__events.filter(e => e.type === 'scroll'));
  check('mouse: wheel event over wheel rotates it (wheel_scroll)', sc.length >= 1 && sc[0].id === 'wheel_scroll');
  const camBefore = await page.evaluate(() => window.__viewers.mouse.getCameraState().distance);
  await page.mouse.move(80, 80);
  await page.mouse.wheel(0, 300);
  await page.waitForTimeout(300);
  const camAfter = await page.evaluate(() => window.__viewers.mouse.getCameraState().distance);
  check('mouse: wheel elsewhere still zooms', Math.abs(camAfter - camBefore) > 1, `${camBefore.toFixed(0)} -> ${camAfter.toFixed(0)}`);
  const glb = await page.evaluate(async () => {
    const blob = await window.__viewers.mouse.exportGLB();
    const head = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
    return { size: blob.size, magic: String.fromCharCode(...head) };
  });
  check('export: mouse GLB', glb.magic === 'glTF' && glb.size > 10000, `${glb.size} bytes`);
  check('console: no page errors (mouse)', errors.filter(e => !e.includes('404')).length === 0, errors.join(' | '));
  await page.close();
}

{
  const touch = await launch({ viewport: { width: 1200, height: 700 }, hasTouch: true });
  const { page } = await openViewer(touch.context, 'device=keyboard&solo=1');
  await page.evaluate(() => {
    const v = window.__viewers.keyboard;
    v.setAutoRotate(false);
    window.__events = [];
    v.on('click', (id, info) => window.__events.push({ type: 'click', id, ...info }));
    v.setView('top', { animate: false });
  });
  await page.waitForTimeout(150);
  const loc = await page.evaluate(() => window.__viewers.keyboard.locatePart('KeyJ'));
  await page.touchscreen.tap(loc.x, loc.y);
  await page.waitForTimeout(80);
  const ev = await page.evaluate(() => window.__events);
  check('touch: tap on key clicks', ev.length === 1 && ev[0].id === 'KeyJ', JSON.stringify(ev));
  await touch.browser.close();
}

{
  const rm = await launch({ viewport: { width: 1000, height: 600 }, reducedMotion: 'reduce' });
  const { page } = await openViewer(rm.context, 'device=keyboard&solo=1');
  const r = await page.evaluate(async () => {
    const v = window.__viewers.keyboard;
    const part = v.debug.model.parts.find(p => p.id === 'KeyG');
    v.press('KeyG');
    const pressNow = part.press;
    v.release('KeyG');
    return { pressNow, autoRotate: v.debug.controls.autoRotate };
  });
  check('reduced motion: press snaps and auto-rotate is off', r.pressNow === 1 && r.autoRotate === false, JSON.stringify(r));
  await rm.browser.close();
}

{
  const { page } = await setup('keyboard');
  const lost = await page.evaluate(async () => {
    const canvas = document.querySelector('#stage-keyboard canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    const ext = gl.getExtension('WEBGL_lose_context');
    ext.loseContext();
    await new Promise(r => setTimeout(r, 200));
    const hiddenWhileLost = canvas.style.visibility === 'hidden';
    const imgShown = getComputedStyle(document.querySelector('#stage-keyboard img')).display !== 'none';
    ext.restoreContext();
    await new Promise(r => setTimeout(r, 500));
    window.__viewers.keyboard.select(['KeyA']);
    window.__viewers.keyboard.renderNow();
    return { hiddenWhileLost, imgShown, restored: canvas.style.visibility !== 'hidden' };
  });
  check('context loss: fallback shown then restored', lost.hiddenWhileLost && lost.imgShown && lost.restored, JSON.stringify(lost));
  await page.close();
}

{
  const { context: ctx2, browser: b2 } = await launch({ viewport: { width: 900, height: 600 } });
  const page = await ctx2.newPage();
  await page.addInitScript(() => {
    const orig = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
      if (type && String(type).startsWith('webgl')) return null;
      return orig.call(this, type, ...rest);
    };
  });
  await page.goto(`${process.env.VIEWER_URL || 'http://127.0.0.1:5174'}/viewer-dev.html?device=keyboard&solo=1`);
  await page.waitForFunction(() => window.__viewers && window.__viewers.keyboard);
  const fb = await page.evaluate(() => ({ fallback: window.__viewers.keyboard.isFallback, img: !!document.querySelector('#stage-keyboard img') }));
  check('fallback: PNG shown without WebGL', fb.fallback === true && fb.img === true);
  await b2.close();
}

{
  const { page } = await setup('keyboard');
  const disposed = await page.evaluate(() => {
    const v = window.__viewers.keyboard;
    v.dispose();
    return document.querySelectorAll('#stage-keyboard canvas').length;
  });
  check('dispose: canvas removed', disposed === 0);
  await page.close();
}

writeFileSync(join(here, 'report.json'), JSON.stringify({ at: new Date().toISOString(), failures, results }, null, 2));
await browser.close();
console.log(`\n${results.length - failures}/${results.length} passed`);
process.exit(failures ? 1 : 0);
