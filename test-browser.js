import { chromium } from 'playwright-core';

async function run() {
  console.log('Testing Edge launch...');
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: true,
  });
  console.log('Browser launched successfully!');
  const page = await browser.newPage();
  await page.goto('https://example.com');
  const title = await page.title();
  console.log('Page title:', title);
  await browser.close();
  console.log('Browser test finished cleanly.');
}

run().catch((err) => {
  console.error('Launch failed:', err);
  process.exit(1);
});
