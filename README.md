# Scaler Experiment Tester

A Chrome/Arc browser extension for testing and toggling experiment variants on Scaler pages.

## Features

- View all experiments on the current page
- Toggle between different variants with one click
- See variant distribution percentages
- Direct links to Flagr dashboard for each experiment
- Search and filter experiments
- Auto-refresh page after applying changes

## Installation

1. Clone or download this repository
2. Open `chrome://extensions` (Chrome) or `arc://extensions` (Arc)
3. Enable **Developer mode** (toggle in top right)
4. Click **Load unpacked**
5. Select the `scaler-experiment-toggler` folder

## Usage

1. Navigate to a Scaler page with experiments
2. Click the extension icon in your toolbar
3. View all experiments detected on the page
4. Click on a variant chip to select it
5. Click **Save & Apply** to update the cookie and refresh the page

## How It Works

The extension reads experiments from DOM elements with `data-variant-key` and `data-variant-value` attributes. When you select a variant and save, it updates the `experiments` cookie with the new values and refreshes the page.

Variant options and percentages are fetched from the Flagr API at `abex.scaler.com`.

## Project Structure

```
scaler-experiment-toggler/
├── manifest.json        # Extension configuration
├── popup.html           # Extension popup UI
├── styles.css           # Popup styles
├── scripts/
│   ├── popup.js         # Main popup logic
│   ├── background.js    # Service worker for cookie operations
│   └── content.js       # Content script for reading DOM
└── icons/               # Extension icons
```

## Requirements

- Chrome or Arc browser
- Access to Scaler pages with experiment elements

# scaler-experiments-toggler
