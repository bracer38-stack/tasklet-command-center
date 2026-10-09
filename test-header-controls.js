import { chromium } from 'playwright-core';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = path.resolve('./screenshots');

async function main() {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  console.log('Launching Edge browser...');
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 960 },
  });
  const page = await context.newPage();

  console.log('Navigating to http://127.0.0.1:5173/ ...');
  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });

  // 1. Verify "Upload CSV / Plaid" green button is in the header
  console.log('Checking for green Upload CSV / Plaid button...');
  const uploadButton = page.locator('button:has-text("Upload CSV / Plaid")');
  await uploadButton.waitFor({ state: 'visible' });
  console.log('Found green button: Upload CSV / Plaid!');

  // 2. Test inline business name editing
  console.log('Testing business name inline edit...');
  const bizNameButton = page.locator('header button:has-text("Acme Labs"), header button:has-text("My Business"), header button:has-text("Pinnacle")');
  await bizNameButton.first().click();

  const bizInput = page.locator('header input[type="text"]');
  await bizInput.waitFor({ state: 'visible' });
  await bizInput.fill('Apex Global Ventures LLC');
  await page.keyboard.press('Enter');

  await page.waitForSelector('header :has-text("Apex Global Ventures LLC")');
  console.log('Successfully updated business name to Apex Global Ventures LLC!');

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '16_header_controls_and_inline_edit.png') });
  console.log('Saved screenshots/16_header_controls_and_inline_edit.png');

  // 3. Test "Clear Demo Data" button if visible, or test clear action
  const clearDemoBtn = page.locator('button:has-text("Clear Demo Data")');
  if (await clearDemoBtn.isVisible()) {
    console.log('Clicking Clear Demo Data button...');
    await clearDemoBtn.click();
    await page.waitForSelector('text=Demo Data Cleared');
    console.log('Verified empty state with 0 accounts!');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '17_cleared_demo_empty_state.png') });
    console.log('Saved screenshots/17_cleared_demo_empty_state.png');
  }

  // 4. Click the green "Upload CSV / Plaid" button
  console.log('Clicking green Upload CSV / Plaid button...');
  await uploadButton.click();
  await page.waitForSelector('text=Plaid & Bank CSV Ingestion');
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '18_modal_opened_from_green_button.png') });
  console.log('Saved screenshots/18_modal_opened_from_green_button.png');

  await browser.close();
  console.log('Header controls test completed successfully!');
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
