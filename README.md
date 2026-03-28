# Page Price Analyzer Chrome Extension

A Chrome extension that analyzes web pages and extracts pricing information, specifically designed for moving company and service pricing pages.

## Features

- **Automatic Page Analysis**: Automatically detects and analyzes pricing pages
- **Zip Code Extraction**: Extracts origin and destination zip codes from moving forms
- **Pricing Breakdown**: Captures initial price, fuel surcharge, extra charges, and total estimates
- **Job Details**: Extracts job numbers, status, and important dates
- **Real-time Updates**: Monitors page changes and updates analysis automatically
- **Clean Interface**: Modern, responsive popup interface without external CSS frameworks

## Installation

### Method 1: Load as Unpacked Extension (Development)

1. Download or clone this repository to your local machine
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the extension folder
5. The extension icon should appear in your Chrome toolbar

### Method 2: Install from Chrome Web Store (Future)

*Coming soon - the extension will be available on the Chrome Web Store*

## Usage

1. **Navigate to a pricing page** (e.g., moving company estimate page)
2. **Click the extension icon** in your Chrome toolbar
3. **Click "Analyze Current Page"** to extract information
4. **View the results** in the organized sections:
   - Location Information (Moving From/To)
   - Pricing Breakdown
   - Job Details

## What It Analyzes

### Location Information
- **Moving From**: Zip code, city, state
- **Moving To**: Zip code, city, state

### Pricing Breakdown
- Initial Price
- Fuel Surcharge
- Extra Charges
- Total Estimate

### Job Details
- Job Number
- Status
- Pick-up Date

## Supported Page Types

The extension is optimized for:
- Moving company pricing pages
- Service estimate forms
- Quote calculation pages
- Relocation cost estimators

## Technical Details

- **Manifest Version**: 3 (Latest Chrome extension standard)
- **Permissions**: 
  - `activeTab`: Access to current tab
  - `storage`: Save user preferences
  - `scripting`: Execute content scripts
- **Content Scripts**: Automatically injected on all pages
- **Background Service Worker**: Handles extension lifecycle and background tasks

## File Structure

```
├── manifest.json          # Extension configuration
├── popup.html            # Popup interface
├── popup.css             # Popup styling
├── popup.js              # Popup functionality
├── content.js            # Page analysis logic
├── background.js         # Background service worker
└── README.md             # This file
```

## Customization

### Adding New Data Extraction Patterns

Edit `content.js` to add new extraction patterns:

```javascript
// Add new extraction method
extractNewData(textContent) {
    const pattern = /your-pattern-here/;
    const match = textContent.match(pattern);
    if (match) {
        this.data.newField = match[1];
    }
}
```

### Modifying the Interface

Edit `popup.html` and `popup.css` to change the appearance and layout.

## Troubleshooting

### Extension Not Working
1. Check if the extension is enabled in `chrome://extensions/`
2. Refresh the page you're trying to analyze
3. Check the browser console for error messages

### No Data Extracted
1. Ensure the page has fully loaded
2. Check if the page contains the expected data
3. The extension works best with structured pricing forms

### Permission Issues
1. The extension only needs access to the current tab
2. No personal data is collected or transmitted
3. All analysis happens locally in your browser

## Development

### Prerequisites
- Chrome browser
- Basic knowledge of HTML, CSS, and JavaScript

### Making Changes
1. Edit the source files
2. Go to `chrome://extensions/`
3. Click the refresh button on your extension
4. Test the changes

### Testing
- Test on various pricing pages
- Check different page structures
- Verify data extraction accuracy

## Contributing

Feel free to submit issues, feature requests, or pull requests to improve the extension.

## License

This project is open source and available under the MIT License.

## Support

For support or questions, please open an issue in the repository or contact the development team.

---

**Note**: This extension is designed to work with publicly available pricing information and does not bypass any paywalls or access restricted content.

