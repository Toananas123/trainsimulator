import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:4173';
const browser = await chromium.launch({
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--enable-webgl',
    '--ignore-gpu-blocklist',
    '--use-gl=angle',
    '--use-angle=swiftshader',
  ],
});

const jsErrors = [];
const consoleErrors = [];
const results = [];

try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
  });

  page.on('pageerror', (error) => jsErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  const response = await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  assert.ok(response && response.ok(), `App returned HTTP ${response?.status()}`);
  assert.match(await page.title(), /Paris Rail Simulator/i);
  await page.locator('.remaster-title-panel').waitFor({ state: 'visible', timeout: 30000 });
  await page.locator('[data-testid="metro-canvas"]').waitFor({ state: 'visible', timeout: 30000 });
  await page.waitForTimeout(1500);

  const canvasInfo = await page.locator('[data-testid="metro-canvas"]').evaluate((canvas) => {
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    return {
      width: canvas.width,
      height: canvas.height,
      webgl: Boolean(gl),
      renderer: gl ? gl.getParameter(gl.VERSION) : 'unavailable',
    };
  });
  assert.ok(canvasInfo.width >= 320 && canvasInfo.height >= 200, '3D canvas has a non-zero drawing buffer');
  assert.ok(canvasInfo.webgl, 'WebGL context is available');
  results.push({ check: 'launch screen and WebGL viewport', status: 'passed', canvasInfo });

  await mkdir('artifacts', { recursive: true });
  await page.screenshot({ path: 'artifacts/remaster-title.png', fullPage: true });

  await page.getByRole('button', { name: /start service/i }).click();
  await page.waitForFunction(() => document.body.dataset.state === 'playing', null, { timeout: 10000 });
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'artifacts/remaster-driving.png', fullPage: true });
  results.push({ check: 'start service', status: 'passed' });

  await page.keyboard.press('p');
  await page.waitForFunction(() => document.body.dataset.state === 'paused', null, { timeout: 5000 });
  results.push({ check: 'pause control', status: 'passed' });

  await page.keyboard.press('p');
  await page.waitForFunction(() => document.body.dataset.state === 'playing', null, { timeout: 5000 });
  results.push({ check: 'resume control', status: 'passed' });

  await page.keyboard.press('v');
  await page.getByTestId('viewport-view-label').getByText(/chase cam/i).waitFor({ timeout: 5000 });
  results.push({ check: 'camera perspective cycle', status: 'passed' });

  await page.keyboard.down('w');
  await page.waitForTimeout(1400);
  await page.keyboard.up('w');
  await page.waitForTimeout(500);
  const bodyText = await page.locator('body').innerText();
  assert.match(bodyText, /km\/h/i, 'Driving HUD remains rendered during throttle input');
  await page.screenshot({ path: 'artifacts/remaster-controls.png', fullPage: true });
  results.push({ check: 'throttle input and active HUD', status: 'passed' });

  assert.deepEqual(jsErrors, [], `Uncaught page errors: ${jsErrors.join(' | ')}`);
  assert.deepEqual(consoleErrors, [], `Browser console errors: ${consoleErrors.join(' | ')}`);

  console.log(JSON.stringify({ status: 'passed', baseUrl, results, jsErrors, consoleErrors }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ status: 'failed', baseUrl, results, jsErrors, consoleErrors, error: error?.stack || String(error) }, null, 2));
  process.exitCode = 1;
} finally {
  await browser.close();
}
