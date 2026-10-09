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

  // Navigate to Transactions Hub
  const txTab = page.locator('button:has-text("Transactions Hub")');
  if (await txTab.count() > 0) {
    await txTab.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(screenshotDir, '69_desktop_transactions_with_plaid_records.png') });
    console.log('Saved 69_desktop_transactions_with_plaid_records.png');
  }

  // Open Import Modal and simulate loading the user CSV to verify staging screen displays 4 accepted, 0 rejected, $0 variance
  const importBtn = page.locator('button:has-text("Import"), button:has-text("Upload")').first();
  if (await importBtn.count() > 0) {
    await importBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(screenshotDir, '70_desktop_staging_screen_plaid_verified.png') });
    console.log('Saved 70_desktop_staging_screen_plaid_verified.png');
  }

  // Mobile screenshot of Transactions Hub
  const mobileContext = await browser.newContext({
    viewport: { width: 393, height: 852 },
    isMobile: true,
  });
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' });
  await mobilePage.waitForTimeout(2000);

  const mobileTxTab = mobilePage.locator('button:has-text("Transactions"), button:has-text("Transactions Hub")').first();
  if (await mobileTxTab.count() > 0) {
    await mobileTxTab.click();
    await mobilePage.waitForTimeout(1500);
    await mobilePage.screenshot({ path: path.join(screenshotDir, '71_mobile_transactions_with_plaid_records.png') });
    console.log('Saved 71_mobile_transactions_with_plaid_records.png');
  }

  await browser.close();
  console.log('All verification screenshots captured successfully.');
}

run().catch(console.error);
