import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';

const CANDIDATES = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe'
].filter(Boolean);

export const BASE_URL = process.env.VIEWER_URL || 'http://127.0.0.1:5174';

export async function launch(options = {}) {
  const executablePath = CANDIDATES.find(p => existsSync(p));
  if (!executablePath) throw new Error('No Chrome or Edge executable found. Set CHROME_PATH.');
  const browser = await chromium.launch({
    executablePath,
    headless: true,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl']
  });
  const context = await browser.newContext({
    viewport: options.viewport || { width: 1200, height: 760 },
    deviceScaleFactor: options.deviceScaleFactor || 1,
    hasTouch: !!options.hasTouch,
    reducedMotion: options.reducedMotion || 'no-preference'
  });
  return { browser, context };
}

export async function openViewer(context, query = 'device=keyboard&solo=1') {
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('response', r => {
    if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`);
  });
  page.on('console', m => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto(`${BASE_URL}/viewer-dev.html?${query}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__viewers && Object.keys(window.__viewers).length > 0);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);
  return { page, errors };
}
