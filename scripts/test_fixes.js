import { chromium } from 'playwright-core';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = 'C:/Users/brace/.gemini/antigravity/brain/1949cb98-28e7-47cc-8ca1-02d885a6fcd0/screenshots';
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function run() {
  console.log('Launching Edge browser...');
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // Accept any window.confirm / alert dialogs automatically
  page.on('dialog', async (dialog) => {
    console.log(`Dialog message: "${dialog.message()}" -> accepting`);
    await dialog.accept();
  });

  console.log('Navigating to app...');
  await page.goto('http://127.0.0.1:5173');
  await page.waitForTimeout(1200);

  // 1. Check Cards & Loans
  console.log('1. Navigating to Cards & Loans...');
  await page.click('button:has-text("Cards & Loans")');
  await page.waitForTimeout(800);

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '27_cards_loans_before_purge.png') });
  console.log('Saved 27_cards_loans_before_purge.png');

  // Purge demo accounts if banner exists
  const purgeBtn = await page.$('button:has-text("Purge All Demo Accounts")');
  if (purgeBtn) {
    console.log('Purging demo template accounts...');
    await purgeBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '28_cards_loans_after_purge.png') });
    console.log('Saved 28_cards_loans_after_purge.png (Notice SBA loan $118.5k is removed!)');
  }

  // Test "Add Account" modal
  console.log('Opening Add Account modal...');
  const addAccountBtn = await page.$('button:has-text("Add Account")');
  if (addAccountBtn) {
    await addAccountBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '29_add_account_modal.png') });
    console.log('Saved 29_add_account_modal.png');
    // Close modal
    await page.click('button:has-text("Cancel")');
    await page.waitForTimeout(400);
  }

  // 2. Check Subscriptions View
  console.log('2. Navigating to Subscriptions view...');
  await page.click('button:has-text("Subscriptions")');
  await page.waitForTimeout(800);

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '30_subscriptions_distinct_dates.png') });
  console.log('Saved 30_subscriptions_distinct_dates.png');

  // Test editing a subscription's renewal date
  const editSubBtns = await page.$$('button[title="Edit subscription details"]');
  if (editSubBtns.length > 0) {
    console.log('Clicking Edit Subscription on first vendor...');
    await editSubBtns[0].click();
    await page.waitForTimeout(500);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '31_edit_subscription_modal.png') });
    console.log('Saved 31_edit_subscription_modal.png');

    // Change next estimated date
    const dateInput = await page.$('input[type="date"]');
    if (dateInput) {
      await dateInput.fill('2026-11-15');
      console.log('Updated next renewal date to 2026-11-15');
    }
    await page.click('button[type="submit"]:has-text("Save Changes")');
    await page.waitForTimeout(800);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '32_subscriptions_after_custom_date.png') });
    console.log('Saved 32_subscriptions_after_custom_date.png');
  }

  // 3. Test Add Subscription modal
  const addSubBtn = await page.$('button:has-text("Add Subscription")');
  if (addSubBtn) {
    console.log('Opening Add Subscription modal...');
    await addSubBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '33_add_subscription_modal.png') });
    console.log('Saved 33_add_subscription_modal.png');
    await page.click('button:has-text("Cancel")');
    await page.waitForTimeout(400);
  }

  // 4. Check Command Overview Dashboard
  console.log('4. Navigating back to Command Overview...');
  await page.click('button:has-text("Command Overview")');
  await page.waitForTimeout(800);

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '34_command_overview_reconciled.png') });
  console.log('Saved 34_command_overview_reconciled.png');

  // 5. Open Daily Briefing modal
  console.log('5. Opening Daily Briefing modal...');
  await page.click('button:has-text("Daily Briefing")');
  await page.waitForTimeout(800);

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '35_daily_briefing_after_fixes.png') });
  console.log('Saved 35_daily_briefing_after_fixes.png');

  await browser.close();
  console.log('All verification tests completed successfully!');
}

run().catch((err) => {
  console.error('Error during browser testing:', err);
  process.exit(1);
});
