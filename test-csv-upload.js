import { chromium } from 'playwright-core';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = path.resolve('./screenshots');

async function main() {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  // Create temporary test CSV file
  const testCsvPath = path.resolve('./test_bank_feed.csv');
  const csvData = `Transaction ID,Account Name,Date,Description,Amount,Category,Pending
tx_upload_01,Mercury Operating,2026-10-03,AWS EC2 & CLOUD STORAGE,1840.50,Cloud Infrastructure,false
tx_upload_02,Mercury Operating,2026-10-02,STRIPE PAYOUT BATCH #7741,-28500.00,Deposit,false
tx_upload_03,Chase Ink Business Cash,2026-10-03,AIRBNB OFF-SITE RETREAT,850.00,Travel,true
tx_upload_04,Chase Ink Business Cash,2026-10-01,FIGMA ANNUAL TEAM LICENSE,540.00,Software,false`;

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

  // 1. Click "Ingest Plaid Data" button
  console.log('Opening Ingest Plaid Data Modal...');
  await page.click('button:has-text("Ingest Plaid Data")');
  await page.waitForSelector('text=Plaid Data Ingestion & Reconciliation');

  // 2. Upload file via the hidden input[type="file"]
  console.log('Uploading test_bank_feed.csv via file input...');
  const fileInput = await page.locator('input[type="file"]');
  await fileInput.setInputFiles(testCsvPath);

  // 3. Wait for preview and validation
  console.log('Waiting for parser validation...');
  await page.waitForSelector('text=Ready for Reconciliation');
  await page.waitForSelector('text=test_bank_feed.csv');

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '11_csv_file_uploaded.png') });
  console.log('Saved screenshots/11_csv_file_uploaded.png');

  // 4. Click "Commit & Reconcile Financial Records"
  console.log('Committing ingestion...');
  await page.click('button:has-text("Commit & Reconcile Financial Records")');
  await page.waitForSelector('text=Reconciliation complete');

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '12_csv_reconciliation_applied.png') });
  console.log('Saved screenshots/12_csv_reconciliation_applied.png');

  // Wait for modal to auto-close
  await page.waitForTimeout(1600);

  // Check that the new transactions appear on Overview / Transactions
  await page.click('button:has-text("Transactions")');
  await page.waitForSelector('text=AWS EC2 & CLOUD STORAGE');
  console.log('Verified newly ingested CSV transactions visible in Transactions view!');

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '13_transactions_after_csv_upload.png') });
  console.log('Saved screenshots/13_transactions_after_csv_upload.png');

  await browser.close();

  // Cleanup test file
  if (fs.existsSync(testCsvPath)) {
    fs.unlinkSync(testCsvPath);
    console.log('Cleaned up test_bank_feed.csv');
  }

  console.log('CSV Upload test completed successfully!');
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
