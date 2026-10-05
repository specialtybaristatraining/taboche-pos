# Taboche Restaurant - Quick Start Guide

## What's Included

Your professional restaurant website includes:

✅ **Fully Responsive Design** - Works on all devices
✅ **Modern Navigation** - Sticky header with mobile menu
✅ **Hero Section** - Eye-catching banner
✅ **About Section** - Tell your restaurant story
✅ **Menu Management** - Easy-to-update menu system
✅ **Gallery** - Showcase your food and ambiance
✅ **Reservation System** - Online booking capability
✅ **Contact Information** - Location, phone, hours
✅ **Social Media Links** - Connect with customers
✅ **Professional Styling** - Premium look and feel
✅ **Mobile Optimized** - Perfect on smartphones
✅ **Smooth Animations** - Engaging user experience

## Quick Setup - 5 Minutes

### Step 1: Open the Website
1. Open the folder "taboche webside" on your desktop
2. Double-click `index.html` to open in your browser

### Step 2: Customize Your Information
Edit `index.html` and update these key sections:

**Location & Contact Details** (Find "Contact Us"):
```
Opposite Siddhapokhari, Bhaktapur 44800, Nepal
Phone: +977-9824926296
Hours: Daily, 07:00 AM – 08:00 PM
```

**Restaurant Description** (Find "About Taboche"):
- Add your restaurant's story
- Update mission and values

**Menu Items** (Menu Section):
- Add your actual dishes
- Update prices
- Add descriptions

### Step 3: Upload to Web
Once customized, upload all files to your web hosting:
- index.html
- loyalty/loyalty.html
- styles.css
- loyalty/loyalty.css
- script.js
- loyalty/loyalty.js
- loyalty/loyalty-code.js
- theme.js
- sw.js
- manifest.webmanifest
- offline.html
- 404.html
- success.html
- captions.vtt
- images/ (including WebP variants, icons, og-image.jpg, and apple-touch-icon.png)
- robots.txt
- sitemap.xml
- _headers
- README.md

## Key Features Explained

### 📍 Navigation
- Automatically highlights current section
- Smooth scrolling to sections
- Mobile-friendly hamburger menu
- Professional sticky header

### 🍽️ Menu System
Click menu tabs to switch between:
- Coffee
- Tea
- Signature Drinks
- Food

Add new items by copying the menu-item template.

### 📅 Reservation System
Customers can:
- Select date and time
- Choose number of guests
- Pick seating preference
- Add special requests

The reservation form opens WhatsApp so the customer can confirm directly. Reservation records are also kept in that browser for export; there is no shared reservation database. On Netlify, the form's native fallback uses Netlify Forms and redirects to `success.html`.

### 🖼️ Gallery
Replace placeholders with your restaurant photos:
- Interior photos
- Food photography
- Staff and ambiance
- Special events

### 📞 Contact Section
Display all your contact information clearly:
- Physical location
- Phone number
- Email address
- Operating hours
- Social media links

## Customization Tips

### Change Colors
Edit the brand variables at the top of `styles.css`:
```css
--latte: #C5A059;
--espresso: #2D2424;
--cream: #FDF8F5;
```

### Add Menu Categories
1. Add button to `.menu-tabs`:
   ```html
   <button class="tab-btn" data-tab="new-category">New</button>
   ```

2. Add content div:
   ```html
   <div id="new-category" class="tab-content">
       <!-- Add menu items here -->
   </div>
   ```

### Update Social Links
Find the social-links section and update URLs:
```html
<a href="https://facebook.com/taboche" class="social-link">
```

## Testing the Website

### Desktop Testing
- Open index.html in any browser
- Test all navigation links
- Try the reservation form
- Check hamburger menu on resized window

### Mobile Testing
1. Open in mobile browser
2. Check responsiveness
3. Test touch interactions
4. Verify all sections display properly

### Reservation Testing
1. Fill out reservation form
2. Click "Reserve Table"
3. See success notification
4. If the submission is handled by Netlify Forms, check the site's Netlify dashboard for the form entry.

## SEO & Online Presence

### Google Search
To help search engines find the site:
1. Deploy the site to its production domain
2. Verify in Google Search Console
3. Submit sitemap (auto-generated)
4. Add to Google Business Profile

### Meta Information
The page title, description, Open Graph tags, and sitemap are in `index.html` and `sitemap.xml`.

### Social Media
Add your social handles:
- Facebook
- Instagram
- Twitter
- LinkedIn

## Advanced Features

### Reservation Data
Reservation records are browser-local and are not a shared business database. When hosted on Netlify, submissions can also be viewed in the Netlify Forms dashboard.

## Performance Tips

✅ **Images**: Optimize for web (compress, resize)
✅ **Mobile**: Responsive layout
✅ **SEO**: Page metadata and sitemap included

## Hosting Options

### Free Hosting
- **Netlify** - Connect GitHub repo
- **GitHub Pages** - Free static hosting
- **Vercel** - Free with auto-deployment

### Paid Hosting
- **Bluehost** - Affordable and reliable
- **GoDaddy** - Domain + hosting combo
- **HostGator** - Budget-friendly

### DIY Hosting
- Upload files via FTP
- Set index.html as default page
- Enable SSL certificate

## Browser Support

The site uses standard HTML, CSS, and JavaScript and should be tested in current desktop and mobile browsers before launch.

## File Checklist

Before uploading, ensure you have:
- [ ] index.html
- [ ] loyalty/loyalty.html
- [ ] styles.css
- [ ] script.js
- [ ] theme.js
- [ ] sw.js
- [ ] manifest.webmanifest
- [ ] offline.html
- [ ] 404.html
- [ ] success.html
- [ ] captions.vtt
- [ ] images/apple-touch-icon.png
- [ ] images/og-image.jpg
- [ ] images/ (all referenced image files)
- [ ] _headers
- [ ] robots.txt
- [ ] sitemap.xml
- [ ] README.md
- [ ] QUICKSTART.md (this file)

## Common Questions

**Q: How do I add more menu items?**
A: Copy an existing menu-item div and paste, then edit the text.

**Q: How do I change the restaurant name?**
A: Search for "TABOCHE" in index.html and replace text.

**Q: How do I add restaurant photos?**
A: Replace placeholder divs with `<img>` tags pointing to your images.

**Q: Where are reservation details stored?**
A: Check Netlify Forms submissions when deployed there. The browser also keeps a local copy for export; WhatsApp opens so customers can confirm directly.

**Q: Is this mobile-friendly?**
A: Yes! Fully responsive and mobile-optimized.

**Q: Can I add online ordering?**
A: Yes, with additional backend integration.

**Q: Do I need a database?**
A: Not required. Reservations use browser storage. For production, add a backend.

## Next Steps

1. **Customize Content** - Update restaurant info
2. **Add Photos** - Replace placeholders with your images
3. **Test Thoroughly** - Check all features work
4. **Get Domain** - Get a .com or local domain
5. **Upload to Web** - Host your website
6. **Share Everywhere** - Promote on social media
7. **Add to Google** - Get found in Google Search
8. **Gather Reviews** - Ask customers to review

## Support

For issues or questions:
1. Check README.md for detailed information
2. Test in different browsers
3. Clear browser cache and reload
4. Check browser console for errors (F12)
5. Verify all file names match exactly

## Before Launch

Test reservations and WhatsApp links on a phone, verify all image paths, then deploy to Netlify so `_headers`, Netlify Forms, and the service worker work as intended. Update `README.md` and the contact details in `index.html` together if business information changes.
