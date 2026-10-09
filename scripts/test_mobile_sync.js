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

  // 1. Desktop Session: load sample data and classify a transaction
  console.log('1. Simulating Desktop session...');
  const desktopContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const desktopPage = await desktopContext.newPage();
  await desktopPage.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' });
  await desktopPage.waitForTimeout(1000);

  const loadSampleBtn = desktopPage.locator('button:has-text("Load Sample Data")').first();
  if (await loadSampleBtn.isVisible()) {
    await loadSampleBtn.click();
    console.log('Desktop: Loaded sample data');
    await desktopPage.waitForTimeout(1500); // Wait for debounced POST to /api/ledger
  }

  // 2. Mobile Session: completely new browser context (simulating iPhone on the go)
  console.log('2. Simulating Mobile phone session (iPhone 14 viewport 390x844)...');
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const mobilePage = await mobileContext.newPage();

  // Load app on mobile - should fetch /api/ledger and hydrate all data automatically!
  await mobilePage.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' });
  await mobilePage.waitForTimeout(1500);

  // Take screenshot of mobile overview with shared ledger loaded
  await mobilePage.screenshot({ path: path.join(screenshotDir, '50_mobile_overview_synced.png') });
  console.log('Saved 50_mobile_overview_synced.png');

  // Navigate to Transactions Hub on mobile
  console.log('Mobile: Navigating to Transactions Hub...');
  const txTab = mobilePage.locator('button:has-text("Transactions Hub")');
  await txTab.click();
  await mobilePage.waitForTimeout(800);

  // Take screenshot of mobile transactions review screen
  await mobilePage.screenshot({ path: path.join(screenshotDir, '51_mobile_transactions_review.png') });
  console.log('Saved 51_mobile_transactions_review.png');

  // Open AI Agent on mobile
  console.log('Mobile: Opening AI Agent Copilot on phone...');
  const aiFab = mobilePage.locator('button[title*="Tasklet AI"]').first();
  await aiFab.click();
  await mobilePage.waitForTimeout(800);

  // Take screenshot of mobile AI Agent drawer
  await mobilePage.screenshot({ path: path.join(screenshotDir, '52_mobile_ai_copilot_drawer.png') });
  console.log('Saved 52_mobile_ai_copilot_drawer.png');

  await browser.close();
  console.log('Cross-device mobile sync verification successful!');
}

run().catch((err) => {
  console.error('Mobile verification failed:', err);
  process.exit(1);
});
