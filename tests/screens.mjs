import { launch, BASE_URL } from './harness.mjs';
const out = process.argv[2];
const theme = process.argv[3] || 'light';
const { browser, context } = await launch({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => m.type() === 'error' && errors.push(m.text()));
await page.addInitScript(t => localStorage.setItem('gear_theme', t), theme);
await page.goto(BASE_URL + '/');
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}_home.png` });
for (const dev of ['keyboard', 'mouse', 'headset']) {
  await page.locator(`[data-device-id="demo-${dev}"]`).click();
  await page.waitForTimeout(1800);
  const tabs = await page.$$eval('.topbar [role=tab]', els => els.map(e => e.textContent));
  for (const t of tabs) {
    await page.locator('.topbar [role=tab]', { hasText: t }).click();
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${out}_${dev}_${t.toLowerCase()}.png` });
  }
  await page.locator('.back').click();
  await page.waitForTimeout(800);
}
console.log(JSON.stringify(errors.filter(e => !e.includes('404'))));
await browser.close();
