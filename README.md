# Taboche POS System

A modern, fast, and organized Point of Sale (POS) system built for restaurants and cafes.

## Features

- 🏪 **Table Management**: Track multiple tables with timers
- 🍽️ **Menu System**: Categorized menu with search functionality
- 🧾 **Order Management**: Real-time order tracking and KOT printing
- 💰 **Payment Processing**: Multiple payment methods with change calculation
- 📊 **Reports**: Sales reports, order history, and item analytics
- 💾 **Data Backup**: Export/import system data
- 📱 **PWA Ready**: Installable on mobile devices with offline support
- 🎨 **Dark Mode**: Toggle between light and dark themes

## Local Development

### Option 1: Python Server (Recommended)
```bash
cd "path/to/taboche-pos"
python -m http.server 8000
```
Then open `http://localhost:8000` in your browser.

### Option 2: Node.js Server
```bash
npx serve .
```
Then open the provided localhost URL.

## GitHub Pages Deployment

1. **Fork or clone this repository**
2. **Enable GitHub Pages**:
   - Go to repository Settings → Pages
   - Source: "Deploy from a branch"
   - Branch: `main` (or your default branch)
   - Folder: `/ (root)`
3. **Access your site** at `https://yourusername.github.io/repository-name/`

### Important Notes for GitHub Pages:
- Service Workers work on HTTPS (automatically enabled)
- All paths are relative and will work correctly
- PWA installation is available on mobile devices
- Offline functionality is fully supported

## Browser Support

- Chrome/Edge: Full PWA support
- Firefox: Full functionality (PWA limited)
- Safari: Full functionality (PWA limited)
- Mobile browsers: Optimized touch interface

## File Structure

```
taboche-pos/
├── index.html          # Main application
├── manifest.json       # PWA manifest
├── sw.js              # Service worker
├── images/            # Menu item images and logos
└── README.md          # This file
```

## Usage

1. **Tables**: Click table buttons to select active table
2. **Menu**: Browse categories or search for items
3. **Orders**: Add items, modify quantities, add extras
4. **Checkout**: Process payments and print receipts
5. **Reports**: Access via sidebar menu

## Data Management

- **Auto-save**: All changes saved automatically to browser storage
- **Backup**: Export data via sidebar → Backup Data
- **Restore**: Import data via sidebar → Restore Data
- **Reset**: Clear all data via sidebar → Reset All Data

## Offline Support

When deployed on HTTPS (GitHub Pages), the app works offline:
- Cached menu and images
- Local data storage
- Background sync for orders (when online)

## Contributing

Feel free to submit issues and enhancement requests!
