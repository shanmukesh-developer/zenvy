const puppeteer = require('puppeteer');
const fs = require('fs');

const ARTIFACT_DIR = 'C:\\Users\\Shanmukh\\.gemini\\antigravity\\brain\\a98b5402-fd32-402f-acf9-1ed7f085dd5c';

(async () => {
  const browser = await puppeteer.launch({ 
    headless: "new",
    defaultViewport: { width: 390, height: 844, isMobile: true, hasTouch: true }
  });
  
  const page = await browser.newPage();
  const errors = [];
  const logs = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(`[CONSOLE ERROR] ${msg.text()}`);
    } else if (msg.text().includes('Warning')) {
      logs.push(`[CONSOLE WARN] ${msg.text()}`);
    }
  });

  page.on('requestfailed', request => {
    errors.push(`[REQ FAILED] ${request.url()} - ${request.failure().errorText}`);
  });

  page.on('response', response => {
    if (response.status() === 404) {
      errors.push(`[404 NOT FOUND] ${response.url()}`);
    }
  });

  page.on('pageerror', err => {
    errors.push(`[PAGE ERROR] ${err.toString()}`);
  });

  const urls = [
    { name: 'home', url: 'http://localhost:3000/' },
    { name: 'basket', url: 'http://localhost:3000/basket' },
    { name: 'profile', url: 'http://localhost:3000/profile' },
    { name: 'community', url: 'http://localhost:3000/community' }
  ];

  for (const { name, url } of urls) {
    try {
      console.log(`Auditing ${name} (${url})...`);
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
      await new Promise(r => setTimeout(r, 2000)); // Let animations settle
      
      const screenshotPath = `${ARTIFACT_DIR}\\audit_${name}_${Date.now()}.png`;
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`-> Saved screenshot: ${screenshotPath}`);
      
    } catch (err) {
      console.log(`-> Error navigating to ${name}: ${err.message}`);
      errors.push(`[NAV ERROR] ${name}: ${err.message}`);
    }
  }

  await browser.close();

  // Print results
  console.log("\n--- AUDIT RESULTS ---");
  console.log(`Total Errors Detected: ${errors.length}`);
  if (errors.length > 0) {
    errors.forEach(e => console.log(e));
  }
  
  console.log(`\nTotal Warnings Detected: ${logs.length}`);
  if (logs.length > 0) {
    logs.forEach(e => console.log(e));
  }
})();
