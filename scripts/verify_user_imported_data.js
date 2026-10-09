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

  await page.screenshot({ path: path.join(screenshotDir, '60_desktop_user_imported_overview.png') });
  console.log('Saved 60_desktop_user_imported_overview.png');

  // Navigate to Cards & Loans
  const cardsTab = page.locator('button:has-text("Cards & Loans")');
  if (await cardsTab.count() > 0) {
    await cardsTab.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(screenshotDir, '61_desktop_user_imported_cards_loans.png') });
    console.log('Saved 61_desktop_user_imported_cards_loans.png');
  }

  // Navigate to Transactions Hub
  const txTab = page.locator('button:has-text("Transactions Hub")');
  if (await txTab.count() > 0) {
    await txTab.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(screenshotDir, '62_desktop_user_imported_transactions.png') });
    console.log('Saved 62_desktop_user_imported_transactions.png');
  }

  await browser.close();
  console.log('Done capturing imported data screenshots.');
}

run().catch(console.error);
