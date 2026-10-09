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
    viewport: { width: 1440, height: 900 },
  });
  const page = await desktopContext.newPage();
  await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Click "Import Statement" in the header
  const importBtn = page.locator('button:has-text("Import Statement")').first();
  await importBtn.click();
  await page.waitForTimeout(1000);

  // Set file on input
  const csvPath = path.resolve('data/latest_plaid_import.csv');
  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.setInputFiles(csvPath);
  await page.waitForTimeout(1500);

  // Take screenshot of the Staging Screen
  await page.screenshot({ path: path.join(screenshotDir, '72_desktop_staging_screen_4_accepted_0_rejected.png') });
  console.log('Saved 72_desktop_staging_screen_4_accepted_0_rejected.png');

  await browser.close();
  console.log('Done.');
}

run().catch(console.error);
