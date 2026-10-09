import { chromium } from 'playwright-core';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = 'C:/Users/brace/.gemini/antigravity/brain/1949cb98-28e7-47cc-8ca1-02d885a6fcd0/screenshots';
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function run() {
  console.log('Launching browser for verification...');
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  page.on('dialog', async (d) => await d.accept());

  console.log('Navigating to http://127.0.0.1:5173...');
  await page.goto('http://127.0.0.1:5173');
  await page.waitForTimeout(1500);

  // 1. Overview Screen
  console.log('Capturing 36_command_overview_with_reviewer_fixes.png...');
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '36_command_overview_with_reviewer_fixes.png') });

  // 2. Transactions Hub
  console.log('Navigating to Transactions Hub...');
  await page.click('button:has-text("Transactions Hub")');
  await page.waitForTimeout(1000);
  console.log('Capturing 37_transactions_hub_safe_classification.png...');
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '37_transactions_hub_safe_classification.png') });

  // 3. Subscriptions View
  console.log('Navigating to Subscriptions...');
  await page.click('button:has-text("Subscriptions")');
  await page.waitForTimeout(800);
  console.log('Capturing 38_subscriptions_confidence_badges.png...');
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '38_subscriptions_confidence_badges.png') });

  // 4. Cards & Loans Center
  console.log('Navigating to Cards & Loans...');
  await page.click('button:has-text("Cards & Loans")');
  await page.waitForTimeout(800);
  console.log('Capturing 39_cards_loans_npsl_and_cash_gated.png...');
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '39_cards_loans_npsl_and_cash_gated.png') });

  // 5. Data Health Screen
  console.log('Navigating to Data Health...');
  await page.click('button:has-text("Data Health")');
  await page.waitForTimeout(800);
  console.log('Capturing 40_data_health_5_dimensions.png...');
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '40_data_health_5_dimensions.png') });

  // 6. Anomalies View
  console.log('Navigating to Anomalies...');
  await page.click('button:has-text("Anomalies")');
  await page.waitForTimeout(800);
  console.log('Capturing 41_anomalies_safe_triage.png...');
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '41_anomalies_safe_triage.png') });

  await browser.close();
  console.log('Verification completed successfully!');
}

run().catch((err) => {
  console.error('Error running verification:', err);
  process.exit(1);
});
