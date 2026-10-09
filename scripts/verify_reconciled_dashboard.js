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

  // 1. Desktop Command Overview Screenshot
  const desktopContext = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
  });
  const page = await desktopContext.newPage();
  await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  await page.screenshot({ path: path.join(screenshotDir, '65_desktop_overview_reconciled_liquidity.png') });
  console.log('Saved 65_desktop_overview_reconciled_liquidity.png');

  // Scroll to Operating Cash & Credit Cards section
  await page.evaluate(() => window.scrollBy(0, 380));
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(screenshotDir, '66_desktop_operating_cash_accounts.png') });
  console.log('Saved 66_desktop_operating_cash_accounts.png');

  // 2. Open Daily Backup & Google Drive Modal
  const backupBtn = page.locator('button:has-text("Daily Backup & Drive")');
  await backupBtn.click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(screenshotDir, '67_desktop_backup_google_drive_modal.png') });
  console.log('Saved 67_desktop_backup_google_drive_modal.png');

  // 3. Mobile Viewport (iPhone 14 / modern phone)
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
  });
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' });
  await mobilePage.waitForTimeout(2000);

  await mobilePage.screenshot({ path: path.join(screenshotDir, '68_mobile_overview_reconciled.png') });
  console.log('Saved 68_mobile_overview_reconciled.png');

  await browser.close();
  console.log('All verification screenshots captured successfully!');
}

run().catch(console.error);
