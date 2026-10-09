import { chromium } from 'playwright-core';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = 'C:/Users/brace/.gemini/antigravity/brain/1949cb98-28e7-47cc-8ca1-02d885a6fcd0/screenshots';
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function run() {
  console.log('Launching browser...');
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('Navigating to http://127.0.0.1:5173...');
  await page.goto('http://127.0.0.1:5173');
  await page.waitForTimeout(1000);

  // 1. Transactions Hub
  console.log('Testing Transactions Hub...');
  await page.click('button:has-text("Transactions Hub")');
  await page.waitForTimeout(600);

  // Check headers
  const headers = await page.$$eval('table thead th', (ths) => ths.map((th) => th.textContent?.trim()));
  console.log('Table Headers:', headers);

  // Take screenshot of Transactions Hub showing Column 3 as Amount
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '19_transactions_hub_amount_col3.png') });
  console.log('Saved 19_transactions_hub_amount_col3.png');

  // Check if bulk classify button is visible
  const bulkBtn = await page.$('button:has-text("Auto-Classify All as Business")');
  if (bulkBtn) {
    console.log('Found bulk classify button, clicking it...');
    await bulkBtn.click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '20_transactions_after_bulk_classify.png') });
    console.log('Saved 20_transactions_after_bulk_classify.png');
  }

  // 2. Cards & Loans
  console.log('Testing Cards & Loans...');
  await page.click('button:has-text("Cards & Loans")');
  await page.waitForTimeout(600);

  // Take screenshot of Cards & Loans showing Cash accounts + Credit limits
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '21_cards_and_loans_with_cash_and_edit.png') });
  console.log('Saved 21_cards_and_loans_with_cash_and_edit.png');

  // Test opening Edit modal on a credit card
  const editCardBtns = await page.$$('button[title="Edit credit limit and balance"], button:has-text("Edit Balance & Limit")');
  if (editCardBtns.length > 0) {
    console.log('Clicking Edit Balance & Limit...');
    await editCardBtns[0].click();
    await page.waitForTimeout(500);

    // Take screenshot of Edit Account modal
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '22_edit_card_limit_modal.png') });
    console.log('Saved 22_edit_card_limit_modal.png');

    // Fill new limit: 80000
    await page.fill('input[type="number"][step="1"]', '80000');
    await page.click('button[type="submit"]:has-text("Save Account")');
    await page.waitForTimeout(600);
    console.log('Saved updated credit limit!');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '23_cards_and_loans_recalculated.png') });
    console.log('Saved 23_cards_and_loans_recalculated.png');
  }

  // 3. Data Health & Integrity
  console.log('Testing Data Health...');
  await page.click('button:has-text("Data Health & Integrity")');
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '24_data_health_screen.png') });
  console.log('Saved 24_data_health_screen.png');

  // 4. Ingest & Export Modal (Portable Unified CSV)
  console.log('Testing Ingest Modal Export Tab...');
  await page.click('button:has-text("Upload CSV / Plaid")');
  await page.waitForTimeout(600);
  await page.click('button:has-text("Export Active Dataset")');
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '25_portable_unified_csv_export.png') });
  console.log('Saved 25_portable_unified_csv_export.png');

  // Close modal
  await page.click('button:has-text("Close")');
  await page.waitForTimeout(400);

  // 5. Daily Briefing
  console.log('Testing Daily Briefing Modal...');
  await page.click('button:has-text("Daily Briefing")');
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '26_daily_briefing_modal.png') });
  console.log('Saved 26_daily_briefing_modal.png');

  await browser.close();
  console.log('Browser tests completed successfully!');
}

run().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
