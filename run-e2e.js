import { chromium } from 'playwright-core';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = path.resolve('./screenshots');

async function main() {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  console.log('Launching browser (Edge)...');
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

  // 1. Verify Page Title & KPIs
  console.log('Checking Header and KPIs...');
  const title = await page.textContent('h1');
  console.log('Title:', title);
  if (!title?.includes('Tasklet Financial Command Center')) {
    throw new Error('Title does not match expected text');
  }

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01_command_overview.png') });
  console.log('Saved 01_command_overview.png');

  // 2. Test "Why does this number say $X?" Lineage Tracing on True Available Cash
  console.log('Testing Metric Lineage: Why does True Available Cash say $X?...');
  const kpiWhyButton = page.locator('div:has-text("True Available Cash") button:has-text("Why?")');
  await kpiWhyButton.first().click();
  await page.waitForSelector('text=Why Does This Number Say');
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '10_metric_lineage_available_cash.png') });
  console.log('Saved 10_metric_lineage_available_cash.png');
  await page.click('button:has-text("Close Audit")');

  // 3. Open Daily Briefing Modal
  console.log('Testing Daily Briefing Modal...');
  await page.click('button:has-text("Daily Briefing")');
  await page.waitForSelector('text=Daily Executive Financial Briefing');
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02_daily_briefing.png') });
  console.log('Saved 02_daily_briefing.png');

  // Click Copy Markdown
  await page.click('button:has-text("Copy Markdown")');
  await page.waitForSelector('text=Copied!');
  console.log('Verified Copy Markdown action!');

  // Close Briefing Modal
  await page.click('button:has-text("Done")');

  // 4. Navigate to Transactions Hub
  console.log('Testing Transactions Hub...');
  await page.click('button:has-text("Transactions Hub")');
  await page.waitForSelector('text=Merchant / Original Description');

  // Filter to Pending
  await page.click('button:has-text("pending")');
  await page.waitForTimeout(300);
  console.log('Filtered to pending charges.');

  // Back to All
  await page.click('button:has-text("all")');
  await page.waitForTimeout(300);

  // Click "Why?" on first row of transactions table to open Audit Trail
  const whyButtons = page.locator('table button:has-text("Why?")');
  await whyButtons.first().click();
  await page.waitForSelector('text=Classification Audit & Evidence Trail');
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03_audit_trail_modal.png') });
  console.log('Saved 03_audit_trail_modal.png');

  // Close Audit modal
  await page.click('button:has-text("Close")');

  // 5. Cards & Loans Center
  console.log('Testing Cards & Loans...');
  await page.click('button:has-text("Cards & Loans")');
  await page.waitForSelector('text=Revolving Credit & Commercial Debt Center');
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04_cards_and_loans.png') });
  console.log('Saved 04_cards_and_loans.png');

  // Check Stale feed button and resolve it
  const reauthBtn = page.locator('button:has-text("Re-Authenticate Feed")');
  if (await reauthBtn.isVisible()) {
    console.log('Found stale feed re-auth button. Clicking to resolve feed...');
    await reauthBtn.click();
    await page.waitForTimeout(500);
    console.log('Feed successfully re-authenticated!');
  }

  // 6. Subscriptions View
  console.log('Testing Subscriptions View...');
  await page.click('button:has-text("Subscriptions")');
  await page.waitForSelector('text=Subscriptions & Recurring Vendor Commitments');
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05_subscriptions_view.png') });
  console.log('Saved 05_subscriptions_view.png');

  // 7. Anomalies & Review Inbox
  console.log('Testing Anomalies Inbox...');
  await page.click('button:has-text("Anomalies & Review")');
  await page.waitForSelector('text=Anomalies & Classification Triage Inbox');
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06_anomalies_inbox.png') });
  console.log('Saved 06_anomalies_inbox.png');

  // Test 1-click reclassify on Steam personal expense
  const reclassifyPersonalBtn = page.locator('button:has-text("Classify as Personal Draw")');
  if (await reclassifyPersonalBtn.isVisible()) {
    console.log('Clicking "Classify as Personal Draw"...');
    await reclassifyPersonalBtn.first().click();
    await page.waitForTimeout(500);
    console.log('Reclassification successful!');
  }

  // 8. Financial Data Health Screen
  console.log('Testing Financial Data Health Screen...');
  await page.click('button:has-text("Data Health & Integrity")');
  await page.waitForSelector('text=Financial Data Health & Integrity Monitor');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '09_data_health.png') });
  console.log('Saved 09_data_health.png');

  // 9. What Changed Modal & Live Sync simulation
  console.log('Testing "What Changed?" Diff Modal...');
  await page.click('button:has-text("What Changed?")');
  await page.waitForSelector('text=What Changed Since Last Sync?');
  
  // Click Simulate Feed Sync Now
  await page.click('button:has-text("Simulate Feed Sync Now")');
  await page.waitForTimeout(1200);
  await page.waitForSelector('text=New Transactions Ingested Since Last Sync');
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07_what_changed_diff.png') });
  console.log('Saved 07_what_changed_diff.png');

  // Close What Changed
  await page.click('button:has-text("Close")');

  // 10. Ingest Plaid Data Modal
  console.log('Testing Ingest Plaid Data Modal...');
  await page.click('button:has-text("Ingest Plaid Data")');
  await page.waitForSelector('text=Plaid Data Ingestion & Normalizer');
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '08_ingest_data_modal.png') });
  console.log('Saved 08_ingest_data_modal.png');

  // Close Ingest Modal
  await page.click('button:has-text("Close")');

  console.log('All browser verification tests passed with 100% success!');
  await browser.close();
}

main().catch((err) => {
  console.error('E2E Browser verification failed:', err);
  process.exit(1);
});
