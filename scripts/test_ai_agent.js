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

  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });

  console.log('Navigating to app...');
  await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Click Load Sample Data to populate rich context
  console.log('Populating sample ledger data for AI Agent demo...');
  const loadSampleBtn = page.locator('button:has-text("Load Sample Data")').first();
  if (await loadSampleBtn.isVisible()) {
    await loadSampleBtn.click();
    await page.waitForTimeout(1000);
  }

  // Open AI Agent
  console.log('Opening AI Agent...');
  const aiButton = page.locator('button:has-text("AI Agent")').first();
  await aiButton.click();
  await page.waitForTimeout(800);

  // Click Upload Summary chip
  console.log('Clicking Upload Summary chip...');
  const summaryChip = page.locator('button:has-text("Upload Summary")').first();
  await summaryChip.click();
  await page.waitForTimeout(1200);

  // Screenshot rich upload summary
  await page.screenshot({ path: path.join(screenshotDir, '47_ai_agent_full_summary.png') });
  console.log('Saved 47_ai_agent_full_summary.png');

  // Click "What Needs Attention?" chip
  console.log('Clicking What Needs Attention chip...');
  const attentionChip = page.locator('button:has-text("What Needs Attention?")').first();
  await attentionChip.click();
  await page.waitForTimeout(1200);

  await page.screenshot({ path: path.join(screenshotDir, '48_ai_agent_attention_items.png') });
  console.log('Saved 48_ai_agent_attention_items.png');

  // Click an action shortcut inside the drawer to navigate to Cards & Loans
  console.log('Clicking action shortcut to navigate to Cards & Loans...');
  const openCardsBtn = page.locator('button:has-text("Cards & Loans")').last();
  await openCardsBtn.click();
  await page.waitForTimeout(1000);

  await page.screenshot({ path: path.join(screenshotDir, '49_ai_agent_navigated_cards_loans.png') });
  console.log('Saved 49_ai_agent_navigated_cards_loans.png');

  await browser.close();
  console.log('AI Agent verification completed successfully!');
}

run().catch((err) => {
  console.error('Playwright verification failed:', err);
  process.exit(1);
});
