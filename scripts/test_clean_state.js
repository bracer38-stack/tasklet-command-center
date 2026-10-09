import { chromium } from 'playwright-core';
import fs from 'fs';
import path from 'path';

async function run() {
  const screenshotDir = 'C:\\Users\\brace\\.gemini\\antigravity\\brain\\1949cb98-28e7-47cc-8ca1-02d885a6fcd0\\screenshots';
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const browser = await chromium.launch({
    executablePath: fs.existsSync(edgePath) ? edgePath : undefined,
    headless: true,
  });

  // 1. Desktop Session - Clean state
  console.log('1. Loading Desktop clean state...');
  const desktopContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await desktopContext.newPage();
  await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // Screenshot Desktop Overview in Clean State
  await page.screenshot({ path: path.join(screenshotDir, '57_desktop_clean_ledger_onboarding.png') });
  console.log('Saved 57_desktop_clean_ledger_onboarding.png');

  // 2. Navigate to Transactions Hub in Clean State
  console.log('2. Navigating to Transactions Hub...');
  const txTab = page.locator('button:has-text("Transactions Hub")');
  await txTab.click();
  await page.waitForTimeout(1000);

  // Screenshot Transactions Hub
  await page.screenshot({ path: path.join(screenshotDir, '58_desktop_clean_transactions_hub.png') });
  console.log('Saved 58_desktop_clean_transactions_hub.png');

  // 3. Mobile phone session (iPhone 14)
  console.log('3. Loading Mobile clean state...');
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' });
  await mobilePage.waitForTimeout(1500);

  await mobilePage.screenshot({ path: path.join(screenshotDir, '59_mobile_clean_ledger.png') });
  console.log('Saved 59_mobile_clean_ledger.png');

  await browser.close();
  console.log('Clean state verification completed successfully!');
}

run().catch((err) => {
  console.error('Clean state verification failed:', err);
  process.exit(1);
});
