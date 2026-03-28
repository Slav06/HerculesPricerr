# Chrome Extensions Setup Guide

This project now has **TWO separate Chrome extensions** for different user roles:

## 🎯 Extension 1: Fronter Edition
**File:** `manifest.json` + `content.js`
**Purpose:** For fronters to track job submissions and dispositions

### Features:
- Submit Job
- Inv Done  
- Transferred
- Dropped
- CB Scheduled
- Disqualified
- Hung Up

## 🎯 Extension 2: Closer Edition  
**File:** `manifest-closer.json` + `content-closer.js`
**Purpose:** For closers to track job statuses and mark jobs as booked

### Features:
- Submit Job
- Inv Done
- **Mark Booked** (closer-specific)
- **Payment Capture** 💳 (closer-specific)
- Dropped
- CB Scheduled
- Disqualified
- Hung Up

---

## 📋 Installation Instructions

### Step 1: Load the Fronter Extension
1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Navigate to your project folder and select the **`fronter-extension`** folder
5. The extension will appear as "Job Tracker - Fronter Edition"

### Step 2: Load the Closer Extension  
1. In the same `chrome://extensions/` page
2. Click "Load unpacked" again
3. Navigate to your project folder and select the **`closer-extension`** folder
4. The extension will appear as "Job Tracker - Closer Edition"

### Step 3: Verify Both Extensions
- You should see TWO extensions in your Chrome extensions list
- Both should show as "Enabled"
- Both should have their respective icons and names

---

## 🚀 Usage

### For Fronters:
1. Install the **Fronter Edition** extension
2. Navigate to any HelloMoving pricing page
3. You'll see the fronter overlay buttons on the right side
4. Use the buttons to track job dispositions

### For Closers:
1. Install the **Closer Edition** extension  
2. Navigate to any HelloMoving pricing page
3. You'll see the closer overlay buttons on the right side
4. Use the buttons to track job statuses, including "Mark Booked" and "Payment Capture"

---

## 🔧 Technical Details

### Key Differences:
- **Fronter Extension**: Has "Transferred" button, no "Mark Booked" or "Payment Capture"
- **Closer Extension**: Has "Mark Booked" and "Payment Capture" buttons, no "Transferred"
- Both extensions work independently and always show overlays
- No authentication required - overlays appear automatically

### Files Structure:
```
├── fronter-extension/           # Fronter Extension Folder
│   ├── manifest.json           # Fronter extension manifest
│   ├── content.js             # Fronter extension content script
│   ├── popup.html             # Fronter extension popup
│   ├── popup.css              # Fronter extension styles
│   ├── popup.js               # Fronter extension popup script
│   └── background.js          # Background script
├── closer-extension/           # Closer Extension Folder
│   ├── manifest.json          # Closer extension manifest
│   ├── content.js             # Closer extension content script
│   ├── popup.html             # Closer extension popup
│   └── background.js          # Background script
├── manifest-closer.json       # Original closer manifest (for reference)
├── content-closer.js          # Original closer content script (for reference)
└── popup-closer.html          # Original closer popup (for reference)
```

---

## 🐛 Troubleshooting

### If overlays don't appear:
1. Make sure you're on a HelloMoving pricing page
2. Check the browser console for any errors
3. Try refreshing the page
4. Verify the extension is enabled in `chrome://extensions/`

### If you see the wrong buttons:
1. Make sure you have the correct extension installed
2. Uninstall the other extension if you only need one role
3. Check that you're using the right manifest file

### For testing:
- Use the browser console command: `testCreateOverlays()`
- This will manually create the overlays for testing

---

## 📝 Notes

- Both extensions work on the same HelloMoving pages
- Each user should only install the extension for their role
- The extensions are completely independent
- All data is submitted to the same Supabase database
- Slack notifications work with both extensions
