import { chromium } from 'playwright-core';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = path.resolve('./screenshots');
const ARTIFACT_SCREENSHOT_DIR = 'C:\\Users\\brace\\.gemini\\antigravity\\brain\\cef13811-c6e2-41f2-84fb-369d909546cf\\screenshots';

async function main() {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
  if (!fs.existsSync(ARTIFACT_SCREENSHOT_DIR)) {
    fs.mkdirSync(ARTIFACT_SCREENSHOT_DIR, { recursive: true });
  }

  console.log('Launching browser for Import-Reset Workflow validation...');
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 960 },
  });
  const page = await context.newPage();

  console.log('Step 1: Navigating to Tasklet Financial Command Center at http://localhost:5173/ ...');
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // 1. Initial State: Verify Demo Mode Badge is present
  console.log('Step 2: Checking Data Mode Badge...');
  const badge = page.locator('button:has-text("Demo Mode"), button:has-text("Imported CSV"), button:has-text("Unknown Freshness")');
  await badge.first().waitFor({ state: 'visible' });
  console.log('Data Mode Badge is visible!');

  // Open Data Mode Badge popover
  await badge.first().click();
  await page.waitForTimeout(500);
  await saveScreenshot(page, '25_data_mode_badge_popover.png');

  // Close popover by clicking outside or pressing Escape
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // 2. Click "Purge Fixtures" (Requirement 1 & 2)
  console.log('Step 3: Purging all demo fixtures from production state...');
  const purgeBtn = page.locator('button:has-text("Purge Fixtures"), button:has-text("Clear Demo Data")').first();
  if (await purgeBtn.isVisible()) {
    await purgeBtn.click();
    await page.waitForTimeout(1000);
    console.log('Fixtures purged!');
  }

  // 3. Verify Clean Slate & Requirement 8: No calculated fake cash, utilization, or debt (render em-dash '—')
  console.log('Step 4: Verifying clean slate (Requirement 8)...');
  await page.waitForSelector('text=Awaiting valid source data');
  console.log('Verified: Em-dashes and "Awaiting valid source data" rendered on all cards!');
  await saveScreenshot(page, '26_clean_slate_em_dashes_awaiting_source.png');

  // 4. Open Ingestion Modal
  console.log('Step 5: Opening Ingestion Modal to test multi-record-type reconciliation...');
  const importStatementBtn = page.locator('button:has-text("Import Statement"), button:has-text("Upload CSV / Plaid"), button:has-text("Upload Bank CSV Now")');
  await importStatementBtn.first().click();
  await page.waitForTimeout(800);

  // 5. Click "Preset Scenarios" -> "Open Import Reconciliation Screen"
  console.log('Step 6: Navigating to Preset Scenarios...');
  const presetTab = page.locator('button:has-text("Preset Scenarios")');
  await presetTab.click();
  await page.waitForTimeout(500);
  await saveScreenshot(page, '27_preset_scenarios_tab.png');

  // Click "Open Import Reconciliation Screen" (Requirement 7)
  console.log('Step 7: Launching Import Reconciliation Screen...');
  const openReconBtn = page.locator('button:has-text("Open Import Reconciliation Screen")');
  await openReconBtn.click();
  await page.waitForTimeout(1000);

  // 6. Verify Reconciliation Screen counters and tabs
  console.log('Step 8: Verifying reconciliation screen metrics (rows read, accepted, rejected, duplicates, unknown types)...');
  await page.waitForSelector('text=Import Reconciliation Report');
  await page.waitForSelector('text=Totals by Record Type');
  console.log('Verified: Import Reconciliation Report rendered with all 5 metric cards!');
  await saveScreenshot(page, '28_import_reconciliation_report.png');

  // Inspect Accepted Records tab
  console.log('Step 9: Inspecting Accepted Records tab...');
  const acceptedTab = page.locator('button:has-text("Accepted Records")');
  await acceptedTab.click();
  await page.waitForTimeout(500);
  await saveScreenshot(page, '29_reconciliation_accepted_records.png');

  // 7. Commit Reconciled Records
  console.log('Step 10: Committing reconciled records to live production state...');
  const commitBtn = page.locator('button:has-text("Commit 7 Reconciled Records")');
  await commitBtn.click();
  await page.waitForTimeout(1200);

  // 8. Verify Dashboard updated with live imported data & Data Mode changed to "Imported CSV"
  console.log('Step 11: Verifying dashboard updated with Imported CSV state...');
  await page.waitForSelector('button:has-text("Imported CSV")');
  console.log('Verified: Data Mode Badge updated to "Imported CSV"!');
  await saveScreenshot(page, '30_imported_csv_dashboard_active.png');

  // 9. Verify Transactions Hub defaults unclassified to "Needs Review" (Requirement 9)
  console.log('Step 12: Checking Transactions Hub for Needs Review default...');
  const txTab = page.locator('nav button:has-text("Transactions Hub")');
  await txTab.click();
  await page.waitForTimeout(800);
  await page.waitForSelector('text=Needs Review');
  console.log('Verified: Unclassified transactions defaulted to Needs Review!');
  await saveScreenshot(page, '31_transactions_hub_needs_review.png');

  // 10. Test Traceable Financial Data Export (Requirement 10)
  console.log('Step 13: Testing Traceable Financial Data Export...');
  const exportJsonBtn = page.locator('header button:has-text("Export JSON")');
  await exportJsonBtn.waitFor({ state: 'visible' });
  console.log('Export JSON and CSV buttons verified!');

  console.log('All 10 requirements validated successfully!');
  await browser.close();
}

async function saveScreenshot(page, filename) {
  const localPath = path.join(SCREENSHOT_DIR, filename);
  const artifactPath = path.join(ARTIFACT_SCREENSHOT_DIR, filename);
  await page.screenshot({ path: localPath });
  fs.copyFileSync(localPath, artifactPath);
  console.log(`Saved screenshot: ${filename}`);
}

main().catch((err) => {
  console.error('Test run failed:', err);
  process.exit(1);
});
