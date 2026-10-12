import { chromium } from 'playwright-core';
const BASE = process.env.VIEWER_URL || 'http://127.0.0.1:5175';
const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--headless=new', '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-gpu-vsync=false']
});
const context = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: Number(process.env.DPR || 1.5) });
const page = await context.newPage();
await page.goto(BASE + '/');
await page.waitForTimeout(2500);
const device = process.env.DEVICE || 'keyboard';
const t0 = Date.now();
await page.locator(`[data-device-id="demo-${device}"]`).click();
await page.waitForSelector('.stage canvas');
const openMs = Date.now() - t0;
await page.waitForTimeout(1200);
const res = await page.evaluate(async () => {
  const c = document.querySelector('.stage canvas');
  const gl = c.getContext('webgl2');
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const gpu = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'n/a';
  const r = c.getBoundingClientRect();
  const frames = [];
  let last = performance.now();
  let run = true;
  const tick = now => { frames.push(now - last); last = now; if (run) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  const o = { bubbles: true, pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0, buttons: 1 };
  let x = r.left + 80, y = r.top + r.height * 0.75;
  c.dispatchEvent(new PointerEvent('pointerdown', { ...o, clientX: x, clientY: y }));
  for (let i = 0; i < 120; i++) {
    await new Promise(res => requestAnimationFrame(res));
    x += 3;
    c.dispatchEvent(new PointerEvent('pointermove', { ...o, clientX: x, clientY: y }));
  }
  c.dispatchEvent(new PointerEvent('pointerup', { ...o, clientX: x, clientY: y, buttons: 0 }));
  for (let i = 0; i < 60; i++) {
    await new Promise(res => requestAnimationFrame(res));
    c.dispatchEvent(new PointerEvent('pointermove', { ...o, buttons: 0, clientX: r.left + r.width * (0.2 + i / 150), clientY: r.top + r.height * 0.5 }));
  }
  run = false;
  const f = frames.slice(3).sort((a, b) => a - b);
  const q = p => f[Math.min(f.length - 1, Math.floor(f.length * p))].toFixed(1);
  return { gpu, canvas: [c.width, c.height], frames: f.length, median: q(0.5), p95: q(0.95), p99: q(0.99), max: f[f.length - 1].toFixed(1), over20: f.filter(x => x > 20).length };
});
console.log(JSON.stringify({ device, openMs, ...res }));
await browser.close();
