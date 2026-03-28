// Step 1: Run this first to log into Google manually and save the session
// Usage: node login.js
// This opens a browser — log in with andy@herculesmovingsolutions.com
// Once logged in to the LSA dashboard, close the browser. Session is saved.

const { chromium } = require('playwright');
const path = require('path');

const USER_DATA_DIR = path.join(__dirname, 'google-session-2');

(async () => {
    console.log('Opening browser — please log in to Google...');
    console.log('Email: andy@herculesmovingsolutions.com');
    console.log('');
    console.log('Steps:');
    console.log('  1. Log in to Google');
    console.log('  2. Once logged in, paste this in the address bar:');
    console.log('     https://ads.google.com/localservices/leads');
    console.log('  3. Once you see the leads dashboard, close the browser.');
    console.log('');

    const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
        headless: false,
        viewport: { width: 1280, height: 800 },
        executablePath: process.platform === 'win32'
            ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
            : '/mnt/c/Program Files/Google/Chrome/Application/chrome.exe',
        args: [
            '--disable-blink-features=AutomationControlled',
            '--disable-infobars',
            '--start-maximized'
        ],
        ignoreDefaultArgs: ['--enable-automation'],
    });

    const page = context.pages()[0] || await context.newPage();
    // Start at plain Google sign-in — no redirect target that causes loops
    await page.goto('https://accounts.google.com', { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Wait for user to close browser
    await new Promise((resolve) => {
        context.on('close', resolve);
    });

    console.log('Session saved! You can now run: node scraper.js');
})();
