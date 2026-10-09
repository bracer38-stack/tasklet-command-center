import { chromium } from 'playwright-core';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = path.resolve('./screenshots');

async function main() {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  // Create temporary test CSV representing a business owner's real bank export
  const testCsvPath = path.resolve('./user_real_bank_export.csv');
  const csvData = `Transaction ID,Account Name,Date,Description,Amount,Category,Pending
tx_real_01,Pinnacle Consulting Checking,2026-10-02,CLIENT RETAINER WIRE INFLOW,-18500.00,Deposit,false
tx_real_02,Pinnacle Consulting Checking,2026-10-01,OFFICE LEASE SUITE 400,3200.00,Rent,false
tx_real_03,Pinnacle Consulting Checking,2026-10-03,GUSTO PAYROLL RUN,6400.00,Payroll,false
tx_real_04,Pinnacle Corporate Card,2026-10-02,GOOGLE ADS CAMPAIGN,1450.00,Advertising,false
tx_real_05,Pinnacle Corporate Card,2026-10-03,ZOOM VIDEO COMMUNICATIONS,59.99,Software,false`;

  fs.writeFileSync(testCsvPath, csvData, 'utf-8');
  console.log('Created temporary test CSV at:', testCsvPath);

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

  // 1. Verify initially we have the demo state
  console.log('Verifying initial state...');
  const initialCompany = await page.textContent('header');
  console.log('Header text contains Acme Labs?', initialCompany?.includes('Acme Labs'));

  // 2. Click "Ingest Plaid Data" button
  console.log('Opening Ingestion Modal...');
  await page.click('button:has-text("Ingest Plaid Data")');
  await page.waitForSelector('text=Plaid & Bank CSV Ingestion');

  // 3. Upload file via the hidden input[type="file"]
  console.log('Uploading user_real_bank_export.csv via file input...');
  const fileInput = await page.locator('input[type="file"]');
  await fileInput.setInputFiles(testCsvPath);

  // 4. Wait for preview and validation
  console.log('Waiting for parser validation...');
  await page.waitForSelector('text=Discovered Accounts & Starting Balances');
  await page.waitForSelector('text=user_real_bank_export.csv');

  // Edit Business name to "Pinnacle Consulting Group"
  const businessInput = page.locator('input[placeholder="e.g. My Business LLC"]');
  await businessInput.fill('Pinnacle Consulting Group');

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '14_csv_replace_demo_preview.png') });
  console.log('Saved screenshots/14_csv_replace_demo_preview.png');

  // 5. Click "Apply to Dashboard & Update All Numbers"
  console.log('Applying ingestion and updating all dashboard numbers...');
  await page.click('button:has-text("Apply to Dashboard & Update All Numbers")');
  await page.waitForSelector('text=Reconciliation complete');

  // Wait for modal to auto-close
  await page.waitForTimeout(1400);

  // 6. Verify Dashboard now shows the new company and new numbers
  console.log('Verifying updated dashboard...');
  const updatedHeader = await page.textContent('header');
  console.log('New Business Name in Header:', updatedHeader?.includes('Pinnacle Consulting Group'));

  const kpis = await page.textContent('main');
  console.log('Does main contain fake SVB loan ($118,500)?', kpis?.includes('$118,500'));

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '15_dashboard_after_real_csv_replace.png') });
  console.log('Saved screenshots/15_dashboard_after_real_csv_replace.png');

  await browser.close();

  // Cleanup test file
  if (fs.existsSync(testCsvPath)) {
    fs.unlinkSync(testCsvPath);
    console.log('Cleaned up user_real_bank_export.csv');
  }

  console.log('Replace Demo E2E test completed successfully!');
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
