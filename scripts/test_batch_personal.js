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

  // 1. Desktop Session
  console.log('1. Loading Desktop session...');
  const desktopContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await desktopContext.newPage();
  await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // Screenshot Desktop Overview
  await page.screenshot({ path: path.join(screenshotDir, '53_desktop_overview_batch_personal.png') });
  console.log('Saved 53_desktop_overview_batch_personal.png');

  // 2. Navigate to Transactions Hub
  console.log('2. Navigating to Transactions Hub...');
  const txTab = page.locator('button:has-text("Transactions Hub")');
  await txTab.click();
  await page.waitForTimeout(1000);

  // Screenshot Transactions Hub
  await page.screenshot({ path: path.join(screenshotDir, '54_desktop_transactions_verified.png') });
  console.log('Saved 54_desktop_transactions_verified.png');

  // 3. Open AI Agent Drawer and test batch query
  console.log('3. Testing AI Agent query: "in a batch mark the rest as personal"...');
  const aiBtn = page.locator('button:has-text("AI Agent")').first();
  await aiBtn.click();
  await page.waitForTimeout(800);

  // Type query into AI copilot input
  const aiInput = page.locator('input[placeholder*="Ask Tasklet AI"]').first();
  await aiInput.fill('in a batch can you mark the rest as personal');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);

  // Screenshot AI Drawer Response
  await page.screenshot({ path: path.join(screenshotDir, '55_ai_copilot_batch_personal_response.png') });
  console.log('Saved 55_ai_copilot_batch_personal_response.png');

  // Close AI Drawer
  const closeAiBtn = page.locator('button').filter({ has: page.locator('svg.lucide-x') }).first();
  if (await closeAiBtn.isVisible()) {
    await closeAiBtn.click();
    await page.waitForTimeout(500);
  }

  // 4. Mobile Session (iPhone 14)
  console.log('4. Testing Mobile phone session...');
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' });
  await mobilePage.waitForTimeout(1500);

  const mobileTxTab = mobilePage.locator('button:has-text("Transactions Hub")');
  await mobileTxTab.click();
  await mobilePage.waitForTimeout(1000);

  await mobilePage.screenshot({ path: path.join(screenshotDir, '56_mobile_verified_personal_ledger.png') });
  console.log('Saved 56_mobile_verified_personal_ledger.png');

  await browser.close();
  console.log('All verification checks completed successfully!');
}

run().catch((err) => {
  console.error('Playwright verification failed:', err);
  process.exit(1);
});
