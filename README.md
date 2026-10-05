# Taboche — Restaurant & Coffee Shop

Premium specialty coffee and authentic cuisine in Bhaktapur, Nepal. Located peacefully by Siddhapokhari.

## About

Experience the finest specialty coffee in Bhaktapur at Taboche. We serve **100% Arabica beans** and are run by **three brothers** trained at **Costa Coffee UAE** and **The Coffee Bean & Tea Leaf Malaysia**.

## Contact

- 📍 Opposite Siddhapokhari, Bhaktapur 44800, Nepal
- ☎️ +977-9824926296
- 🌐 https://taboche.netlify.app/
- 🕐 Daily 07:00 AM – 08:00 PM

## Services

Dine-in, Takeaway, Delivery, Outdoor seating, Table service, Breakfast, Brunch, Lunch, Dinner, NFC mobile payments, Family friendly.

## Social

- [Facebook](https://www.facebook.com/tabochebhaktapur)
- [Instagram](https://www.instagram.com/taboche_bhaktapur/)
- [TikTok](https://www.tiktok.com/@taboche7)

## Menu Highlights

- **Hot Coffee**: Americano, Latte, Cappuccino, Vanilla Latte, Hazelnut Latte, Caramel Latte, Hot Chocolate
- **Signature Iced**: Hibiscus (Roselle), Iced Mocha
- **Tea**: Ilam Greens, Earl Grey, Jasmine, Chamomile, Butterfly Pea
- **Food**: Mo Mo, Burgers, Pizza, Wraps, Keema Noodles

All prices in Nepali Rupees (रू).

## Files

| File | Purpose |
|------|---------|
| `index.html` | Main page |
| `styles.css` | All styles |
| `script.js` | All JS (menu, forms, PWA) |
| `loyalty/loyalty.html` | Server-backed loyalty card and reward claim |
| `loyalty/loyalty.css` | Loyalty page styles |
| `loyalty/loyalty.js` | Stamp, reward-code claim, and countdown interactions |
| `netlify/functions/` | Loyalty stamp, reward issue/redeem, and staff functions |
| `supabase-loyalty-rewards.sql` | Reward ledger, atomic RPCs, and rate-limit schema |
| `theme.js` | Early theme bootstrap to prevent a dark-mode flash |
| `sw.js` | Service worker |
| `manifest.webmanifest` | PWA manifest |
| `offline.html` | Offline fallback page |
| `404.html` | Branded not-found page |
| `success.html` | Native reservation fallback page |
| `captions.vtt` | Gallery video captions |
| `robots.txt` | Crawler access rules |
| `sitemap.xml` | Search-engine sitemap |
| `_headers` | Netlify security headers |

## Loyalty Deployment

Before deploying the loyalty functions, run `supabase-loyalty-rewards.sql` in the existing Supabase SQL editor. It creates the reward ledger and imports existing `cards.free_drinks` balances. Configure `LOYALTY_TOKEN_SECRET`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE` in the Netlify environment; keep the service-role key server-side only. The POS and loyalty card should use the `tabochebhakatpur.netlify.app` deployment until the separate canonical-site deployment is configured to serve these same routes and Supabase project.

## Local Admin Utilities

Reservation copies are stored in the current browser; the form also opens WhatsApp and can submit through Netlify Forms when deployed there. These browser utilities are not access-controlled security features.

For local troubleshooting, add `?admin=1` to the page URL, then open DevTools (F12) and use:

```javascript
tabocheAdmin.viewReservations();   // Log all reservations
tabocheAdmin.exportReservations(); // Download JSON
tabocheAdmin.clearReservations();  // Delete all (requires confirmation)