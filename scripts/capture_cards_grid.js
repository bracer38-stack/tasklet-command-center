import { chromium } from 'playwright-core';
import fs from 'fs';
import path from 'path';

async function run() {
  const screenshotDir = 'C:\\Users\\brace\\.gemini\\antigravity\\brain\\1949cb98-28e7-47cc-8ca1-02d885a6fcd0\\screenshots';
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const browser = await chromium.launch({
    executablePath: fs.existsSync(edgePath) ? edgePath : undefined,
    headless: true,
  });

  const desktopContext = await browser.newContext({
    viewport: { width: 1440, height: 1200 },
  });
  const page = await desktopContext.newPage();
  await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  const cardsTab = page.locator('button:has-text("Cards & Loans")');
  await cardsTab.click();
  await page.waitForTimeout(1000);

  await page.evaluate(() => window.scrollBy(0, 1400));
  await page.waitForTimeout(500);

  await page.screenshot({ path: path.join(screenshotDir, '64_desktop_cards_cards_grid.png') });
  console.log('Saved 64_desktop_cards_cards_grid.png');

  await browser.close();
}

run().catch(console.error);
