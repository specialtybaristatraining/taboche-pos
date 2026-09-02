
// =========================================================================
// ===================== POS SYSTEM SCRIPT (In-memory with LocalStorage) ======================
// =========================================================================

// ========== STORAGE MONITORING SYSTEM ==========
function checkStorageAndWarn() {
    let total = 0;
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const value = localStorage.getItem(key);
        total += (key.length + value.length) * 2;
    }
    const usedMB = total / (1024 * 1024);
    const percentUsed = (usedMB / 10 * 100);
    
    // Update topbar indicator text and color
    let indicator = document.getElementById('storage-indicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'storage-indicator';
        indicator.className = 'topbar-storage-indicator';
        indicator.onclick = () => showQuickBackup();
        const header = document.querySelector('header');
        if (header) header.appendChild(indicator);
        else document.body.appendChild(indicator);
    }
    indicator.innerHTML = `ðŸ’¾ ${usedMB.toFixed(1)}MB / 10MB`;
    indicator.style.background = percentUsed > 80 ? '#dc2626' : 'rgba(255, 255, 255, 0.15)';
    indicator.style.color = percentUsed > 80 ? '#ffffff' : '#eef2ff';
    
    // Show warning if near full
    if (percentUsed > 85) {
        const warning = document.createElement('div');
        warning.id = 'storage-warning';
        warning.style.cssText = 'position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); background:#dc2626; color:white; padding:20px; border-radius:12px; z-index:10000; text-align:center; box-shadow:0 4px 20px black; min-width:280px;';
        warning.innerHTML = `
            <h3>âš ï¸ STORAGE ${Math.floor(percentUsed)}% FULL!</h3>
            <p>You have ${salesHistory.length} sales records.</p>
            <p style="font-size:14px;">Estimated ${Math.floor((10 - usedMB) / 0.0008)} more sales before data loss.</p>
            <button onclick="quickBackupNow()" style="background:white; color:black; padding:10px 20px; margin:10px; border:none; border-radius:8px; cursor:pointer;">ðŸ“¥ BACKUP NOW</button>
            <button onclick="document.getElementById('storage-warning').remove()" style="background:transparent; color:white; padding:10px 20px; border:1px solid white; border-radius:8px; cursor:pointer;">Dismiss</button>
        `;
        if (!document.getElementById('storage-warning')) document.body.appendChild(warning);
    }
}

function quickBackupNow() {
    const data = {
        salesHistory: salesHistory,
        orderHistory: orderHistory,
        voidDetails: voidDetails,
        backupDate: new Date().toISOString(),
        totalSales: salesHistory.length,
        totalRevenue: salesHistory.reduce((sum, s) => sum + (s.total || 0), 0)
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `pos_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(blob);
    alert('âœ… Backup saved to Downloads/Files! Save this to iCloud or email to yourself.');
    const warning = document.getElementById('storage-warning');
    if (warning) warning.remove();
}

function showQuickBackup() {
    let total = 0;
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const value = localStorage.getItem(key);
        total += (key.length + value.length) * 2;
    }
    const usedMB = total / (1024 * 1024);
    
    if (confirm(`ðŸ“Š Storage: ${usedMB.toFixed(1)}MB / 10MB used\n\nClick OK to backup your data now.`)) {
        quickBackupNow();
    }
}

// Make functions globally available for onclick handlers
window.quickBackupNow = quickBackupNow;
window.showQuickBackup = showQuickBackup;

// Run the storage monitor immediately and refresh hourly
checkStorageAndWarn();
setInterval(checkStorageAndWarn, 60 * 60 * 1000);

// Utility functions
function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    return String(text).replace(/[&<>"']/g, (char) => {
        switch (char) {
            case '&': return '&amp;';
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '"': return '&quot;';
            case "'": return '&#39;';
            default: return char;
        }
    });
}

// Global state variables, loaded from localStorage or initialized empty
let currentTable = null;
let orders = {}; // { tableNumber: [item1, item2, ...] }
let tableTimers = {}; // { tableNumber: { start: timestamp, elapsed: ms, lastUpdated: ms } }
let salesHistory = []; // [sale1, sale2, ...]
let orderHistory = []; // Same as salesHistory in this simplified version
let voidDetails = []; // [void1, void2, ...]
let kotHistory = []; // [kot1, kot2, ...]
let itemsSold = []; // Aggregated items from sales history
let removedItems = []; // Not used in this simplified version, kept for compatibility if needed.

let paymentAmount = 0;
let discount = 0;
let discountCodeApplied = null;
let paymentMethods = [];
let currentItemIndex = null;
let currentPage = 1;
const itemsPerPage = 10;
const MAX_HISTORY_ITEMS = 1000;
let saveTimeout;
let isProcessingPayment = false;
let timerUpdateQueued = false;

// NEW: Menu Navigation State
let currentMenuLevel = 'topLevelSections'; // 'topLevelSections', 'itemsOfSection', 'itemsOfCategory'
let activeSection = null; // Stores the top-level section selected (e.g., 'Food')
let activeCategoryDisplayGroup = null; // Stores the category selected (e.g., 'Burger with fries')

// Dummy current user for local-only mode
let currentUser = { email: 'localuser@example.com', role: 'Staff' }; 

// Hardcoded menu and extras
const menuItems = [
    // ================== FOOD GROUPS ==================
{ name: "Burger with Fries (Chicken)", price: 370, category: "Burger with Fries", section: "Kitchen", type: "food", image: "images/burger_chicken_with_fries.jpg" },
    { name: "Burger with Fries (Buff)", price: 350, category: "Burger with Fries", section: "Kitchen", type: "food", image: "images/burger_chicken_with_fries.jpg" },
    { name: "Burger with Fries (Veg)", price: 295, category: "Burger with Fries", section: "Kitchen", type: "food", image: "images/burger_chicken_with_fries.jpg" },
    { name: "Wrap with Fries (Chicken)", price: 350, category: "Wrap with Fries", section: "Kitchen", type: "food", image: "images/wrap_chicken_with_fries.jpg" },
    { name: "Wrap with Fries (Buff)", price: 330, category: "Wrap with Fries", section: "Kitchen", type: "food", image: "images/wrap_chicken_with_fries.jpg" },
    { name: "Wrap with Fries (Veg)", price: 280, category: "Wrap with Fries", section: "Kitchen", type: "food", image: "images/wrap_chicken_with_fries.jpg" },
    
   { name: "Keema Noodles (Chicken)", price: 300, category: "Keema Noodles", section: "Kitchen", type: "food", image: "images/keema_noodles_chicken.jpg" },
{ name: "Keema Noodles (Buff)", price: 280, category: "Keema Noodles", section: "Kitchen", type: "food", image: "images/keema_noodles_chicken.jpg" },
{ name: "Keema Noodles (Egg)", price: 250, category: "Keema Noodles", section: "Kitchen", type: "food", image: "images/keema_noodles_chicken.jpg" },

{ name: "Chow Mein (Chicken)", price: 280, category: "Chow Mein", section: "Kitchen", type: "food", image: "images/chow_mein_chicken.jpg" },
{ name: "Chow Mein (Veg)", price: 200, category: "Chow Mein", section: "Kitchen", type: "food", image: "images/chow_mein_veg.jpg" },
{ name: "Chow Mein (Buff)", price: 260, category: "Chow Mein", section: "Kitchen", type: "food", image: "images/chow_mein_buff.jpg" },

    { name: "Steam Mo:Mo (Chicken)", price: 285, category: "Steam Mo:Mo", section: "Kitchen", type: "food", image: "images/momo_chicken.jpg" },
    { name: "Steam Mo:Mo (Buff)", price: 260, category: "Steam Mo:Mo", section: "Kitchen", type: "food", image: "images/momo_chicken.jpg" },
    { name: "Steam Mo:Mo (Veg)", price: 220, category: "Steam Mo:Mo", section: "Kitchen", type: "food", image: "images/momo_chicken.jpg" },
    
    { name: "Jhol Mo:Mo (Chicken)", price: 320, category: "Jhol Mo:Mo", section: "Kitchen", type: "food", image: "images/jhol_momo_chicken.jpg" },
    { name: "Jhol Mo:Mo (Buff)", price: 285, category: "Jhol Mo:Mo", section: "Kitchen", type: "food", image: "images/jhol_momo_chicken.jpg" },
    { name: "Jhol Mo:Mo (Veg)", price: 250, category: "Jhol Mo:Mo", section: "Kitchen", type: "food", image: "images/jhol_momo_chicken.jpg" },
    
 { name: "Chilly (Chicken)", price: 360, category: "Chilly", section: "Kitchen", type: "food", image: "images/chilly_chicken.jpg" },
{ name: "Chilly (Buff)", price: 320, category: "Chilly", section: "Kitchen", type: "food", image: "images/chilly_chicken.jpg" },
{ name: "Chilly Momo (Chicken)", price: 300, category: "Chilly", section: "Kitchen", type: "food", image: "images/chilly_chicken.jpg" },
{ name: "Chilly Momo (Veg)", price: 250, category: "Chilly", section: "Kitchen", type: "food", image: "images/chilly_chicken.jpg" },
{ name: "Chilly Momo (Buff)", price: 280, category: "Chilly", section: "Kitchen", type: "food", image: "images/chilly_chicken.jpg" },
    
    { name: "Pizza (Cheese)", price: 500, category: "Pizza", section: "Kitchen", type: "food", image: "images/pizza_cheese.jpg" },
    { name: "Pizza (Chicken)", price: 580, category: "Pizza", section: "Kitchen", type: "food", image: "images/pizza_cheese.jpg" },
    { name: "Pizza (Mixed)", price: 650, category: "Pizza", section: "Kitchen", type: "food", image: "images/pizza_cheese.jpg" },
    
    { name: "French Fry", price: 350, category: "French Fry", section: "Kitchen", type: "food", image: "images/french_fry.jpg" },
    { name: "Wings", price: 480, category: "Wings", section: "Kitchen", type: "food", image: "images/wings.jpg" },

    { name: "Fried Rice (Chicken)", price: 360, category: "Fried Rice", section: "Kitchen", type: "food", image: "images/fried_rice_chicken.jpg" },
    { name: "Fried Rice (Buff)", price: 320, category: "Fried Rice", section: "Kitchen", type: "food", image: "images/fried_rice_chicken.jpg" },
    { name: "Fried Rice (Egg)", price: 285, category: "Fried Rice", section: "Kitchen", type: "food", image: "images/fried_rice_chicken.jpg" },
    
    { name: "Sausage (Chicken)", price: 340, category: "Sausage", section: "Kitchen", type: "food", image: "images/sausage_chicken.jpg" },
    { name: "Sausage (Buff)", price: 300, category: "Sausage", section: "Kitchen", type: "food", image: "images/sausage_buff.jpg" },

    // ================== BREAKFAST ITEMS ==================
    { name: "Toast", price: 150, category: "Breakfast", section: "Kitchen", type: "food", image: "images/chi_toasty_salsa.jpg" },
    { name: "Omelette", price: 120, category: "Breakfast", section: "Kitchen", type: "food", image: "images/omelet_plain.jpg" },
    { name: "Sausage (2pcs)", price: 120, category: "Breakfast", section: "Kitchen", type: "food", image: "images/buff_sausage.jpg" },
    { name: "Veg Sandwich", price: 300, category: "Breakfast", section: "Kitchen", type: "food", image: "images/sandwich_veg.jpg" },
    { name: "Chi Sandwich", price: 350, category: "Breakfast", section: "Kitchen", type: "food", image: "images/chi_toasty_salsa.jpg" },

    { name: "Laping (Noodles)", price: 95, category: "Laping", section: "Kitchen", type: "food", image: "images/laping_noodles.jpg" },
    { name: "Laping (Chips)", price: 120, category: "Laping", section: "Kitchen", type: "food", image: "images/laping_chips.jpg" },
    { name: "Laping (Mix)", price: 140, category: "Laping", section: "Kitchen", type: "food", image: "images/laping_mix.jpg" },

    { name: "Banana Muffin", price: 150, category: "Breakfast", section: "Kitchen", type: "food", image: "images/banana_muffin.jpg" },
    { name: "Brownie Walnut", price: 200, category: "Breakfast", section: "Kitchen", type: "food", image: "images/brownie_walnut.jpg" },
    { name: "Chicken Patty", price: 150, category: "Breakfast", section: "Kitchen", type: "food", image: "images/chicken_pie.jpg" },
    { name: "Chicken Pie", price: 100, category: "Bakery", section: "Retail", type: "food", image: "images/chicken_pie.jpg" },
    { name: "Chocolate Muffin", price: 150, category: "Breakfast", section: "Kitchen", type: "food", image: "images/chocolate_muffin.jpg" },

    // ================== DRINK GROUPS (now section "Bar", type "drink") ==================
    { name: "Americano", price: 150, category: "Hot Coffee", section: "Bar", type: "drink", image: "images/americano.jpg" },
    { name: "Eapresso", price: 140, category: "Hot Coffee", section: "Bar", type: "drink", image: "images/espresso.jpg" },
    { name: "Latte", price: 190, category: "Hot Coffee", section: "Bar", type: "drink", image: "images/latte.jpg" },
    { name: "Cappuccino", price: 200, category: "Hot Coffee", section: "Bar", type: "drink", image: "images/cappuccino.jpg" },
    { name: "Vanilla Latte", price: 260, category: "Hot Coffee", section: "Bar", type: "drink", image: "images/latte_vanilla.jpg" },
    { name: "Hazelnut Latte", price: 260, category: "Hot Coffee", section: "Bar", type: "drink", image: "images/flavored_latte_hazelnut.jpg" },
    { name: "Caramel Latte", price: 260, category: "Hot Coffee", section: "Bar", type: "drink", image: "images/latte_caramel.jpg" },
    { name: "Hot Chocolate", price: 260, category: "Hot Coffee", section: "Bar", type: "drink", image: "images/hot_chocolate.jpg" },

    // Moved Cold Coffee OUT of "Cold Drinks" section to be a top-level category
    { name: "Iced Latte", price: 220, category: "Cold Coffee", section: "Bar", type: "drink", image: "images/iced_latte.jpg" },
    { name: "Iced Americano", price: 200, category: "Cold Coffee", section: "Bar", type: "drink", image: "images/iced_americano.jpg" },
    { name: "Iced Cappuccino", price: 240, category: "Cold Coffee", section: "Bar", type: "drink", image: "images/iced_cappuccino.jpg" },
    { name: "Iced Vanilla", price: 290, category: "Cold Coffee", section: "Bar", type: "drink", image: "images/iced_vanilla_latte.jpg" },
    { name: "Iced Caramel", price: 290, category: "Cold Coffee", section: "Bar", type: "drink", image: "images/iced_caramel_latte.jpg" },
    { name: "Iced Mocha", price: 290, category: "Cold Coffee", section: "Bar", type: "drink", image: "images/iced_mocha.jpg" },
    { name: "Iced Hazelnut", price: 290, category: "Cold Coffee", section: "Bar", type: "drink", image: "images/iced_hazelnut_latte.jpg" },

    { name: "Mocha", price: 320, category: "Frappe / Blended", section: "Bar", type: "drink", image: "blended.jpg" },
    { name: "Vanilla", price: 320, category: "Frappe / Blended", section: "Bar", type: "drink", image: "blended.jpg" },
    { name: "Caramel", price: 320, category: "Frappe / Blended", section: "Bar", type: "drink", image: "blended.jpg" },
    { name: "Hazelnut", price: 320, category: "Frappe / Blended", section: "Bar", type: "drink", image: "blended.jpg" },
    { name: "Oreo", price: 320, category: "Frappe / Blended", section: "Bar", type: "drink", image: "blended.jpg" },

    { name: "Virgin Mojito", price: 250, category: "Mojito", section: "Bar", type: "drink", image: "images/virgin_mojito.jpg" },
    { name: "Peach Mojito", price: 280, category: "Mojito", section: "Bar", type: "drink", image: "images/peach_mojito.jpg" },
    { name: "Blueberry Mojito", price: 295, category: "Mojito", section: "Bar", type: "drink", image: "images/blueberry_mojito.jpg" },
    { name: "Mango Mojito", price: 295, category: "Mojito", section: "Bar", type: "drink", image: "images/mango_mojito.jpg" },
    { name: "Strawberry Mojito", price: 295, category: "Mojito", section: "Bar", type: "drink", image: "images/strawberry_mojito.jpg" },

    { name: "Sparkling Iced Tea (Apple)", price: 320, category: "Iced Tea", section: "Bar", type: "drink", image: "images/iced_tea_lemon.jpg" },
    { name: "Sparkling Iced Tea (Peach)", price: 300, category: "Iced Tea", section: "Bar", type: "drink", image: "images/sparkling_peach.jpg" },
    { name: "Sparkling Iced Tea (Lemon)", price: 300, category: "Iced Tea", section: "Bar", type: "drink", image: "images/sparkling_lemon.jpg" },

    { name: "Lemonade", price: 250, category: "Lemonade", section: "Bar", type: "drink", image: "images/lemonade.jpg" },
    { name: "Mint Lemonade", price: 280, category: "Lemonade", section: "Bar", type: "drink", image: "images/mint_lemonade.jpg" },
    { name: "Peach Lemonade", price: 300, category: "Lemonade", section: "Bar", type: "drink", image: "images/peach_lemonade.jpg" },
    { name: "Strawberry Lemonade", price: 300, category: "Lemonade", section: "Bar", type: "drink", image: "images/strawberry_lemonade.jpg" },

    { name: "Lemon Tea", price: 220, category: "Iced Tea", section: "Bar", type: "drink", image: "images/iced_tea_lemon.jpg" },
    { name: "Peach Tea", price: 270, category: "Iced Tea", section: "Bar", type: "drink", image: "images/iced_tea_peach.jpg" },
    { name: "Hibiscus", price: 270, category: "Iced Tea", section: "Bar", type: "drink", image: "images/iced_tea_hibiscus.jpg" },
    { name: "Black Berries", price: 270, category: "Iced Tea", section: "Bar", type: "drink", image: "images/blackberry_iced_tea.jpg" },
    
    { name: "Bubble Tea", price: 280, category: "Bubble Tea", section: "Bar", type: "drink", image: "images/bubble-tea.jpg" },
    
    { name: "Lassi (Sweet)", price: 195, category: "Lassi", section: "Bar", type: "drink", image: "images/lassi_sweet.jpg" },
    { name: "Lassi (Mango)", price: 250, category: "Lassi", section: "Bar", type: "drink", image: "images/lassi_mango.jpg" },
    { name: "Lassi (Strawberry)", price: 250, category: "Lassi", section: "Bar", type: "drink", image: "images/lassi_strawberry.jpg" },

    // ================== NEW TEA ITEMS ==================
    { name: "Black Rosella", price: 150, category: "Tea", section: "Bar", type: "drink", image: "images/black_rosella.jpg", recipe: [{ materialId: 'tea-bag-rosella', quantity: 1 }, { materialId: 'hot-water', quantity: 0.22 }] },
    { name: "Butterfly", price: 180, category: "Tea", section: "Bar", type: "drink", image: "images/butterfly.jpg", recipe: [{ materialId: 'tea-bag-butterfly-pea', quantity: 1 }, { materialId: 'hot-water', quantity: 0.22 }] },
    { name: "Calming Tea", price: 200, category: "Tea", section: "Bar", type: "drink", image: "images/calming_tea.jpg", recipe: [{ materialId: 'tea-bag-calming', quantity: 1 }, { materialId: 'hot-water', quantity: 0.22 }] },
    { name: "Chamomile", price: 150, category: "Tea", section: "Bar", type: "drink", image: "images/chamomile.jpg", recipe: [{ materialId: 'tea-bag-chamomile', quantity: 1 }, { materialId: 'hot-water', quantity: 0.22 }] },
    { name: "Earl Grey", price: 150, category: "Tea", section: "Bar", type: "drink", image: "images/earl_grey.jpg", recipe: [{ materialId: 'tea-bag-earl-grey', quantity: 1 }, { materialId: 'hot-water', quantity: 0.22 }] },
    { name: "Floral Delight", price: 200, category: "Tea", section: "Bar", type: "drink", image: "images/floral_delight.jpg", recipe: [{ materialId: 'tea-bag-floral-delight', quantity: 1 }, { materialId: 'hot-water', quantity: 0.22 }] },
    { name: "Ginger Honey Hot Lemon", price: 130, category: "Tea", section: "Bar", type: "drink", image: "images/ginger_honey_hot_lemon.jpg", recipe: [{ materialId: 'hot-water', quantity: 0.22 }, { materialId: 'ginger-slice', quantity: 2 }, { materialId: 'honey', quantity: 0.02 }, { materialId: 'lemon-slice', quantity: 1 }] },
    { name: "Green Tea", price: 150, category: "Tea", section: "Bar", type: "drink", image: "images/green_tea.jpg", recipe: [{ materialId: 'tea-bag-green', quantity: 1 }, { materialId: 'hot-water', quantity: 0.22 }] },
    { name: "Hibiscus", price: 180, category: "Tea", section: "Bar", type: "drink", image: "images/hibiscus.jpg", recipe: [{ materialId: 'tea-bag-hibiscus', quantity: 1 }, { materialId: 'hot-water', quantity: 0.22 }] },
    { name: "Himalayan Green Tea", price: 150, category: "Tea", section: "Bar", type: "drink", image: "images/himalayan_green_tea.jpg", recipe: [{ materialId: 'tea-bag-himalayan-green', quantity: 1 }, { materialId: 'hot-water', quantity: 0.22 }] },
    { name: "Himalayan Herbal", price: 150, category: "Tea", section: "Bar", type: "drink", image: "images/himalayan_herbal.jpg", recipe: [{ materialId: 'tea-bag-himalayan-herbal', quantity: 1 }, { materialId: 'hot-water', quantity: 0.22 }] },
    { name: "Himalayan Pearl Black Tea", price: 120, category: "Tea", section: "Bar", type: "drink", image: "images/himalayan_pearl_black_tea.jpg", recipe: [{ materialId: 'tea-bag-himalayan-black', quantity: 1 }, { materialId: 'hot-water', quantity: 0.22 }] },
    { name: "Honey Hot Lemon", price: 125, category: "Tea", section: "Bar", type: "drink", image: "images/honey_hot_lemon.jpg", recipe: [{ materialId: 'hot-water', quantity: 0.22 }, { materialId: 'honey', quantity: 0.02 }, { materialId: 'lemon-slice', quantity: 1 }] },
    { name: "Hot Lemon", price: 75, category: "Tea", section: "Bar", type: "drink", image: "images/hot_lemon.jpg", recipe: [{ materialId: 'hot-water', quantity: 0.22 }, { materialId: 'lemon-slice', quantity: 2 }] },
    { name: "Illam with Lemon Grass", price: 150, category: "Tea", section: "Bar", type: "drink", image: "images/illam_with_lemon_grass.jpg", recipe: [{ materialId: 'tea-loose-illam', quantity: 0.01 }, { materialId: 'lemongrass-stalk', quantity: 1 }, { materialId: 'hot-water', quantity: 0.22 }] },
    { name: "Jasmine", price: 150, category: "Tea", section: "Bar", type: "drink", image: "images/jasmine.jpg", recipe: [{ materialId: 'tea-bag-jasmine', quantity: 1 }, { materialId: 'hot-water', quantity: 0.22 }] },
    { name: "Lavender Rose", price: 220, category: "Tea", section: "Bar", type: "drink", image: "images/flower_tea.jpg", recipe: [{ materialId: 'tea-bag-lavender-rose', quantity: 1 }, { materialId: 'hot-water', quantity: 0.22 }] },
    { name: "Lemon Tea", price: 150, category: "Tea", section: "Bar", type: "drink", image: "images/lemon_tea.jpg", recipe: [{ materialId: 'tea-bag-black', quantity: 1 }, { materialId: 'hot-water', quantity: 0.22 }, { materialId: 'lemon-slice', quantity: 1 }] },
    { name: "Midnight Red Rose", price: 200, category: "Tea", section: "Bar", type: "drink", image: "images/midnight_red_rose.jpg", recipe: [{ materialId: 'tea-bag-red-rose', quantity: 1 }, { materialId: 'hot-water', quantity: 0.22 }] },
    { name: "Organic Black Tea", price: 100, category: "Tea", section: "Bar", type: "drink", image: "images/organic_black_tea.jpg", recipe: [{ materialId: 'tea-bag-organic-black', quantity: 1 }, { materialId: 'hot-water', quantity: 0.22 }] },
    { name: "Pearl Green Tea", price: 150, category: "Tea", section: "Bar", type: "drink", image: "images/pearl_green_tea.jpg", recipe: [{ materialId: 'tea-loose-pearl-green', quantity: 0.01 }, { materialId: 'hot-water', quantity: 0.22 }] },
    { name: "Peppermint", price: 150, category: "Tea", section: "Bar", type: "drink", image: "images/peppermint.jpg", recipe: [{ materialId: 'tea-bag-peppermint', quantity: 1 }, { materialId: 'hot-water', quantity: 0.22 }] },
    { name: "Spearmint", price: 150, category: "Tea", section: "Bar", type: "drink", image: "images/spearmint.jpg", recipe: [{ materialId: 'tea-bag-spearmint', quantity: 1 }, { materialId: 'hot-water', quantity: 0.22 }] },
    
    // ================== NEW SOFT DRINKS ==================
    { name: "Sprite", price: 95, category: "Soft Drinks", section: "Bar", type: "drink", image: "images/sprite.jpg" },
    { name: "Coke", price: 95, category: "Soft Drinks", section: "Bar", type: "drink", image: "images/coke.jpg" },
    { name: "Fanta", price: 95, category: "Soft Drinks", section: "Bar", type: "drink", image: "images/fanta.jpg" },
    // ================== RETAIL & MISC ==================
    { name: "Butterfly Pea Packet", price: 400, category: "Retail", section: "Bar", type: "food", image: "images/butterfly_peaPKT.jpg" },
    { name: "Calming Tea Packet", price: 400, category: "Retail", section: "Bar", type: "food", image: "images/calming_teaPKT.jpg" },
    { name: "Coffee Bag Packet", price: 950, category: "Retail", section: "Bar", type: "food", image: "images/coffee_bagPKT.jpg" },
    { name: "Strainer 1", price: 250, category: "Retail", section: "Bar", type: "tool", image: "images/strainer1.jpg" },
    { name: "Strainer 2", price: 300, category: "Retail", section: "Bar", type: "tool", image: "images/strainer2.jpg" },
    { name: "Strainer 3", price: 400, category: "Retail", section: "Bar", type: "tool", image: "images/strainer3.jpg" },
    { name: "Hibiscus PKT", price: 450, category: "Retail", section: "Bar", type: "food", image: "images/hibiscus_PKT.jpg" },
    { name: "Chamomile PKT", price: 350, category: "Retail", section: "Bar", type: "food", image: "images/chamomile_PKT.jpg" },
    { name: "Lavender PKT", price: 300, category: "Retail", section: "Bar", type: "food", image: "images/lavender_PKT.jpg" },
    { name: "Pepper Mint PKT", price: 250, category: "Retail", section: "Retail", type: "food", image: "images/peppermint_PKT.jpg" },
    { name: "Spearmint PKT", price: 250, category: "Retail", section: "Retail", type: "food", image: "images/spearmint_PKT.jpg" },
    { name: "Floral Delight PKT", price: 490, category: "Retail", section: "Retail", type: "food", image: "images/floral_delight_PKT.jpg" },
    { name: "Herbal Tea PKT", price: 400, category: "Retail", section: "Retail", type: "food", image: "images/herbal_tea.jpg" },
    { name: "Jasmine PKT", price: 380, category: "Retail", section: "Retail", type: "food", image: "images/jasmine.jpg" },

    { name: "Artice Brust", price: 30, category: "Misc", section: "MIS", type: "misc", image: "images/artice_brust.jpg", discountable: false },
    { name: "Hukka", price: 550, category: "Misc", section: "MIS", type: "misc", image: "images/hukka.jpg", discountable: false },
    { name: "Juju Dhau", price: 85, category: "Misc", section: "MIS", type: "misc", image: "images/juju_dhau.jpg", discountable: false },
    { name: "Shikhar Ice", price: 25, category: "Misc", section: "MIS", type: "misc", image: "images/shikar_ICE.jpg", discountable: false },
    { name: "Surya Light", price: 30, category: "Misc", section: "MIS", type: "misc", image: "images/surya_light.jpg", discountable: false },
    { name: "Surya Red", price: 30, category: "Misc", section: "MIS", type: "misc", image: "images/surya_red.jpg", discountable: false },
    { name: "Water", price: 50, category: "Misc", section: "MIS", type: "misc", image: "images/water.jpg", discountable: false }
];

const extras = [
    // Food Extras
    { name: "Cheese", price: 75, image: "images/cheese.jpg", type: "food" },
    { name: "Sausage", price: 40, image: "images/buff_sausage.jpg", type: "food" },
    { name: "Extra Chicken", price: 120, image: "images/extra_chicken.jpg", type: "food" },
    { name: "Extra Buff", price: 100, image: "images/extra_buff.jpg", type: "food" },
    { name: "Egg", price: 50, image: "images/egg.jpg", type: "food" },
    { name: "Salad", price: 75, image: "images/salad.jpg", type: "food" },
    { name: "Toast", price: 50, image: "images/chi_toasty_salsa.jpg", type: "food" },

    // Drink Extras
    { name: "Boba", price: 50, image: "images/boba.jpg", type: "drink" },
    { name: "Flavour Shot", price: 50, image: "images/flavour.jpg", type: "drink" },
    { name: "Extra Ice", price: 10, image: "images/ice.jpg", type: "drink" },
    { name: "Extra Sugar", price: 5, image: "images/sugar.jpg", type: "drink" },

    // Misc Extras (for hukka, etc.)
    { name: "Extra Coil", price: 50, image: "images/coil.jpg", type: "misc" },
    { name: "Extra Flavour", price: 250, image: "images/extraflavour.jpg", type: "misc" }
];
const discountCodes = {
    "SAVE10": 10,
    "SAVE20": 20,
    "FREEDRINK": 15
};

// MODIFIED: "Cold Coffee" is now a top-level category outside of "Cold Drinks" section.
const menuSections = {
    "Food": [
        "Bakery",
        "Burger with Fries",
        "Wrap with Fries",
        "Keema Noodles",
        "Steam Mo:Mo",
        "Jhol Mo:Mo",
        "Chilly",
        "Pizza",
        "French Fry",
        "Wings",
        "Fried Rice",
        "Sausage",
        "Laping"
    ],
    "Breakfast": [
        "Breakfast"
    ],
    // Cold Drinks grouping removed because these categories now show directly on the home screen
    // Retail and Misc are now separate top-level sections for premium sorting
    "Retail": [
        "Retail"
    ],
    "Misc": [
        "Misc"
    ]
};


// =========================================================================
// =================== LOCAL STORAGE MANAGEMENT ==========================
// =========================================================================
function saveToLocalStorage(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
        console.log(`Saved '${key}' to localStorage.`);
    } catch (error) {
        console.error(`Error saving '${key}' to localStorage:`, error);
        notifications.show(`Error saving data locally for '${key}'.`, 'error');
    }
}

const IDB_DB_NAME = 'taboche-pos-db';
const IDB_STORE_NAME = 'largeState';
const IDB_VERSION = 1;
const BACKUP_SCHEMA_VERSION = 1;
const HISTORY_RETENTION_DAYS = 90;

function handleCriticalError(context, error) {
    console.error(`${context} failed:`, error);
    notifications.show(`${context} failed. Check console for details.`, 'error');
}

function getFromLocalStorage(key) {
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    } catch (error) {
        handleCriticalError(`Reading '${key}' from localStorage`, error);
        return null;
    }
}

function openIndexedDB() {
    return new Promise((resolve, reject) => {
        if (!window.indexedDB) {
            reject(new Error('IndexedDB is not supported in this browser.'));
            return;
        }

        const request = indexedDB.open(IDB_DB_NAME, IDB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
                db.createObjectStore(IDB_STORE_NAME, { keyPath: 'key' });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function saveLargeStateToIndexedDB() {
    try {
        const db = await openIndexedDB();
        const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
        const store = tx.objectStore(IDB_STORE_NAME);
        const records = [
            { key: 'salesHistory', value: salesHistory },
            { key: 'orderHistory', value: orderHistory },
            { key: 'voidDetails', value: voidDetails },
            { key: 'kotHistory', value: kotHistory },
            { key: 'itemsSold', value: itemsSold }
        ];
        records.forEach(record => store.put(record));
        await new Promise((resolve, reject) => {
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error);
        });
        db.close();
    } catch (error) {
        console.warn('IndexedDB save failed, falling back to localStorage.', error);
    }
}

async function loadLargeStateFromIndexedDB() {
    try {
        const db = await openIndexedDB();
        const tx = db.transaction(IDB_STORE_NAME, 'readonly');
        const store = tx.objectStore(IDB_STORE_NAME);
        const keys = ['salesHistory', 'orderHistory', 'voidDetails', 'kotHistory', 'itemsSold'];
        await Promise.all(keys.map(async (key) => {
            const request = store.get(key);
            await new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    if (request.result && request.result.value !== undefined) {
                        switch (key) {
                            case 'salesHistory': salesHistory = request.result.value; break;
                            case 'orderHistory': orderHistory = request.result.value; break;
                            case 'voidDetails': voidDetails = request.result.value; break;
                            case 'kotHistory': kotHistory = request.result.value; break;
                            case 'itemsSold': itemsSold = request.result.value; break;
                        }
                    }
                    resolve();
                };
                request.onerror = () => reject(request.error);
            });
        }));
        db.close();
    } catch (error) {
        console.warn('IndexedDB load failed, staying on localStorage.', error);
    }
}

function validateBackupData(data) {
    if (!data || typeof data !== 'object') return false;
    if (data.schemaVersion !== BACKUP_SCHEMA_VERSION) {
        console.warn('Backup schema version mismatch:', data.schemaVersion);
        return false;
    }
    const requiredFields = ['orders', 'salesHistory', 'orderHistory', 'voidDetails', 'kotHistory', 'itemsSold'];
    const hasRequiredFields = requiredFields.every(field => data.hasOwnProperty(field));
    if (!hasRequiredFields) return false;
    if (typeof data.orders !== 'object') return false;
    if (!Array.isArray(data.salesHistory)) return false;
    if (!Array.isArray(data.orderHistory)) return false;
    if (!Array.isArray(data.voidDetails)) return false;
    if (!Array.isArray(data.kotHistory)) return false;
    if (!Array.isArray(data.itemsSold)) return false;
    return true;
}

function loadFromLocalStorage() {
    try {
        orders = getFromLocalStorage('orders') || {};
        tableTimers = getFromLocalStorage('tableTimers') || {};
        salesHistory = getFromLocalStorage('salesHistory') || [];
        orderHistory = getFromLocalStorage('orderHistory') || [];
        voidDetails = getFromLocalStorage('voidDetails') || [];
        kotHistory = getFromLocalStorage('kotHistory') || [];
        itemsSold = getFromLocalStorage('itemsSold') || [];

        if (!Array.isArray(salesHistory)) salesHistory = [];
        if (!Array.isArray(orderHistory)) orderHistory = [];
        if (!Array.isArray(voidDetails)) voidDetails = [];
        if (!Array.isArray(kotHistory)) kotHistory = [];
        if (!Array.isArray(itemsSold)) itemsSold = [];
    } catch (error) {
        handleCriticalError('Loading state from localStorage', error);
        orders = {};
        tableTimers = {};
        salesHistory = [];
        orderHistory = [];
        voidDetails = [];
        kotHistory = [];
        itemsSold = [];
    }
}

// Automatically save all main state variables
function persistAllData() {
    try {
        trimHistoryIfNeeded();
        saveToLocalStorage('orders', orders);
        saveToLocalStorage('tableTimers', tableTimers);
        saveToLocalStorage('salesHistory', salesHistory);
        saveToLocalStorage('orderHistory', orderHistory);
        saveToLocalStorage('voidDetails', voidDetails);
        saveToLocalStorage('kotHistory', kotHistory);
        saveToLocalStorage('itemsSold', itemsSold);
        saveLargeStateToIndexedDB();

        const channel = new BroadcastChannel('pos-sync');
        channel.postMessage('data-changed');
    } catch (error) {
        handleCriticalError('Persisting all data', error);
    }
}

function debouncedPersistAllData() {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => persistAllData(), 300);
}

function trimHistoryIfNeeded() {
    const retentionDate = Date.now() - HISTORY_RETENTION_DAYS * 24 * 60 * 60 * 1000;

    orderHistory = orderHistory.filter(order => {
        const created = order?.timestamp ? new Date(order.timestamp).getTime() : Date.now();
        return created >= retentionDate;
    });
    salesHistory = salesHistory.filter(sale => {
        const created = sale?.timestamp ? new Date(sale.timestamp).getTime() : Date.now();
        return created >= retentionDate;
    });
    voidDetails = voidDetails.filter(voidEntry => {
        const created = voidEntry?.timestamp ? new Date(voidEntry.timestamp).getTime() : Date.now();
        return created >= retentionDate;
    });
    kotHistory = kotHistory.filter(kot => {
        const created = kot?.timestamp ? new Date(kot.timestamp).getTime() : Date.now();
        return created >= retentionDate;
    });

    if (orderHistory.length > MAX_HISTORY_ITEMS) {
        orderHistory = orderHistory.slice(-MAX_HISTORY_ITEMS);
    }
    if (salesHistory.length > MAX_HISTORY_ITEMS) {
        salesHistory = salesHistory.slice(-MAX_HISTORY_ITEMS);
    }
}

function validateNumericInput(value, min = 0, max = Infinity) {
    const num = parseFloat(value);
    if (Number.isNaN(num)) return min;
    return Math.min(max, Math.max(min, num));
}

function handleImageError(img) {
    img.onerror = null;
    img.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="%23999"%3E%3Crect x="1" y="1" width="22" height="22" rx="3" ry="3" stroke-width="2"/%3E%3Cpath d="M4 4l16 16" stroke-width="2"/%3E%3C/svg%3E';
}

async function backupData() {
    try {
        const data = {
            schemaVersion: BACKUP_SCHEMA_VERSION,
            orders, salesHistory, orderHistory, voidDetails, kotHistory, itemsSold,
            exportDate: new Date().toISOString()
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pos-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        notifications.show('Data backup downloaded successfully', 'success');
    } catch (error) {
        handleCriticalError('Backing up data', error);
    }
}

function restoreData(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);

            if (!validateBackupData(data)) {
                notifications.show('Invalid backup file: incompatible schema or missing fields', 'error');
                return;
            }

            orders = data.orders || {};
            salesHistory = data.salesHistory || [];
            orderHistory = data.orderHistory || [];
            voidDetails = data.voidDetails || [];
            kotHistory = data.kotHistory || [];
            itemsSold = data.itemsSold || [];
            
            trimHistoryIfNeeded();
            persistAllData();
            renderOrderItems();
            renderTables();
            notifications.show('Data restored successfully', 'success');
        } catch (error) {
            handleCriticalError('Restoring backup data', error);
        }
    };
    reader.readAsText(file);
}

function initAudio() {
    const ctx = getClickAudioContext();
    if (ctx.state === 'suspended') {
        document.body.addEventListener('touchstart', () => ctx.resume(), { once: true });
        document.body.addEventListener('click', () => ctx.resume(), { once: true });
    }
}

function updateNetworkStatusIndicator() {
    const indicator = document.getElementById('network-status');
    if (!indicator) return;
    const online = navigator.onLine;
    indicator.textContent = online ? 'Online' : 'Offline';
    indicator.classList.toggle('online', online);
    indicator.classList.toggle('offline', !online);
}

// =========================================================================
// =================== UTILITY FUNCTIONS ===================================
// =========================================================================

function showLoadingSpinner() {
    const spinner = document.getElementById('loading-spinner');
    if (spinner) spinner.style.display = 'block';
}

function hideLoadingSpinner() {
    const spinner = document.getElementById('loading-spinner');
    if (spinner) spinner.style.display = 'none';
}

/**
 * A modern, promise-based replacement for the native `prompt()`.
 * This is non-blocking and works reliably on all devices, especially mobile.
 * @param {string} title - The title for the modal dialog.
 * @param {string} message - The message or question to display.
 * @param {object} options - Configuration for the prompt.
 * @param {string} options.inputType - 'text' or 'textarea'.
 * @param {string} options.initialValue - An initial value for the input field.
 * @param {string} options.placeholder - Placeholder text for the input.
 * @returns {Promise<string|null>} A promise that resolves with the user's input, or null if cancelled.
 */
function showPromptModal(title, message, options = {}) {
    return new Promise(resolve => {
        const modal = document.getElementById('generic-prompt-modal');
        const titleEl = document.getElementById('generic-prompt-title');
        const messageEl = document.getElementById('generic-prompt-message');
        const inputContainer = document.getElementById('generic-prompt-input-container');
        const confirmBtn = document.getElementById('generic-prompt-confirm-btn');
        const cancelBtn = document.getElementById('generic-prompt-cancel-btn');

        titleEl.textContent = title;
        messageEl.textContent = message;

        inputContainer.innerHTML = ''; // Clear previous input
        const inputType = options.inputType || 'text';
        const inputEl = inputType === 'textarea'
            ? document.createElement('textarea')
            : document.createElement('input');
        
        inputEl.className = 'generic-modal-input';
        if (inputType !== 'textarea') inputEl.type = 'text';
        inputEl.id = 'generic-prompt-input-field';
        inputEl.value = options.initialValue || '';
        inputEl.placeholder = options.placeholder || '';
        if (inputType === 'textarea') inputEl.rows = 4;
        
        inputContainer.appendChild(inputEl);
        inputContainer.style.display = 'block'; // Ensure input is visible
        
        modal.style.display = 'flex';
        inputEl.focus();

        const cleanupAndResolve = (value) => {
            modal.style.display = 'none';
            // Use .replaceWith to remove event listeners cleanly
            confirmBtn.replaceWith(confirmBtn.cloneNode(true));
            cancelBtn.replaceWith(cancelBtn.cloneNode(true));
            resolve(value);
        };

        const newConfirmBtn = confirmBtn.cloneNode(true);
        const newCancelBtn = cancelBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
        cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
        
        newConfirmBtn.onclick = () => cleanupAndResolve(inputEl.value);
        newCancelBtn.onclick = () => cleanupAndResolve(null);
    });
}

/**
 * A modern, promise-based replacement for the native `confirm()`.
 * This is non-blocking and provides a better user experience.
 * @param {string} title - The title for the confirmation dialog.
 * @param {string} message - The question to ask the user.
 * @returns {Promise<boolean>} A promise that resolves with `true` if confirmed, or `false` if cancelled.
 */
function showConfirmModal(title, message) {
     return new Promise(resolve => {
        const modal = document.getElementById('generic-prompt-modal');
        const titleEl = document.getElementById('generic-prompt-title');
        const messageEl = document.getElementById('generic-prompt-message');
        const inputContainer = document.getElementById('generic-prompt-input-container');
        const confirmBtn = document.getElementById('generic-prompt-confirm-btn');
        const cancelBtn = document.getElementById('generic-prompt-cancel-btn');

        titleEl.textContent = title;
        messageEl.innerHTML = message;
        inputContainer.style.display = 'none'; // Hide the input field
        
        modal.style.display = 'flex';

        const cleanupAndResolve = (value) => {
            modal.style.display = 'none';
            inputContainer.style.display = 'block'; // Show input field again for next use
            confirmBtn.replaceWith(confirmBtn.cloneNode(true));
            cancelBtn.replaceWith(cancelBtn.cloneNode(true));
            resolve(value);
        };
        
        const newConfirmBtn = confirmBtn.cloneNode(true);
        const newCancelBtn = cancelBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
        cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
        
        newConfirmBtn.onclick = () => cleanupAndResolve(true);
        newCancelBtn.onclick = () => cleanupAndResolve(false);
    });
}

class NotificationSystem {
    constructor() {
        this.notificationQueue = [];
        this.isShowing = false;
    }

    show(message, type = 'info', duration = 3000) {
        if (!message) return;
        this.notificationQueue.push({ message, type, duration });
        if (!this.isShowing) {
            this.processQueue();
        }
    }

    processQueue() {
        if (this.notificationQueue.length === 0) {
            this.isShowing = false;
            return;
        }
        this.isShowing = true;
        const { message, type, duration } = this.notificationQueue.shift();
        this.displayNotification(message, type, duration);
    }

    displayNotification(message, type, duration) {
        const toast = document.getElementById('notification-toast');
        if (!toast) return;

        toast.className = 'notification-toast'; // Reset classes
        toast.classList.add(`notification-${type}`);
        toast.innerHTML = `
            <div class="notification-icon">${this.getIconForType(type)}</div>
            <div class="notification-message">${message}</div>
        `;
        toast.style.display = 'flex';
        
        requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateY(0)';
        });

        // Play audio feedback for notification type
        if (type === 'success') {
            playSoundPreset('success');
        } else if (type === 'error') {
            playSoundPreset('cancel');
        } else if (type === 'warning') {
            playSoundPreset('soft');
        } else {
            playSoundPreset('default');
        }

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(20px)';
            setTimeout(() => {
                toast.style.display = 'none';
                this.processQueue();
            }, 300);
        }, duration);
    }

    getIconForType(type) {
        const icons = {
            info: '<i class="fas fa-info-circle"></i>',
            success: '<i class="fas fa-check-circle"></i>',
            warning: '<i class="fas fa-exclamation-triangle"></i>',
            error: '<i class="fas fa-times-circle"></i>'
        };
        return icons[type] || icons.info;
    }
}
const notifications = new NotificationSystem();

// Date and Time
function updateDateTime() {
    const datetimeEl = document.getElementById('datetime');
    if (datetimeEl) datetimeEl.textContent = new Date().toLocaleString();
}

// Theme Management
function loadTheme() {
    const theme = localStorage.getItem('theme') || 'light';
    if (theme === 'dark') document.body.classList.add('dark-mode');
    document.getElementById('theme-toggle').className = theme === 'dark' ? 'fas fa-moon' : 'fas fa-sun';
}

function toggleTheme() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    document.getElementById('theme-toggle').className = isDark ? 'fas fa-moon' : 'fas fa-sun';
}

let audioContext;

// Customize sound presets here:
// frequency: 200-1000 Hz, waveform: 'sine'|'square'|'sawtooth'|'triangle', duration: seconds, volume: 0-1
const buttonSoundPresets = {
    default: { frequency: 420, waveform: 'square', duration: 0.1, volume: 0.11 },
    pling: { frequency: 860, waveform: 'triangle', duration: 0.12, volume: 0.14 },
    tick: { frequency: 520, waveform: 'square', duration: 0.05, volume: 0.12 },
    confirm: { frequency: 620, waveform: 'triangle', duration: 0.11, volume: 0.15 },
    success: { frequency: 760, waveform: 'triangle', duration: 0.18, volume: 0.18 },
    cancel: { frequency: 280, waveform: 'sawtooth', duration: 0.12, volume: 0.12 },
    soft: { frequency: 360, waveform: 'sine', duration: 0.09, volume: 0.08 },
    keypad: { frequency: 520, waveform: 'square', duration: 0.06, volume: 0.12 },
    select: { frequency: 680, waveform: 'triangle', duration: 0.1, volume: 0.13 },
    whoosh: { frequency: 420, waveform: 'sawtooth', duration: 0.2, volume: 0.16 }
};

function getClickAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioContext;
}

function getSoundConfig(target) {
    if (typeof target === 'string') {
        return buttonSoundPresets[target] || buttonSoundPresets.default;
    }
    if (!target) return buttonSoundPresets.default;
    if (target.dataset.sound && buttonSoundPresets[target.dataset.sound]) {
        return buttonSoundPresets[target.dataset.sound];
    }

    if (target.classList.contains('table-btn')) {
        return buttonSoundPresets.select;
    }
    if (target.id === 'finalize-btn' || target.classList.contains('finalize-btn')) {
        return buttonSoundPresets.whoosh;
    }
    if (target.id === 'checkout-btn') {
        return buttonSoundPresets.confirm;
    }
    if (target.id === 'complete-btn') {
        return buttonSoundPresets.success;
    }
    if (target.id === 'void-btn' || target.classList.contains('void-btn') || target.classList.contains('remove-btn')) {
        return buttonSoundPresets.cancel;
    }
    if (target.classList.contains('increment-btn') || target.classList.contains('decrement-btn')) {
        return buttonSoundPresets.tick;
    }
    if (target.closest && target.closest('#keypad')) {
        return buttonSoundPresets.keypad;
    }
    if (target.id === 'clear-input') {
        return buttonSoundPresets.keypad;
    }
    if (target.classList.contains('notes-btn') || target.classList.contains('extras-btn') || target.id === 'apply-discount-code' || target.id === 'change-table-btn' || target.id === 'print-receipt-btn' || target.id === 'save-notes-btn' || target.id === 'close-sidebar' || target.classList.contains('close-modal')) {
        return buttonSoundPresets.soft;
    }
    if (target.classList.contains('btn') || target.classList.contains('sidebar-content') || target.tagName === 'BUTTON') {
        return buttonSoundPresets.default;
    }
    return buttonSoundPresets.default;
}

function playSoundPreset(presetName) {
    playButtonClickSound(getSoundConfig(presetName));
}

function playButtonClickSound(button = null) {
    try {
        const ctx = getClickAudioContext();
        if (ctx.state === 'suspended') {
            ctx.resume();
        }

        const { frequency, waveform, duration, volume } = button && button.frequency ? button : getSoundConfig(button);
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.type = waveform;
        oscillator.frequency.value = frequency;

        gainNode.gain.setValueAtTime(0.0001, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(volume, ctx.currentTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + duration);
    } catch (err) {
        console.warn('Click sound unavailable:', err);
    }
}

function speakText(message) {
    if (!('speechSynthesis' in window)) {
        console.warn('Speech synthesis not supported');
        return;
    }

    setTimeout(() => {
        try {
            const voices = window.speechSynthesis.getVoices();
            console.log('=== All Available Voices ===');
            voices.forEach((v, i) => console.log(`${i}: ${v.name} (${v.lang})${v.default ? ' [DEFAULT]' : ''}`));
            
            window.speechSynthesis.cancel();
            
            const utterance = new SpeechSynthesisUtterance(message);
            utterance.lang = 'en-US';
            utterance.rate = 0.9;
            utterance.pitch = 1.4;
            utterance.volume = 1;

            let selectedVoice = null;
            
            if (voices.length > 0) {
                const femaleKeywords = ['samantha', 'victoria', 'moira', 'karen', 'zira', 'susan', 'amelia', 'woman', 'female', 'google uk', 'natural'];
                
                for (let voice of voices) {
                    const voiceLower = voice.name.toLowerCase();
                    if (femaleKeywords.some(kw => voiceLower.includes(kw))) {
                        selectedVoice = voice;
                        console.log('âœ“ Selected female voice:', voice.name);
                        break;
                    }
                }
                
                if (!selectedVoice && voices.length > 1) {
                    selectedVoice = voices[1];
                    console.log('âš  No female voice found, using voices[1]:', selectedVoice.name);
                } else if (!selectedVoice) {
                    selectedVoice = voices[0];
                    console.log('âš  Using default voice:', selectedVoice.name);
                }
                
                if (selectedVoice) {
                    utterance.voice = selectedVoice;
                }
            }

            window.speechSynthesis.speak(utterance);
            console.log('ðŸ”Š Speaking:', message);
        } catch (err) {
            console.error('Speech error:', err);
        }
    }, 300);
}

function generateOrderId() {
    const now = new Date();
    return `TAB-${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
}

function pad(num) {
    return num.toString().padStart(2, '0');
}

// =========================================================================
// =================== POS CORE LOGIC ======================================
// =========================================================================

const tableList = ['1', '2', '3', '4', '5', '6', '7', '8A', '8B', '9A', '9B', '10A', '10B', '10C', '11', '12'];

function initializeTables() {
    const tablesDashboard = document.getElementById('tables-dashboard');
    if (!tablesDashboard) return;

    tablesDashboard.innerHTML = '';

    tableList.forEach(table => {
        const tableBtn = document.createElement('button');
        tableBtn.className = 'table-btn';
        tableBtn.id = `table-btn-${table}`;

        // Determine table status from local data
        let status = (orders[table] && orders[table].length > 0) ? 'occupied' : 'available';
        tableBtn.classList.add(status);

        // Timer display logic
        const elapsedTime = tableTimers[table] ? formatTime(Math.floor(tableTimers[table].elapsed / 1000)) : '00:00';

        tableBtn.innerHTML = `
            <div>Table ${table}</div>
            ${status !== 'available' ? `<div class="timer" id="timer-${table}">${elapsedTime}</div>` : ''}
        `;

        tableBtn.addEventListener('click', () => selectTable(table));
        tablesDashboard.appendChild(tableBtn);
    });
}

function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return "00:00";
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function updateTableTimers() {
    try {
        if (timerUpdateQueued) return;
        timerUpdateQueued = true;

        requestAnimationFrame(() => {
            timerUpdateQueued = false;
            const now = Date.now();
            let changed = false;

        Object.entries(tableTimers).forEach(([table, timer]) => {
            if (orders[table] && orders[table].length > 0) {
                const lastUpdated = timer.lastUpdated || now;
                const elapsed = (timer.elapsed || 0) + (now - lastUpdated);
                tableTimers[table] = { ...timer, elapsed, lastUpdated: now };
                changed = true;
                const timerElement = document.getElementById(`timer-${table}`);
                if (timerElement) {
                    timerElement.textContent = formatTime(Math.floor(elapsed / 1000));
                }
            } else {
                delete tableTimers[table];
                changed = true;
                const tableBtn = document.getElementById(`table-btn-${table}`);
                if (tableBtn) {
                    tableBtn.classList.remove('occupied', 'blinking');
                    tableBtn.classList.add('available');
                    const timerElement = tableBtn.querySelector('.timer');
                    if (timerElement) timerElement.textContent = '00:00';
                }
            }
        });

        if (changed) {
            persistAllData();
        }
    });
    } catch (error) {
        handleCriticalError('Updating table timers', error);
    }
    });
}

async function selectTable(tableNumber) {
    // Auto-finalize pending items on the current table before switching to another table
    if (currentTable && currentTable !== tableNumber && orders[currentTable]?.length) {
        orders[currentTable].forEach(item => {
            if (!item.finalized) {
                item.finalized = true;
            }
        });
        persistAllData();
    }

    showLoadingSpinner();
    currentTable = tableNumber;
    document.getElementById('selected-table').textContent = tableNumber;
    document.getElementById('selected-table-checkout').textContent = tableNumber;

    // Immediately clear and show loading for order items
    const orderItemsDiv = document.getElementById('order-items');
    if (orderItemsDiv) {
        orderItemsDiv.innerHTML = '<div class="no-items">Loading order...</div>';
    }
    updateTotal();

    // Load order from local storage (already loaded on app start, this just ensures it's referenced)
    orders[tableNumber] = orders[tableNumber] || []; 
    
    renderOrderItems();
    updateTotal();
    stopBlinking(tableNumber);
    initializeTables(); // Update table status visual
    hideLoadingSpinner();
}

// Helper to get image for category or section
function getRepresentativeImage(name, isSection = false) {
    if (isSection) {
        // For top-level sections (Food, Cold Drinks, Retail & Misc), pick a representative category's image
        const categoriesInSection = menuSections[name];
        if (categoriesInSection && categoriesInSection.length > 0) {
            const firstCategory = categoriesInSection[0];
            const firstItemInCategory = menuItems.find(item => item.category === firstCategory && item.image);
            if (firstItemInCategory) return firstItemInCategory.image;
        }
    } else {
        // For individual categories (including all drink categories), pick the first item's image
        const firstItemInCategory = menuItems.find(item => item.category === name && item.image);
        if (firstItemInCategory) return firstItemInCategory.image;
    }
    return 'images/placeholder.jpg'; // Generic placeholder
}


// MODIFIED: Central function for rendering menu navigation
function renderMenuNavigation() {
    const categoriesContainer = document.getElementById('categories');
    const menuItemsContainer = document.getElementById('menu');
    const backButton = document.getElementById('back-button');
    const menuSectionTitle = document.getElementById('menu-section-title');
    const searchInput = document.getElementById('search');

    if (!categoriesContainer || !menuItemsContainer || !backButton || !menuSectionTitle || !searchInput) return;

    categoriesContainer.innerHTML = '';
    menuItemsContainer.innerHTML = '';
    backButton.style.display = 'none';
    document.querySelectorAll('.categories button').forEach(btn => btn.classList.remove('active'));

    if (searchInput.value.trim() !== '') {
        searchMenu();
        return;
    }

    if (currentMenuLevel === 'topLevelSections') {
        menuSectionTitle.textContent = 'Select Section or Category';

        const sectionNames = Object.keys(menuSections).sort();
        const topLevelDrinkCategoriesOrder = [
            "Cold Coffee",
            "Frappe / Blended",
            "Iced Tea",
            "Mojito",
            "Lassi",
            "Soft Drinks"
        ];

        const allDirectDrinkCategories = [...new Set(
            menuItems
                .filter(item => item.section === 'Bar' && item.type === 'drink')
                .map(item => item.category)
        )];

        const orderedDrinkCategories = [
            ...topLevelDrinkCategoriesOrder.filter(cat => allDirectDrinkCategories.includes(cat)),
            ...allDirectDrinkCategories.filter(cat => !topLevelDrinkCategoriesOrder.includes(cat))
        ];

        const categoryColorMap = {
            'bubble tea': 'color-sky',
            'cold coffee': 'color-amber',
            'food': 'color-lime',
            'frappe / blended': 'color-fuchsia',
            'hot coffee': 'color-orange',
            'iced tea': 'color-teal',
            'lassi': 'color-pink',
            'lemonade': 'color-emerald',
            'mojito': 'color-emerald',
            'retail': 'color-cyan',
            'misc': 'color-purple',
            'breakfast': 'color-lime',
            'soft drinks': 'color-sky'
        };

        const getCategoryColorClass = (name) => {
            const key = name.toLowerCase().trim();
            return categoryColorMap[key] || 'color-gray';
        };

        const allTopLevelDisplayItems = [...new Set([
            ...orderedDrinkCategories,
            ...sectionNames
        ])].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));

        allTopLevelDisplayItems.forEach(displayName => {
            const div = document.createElement('div');
            const isSection = Boolean(menuSections[displayName]);
            const colorClass = getCategoryColorClass(displayName);
            const premiumClass = isSection && (displayName === 'Retail' || displayName === 'Misc') ? ` premium ${displayName.toLowerCase()}-section` : '';
            div.className = `menu-item category-card${isSection ? ' section-card' : ''}${premiumClass}${colorClass ? ' ' + colorClass : ''}`;

            const imageUrl = isSection
                ? getRepresentativeImage(displayName, true)
                : getRepresentativeImage(displayName, false);

            const clickHandler = () => {
                if (menuSections[displayName]) {
                    activeSection = displayName;
                    currentMenuLevel = 'itemsOfSection';
                    activeCategoryDisplayGroup = null;
                } else {
                    activeCategoryDisplayGroup = displayName;
                    currentMenuLevel = 'itemsOfCategory';
                    activeSection = null;
                }
                renderMenuNavigation();
            };

            const sectionSubtitle = isSection
                ? displayName === 'Retail'
                    ? 'Premium Goods'
                    : displayName === 'Misc'
                        ? 'Advanced Supplies'
                        : ''
                : '';

            div.innerHTML = `
                <img src="${imageUrl}" alt="${escapeHtml(displayName)}" loading="lazy" onerror="handleImageError(this)">
                <p class="category-card-name">${displayName}</p>
                ${sectionSubtitle ? `<p class="category-card-subtitle">${sectionSubtitle}</p>` : ''}
            `;
            div.addEventListener('click', clickHandler);
            menuItemsContainer.appendChild(div);
        });

    } else if (currentMenuLevel === 'itemsOfSection' && activeSection) {
        menuSectionTitle.textContent = activeSection;
        backButton.style.display = 'block';
        renderMenuItemsForSection(activeSection);

    } else if (currentMenuLevel === 'itemsOfCategory' && activeCategoryDisplayGroup) {
        menuSectionTitle.textContent = activeCategoryDisplayGroup;
        backButton.style.display = 'block';
        renderMenuItemsForCategory(activeCategoryDisplayGroup);
    }
}

function renderMenuItemsForSection(sectionName) {
    const menu = document.getElementById('menu');
    if (!menu) return;
    menu.innerHTML = '';

    const sectionCategories = menuSections[sectionName];
    let filteredItems;

    if (sectionCategories && Array.isArray(sectionCategories)) {
        filteredItems = menuItems.filter(item => sectionCategories.includes(item.category));
    } else {
        filteredItems = menuItems.filter(item => item.section === sectionName);
    }

    if (filteredItems.length === 0) {
        menu.innerHTML = '<p class="text-muted text-center py-4">No items found in this section.</p>';
        return;
    }

    filteredItems.forEach(item => {
        const div = document.createElement('div');
        div.className = 'menu-item';
        div.innerHTML = `
            <img src="${item.image}" alt="${item.name}" loading="lazy">
            <p>${item.name}</p>
            <div class="price">Rs ${item.price.toFixed(2)}</div>
        `;
        div.addEventListener('click', () => addToOrder(item));
        menu.appendChild(div);
    });
}

// MODIFIED: Navigate back function to always go to topLevelSections
function navigateBackMenu() {
    const searchInput = document.getElementById('search');
    
    // Always reset to topLevelSections
    currentMenuLevel = 'topLevelSections';
    activeSection = null;
    activeCategoryDisplayGroup = null;
    searchInput.value = ''; // Clear search term if it was active

    renderMenuNavigation(); // Re-render to show main page
}

// Renamed from renderMenuItemsForGroup to be more explicit
function renderMenuItemsForCategory(categoryName = null) {
    const menu = document.getElementById('menu');
    if (!menu) return;
    menu.innerHTML = ''; // Clear existing items

    let filteredItems = menuItems;
    if (categoryName) {
        filteredItems = menuItems.filter(item => item.category === categoryName);
    }
    // Apply search filter if active
    const searchTerm = document.getElementById('search')?.value.toLowerCase() || '';
    if (searchTerm) {
        filteredItems = filteredItems.filter(item => item.name.toLowerCase().includes(searchTerm));
    }

    if (filteredItems.length === 0) {
        menu.innerHTML = '<p class="text-muted text-center py-4">No items found in this category.</p>';
        return;
    }

    filteredItems.forEach(item => {
        const div = document.createElement('div');
        div.className = `menu-item`; 
        
        div.innerHTML = `
            <img src="${item.image}" alt="${item.name}" loading="lazy">
            <p>${item.name}</p>
            <div class="price">Rs ${item.price.toFixed(2)}</div>
        `;

        div.addEventListener('click', () => addToOrder(item));
        menu.appendChild(div);
    });
}

// No stock check without inventory system
function hasSufficientStock(menuItem) {
    return true; // Always true as inventory tracking is removed
}

async function addToOrder(item) {
    if (!currentTable) {
        notifications.show('Please select a table first!', 'warning');
        return;
    }

    orders[currentTable] ??= [];
    const existingItem = orders[currentTable].find(i =>
        i.name === item.name &&
        JSON.stringify(i.extras || []) === JSON.stringify(i.extras || []) &&
        (i.notes || '') === (item.notes || '')
    );

    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        orders[currentTable].push({
            ...item,
            quantity: 1,
            extras: item.extras || [],
            notes: item.notes || '',
            status: 'pending' // pending -> finalized
        });
    }

    persistAllData();
    renderOrderItems();
    updateTotal();
    startBlinking(currentTable);
    initializeTables(); // Update table status visual
    notifications.show(`${item.name} added to Table ${currentTable}`, 'success');
}

function renderOrderItems() {
    const orderItemsDiv = document.getElementById('order-items');
    if (!orderItemsDiv) return;

    if (!currentTable || !orders[currentTable] || orders[currentTable].length === 0) {
        orderItemsDiv.innerHTML = '<div class="no-items">No items added to this table</div>';
        updateTotal();
        return;
    }

    orderItemsDiv.innerHTML = '';
    const fragment = document.createDocumentFragment();

    orders[currentTable].forEach((item, index) => {
        const extrasTotal = item.extras?.reduce((sum, e) => sum + e.price, 0) || 0;
        const isFinalized = item.finalized;
        const isDiscountable = item.discountable !== false;
        const itemName = escapeHtml(item.name || 'Unknown Item');
        const priceDisplayHTML = `Rs ${(item.quantity * (item.price + extrasTotal)).toFixed(2)}`;

        let statusBadge = '';
        if (isFinalized) {
            statusBadge = '<span class="finalized-badge">FINALIZED</span>';
            if (item.kotNumber) {
                statusBadge += ` <span class="kot-info-badge">KOT: ${escapeHtml(item.kotNumber)}</span>`;
            }
        } else if (item.quantity > 0 && item.name) {
            statusBadge = '<span class="pending-kot-badge" style="color:orange; font-size:0.8em; margin-left:5px;">PENDING KOT</span>';
        }

        const removeButtonHTML = !isFinalized
            ? '<button class="remove-btn" style="background-color: #cc0000; color: white;">Remove Item</button>'
            : '';

        let comboDetailsHTML = '';
        if (item.type === 'combo' && Array.isArray(item.details) && item.details.length > 0) {
            comboDetailsHTML = `<ul class="combo-details-list" style="margin: 4px 0 0 0; padding-left: 18px; font-size: 0.95em; color: #0a4d6a;">
                ${item.details.map(detail => `<li>${escapeHtml(detail)}</li>`).join('')}
            </ul>`;
        }

        const itemDiv = document.createElement('div');
        itemDiv.className = 'order-item';
        itemDiv.dataset.index = index;
        itemDiv.innerHTML = `
            <div class="order-item-details">
                <p>
                    ${itemName} x${item.quantity} - ${priceDisplayHTML}
                    ${!isDiscountable ? '<span class="non-discountable">(Non-discountable)</span>' : ''}
                    ${statusBadge}
                </p>
                ${comboDetailsHTML}
                ${item.extras?.length ? `<p class="extras-display" style="font-size: 0.8em; color: #555; margin-top: 4px;">Extras: ${item.extras.map(e => `${escapeHtml(e.name)} (+Rs ${e.price.toFixed(2)})`).join(', ')}</p>` : ''}
                ${item.notes ? `<p class="notes">Notes: ${escapeHtml(item.notes)}</p>` : ''}
            </div>
            <div class="order-item-controls">
                <div class="quantity-control">
                    <button class="decrement-btn" ${isFinalized ? 'disabled' : ''}>-</button>
                    <input type="number" value="${item.quantity}" min="1" ${isFinalized ? 'disabled' : ''}>
                    <button class="increment-btn">+</button>
                </div>
                <button class="notes-btn" style="background-color: #2196f3; color: white;" ${isFinalized ? 'disabled' : ''}>Notes</button>
                <button class="extras-btn" data-name="${escapeHtml(item.name)}"
                        style="background-color: #ff9800; color: white;" ${isFinalized ? 'disabled' : ''}>Extras</button>
                <button class="void-btn" style="background-color: #ef4444; color: white;">Void Item</button>
                ${removeButtonHTML}
            </div>
        `;

        fragment.appendChild(itemDiv);
    });

    orderItemsDiv.appendChild(fragment);
    updateTotal();

    if (!document.getElementById('order-item-styles')) {
        const styleElement = document.createElement('style');
        styleElement.id = 'order-item-styles';
        styleElement.innerHTML = `
            .finalized-badge { background-color: #673AB7; color: white; padding: 2px 5px; border-radius: 3px; font-size: 0.7em; margin-left: 5px; }
            .kot-info { font-size: 0.8em; color: #666; margin-top: 3px; }
            .order-item-controls button[disabled] { opacity: 0.5; cursor: not-allowed; }
            .order-item-controls input[disabled] { background-color: #eee; cursor: not-allowed; }
            .combo-details-list { margin: 4px 0 0 0; padding-left: 18px; font-size: 0.95em; color: #0a4d6a; }
            .combo-details-list li { margin-bottom: 2px; }
        `;
        document.head.appendChild(styleElement);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const orderItemsDiv = document.getElementById('order-items');
    if (orderItemsDiv) {
        orderItemsDiv.addEventListener('click', async (e) => {
            const target = e.target;
            const orderItemElement = target.closest('.order-item');
            if (!orderItemElement) return;

            const index = parseInt(orderItemElement.dataset.index);
            if (isNaN(index)) {
                console.error("Could not determine item index from clicked element.");
                return;
            }

            if (target.classList.contains('increment-btn')) {
                await incrementQuantity(index);
            } else if (target.classList.contains('decrement-btn')) {
                await decrementQuantity(index);
            } else if (target.classList.contains('notes-btn')) {
                if (target.disabled) {
                    notifications.show("Cannot add notes to a finalized item.", "warning");
                    return;
                }
                currentItemIndex = index;
                showNotesModal();
            } else if (target.classList.contains('extras-btn')) {
                if (target.disabled) {
                    notifications.show("Cannot add extras to a finalized item.", "warning");
                    return;
                }
                currentItemIndex = index;
                showExtrasModal();
            } else if (target.classList.contains('void-btn')) {
                voidItem(index);
            } else if (target.classList.contains('remove-btn')) {
                removeOrderItem(index);
            }
        });

        orderItemsDiv.addEventListener('change', (e) => {
            const targetInput = e.target;
            if (targetInput.tagName === 'INPUT' && targetInput.type === 'number') {
                if (targetInput.disabled) {
                     notifications.show("Cannot change quantity of a finalized item.", "warning");
                     const index = parseInt(targetInput.closest('.order-item')?.dataset.index);
                     if (!isNaN(index) && orders[currentTable]?.[index]) {
                        targetInput.value = orders[currentTable][index].quantity;
                     }
                     return;
                }

                const index = parseInt(targetInput.closest('.order-item')?.dataset.index);
                if (!isNaN(index)) {
                    updateOrderQuantity(index, parseInt(targetInput.value));
                }
            }
        });
    }
});

function updateOrderQuantity(index, quantity) {
    if (!orders[currentTable]?.[index]) return;
    const item = orders[currentTable][index];
    
    if (isNaN(quantity) || quantity < 1) {
        notifications.show(`Invalid quantity.`, 'error');
        renderOrderItems();
        return;
    }

    item.quantity = quantity;

    if (item.quantity <= 0) {
        removeOrderItem(index);
    } else {
        persistAllData();
        renderOrderItems();
        initializeTables();
    }

    if (orders[currentTable].length === 0) {
        delete tableTimers[currentTable];
        persistAllData();
    }
}

async function incrementQuantity(index) {
    if (!currentTable || !orders[currentTable]?.[index]) {
        notifications.show('Item not found in the current order.', 'error');
        console.error('Attempted to increment non-existent item at index:', index, 'for table:', currentTable, 'Current orders:', JSON.parse(JSON.stringify(orders)));
        return;
    }

    showLoadingSpinner();
    const itemEntry = orders[currentTable][index];
    const wasFinalizedInitially = itemEntry.finalized;

    itemEntry.quantity += 1;
    if (wasFinalizedInitially) {
        itemEntry.finalized = false;
        delete itemEntry.kotNumber;
    }
    
    persistAllData();
    renderOrderItems();
    updateTotal();
    hideLoadingSpinner();

    if (wasFinalizedInitially) {
        notifications.show(
            `${itemEntry.name} quantity increased. It's now un-finalized and will be included in the next KOT.`,
            'info',
            5000
        );
    } else {
        notifications.show(`Quantity for ${itemEntry.name} increased.`, 'success');
    }
}

async function decrementQuantity(index) {
    if (!orders[currentTable]?.[index]) return;
    if (orders[currentTable][index].finalized) {
        notifications.show("This item has already been finalized and cannot be modified.", 'warning');
        return;
    }

    const item = orders[currentTable][index];
    if (item.quantity <= 1) {
        await removeOrderItem(index);
        return;
    }

    showLoadingSpinner();
    item.quantity -= 1;
    
    persistAllData();
    renderOrderItems();
    updateTotal();
    hideLoadingSpinner();
}

function showExtrasModal() {
    const modal = document.getElementById('extras-modal');
    const content = document.getElementById('extras-content');
    const itemNameEl = document.getElementById('extras-item-name');

    if (!modal || !content || !itemNameEl) {
        console.error("Error: Missing elements for Extras modal!");
        notifications.show("Cannot open extras dialog. UI error.", "error");
        return;
    }

    if (currentItemIndex === null || currentItemIndex === undefined || !orders[currentTable]?.[currentItemIndex]) {
        console.error("Cannot show extras: Invalid item index for modal.", currentItemIndex);
        notifications.show("Cannot determine which item to add extras for.", "error");
        return;
    }

    if (orders[currentTable][currentItemIndex].finalized) {
        notifications.show("Cannot add extras to a finalized item.", "warning");
        return;
    }

    const currentItem = orders[currentTable][currentItemIndex];
    itemNameEl.textContent = currentItem.name;

    let itemType = currentItem.type || 'food';

    if (currentItem.name.toLowerCase().includes('hukka')) {
        itemType = 'misc';
    }

    const filteredExtras = extras.filter(extra => {
        return extra.type === itemType || !extra.type;
    });

    content.innerHTML = filteredExtras.map(extra => {
        const isChecked = currentItem.extras?.some(e => e.name === extra.name) || false;
        return `
            <div class="extra-option">
                <input type="checkbox" id="extra-${extra.name.replace(/\s+/g, '-')}"
                    data-name="${escapeHtml(extra.name)}" data-price="${extra.price}"
                    ${isChecked ? 'checked' : ''}>
                <label for="extra-${extra.name.replace(/\s+/g, '-')}">
                    ${escapeHtml(extra.name)} (+Rs ${extra.price.toFixed(2)})
                </label>
            </div>
        `;
    }).join('');

    const existingSaveBtn = content.querySelector('.save-extras-btn');
    if (existingSaveBtn) existingSaveBtn.remove();

    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save Extras';
    saveBtn.className = 'save-extras-btn';
    saveBtn.addEventListener('click', saveExtras);
    content.appendChild(saveBtn);

    modal.style.display = 'block';
}

function closeExtrasModal() {
    const modal = document.getElementById('extras-modal');
    if (modal) modal.style.display = 'none';
}

async function saveExtras() {
    const content = document.getElementById('extras-content');

    if (!content) {
        console.error("Extras modal content area not found!");
        notifications.show("Error saving extras. UI element missing.", "error");
        return;
    }
    if (!currentTable || !orders[currentTable]) {
        console.error("Cannot save extras: No current table or order selected.");
        notifications.show("Please select a table with an order first.", "warning");
        closeExtrasModal();
        return;
    }
    if (currentItemIndex === null || currentItemIndex === undefined || !orders[currentTable][currentItemIndex]) {
        console.error("Cannot save extras: Invalid item index.", currentItemIndex);
        notifications.show("Error identifying the item to add extras to.", "error");
        closeExtrasModal();
        return;
    }
    if (orders[currentTable][currentItemIndex].finalized) {
        notifications.show("Cannot add extras to a finalized item.", "warning");
        closeExtrasModal();
        return;
    }

    showLoadingSpinner();

    const checkboxes = content.querySelectorAll('input[type="checkbox"]');
    const selectedExtras = Array.from(checkboxes)
        .filter(cb => cb.checked)
        .map(cb => ({
            name: cb.dataset.name,
            price: parseFloat(cb.dataset.price)
        }));

    orders[currentTable][currentItemIndex].extras = selectedExtras;
    persistAllData();
    renderOrderItems();
    updateTotal();
    closeExtrasModal();
    notifications.show("Extras updated successfully!", "success");
    hideLoadingSpinner();
}

function closeNotesModal() {
    const modal = document.getElementById('notes-modal');
    if (modal) modal.style.display = 'none';
}

function showNotesModal() {
    const modal = document.getElementById('notes-modal');
    const textarea = document.getElementById('item-notes');
    const saveBtn = document.getElementById('save-notes-btn');
    const closeBtn = document.getElementById('close-notes-modal');
    
    if (!modal || !textarea || !saveBtn || !closeBtn) {
        console.error("Notes modal elements are missing!");
        return;
    }

    if (currentItemIndex === null || !orders[currentTable]?.[currentItemIndex]) {
        notifications.show("No item selected to add a note to.", "warning");
        return;
    }
    
    textarea.value = orders[currentTable][currentItemIndex].notes || '';
    
    saveBtn.onclick = () => saveNotes();
    closeBtn.onclick = () => closeNotesModal();
    
    modal.style.display = 'block';
    textarea.focus();
}

async function saveNotes() {
    const textarea = document.getElementById('item-notes');
    const notesValue = textarea.value.trim();

    if (currentItemIndex === null || !orders[currentTable]?.[currentItemIndex]) {
        notifications.show("Error: No item selected to save notes for.", "error");
        closeNotesModal();
        return;
    }

    orders[currentTable][currentItemIndex].notes = notesValue;
    persistAllData();
    renderOrderItems();
    closeNotesModal();
    notifications.show("Note saved successfully.", "success");
}

async function removeOrderItem(index) {
    if (!currentTable || !orders[currentTable]?.[index]) {
        notifications.show("Cannot remove: Item not found.", 'error');
        return;
    }
    const itemToRemove = { ...orders[currentTable][index] };

    if (itemToRemove.finalized) {
        notifications.show(`"${itemToRemove.name}" is finalized. Use 'Void Item' instead.`, 'warning', 4000);
        return;
    }

    const confirmed = await showConfirmModal('Remove Item', `Are you sure you want to remove "${itemToRemove.name}" from the order?`);
    if (!confirmed) {
        return;
    }

    showLoadingSpinner();

    orders[currentTable].splice(index, 1);
    const isOrderEmpty = orders[currentTable].length === 0;
    if (isOrderEmpty) {
        delete orders[currentTable];
        delete tableTimers[currentTable];
    }

    persistAllData();
    refreshUI();
    notifications.show(`Removed "${itemToRemove.name}"`, 'success');
    hideLoadingSpinner();
}

function refreshUI() {
    renderOrderItems();
    renderMenuNavigation(); // Call the new navigation rendering
    initializeTables();
}

// =========================================================================
// =================== SIDEBAR & REPORT FUNCTIONS ==========================
// =========================================================================

function showSidebarContentModal(title, contentHTML, setupCallback = null) {
    const modal = document.getElementById('sidebar-content-modal');
    const contentArea = document.getElementById('modal-content-area');
    if (!modal || !contentArea) return;
    contentArea.innerHTML = `<h3>${title}</h3>${contentHTML}`;
    modal.style.display = 'block';
    if (setupCallback) setupCallback();
    toggleSidebar({ preventDefault: () => {} });
}

function closeSidebarContentModal() {
    const modal = document.getElementById('sidebar-content-modal');
    if (modal) modal.style.display = 'none';
}

function showSalesReportsContent(e) {
    e.preventDefault();

    showSidebarContentModal('Sales Reports', `
        <div class="report-container">
            <h4>Sales Report</h4>
            <div class="report-filter">
                <input type="date" id="start-date" value="${new Date().toISOString().split('T')[0]}">
                <input type="date" id="end-date" value="${new Date().toISOString().split('T')[0]}">
                <button id="generate-report" class="export-btn">Generate Report</button>
            </div>
            <hr>
            <div id="sales-report-content" class="text-center p-4">
                <p class="text-muted">Select a date range and click "Generate Report" to view sales data.</p>
            </div>
            <button id="export-sales-csv" class="export-btn" style="display:none; margin-top:10px;">Export to CSV</button>
        </div>
    `, () => {
        document.getElementById('generate-report')?.addEventListener('click', generateSalesReport);
        document.getElementById('export-sales-csv')?.addEventListener('click', exportSalesReport);
    });
}

function generateSalesReport() {
    showLoadingSpinner();
    const reportContentEl = document.getElementById('sales-report-content');
    const exportButton = document.getElementById('export-sales-csv');
    if (!reportContentEl || !exportButton) {
        hideLoadingSpinner();
        return;
    }
    reportContentEl.innerHTML = `<p>Loading report...</p>`;
    exportButton.style.display = 'none';

    const startDate = new Date(document.getElementById('start-date').value);
    const endDate = new Date(document.getElementById('end-date').value);
    endDate.setHours(23, 59, 59, 999);

    const filteredSales = salesHistory.filter(sale => {
        const saleDate = new Date(sale.timestamp);
        return saleDate >= startDate && saleDate <= endDate;
    });

    const metrics = calculateSalesMetrics(filteredSales);

    reportContentEl.innerHTML = `
        <table class="report-table">
            <thead><tr><th>Metric</th><th>Value</th></tr></thead>
            <tbody>
                <tr><td>Total Sales (All Sources)</td><td>Rs ${metrics.totalSales.toFixed(2)}</td></tr>
                <tr><td>Total Cash Sales (Net)</td><td>Rs ${metrics.totalCash.toFixed(2)}</td></tr>
                <tr><td>Total Mobile Sales</td><td>Rs ${metrics.totalMobile.toFixed(2)}</td></tr>
                <tr><td>Total Discount Given</td><td>Rs ${metrics.totalDiscount.toFixed(2)}</td></tr>
                <tr><td>Total Transactions</td><td>${metrics.transactionCount}</td></tr>
                <tr><td>Average Transaction Value</td><td>Rs ${metrics.atv.toFixed(2)}</td></tr>
            </tbody>
        </table>
    `;
    if (filteredSales.length > 0) {
        exportButton.style.display = 'block';
    }
    hideLoadingSpinner();
}

function calculateSalesMetrics(sales) {
    let totalSales = 0;
    let totalCash = 0; // Will be net cash received
    let totalMobile = 0;
    let totalDiscount = 0;
    let transactionCount = 0;

    sales.forEach(sale => {
        const saleTotal = typeof sale.total === 'number' ? sale.total : 0;
        totalSales += saleTotal;
        transactionCount++;
        totalDiscount += parseFloat(sale.discountAmount || 0);

        let cashTenderedForSale = 0;
        let mobilePaidForSale = 0;

        if (Array.isArray(sale.paymentMethods)) {
            sale.paymentMethods.forEach(pm => {
                const amount = parseFloat(pm.amount) || 0;
                if (pm.method === 'Cash') {
                    cashTenderedForSale += amount;
                } else if (pm.method === 'Mobile') {
                    mobilePaidForSale += amount;
                }
            });
        }
        
        // Deduct the order's change from the cash component of payment if any.
        totalCash += (cashTenderedForSale - (sale.change || 0));
        totalMobile += mobilePaidForSale;
    });

    const atv = transactionCount > 0 ? totalSales / transactionCount : 0;

    return {
        totalSales: totalSales,
        totalCash: Math.max(0, totalCash), // Ensure net cash is not negative
        totalMobile: totalMobile,
        totalDiscount: totalDiscount,
        transactionCount: transactionCount,
        atv: atv
    };
}

function exportSalesReport() {
    const startDate = document.getElementById('start-date').value;
    const endDate = document.getElementById('end-date').value;
    const filteredSales = salesHistory.filter(sale => {
        const saleDate = new Date(sale.timestamp);
        return saleDate >= new Date(startDate) && saleDate <= new Date(endDate);
    });

    const headers = ["Order ID", "Table", "Total", "Discount", "Payment Methods", "Timestamp", "Items"];
    const csvRows = [headers.join(',')];

    filteredSales.forEach(sale => {
        const paymentMethodsStr = sale.paymentMethods.map(pm => `${pm.method}: Rs ${pm.amount.toFixed(2)}`).join('; ');
        const itemsStr = sale.items.map(item => `${item.name} x${item.quantity}`).join('; ');
        csvRows.push([
            `"${sale.orderNumber}"`,
            `"${sale.table}"`,
            sale.total.toFixed(2),
            sale.discountAmount,
            `"${paymentMethodsStr}"`,
            `"${new Date(sale.timestamp).toLocaleString()}"`,
            `"${itemsStr}"`
        ].join(','));
    });

    const csvContent = "data:text/csv;charset=utf-8," + csvRows.join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `sales_report_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    notifications.show('Sales report exported to CSV.', 'success');
}

function showItemsSoldContent(e) {
    e.preventDefault();

    const getMarkup = () => {
        // Collect all unique categories from menuItems
        const categories = [...new Set(menuItems.map(item => item.category))];
        const categoryOptions = categories.map(cat => `<option value="${cat}">${cat}</option>`).join('');

        return `
            <div class="items-sold-dashboard report-container">
                <div class="dashboard-header"><h3>Items Sold Performance</h3></div>

                <div class="report-controls-grid">
                    <div class="control-group">
                        <label for="items-sold-start-date">From:</label>
                        <input type="date" id="items-sold-start-date" class="report-filter-input">
                    </div>
                    <div class="control-group">
                        <label for="items-sold-end-date">To:</label>
                        <input type="date" id="items-sold-end-date" class="report-filter-input">
                    </div>
                    <div class="control-group">
                        <label for="items-sold-category">Category:</label>
                        <select id="items-sold-category" class="report-filter-input">
                            <option value="all">All Categories</option>${categoryOptions}
                        </select>
                    </div>
                    <div class="control-group">
                        <label for="items-sold-sort">Sort By:</label>
                        <select id="items-sold-sort" class="report-filter-input">
                            <option value="revenue">Revenue</option>
                            <option value="quantity">Quantity</option>
                        </select>
                    </div>
                </div>

                <div id="items-sold-table-container">
                    <table class="pro-table report-table mt-3">
                        <thead><tr><th class="item-name-col">Item</th><th class="numeric-col">Qty</th><th class="numeric-col">Revenue</th></tr></thead>
                        <tbody id="items-sold-tbody"></tbody>
                    </table>
                </div>
                <div id="no-data-container" class="text-center p-4" style="display: none;">
                    <p class="text-muted">No items sold matching your criteria.</p>
                </div>
                <button id="export-items-sold-csv" class="export-btn mt-3 w-100">Export Full Report to CSV</button>
            </div>
        `;
    };

    const renderReport = () => {
        showLoadingSpinner();
        const startDateEl = document.getElementById('items-sold-start-date');
        const endDateEl = document.getElementById('items-sold-end-date');
        
        if (!startDateEl.value || !endDateEl.value) {
            notifications.show('Please select a valid start and end date.', 'warning');
            hideLoadingSpinner();
            return;
        }

        const start = new Date(startDateEl.value);
        const end = new Date(endDateEl.value);
        end.setHours(23, 59, 59, 999);

        // Filter raw sales history to only include sales within the date range
        const salesInDateRange = salesHistory.filter(s => {
            const saleDate = new Date(s.timestamp);
            return saleDate >= start && saleDate <= end;
        });

        // Aggregate items from these filtered sales
        const aggregatedItems = {};
        salesInDateRange.forEach(sale => {
            if (sale.items && Array.isArray(sale.items)) {
                sale.items.forEach(item => {
                    const itemRevenue = (item.price + (item.extras?.reduce((sum, e) => sum + (e.price || 0), 0) || 0)) * item.quantity;
                    if (!aggregatedItems[item.name]) {
                        const menuItem = menuItems.find(m => m.name === item.name);
                        aggregatedItems[item.name] = {
                            name: item.name,
                            category: menuItem?.category || 'Uncategorized',
                            quantity: 0, totalRevenue: 0
                        };
                    }
                    aggregatedItems[item.name].quantity += item.quantity;
                    aggregatedItems[item.name].totalRevenue += itemRevenue;
                });
            }
        });

        let displayData = Object.values(aggregatedItems);
        const categoryFilter = document.getElementById('items-sold-category').value;
        const sortBy = document.getElementById('items-sold-sort').value;
        
        if (categoryFilter !== 'all') {
            displayData = displayData.filter(item => item.category === categoryFilter);
        }
        displayData.sort((a, b) => (sortBy === 'revenue' ? b.totalRevenue - a.totalRevenue : b.quantity - a.quantity));
        
        const tbody = document.getElementById('items-sold-tbody');
        const noDataContainer = document.getElementById('no-data-container');
        if (!tbody || !noDataContainer) { hideLoadingSpinner(); return; }

        if (displayData.length === 0) {
            document.getElementById('items-sold-table-container').style.display = 'none';
            noDataContainer.style.display = 'block';
        } else {
            document.getElementById('items-sold-table-container').style.display = 'block';
            noDataContainer.style.display = 'none';
            tbody.innerHTML = displayData.map(item => `<tr><td class="item-name-col">${item.name}</td><td class="numeric-col">${item.quantity.toLocaleString()}</td><td class="numeric-col">Rs ${item.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td></tr>`).join('');
        }
        hideLoadingSpinner();
    };

    const exportToCSV = () => {
        const startDateEl = document.getElementById('items-sold-start-date');
        const endDateEl = document.getElementById('items-sold-end-date');
        const categoryFilter = document.getElementById('items-sold-category').value;
        const sortBy = document.getElementById('items-sold-sort').value;

        const start = new Date(startDateEl.value);
        const end = new Date(endDateEl.value);
        end.setHours(23, 59, 59, 999);

        // Filter raw sales history to only include sales within the date range
        const salesInDateRange = salesHistory.filter(s => {
            const saleDate = new Date(s.timestamp);
            return saleDate >= start && saleDate <= end;
        });

        // Re-aggregate items for export based on current filters
        const aggregatedItemsForExport = {};
        salesInDateRange.forEach(sale => {
            if (sale.items && Array.isArray(sale.items)) {
                sale.items.forEach(item => {
                    const itemRevenue = (item.price + (item.extras?.reduce((sum, e) => sum + (e.price || 0), 0) || 0)) * item.quantity;
                    if (!aggregatedItemsForExport[item.name]) {
                        const menuItem = menuItems.find(m => m.name === item.name);
                        aggregatedItemsForExport[item.name] = {
                            name: item.name,
                            category: menuItem?.category || 'Uncategorized',
                            quantity: 0, totalRevenue: 0
                        };
                    }
                    aggregatedItemsForExport[item.name].quantity += item.quantity;
                    aggregatedItemsForExport[item.name].totalRevenue += itemRevenue;
                });
            }
        });

        let exportData = Object.values(aggregatedItemsForExport);
        
        if (categoryFilter !== 'all') {
            exportData = exportData.filter(item => item.category === categoryFilter);
        }
        exportData.sort((a, b) => (sortBy === 'revenue' ? b.totalRevenue - a.totalRevenue : b.quantity - a.quantity));

        if (exportData.length === 0) {
            notifications.show('No data to export.', 'warning');
            return;
        }
        
        const headers = ["Item Name", "Category", "Quantity Sold", "Total Revenue (Rs)"];
        const csvRows = [headers.join(',')];

        exportData.forEach(item => {
            csvRows.push([
                `"${item.name.replace(/"/g, '""')}"`,
                `"${item.category}"`,
                item.quantity,
                item.totalRevenue.toFixed(2)
            ].join(','));
        });

        const link = document.createElement('a');
        link.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvRows.join('\n'));
        link.download = `items_sold_report_${startDateEl.value}_to_${endDateEl.value}.csv`;
        link.click();
        notifications.show('Items Sold report exported to CSV.', 'success');
    };
    
    showSidebarContentModal('Items Sold Dashboard', getMarkup(), () => {
        const today = new Date();
        document.getElementById('items-sold-start-date').valueAsDate = new Date(today.getFullYear(), today.getMonth(), 1);
        document.getElementById('items-sold-end-date').valueAsDate = today;
        document.querySelectorAll('.report-filter-input').forEach(el => el.addEventListener('change', renderReport));
        document.getElementById('export-items-sold-csv').addEventListener('click', exportToCSV);
        renderReport();
    });
}

function showOrderHistoryContent(e) {
    e.preventDefault();
    
    showSidebarContentModal('Order History', `
        <div class="report-container">
            <h4>Order History</h4>

            <div class="report-filter"> 
                <input type="date" id="history-start-date" value="${new Date().toISOString().split('T')[0]}">
                <input type="date" id="history-end-date" value="${new Date().toISOString().split('T')[0]}">
                <select id="history-status-filter">
                    <option value="all">All Statuses</option>
                    <option value="completed">Completed</option>
                    <option value="pending">Pending</option>
                    <option value="voided">Voided</option>
                </select>
            </div>

            <div class="report-filter" style="margin-top: 10px; margin-bottom: 5px; align-items: center;">
                <input type="text" id="history-search" placeholder="Search (ID, Table, Item, Payment)..." style="flex-grow: 1;"> 
                <button id="filter-history" class="export-btn" style="margin-left: 10px;">Filter</button>
            </div>

            <div id="order-history-results">
                <div class="history-summary" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-bottom: 20px;">
                    <div class="summary-card" style="background: #f8f9fa; border-radius: 8px; padding: 15px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <h5>Total Orders</h5>
                        <p id="total-orders-count">0</p>
                    </div>
                    <div class="summary-card" style="background: #f8f9fa; border-radius: 8px; padding: 15px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <h5>Total Revenue</h5>
                        <p id="total-revenue">Rs 0.00</p>
                    </div>
                    <div class="summary-card" style="background: #f8f9fa; border-radius: 8px; padding: 15px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <h5>Avg. Order Value</h5>
                        <p id="avg-order-value">Rs 0.00</p>
                    </div>
                </div>
                <div id="order-history-list"></div>
            </div>
            <div id="pagination" style="display: flex; justify-content: center; gap: 10px; margin-top: 10px;"></div>
        </div>
    `, () => {
        const filterButton = document.getElementById('filter-history');
        if (filterButton) {
            const filterHandler = () => renderOrderHistory(1);
            filterButton.addEventListener('click', filterHandler);
        }
        
        const searchInput = document.getElementById('history-search');
        if (searchInput) {
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    renderOrderHistory(1);
                }
            });
        }

        const today = new Date();
        const earliestHistoryDate = orderHistory.length
            ? new Date(Math.min(...orderHistory.map(order => new Date(order.timestamp).getTime())))
            : today;
        const startDateEl = document.getElementById('history-start-date');
        const endDateEl = document.getElementById('history-end-date');
        if (startDateEl) startDateEl.valueAsDate = earliestHistoryDate;
        if (endDateEl) endDateEl.valueAsDate = today;

        currentPage = 1;
        renderOrderHistory(currentPage);
    });
}

function renderOrderHistory(pageToShow) {
    try {
        const requestedPage = Number.isInteger(pageToShow) && pageToShow > 0 ? pageToShow : 1;
        currentPage = requestedPage;

        const startDateElement = document.getElementById('history-start-date');
        const endDateElement = document.getElementById('history-end-date');
        const statusFilterElement = document.getElementById('history-status-filter');
        const searchElement = document.getElementById('history-search');

    if (!startDateElement || !endDateElement || !statusFilterElement || !searchElement) {
        return;
    }

    const startDate = new Date(startDateElement.value);
    const endDate = new Date(endDateElement.value);
    endDate.setHours(23, 59, 59, 999);

    const statusFilter = statusFilterElement.value || "all";
    const searchQuery = (searchElement.value || "").trim().toLowerCase();

    const filteredHistory = orderHistory.filter(order => {
        if (!order || !order.timestamp) return false;
        const orderDate = new Date(order.timestamp);

        return (
            orderDate >= startDate && orderDate <= endDate &&
            (statusFilter === 'all' || (order.status && order.status.toLowerCase() === statusFilter.toLowerCase())) &&
            (!searchQuery || matchesSearch(order, searchQuery))
        );
    }).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    const paginatedHistory = paginateOrders(filteredHistory, currentPage);

    updateOrderHistorySummaryUI(filteredHistory);

    const historyDiv = document.getElementById('order-history-list');
    if (historyDiv) {
        historyDiv.innerHTML = paginatedHistory.length > 0
            ? paginatedHistory.map((order) => renderOrderHistoryItem(order)).join('')
            : '<div class="no-orders">No orders found matching your criteria.</div>';

        }
    renderOrderHistoryPagination(filteredHistory.length, currentPage);
    } catch (error) {
        console.error('Error rendering order history:', error);
        notifications.show('Unable to render order history.', 'error');
    }
}

function renderOrderHistoryItem(order) {
    const statusClass = `status-${order.status || 'pending'}`;
    
    // Payment breakdown
    let paymentDetailsHTML = '';
    if (order.paymentMethods && order.paymentMethods.length > 0) {
        paymentDetailsHTML = order.paymentMethods.map(pm => `
            <div>
                <i class="fas fa-${pm.method === 'Cash' ? 'money-bill-wave' : 'mobile-alt'}"></i> ${pm.method}: Rs ${pm.amount.toFixed(2)}
            </div>
        `).join('');
    }

    const tableLabel = order.table ? `Table ${escapeHtml(String(order.table))}` : 'Table N/A';
    return `
        <div class="order-history-item">
            <div class="order-history-header">
                <span class="order-history-status ${statusClass}">${escapeHtml((order.status || 'pending').replace(/_/g, ' '))}</span>
                <span>${tableLabel}</span>
            </div>
            <div class="order-history-items">
                <h5>Items:</h5>
                ${order.items?.map(renderOrderRow).join('') || '<p>No items available</p>'}
            </div>
            <div class="order-history-footer">
                <div class="payment-breakdown">
                    ${paymentDetailsHTML}
                </div>
                <div class="grand-total-section">
                    <strong>Total:</strong>
                    <span>Rs ${order.total?.toFixed(2) || '0.00'}</span>
                </div>
            </div>
            <div class="order-history-actions">
                <button class="view-receipt-btn" data-order-number="${order.orderNumber}">View Receipt</button>
                <button class="reprint-btn" data-order-number="${order.orderNumber}">Reprint</button>
                ${order.status !== 'voided' ? `<button class="void-order-btn" data-order-number="${order.orderNumber}">Void Order</button>` : ''}
            </div>
        </div>
    `;
}

function matchesSearch(order, query) {
    const orderIdString = String(order.orderNumber || '').toLowerCase();
    const tableString = String(order.table || '').toLowerCase();
    
    if (orderIdString.includes(query) || tableString.includes(query)) {
        return true;
    }

    if (order.items && Array.isArray(order.items)) {
        if (order.items.some(item => item.name && item.name.toLowerCase().includes(query))) {
            return true;
        }
    }

    if (order.paymentMethods && Array.isArray(order.paymentMethods)) {
        if (order.paymentMethods.some(pm => pm.method && pm.method.toLowerCase().includes(query))) {
            return true;
        }
    }
    
    return false;
}

function paginateOrders(orders, page) {
    const startIndex = (page - 1) * itemsPerPage;
    return orders.slice(startIndex, startIndex + itemsPerPage);
}

function updateOrderHistorySummaryUI(filteredHistory) {
    const totalOrders = filteredHistory.length;
    const totalRevenue = filteredHistory.reduce((sum, order) => sum + (order.total || 0), 0);
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    document.getElementById('total-orders-count').textContent = totalOrders;
    document.getElementById('total-revenue').textContent = `Rs ${totalRevenue.toFixed(2)}`;
    document.getElementById('avg-order-value').textContent = `Rs ${avgOrderValue.toFixed(2)}`;
}

function renderOrderRow(item) {
    const extrasTotal = item.extras?.reduce((sum, e) => sum + (e.price || 0), 0) || 0;
    const itemTotal = (item.price + extrasTotal) * (item.quantity || 1);
    const extrasDisplay = item.extras?.length 
        ? `<div class="order-item-extras">Extras: ${item.extras.map(e => `${escapeHtml(e.name)} (+Rs ${e.price.toFixed(2)})`).join(', ')}</div>` 
        : '';
    const notesDisplay = item.notes 
        ? `<div class="order-item-notes-display">Notes: ${escapeHtml(item.notes)}</div>` 
        : '';

    return `
        <div class="order-item-row">
            <div class="order-item-name">
                ${escapeHtml(item.name || 'Unknown Item')}
                ${extrasDisplay}
                ${notesDisplay}
            </div>
            <div class="order-item-qty">x${item.quantity || 1}</div>
            <div class="order-item-price">Rs ${itemTotal.toFixed(2)}</div>
        </div>
    `;
}

function renderOrderHistoryPagination(totalOrders, page) {
    const pagination = document.getElementById('pagination');
    if (!pagination) return;

    pagination.innerHTML = '';
    const totalPages = Math.ceil(totalOrders / itemsPerPage);
    
    if (totalPages <= 1) return;

    if (page > 1) {
        const prevBtn = document.createElement('button');
        prevBtn.innerHTML = 'Â« Previous';
        prevBtn.addEventListener('click', () => renderOrderHistory(page - 1));
        pagination.appendChild(prevBtn);
    }

    let startPage = Math.max(1, page - 2);
    let endPage = Math.min(totalPages, page + 2);

    if (startPage > 1) {
        const firstBtn = document.createElement('button');
        firstBtn.textContent = '1';
        firstBtn.addEventListener('click', () => renderOrderHistory(1));
        pagination.appendChild(firstBtn);
        if (startPage > 2) {
            const ellipsis = document.createElement('span');
            ellipsis.textContent = '...';
            pagination.appendChild(ellipsis);
        }
    }

    for (let i = startPage; i <= endPage; i++) {
        const pageBtn = document.createElement('button');
        pageBtn.textContent = i;
        if (i === page) {
            pageBtn.classList.add('active');
        }
        pageBtn.addEventListener('click', () => renderOrderHistory(i));
        pagination.appendChild(pageBtn);
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
             const ellipsis = document.createElement('span');
            ellipsis.textContent = '...';
            pagination.appendChild(ellipsis);
        }
        const lastBtn = document.createElement('button');
        lastBtn.textContent = totalPages;
        lastBtn.addEventListener('click', () => renderOrderHistory(totalPages));
        pagination.appendChild(lastBtn);
    }

    if (page < totalPages) {
        const nextBtn = document.createElement('button');
        nextBtn.innerHTML = 'Next Â»';
        nextBtn.addEventListener('click', () => renderOrderHistory(page + 1));
        pagination.appendChild(nextBtn);
    }
}


function showVoidDetailsContent(e) {
    e.preventDefault();
    
    showSidebarContentModal('Void Details', `
        <div class="report-container">
            <h4>Void Details</h4>
            <div class="report-filter">
                <input type="date" id="void-start-date">
                <input type="date" id="void-end-date">
                <button id="filter-voids" class="export-btn">Filter</button>
                <button id="export-voids" class="export-btn">Export</button>
            </div>
            <div id="void-details-list"></div>
        </div>
    `, () => {
        document.getElementById('void-start-date').valueAsDate = new Date();
        document.getElementById('void-end-date').valueAsDate = new Date();

        renderVoidDetails();
        
        document.getElementById('filter-voids')?.addEventListener('click', filterVoidDetails);
        document.getElementById('export-voids')?.addEventListener('click', exportVoidDetails);
    });
}

function renderVoidDetails() {
    try {
        const list = document.getElementById('void-details-list');
        if (!list) return;
        
        const startDate = new Date(document.getElementById('void-start-date').value);
        const endDate = new Date(document.getElementById('void-end-date').value);
        endDate.setHours(23, 59, 59, 999);

    const filteredVoids = voidDetails.filter(item => {
        const itemDate = new Date(item.timestamp);
        return itemDate >= startDate && itemDate <= endDate;
    });

    if (filteredVoids.length === 0) {
        list.innerHTML = '<p class="text-center text-muted mt-4">No void records found for the selected dates.</p>';
        return;
    }

    list.innerHTML = filteredVoids.map(voidItem => {
        const date = voidItem.timestamp ? new Date(voidItem.timestamp).toLocaleString() : 'Unknown date';
        const total = voidItem.total ? `Rs ${voidItem.total.toFixed(2)}` : 'Rs 0.00';
        const itemsList = voidItem.items?.map(i => `${escapeHtml(i.name)} x${i.quantity}`).join(', ') || 'No items';
        
        return `
            <div class="void-item">
                <p><strong>Table ${escapeHtml(String(voidItem.table || 'Unknown'))}</strong> - ${date}</p>
                <p>Items: ${itemsList}</p>
                <p>Total: ${total}</p>
                <p>Reason: ${escapeHtml(voidItem.reason || 'No reason provided')}</p>
                <p>Voided by: ${escapeHtml(voidItem.user || 'Unknown user')}</p>
            </div>
        `;
    }).join('');
    } catch (error) {
        console.error('Error rendering void details:', error);
        notifications.show('Unable to render void records.', 'error');
    }
}

function filterVoidDetails() {
    renderVoidDetails(); // Simply re-render with current filter settings
}

function exportVoidDetails() {
    const startDate = document.getElementById('void-start-date').value;
    const endDate = document.getElementById('void-end-date').value;
    const filteredVoids = voidDetails.filter(item => {
        const itemDate = new Date(item.timestamp);
        return itemDate >= new Date(startDate) && itemDate <= new Date(endDate);
    });

    const csvContent = "data:text/csv;charset=utf-8," +
        "Table,Items,Total,Reason,User,Timestamp\n" +
        filteredVoids.map(e => 
            `"${e.table}","${e.items.map(i => `${i.name} x${i.quantity}`).join('; ')}",${e.total},"${e.reason}","${e.user}","${new Date(e.timestamp).toLocaleString()}"`
        ).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `void_details_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    notifications.show('Void details exported to CSV.', 'success');
}


// =========================================================================
// =================== CHECKOUT & PAYMENT FUNCTIONS ========================
// =========================================================================

function resetCheckoutState() {
    paymentMethods = [];
    paymentAmount = 0;
    discount = 0;
    discountCodeApplied = null;
    
    const numericInput = document.getElementById('numeric-input');
    if (numericInput) numericInput.value = '0';
    
    const discountCodeInput = document.getElementById('discount-code');
    if (discountCodeInput) discountCodeInput.value = '';
}

function showCheckoutDialog() {
    if (!currentTable || !orders[currentTable] || !orders[currentTable].length) {
        notifications.show('No items to checkout!', 'warning');
        return;
    }

    resetCheckoutState();
    updateTotal(); 
    document.getElementById('dialog-total-amount').textContent = calculateTotal().toFixed(2);
    renderPaymentMethods(); 
    updateChange();         
    
    document.getElementById('checkout-dialog').style.display = 'block';
}

function closeCheckoutDialog() {
    document.getElementById('checkout-dialog').style.display = 'none';
    resetCheckoutState();
    renderOrderItems();
    updateTotal();
}

function appendNumber(num) {
    const input = document.getElementById('numeric-input');
    if (!input) return;
    let value = input.value;
    if (num === '.' && value.includes('.')) return;
    if (value === '0' && num !== '.') value = num;
    else value += num;
    input.value = value;
    paymentAmount = validateNumericInput(value, 0);
    updateChange();
}

function clearInput() {
    const input = document.getElementById('numeric-input');
    if (input) input.value = '0';
    paymentAmount = 0;
    updateChange();
}

function setQuickAmount(amount) {
    const input = document.getElementById('numeric-input');
    if (!input) return;

    let finalAmount;
    if (isNaN(amount)) { // For "Exact" button
        const total = validateNumericInput(document.getElementById('dialog-total-amount').textContent, 0);
        const paidSoFar = paymentMethods.reduce((sum, pm) => sum + pm.amount, 0);
        finalAmount = Math.max(0, total - paidSoFar);
    } else {
        finalAmount = validateNumericInput(amount, 0);
    }

    input.value = finalAmount.toFixed(2);
    paymentAmount = finalAmount;
    updateChange();
}

function applyDiscount(percentage) {
    if (typeof percentage !== 'number' || percentage < 0) {
        console.error("Invalid discount percentage provided.");
        return;
    }

    discount = percentage;
    discountCodeApplied = null;

    updateTotal();
    document.getElementById('dialog-total-amount').textContent = calculateTotal().toFixed(2);
    updateChange();
    notifications.show(`${percentage}% discount applied to eligible items.`, 'success');
    
    const discountCodeEl = document.getElementById('discount-code');
    if(discountCodeEl) discountCodeEl.value = '';
}

function applyDiscountCode() {
    const codeInput = document.getElementById('discount-code');
    if (!codeInput) return;

    const code = codeInput.value.trim().toUpperCase();
    if (!code) {
        notifications.show('Please enter a discount code.', 'warning');
        return;
    }

    if (code.length > 20) {
        notifications.show('Discount code too long', 'warning');
        return;
    }

    if (discountCodes[code]) {
        const percentage = discountCodes[code];
        discount = percentage;
        discountCodeApplied = code;

        updateTotal();
        document.getElementById('dialog-total-amount').textContent = calculateTotal().toFixed(2);
        updateChange();

        notifications.show(`Discount code "${code}" applied for ${percentage}%.`, 'success');
    } else {
        notifications.show('Invalid discount code.', 'error');
        discountCodeApplied = null;
    }
}

async function clearDiscount() {
    if (discount === 0 && !discountCodeApplied) {
        notifications.show('No discount has been applied.', 'info');
        return;
    }

    const confirmed = await showConfirmModal('Confirm Action', 'Are you sure you want to remove the current discount?');
    if (!confirmed) {
        return;
    }
    
    discount = 0;
    discountCodeApplied = null;

    renderOrderItems();
    updateTotal();
    document.getElementById('dialog-total-amount').textContent = calculateTotal().toFixed(2);
    updateChange();
    notifications.show('Discount has been cleared.', 'success');
}

function processPayment(method) {
    const total = calculateTotal();
    const paidSoFar = paymentMethods.reduce((sum, pm) => sum + pm.amount, 0);
    const remainingDue = Math.max(0, total - paidSoFar);

    if (total <= 0.01 && paymentAmount === 0) {
        notifications.show('Zero total order. Completing payment directly.', 'info');
        completePayment();
        return;
    }
    
    if (remainingDue <= 0.01 && paymentAmount === 0) {
        notifications.show('The bill is already fully paid. Click "Complete Payment".', 'info');
        return;
    }

    if (paymentAmount <= 0) {
        notifications.show('Please enter a valid payment amount.', 'warning');
        return;
    }
    
    if (method === 'Mobile' && paymentAmount > remainingDue) {
        notifications.show(`Mobile payment cannot exceed the remaining due amount of Rs ${remainingDue.toFixed(2)}`, 'error');
        return;
    }

    paymentMethods.push({ method, amount: paymentAmount });
    renderPaymentMethods();
    paymentAmount = 0;
    document.getElementById('numeric-input').value = '0';
    updateChange();

    if (method === 'Mobile') {
        displayQRCode();
    } else if (method === 'Cash') {
        closeQRCodeDialog(); // Always close QR for cash
    }
}

function renderPaymentMethods() {
    const paymentList = document.getElementById('payment-methods');
    if (!paymentList) {
        console.error("Error: Payment list element not found!");
        return;
    }

    paymentList.innerHTML = paymentMethods.map((pm, index) => `
        <li>
            ${pm.method}: Rs ${pm.amount.toFixed(2)}
            <button class="remove-payment-btn" data-index="${index}">Remove</button>
        </li>
    `).join('');

    document.querySelectorAll('.remove-payment-btn').forEach(button => {
        button.addEventListener('click', () => {
            const index = parseInt(button.dataset.index);
            removePayment(index);
        });
        button.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const index = parseInt(button.dataset.index);
            removePayment(index);
        });
    });

    const hasMobilePayment = paymentMethods.some(pm => pm.method === 'Mobile');
    if (hasMobilePayment) {
        displayQRCode();
    } else {
        closeQRCodeDialog();
    }
}

function removePayment(index) {
    if (index < 0 || index >= paymentMethods.length) {
        console.error("Invalid payment method index:", index);
        return;
    }
    
    paymentMethods.splice(index, 1);
    renderPaymentMethods();
    updateChange(); // Recalculates remaining due, change amount, and button states
}

function updateChange() {
    const total = calculateTotal();
    const paidSoFar = paymentMethods.reduce((sum, pm) => sum + pm.amount, 0);
    const pendingPayment = validateNumericInput(paymentAmount, 0);
    const totalPaidIncludingInput = paidSoFar + pendingPayment;

    const remainingDue = Math.max(0, total - paidSoFar);
    const remainingDueAfterInput = Math.max(0, total - totalPaidIncludingInput);
    const changeAmount = Math.max(0, totalPaidIncludingInput - total);
    
    const remainingDueEl = document.getElementById('remaining-due');
    const changeAmountEl = document.getElementById('change-amount');
    const completeBtn = document.getElementById('complete-btn');
    const insufficientMsgEl = document.getElementById('insufficient-message');

    if (remainingDueEl) remainingDueEl.textContent = `Rs ${remainingDueAfterInput.toFixed(2)}`;
    if (changeAmountEl) changeAmountEl.textContent = `Rs ${changeAmount.toFixed(2)}`;
    
    if (completeBtn) {
        // Enable complete button when the current payment input covers the remaining due
        completeBtn.disabled = total > 0.01 && remainingDueAfterInput > 0.01;
    }
    
    if (insufficientMsgEl) {
        if (remainingDueAfterInput > 0.01 && total > 0.01) {
            insufficientMsgEl.textContent = `Payment is insufficient.`;
            insufficientMsgEl.style.display = 'block';
        } else {
            insufficientMsgEl.style.display = 'none';
        }
    }
}

function calculateTotal() {
    if (!orders[currentTable] || !Array.isArray(orders[currentTable])) return 0;

    let discountableTotal = 0;
    let nonDiscountableTotal = 0;

    orders[currentTable].forEach(item => {
        const extrasTotal = (item.extras && Array.isArray(item.extras))
            ? item.extras.reduce((s, e) => s + e.price, 0)
            : 0;
        const itemTotal = (item.price + extrasTotal) * item.quantity;

        // Finalized items (sent to kitchen/bar) are still subject to discounts
        // They just cannot be modified (quantity changes, removals, etc.)
        const isDiscountable = item.discountable !== false;

        if (isDiscountable) {
            discountableTotal += itemTotal;
        } else {
            nonDiscountableTotal += itemTotal;
        }
    });

    const validDiscount = (typeof discount === 'number' && discount >= 0) ? discount : 0;
    const discountedTotal = discountableTotal * (1 - validDiscount / 100);

    return discountedTotal + nonDiscountableTotal;
}

function calculateOriginalTotal() {
    if (!currentTable || !orders[currentTable] || !Array.isArray(orders[currentTable])) return 0;

    return orders[currentTable].reduce((sum, item) => {
        const extrasTotal = (item.extras && Array.isArray(item.extras))
            ? item.extras.reduce((s, e) => s + e.price, 0)
            : 0;
        return sum + ((item.price + extrasTotal) * (item.quantity || 1));
    }, 0);
}

function displayQRCode() {
    const qrCodeImage = document.getElementById('qr-code-image');
    const qrCodeDialog = document.getElementById('qr-code-dialog');

    if (!qrCodeImage || !qrCodeDialog) {
        console.error("Error: QR code elements not found!");
        return;
    }

    qrCodeImage.src = './images/qr.jpeg';
    qrCodeDialog.style.display = 'flex';
}

function closeQRCodeDialog() {
    const qrCodeDialog = document.getElementById('qr-code-dialog');
    if (qrCodeDialog) {
        qrCodeDialog.style.display = 'none';
    } else {
        console.error('QR code dialog element not found');
    }
}

async function completePayment() {
    if (isProcessingPayment) return;
    isProcessingPayment = true;
    try {
        const total = calculateTotal();
        const itemCount = orders[currentTable]?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0;
        if (total > 5000 || itemCount > 12) {
            const confirmed = confirm(`Large checkout detected: Rs ${total.toFixed(2)} for ${itemCount} item(s). Proceed?`);
            if (!confirmed) {
                isProcessingPayment = false;
                return;
            }
        }

        if (paymentAmount > 0) {
            paymentMethods.push({ method: 'Cash', amount: paymentAmount });
            paymentAmount = 0;
            document.getElementById('numeric-input').value = '0';
            renderPaymentMethods();
        }

        if (!currentTable || !orders[currentTable] || !orders[currentTable].length) {
            notifications.show("No order to complete!", 'warning');
            isProcessingPayment = false;
            return;
        }
        const paidSoFar = paymentMethods.reduce((sum, pm) => sum + pm.amount, 0);
        if (paidSoFar < total - 0.01 && total > 0.01) {
            notifications.show("Payment amount is insufficient!", 'error');
            paymentMethods.pop();
            renderPaymentMethods();
            isProcessingPayment = false;
            return;
        }

        showLoadingSpinner();

    const orderId = generateOrderId();
    const sale = {
        orderNumber: orderId,
        table: currentTable,
        items: JSON.parse(JSON.stringify(orders[currentTable])),
        total,
        paymentMethods: JSON.parse(JSON.stringify(paymentMethods)),
        discount: discountCodeApplied || (discount ? `${discount}%` : 'None'),
        discountAmount: (calculateOriginalTotal() - total).toFixed(2),
        timestamp: new Date().toISOString(),
        user: currentUser?.email || 'Guest',
        status: 'completed',
        change: Math.max(0, paidSoFar - total),
        orderType: 'dine-in'
    };

    salesHistory.push(sale);
    orderHistory.push(sale);
    
    // Update itemsSold for items sold report
    sale.items.forEach(item => {
        const itemTotal = (item.price + (item.extras?.reduce((s, e) => s + e.price, 0) || 0)) * item.quantity;
        // Find existing item entry in itemsSold or create new one
        let existingItemEntry = itemsSold.find(entry => entry.name === item.name);
        if (existingItemEntry) {
            existingItemEntry.quantity += item.quantity;
            existingItemEntry.totalRevenue += itemTotal;
        } else {
            itemsSold.push({
                name: item.name,
                quantity: item.quantity,
                totalRevenue: itemTotal,
                timestamp: sale.timestamp // Add timestamp for filtering in items sold report
            });
        }
    });

    delete orders[currentTable];
    if (tableTimers[currentTable]) delete tableTimers[currentTable];
    currentTable = null;
    const selectedTableEl = document.getElementById('selected-table');
    const selectedTableCheckoutEl = document.getElementById('selected-table-checkout');
    if (selectedTableEl) selectedTableEl.textContent = '-';
    if (selectedTableCheckoutEl) selectedTableCheckoutEl.textContent = '-';

    persistAllData();
    renderOrderItems();
    initializeTables();
    
    closeCheckoutDialog();
    notifications.show('Thank you!', 'success');
    speakText('Thank you!');
    return sale;
    } catch (error) {
        console.error('Payment completion failed:', error);
        notifications.show('Unable to process payment. Please try again.', 'error');
    } finally {
        hideLoadingSpinner();
        isProcessingPayment = false;
    }
}

function updateTotal() {
    const totalEl = document.getElementById('total-amount');
    if (totalEl) totalEl.textContent = calculateTotal().toFixed(2);
}

// =========================================================================
// =================== ORDER ACTIONS =======================================
// =========================================================================

function generateKOTNumber() {
    return `KOT-${Date.now()}`;
}

async function finalizeOrder() {
    try {
        if (!currentTable || !orders[currentTable]?.length) {
            notifications.show('No order to finalize!', 'warning');
            return;
        }

        const itemsToFinalize = orders[currentTable].filter(item => !item.finalized);
    if (itemsToFinalize.length === 0) {
        notifications.show('No new items to send.', 'info');
        return;
    }

    showLoadingSpinner();
    const kotNumberBase = `KOT-${Date.now()}`;

    const kitchenItems = itemsToFinalize.filter(item => item.section === 'Kitchen');
    const barItems = itemsToFinalize.filter(item => item.section === 'Bar');

    if (kitchenItems.length > 0) {
        const kitchenKotId = `${kotNumberBase}-KITCHEN`;
        kotHistory.push({
            kotId: kitchenKotId,
            table: currentTable,
            items: kitchenItems.map(item => ({ ...item, isReady: false })),
            timestamp: new Date().toISOString(),
            status: 'pending',
            type: 'kitchen',
            kotNumber: kotNumberBase // Add base KOT number for linking
        });
    }

    if (barItems.length > 0) {
        const barKotId = `${kotNumberBase}-BAR`;
        kotHistory.push({
            kotId: barKotId,
            table: currentTable,
            items: barItems.map(item => ({ ...item, isReady: false })),
            timestamp: new Date().toISOString(),
            status: 'pending',
            type: 'bar',
            kotNumber: kotNumberBase // Add base KOT number for linking
        });
    }
    
    orders[currentTable].forEach(item => {
        if (!item.finalized) {
            item.finalized = true;
            item.kotNumber = kotNumberBase;
        }
    });

    persistAllData();
    renderOrderItems();
    notifications.show(`KOT ${kotNumberBase} sent successfully.`, 'success');
    hideLoadingSpinner();
    } catch (error) {
        handleCriticalError('Finalizing order', error);
        hideLoadingSpinner();
    }
}

function printKOT(kotItems, type) {
    const kotHTML = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>KOT - ${type.toUpperCase()}</title>
            <style>
                body { font-family: monospace; font-size: 12px; margin: 20px; }
                .header { text-align: center; margin-bottom: 20px; }
                .item { margin: 5px 0; }
                .total { border-top: 1px solid #000; margin-top: 10px; padding-top: 5px; }
            </style>
        </head>
        <body>
            <div class="header">
                <h2>KITCHEN ORDER TICKET</h2>
                <p>Table: ${currentTable} | Type: ${type.toUpperCase()}</p>
                <p>Time: ${new Date().toLocaleTimeString()}</p>
            </div>
            <div class="items">
                ${kotItems.map(item => `
                    <div class="item">
                        <strong>${item.name}</strong> x${item.quantity}
                        ${item.extras?.length ? '<br/>Extras: ' + item.extras.map(e => e.name).join(', ') : ''}
                    </div>
                `).join('')}
            </div>
            <div class="total">
                <strong>Total Items: ${kotItems.reduce((sum, item) => sum + item.quantity, 0)}</strong>
            </div>
        </body>
        </html>
    `;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.visibility = 'hidden';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentWindow?.document;
    if (!iframeDoc) {
        console.error('Unable to create hidden print frame for KOT.');
        document.body.removeChild(iframe);
        return;
    }

    iframeDoc.open();
    iframeDoc.write(kotHTML);
    iframeDoc.close();
    iframe.contentWindow.focus();

    try {
        iframe.contentWindow.print();
    } catch (error) {
        console.warn('KOT print dialog could not be opened:', error);
    }

    setTimeout(() => {
        if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
        }
    }, 1000);
}

async function changeTable() {
    if (!currentTable || !orders[currentTable]?.length) {
        notifications.show("No order to move!", 'warning');
        return;
    }

    const newTable = await showPromptModal('Change Table', `Move order from Table ${currentTable} to which table?`);
    if (!newTable || newTable === currentTable || !tableList.includes(newTable)) {
        notifications.show('Invalid or cancelled table change.', 'warning');
        return;
    }

    if (orders[newTable] && orders[newTable].length > 0) {
        notifications.show(`Table ${newTable} is already occupied. Please checkout or void the existing order first.`, 'error');
        return;
    }

    showLoadingSpinner();
    const oldTable = currentTable;

    const itemsToMove = [...orders[oldTable]];
    // Auto-finalize all items when changing tables
    itemsToMove.forEach(item => item.finalized = true);
    const timerToMove = tableTimers[oldTable] ? { ...tableTimers[oldTable] } : null;

    orders[newTable] = itemsToMove;
    if (timerToMove) {
        tableTimers[newTable] = timerToMove;
    }
    // Reset timer for new table
    tableTimers[newTable] = {
        start: Date.now(),
        elapsed: 0,
        lastUpdated: Date.now()
    };
    delete orders[oldTable];
    delete tableTimers[oldTable];
    currentTable = newTable;

    persistAllData();
    document.getElementById('selected-table').textContent = currentTable;
    document.getElementById('selected-table-checkout').textContent = currentTable;
    renderOrderItems();
    initializeTables();
    notifications.show(`Order moved successfully from Table ${oldTable} to ${newTable}.`, 'success');
    hideLoadingSpinner();
}

async function voidItem(index) {
    if (!orders[currentTable]?.[index]) {
        notifications.show('Invalid item to void.', 'error');
        return;
    }

    const reason = await showPromptModal('Void Item', 'Enter reason for voiding this item:');
    if (!reason) {
        notifications.show('Void reason is required.', 'warning');
        return;
    }

    showLoadingSpinner();
    
    const itemToVoid = { ...orders[currentTable][index] };
    const voidId = `void_${Date.now()}`;
    const timestamp = new Date().toISOString();
    const voidEntry = {
        voidId,
        table: currentTable,
        item: itemToVoid,
        total: (itemToVoid.price + (itemToVoid.extras?.reduce((s, e) => s + e.price, 0) || 0)) * itemToVoid.quantity,
        reason,
        user: currentUser?.email || 'Guest',
        timestamp: timestamp
    };
    
    voidDetails.push(voidEntry);
    orders[currentTable].splice(index, 1);
    
    const isOrderEmpty = orders[currentTable].length === 0;
    if (isOrderEmpty) {
        delete orders[currentTable];
    }
    
    persistAllData();
    renderOrderItems();
    initializeTables();
    notifications.show(`${itemToVoid.name} has been voided.`, 'success');
    hideLoadingSpinner();
}

async function voidOrder() {
    if (!currentTable || !orders[currentTable]?.length) {
        notifications.show('No order to void!', 'warning');
        return;
    }

    const reason = await showPromptModal('Void Entire Order', 'Enter reason for voiding this entire order:');
    if (!reason) {
        notifications.show('Void reason is required.', 'warning');
        return;
    }

    showLoadingSpinner();
    const tableToVoid = currentTable;
    const orderToVoid = { ...orders[tableToVoid] }; // Make a copy for logging

    const kotNumbersInOrder = [...new Set(
        orders[tableToVoid]
            .filter(item => item.finalized && item.kotNumber)
            .map(item => item.kotNumber)
    )];

    const voidId = `void_${Date.now()}`;
    const timestamp = new Date().toISOString();

    voidDetails.push({
        voidId,
        table: tableToVoid,
        items: orders[tableToVoid],
        total: calculateTotal(),
        reason,
        user: currentUser?.email || 'Guest',
        timestamp: timestamp
    });

    // Remove KOT entries associated with this order
    kotHistory = kotHistory.filter(kot => !kotNumbersInOrder.includes(kot.kotNumber));

    delete orders[tableToVoid];
    delete tableTimers[tableToVoid];
    currentTable = null;

    persistAllData();
    renderOrderItems();
    initializeTables();
    document.getElementById('selected-table').textContent = '-';
    notifications.show(`Order for Table ${tableToVoid} has been voided.`, 'success');
    hideLoadingSpinner();
}

async function voidOrderFromHistory(orderToVoid) {
    if (!orderToVoid) {
        notifications.show('Cannot void: Invalid order data.', 'error');
        return;
    }

    const reason = await showPromptModal('Void Historical Order', `Enter reason for voiding order #${orderToVoid.orderNumber}:`);
    if (!reason) {
        notifications.show('Void reason is required.', 'warning');
        return;
    }

    showLoadingSpinner();

    const voidId = `void_${Date.now()}`;
    const timestamp = new Date().toISOString();

    const orderIndexInHistory = orderHistory.findIndex(o => o.orderNumber === orderToVoid.orderNumber);
    const saleIndexInHistory = salesHistory.findIndex(s => s.orderNumber === orderToVoid.orderNumber);

    if (orderIndexInHistory === -1) {
        notifications.show('Order not found in history. Cannot void.', 'error');
        hideLoadingSpinner();
        return;
    }
    
    const voidEntry = {
        voidId,
        table: orderToVoid.table,
        items: orderToVoid.items,
        total: orderToVoid.total,
        reason: reason,
        user: currentUser?.email || 'Guest',
        timestamp: timestamp,
        originalOrderNumber: orderToVoid.orderNumber
    };
    
    orderHistory[orderIndexInHistory].status = 'voided';
    if (saleIndexInHistory !== -1) {
         salesHistory[saleIndexInHistory].status = 'voided';
    }
    voidDetails.push(voidEntry);

    persistAllData();
    renderOrderHistory(currentPage);
    notifications.show(`Order #${orderToVoid.orderNumber} has been voided.`, 'success');
    hideLoadingSpinner();
}

// =========================================================================
// =================== RECEIPT & PRINTING ==================================
// =========================================================================

function printReceipt() {
    if (!currentTable || !orders[currentTable]?.length) {
        notifications.show('No order to print!', 'warning');
        return;
    }
    
    const orderForPrinting = {
        orderNumber: `PREVIEW-${Date.now()}`,
        table: currentTable,
        items: orders[currentTable],
        total: calculateTotal(),
        discountAmount: (calculateOriginalTotal() - calculateTotal()),
        timestamp: new Date().toISOString(),
        user: currentUser?.email || 'Guest',
        paymentMethods: [],
        change: 0
    };

    generateReceipt(orderForPrinting);
}

function generateReceipt(order) {
    if (!order || typeof order.total !== 'number') {
        notifications.show('Error: Invalid data for receipt generation.', 'error');
        console.error("Invalid order object passed to generateReceipt:", order);
        return;
    }

    const SERVICE_CHARGE_PERCENT = 0;
    const VAT_PERCENT = 0;
    const RESTAURANT_PAN= "600XXXXXX";

    try {
        const timestamp = order.timestamp ? new Date(order.timestamp) : new Date();

        const subtotal = order.items.reduce((sum, item) => {
             const extrasTotal = (item.extras || []).reduce((s, e) => s + (e.price || 0), 0);
             return sum + (item.price + extrasTotal) * item.quantity;
        }, 0);
        
        const discountAmount = parseFloat(order.discountAmount) || 0;
        const subtotalAfterDiscount = subtotal - discountAmount;
        const serviceChargeAmount = subtotalAfterDiscount * (SERVICE_CHARGE_PERCENT / 100);
        const taxableAmount = subtotalAfterDiscount + serviceChargeAmount;
        const vatAmount = taxableAmount * (VAT_PERCENT / 100);
        const grandTotal = taxableAmount + vatAmount;

        const receiptCSS = `
            <style>
                @page { margin: 4mm; }
                body {
                    font-family: 'ui-sans-serif', system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif;
                    margin: 0;
                    padding: 0;
                    background-color: #fff;
                    color: #000;
                    font-size: 13px;
                    line-height: 1.5;
                }
                .receipt-container {
                    width: 284px; /* Strict width for 80mm paper */
                    margin: 0 auto;
                }
                .text-center { text-align: center; }
                .text-right { text-align: right; }
                .font-bold { font-weight: bold; }

                .header-section img {
                    width: 60px;
                    margin-bottom: 2px;
                }
                .header-section h1 {
                    margin: 0;
                    font-size: 20px;
                }
                .header-section p {
                    margin: 2px 0;
                    font-size: 11px;
                }

                .info-line {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 3px;
                }
                
                .dashed-line {
                    border-top: 1px dashed #000;
                    margin: 12px 0;
                }

                .items-table {
                    width: 100%;
                    table-layout: fixed;
                    border-collapse: collapse;
                }
                .items-table thead th {
                    font-size: 12px;
                    border-bottom: 1px solid #000;
                    padding-bottom: 5px;
                    text-align: left;
                }
                .items-table tbody td {
                    padding: 6px 0;
                    vertical-align: top;
                }
                
                .items-table .col-item {
                    width: 52%;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .items-table .col-qty { width: 18%; text-align: center; }
                .items-table .col-price { width: 30%; text-align: right; }
                
                .item-extras, .item-notes {
                    font-size: 11px;
                    color: #333;
                    padding-left: 10px;
                    white-space: normal;
                }

                .summary-section .summary-line {
                    display: flex;
                    justify-content: space-between;
                    padding: 2px 0;
                }
                .summary-section .grand-total {
                    font-size: 18px;
                    font-weight: bold;
                    margin-top: 5px;
                    padding-top: 5px;
                    border-top: 1px solid #000;
                }
                
                .footer-section {
                    margin-top: 15px;
                }

                @media print {
                    body { font-family: 'monospace'; font-size: 10pt; }
                    .print-button { display: none; }
                }
            </style>
        `;

        const itemsHTML = order.items.map(item => {
            const extrasTotal = (item.extras || []).reduce((sum, e) => sum + (e.price || 0), 0);
            const itemTotal = (item.price + extrasTotal) * item.quantity;
            let itemRow = `
                <tr>
                    <td class="col-item" title="${item.name}">${item.name}</td>
                    <td class="col-qty">${item.quantity}</td>
                    <td class="col-price">${itemTotal.toFixed(2)}</td>
                </tr>`;

            if (item.extras && item.extras.length > 0) {
                itemRow += `<tr><td colspan="3" class="item-extras">+ ${item.extras.map(e => e.name).join(', ')}</td></tr>`;
            }
            if (item.notes) {
                itemRow += `<tr><td colspan="3" class="item-notes"><i>Note: ${item.notes}</i></td></tr>`;
            }
            return itemRow;
        }).join('');
        
        const receiptHTML = `
            <div class="receipt-container">
                <div class="header-section text-center">
                    <img src="./images/logo-print.png" alt="Logo" onerror="handleImageError(this)">
                    <h1>Taboche Restaurant</h1>
                    <p>Bhaktapur, Nepal</p>
                    <p>PAN: ${RESTAURANT_PAN}</p>
                </div>

                <div class="dashed-line"></div>
                
                <div class="info-section">
                    <div class="info-line"><span>Bill No:</span><span>${order.orderNumber || 'N/A'}</span></div>
                    <div class="info-line"><span>Table:</span><span>${order.table || 'N/A'}</span></div>
                    <div class="info-line"><span>Date:</span><span>${timestamp.toLocaleString()}</span></div>
                    ${order.user ? `<div class="info-line"><span>Server:</span><span>${order.user.split('@')[0]}</span></div>` : ''}
                </div>

                <div class="dashed-line"></div>

                <table class="items-table">
                    <thead>
                        <tr>
                            <th class="col-item">Item</th>
                            <th class="col-qty">Qty</th>
                            <th class="col-price">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHTML}
                    </tbody>
                </table>
                
                <div class="dashed-line"></div>
                
                <div class="summary-section">
                    <div class="summary-line"><span>Subtotal</span><span class="text-right">Rs ${subtotal.toFixed(2)}</span></div>
                    ${discountAmount > 0 ? `<div class="summary-line"><span>Discount</span><span class="text-right">-Rs ${discountAmount.toFixed(2)}</span></div>` : ''}
                    <div class="summary-line"><span>Service Charge (${SERVICE_CHARGE_PERCENT}%)</span><span class="text-right">Rs ${serviceChargeAmount.toFixed(2)}</span></div>
                    <div class="summary-line"><span>VAT (${VAT_PERCENT}%)</span><span class="text-right">Rs ${vatAmount.toFixed(2)}</span></div>
                    
                    <div class="summary-line grand-total">
                        <span>GRAND TOTAL</span>
                        <span class="text-right">Rs ${grandTotal.toFixed(2)}</span>
                    </div>
                </div>

                ${(order.paymentMethods && order.paymentMethods.length > 0) ? `
                <div class="dashed-line"></div>
                <div class="payment-section summary-section">
                    ${(order.paymentMethods || []).map(pm => `<div class="summary-line"><span>Paid (${pm.method})</span><span class="text-right">Rs ${pm.amount.toFixed(2)}</span></div>`).join('')}
                    ${order.change > 0 ? `<div class="summary-line font-bold"><span>Change</span><span class="text-right">Rs ${order.change.toFixed(2)}</span></div>` : ''}
                </div>
                ` : ''}

                <div class="dashed-line"></div>

                <div class="footer-section text-center">
                    <p>Thank you for your visit!</p>
                    <p>Find us on social media @Taboche</p>
                </div>
            </div>
            <div style="text-align:center; margin-top: 20px;">
                 <button class="print-button" onclick="window.print()" style="padding: 10px 20px; font-size: 16px; cursor: pointer;">Print Receipt</button>
            </div>
        `;

        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(`
                <!DOCTYPE html>
                <html>
                    <head><title>Bill - ${order.orderNumber || ''}</title>${receiptCSS}</head>
                    <body>${receiptHTML}</body>
                </html>
            `);
            printWindow.document.close();
            printWindow.addEventListener('load', () => {
                printWindow.focus();
                printWindow.print();
            });
        } else {
            notifications.show('Print window blocked. Please enable pop-ups.', 'error');
        }

    } catch (error) {
        console.error('Error generating professional receipt:', error);
        notifications.show('Failed to generate professional receipt. Check console for details.', 'error');
    }
}

// NEW: Reset All Data Function
async function resetAllDataConfirmed() {
    const confirmed = await showConfirmModal(
        'Reset All Data',
        '<p><strong>Are you absolutely sure you want to reset ALL data?</strong></p><p>This will permanently delete all orders, sales history, void details, and KOT history from this device\'s local storage.</p><p>This action cannot be undone!</p>'
    );

    if (confirmed) {
        showLoadingSpinner();
        try {
            localStorage.clear();
            // Re-initialize all global state variables to their default empty states
            currentTable = null;
            orders = {};
            tableTimers = {};
            salesHistory = [];
            orderHistory = [];
            voidDetails = [];
            kotHistory = [];
            itemsSold = [];
            removedItems = []; // Not used, but reset for completeness

            // Reset menu navigation state
            currentMenuLevel = 'topLevelSections'; // Changed initial level
            activeSection = null; // Clear active section
            activeCategoryDisplayGroup = null;

            // Update UI
            initializeTables();
            renderOrderItems();
            document.getElementById('selected-table').textContent = '-';
            updateTotal();
            renderMenuNavigation(); // Re-render menu to initial state
            notifications.show('All local data has been reset successfully!', 'success', 5000);
            closeSidebarContentModal();
        } catch (error) {
            console.error('Error resetting all data:', error);
            notifications.show('Failed to reset data. Please try again or check console.', 'error');
        } finally {
            hideLoadingSpinner();
        }
    }
}


// =========================================================================
// =================== INITIALIZATION & EVENT LISTENERS ====================
// =========================================================================

document.addEventListener("DOMContentLoaded", () => {
    // Load all data from localStorage on startup
    loadFromLocalStorage();
    loadLargeStateFromIndexedDB().then(() => {
        trimHistoryIfNeeded();
        renderOrderItems();
        initializeTables();
        renderOrderHistory();
        renderVoidDetails();
    }).catch((error) => {
        console.warn('IndexedDB data load skipped:', error);
    });

    // Set up BroadcastChannel for real-time sync across tabs
    const channel = new BroadcastChannel('pos-sync');
    channel.onmessage = (event) => {
        if (event.data === 'data-changed') {
            loadFromLocalStorage();
            renderOrderItems();
            updateTotal();
            initializeTables();
            renderOrderHistory();
            renderVoidDetails();
        }
    };

    // Listen for changes in localStorage from other tabs/windows
    window.addEventListener('storage', (e) => {
        if (e.key === 'orders' || e.key === 'tableTimers' || e.key === 'salesHistory' || e.key === 'orderHistory' || e.key === 'voidDetails' || e.key === 'kotHistory' || e.key === 'itemsSold') {
            loadFromLocalStorage();
            renderOrderItems();
            updateTotal();
            initializeTables();
            renderOrderHistory();
            renderVoidDetails();
        }
    });

    // Set up basic UI elements and intervals
    updateDateTime();
    setInterval(updateDateTime, 1000);
    setInterval(updateTableTimers, 1000);

    // Service Worker registration (only on web servers, not file://)
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
        navigator.serviceWorker.register('./sw.js')
            .then(registration => {
                console.log('Service Worker registered with scope:', registration.scope);

                // Check for updates
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    console.log('New service worker installing...');

                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            // New version available, notify user
                            notifications.show('New version available! Refresh to update.', 'info', 10000);
                        }
                    });
                });
            })
            .catch(error => {
                console.error('Service Worker registration failed:', error);
                if (location.protocol === 'file:') {
                    console.log('Service Worker not available in local file mode. Deploy to a web server for offline functionality.');
                } else {
                    notifications.show('Service worker unavailable. Some offline features may not work.', 'warning');
                }
            });

        // Handle controller changes
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (refreshing) return;
            refreshing = true;
            window.location.reload();
        });
    } else if (location.protocol === 'file:') {
        console.log('Running in local file mode. Service Worker and PWA features are disabled. Deploy to a web server for full functionality.');
    }

    initializeTables();
    renderMenuNavigation(); // Initial render of menu categories/items
    updateTotal(); // Calculate initial total
    
    // Header Buttons
    document.getElementById("hamburger-menu")?.addEventListener("click", toggleSidebar);
    document.getElementById("close-sidebar")?.addEventListener("click", toggleSidebar);
    document.getElementById("theme-toggle")?.addEventListener("click", toggleTheme);

    // NEW: Back button for menu navigation
    document.getElementById("back-button")?.addEventListener("click", navigateBackMenu);

    // Footer Buttons
    document.getElementById("finalize-btn")?.addEventListener("click", finalizeOrder);
    document.getElementById("checkout-btn")?.addEventListener("click", showCheckoutDialog);
    document.getElementById("change-table-btn")?.addEventListener("click", changeTable);
    document.getElementById("void-btn")?.addEventListener("click", voidOrder);
    document.getElementById("print-receipt-btn")?.addEventListener("click", printReceipt);

    // Sidebar Navigation
    document.getElementById("nav-sales-reports")?.addEventListener("click", showSalesReportsContent);
    document.getElementById("nav-items-sold")?.addEventListener("click", showItemsSoldContent);
    document.getElementById("nav-order-history")?.addEventListener("click", showOrderHistoryContent);
    document.getElementById("nav-void-details")?.addEventListener("click", showVoidDetailsContent);
    document.getElementById("nav-backup-data")?.addEventListener("click", (e) => {
        e.preventDefault();
        backupData();
    });
    document.getElementById("nav-restore-data")?.addEventListener("click", (e) => {
        e.preventDefault();
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => restoreData(e.target.files[0]);
        input.click();
    });
    document.getElementById("nav-storage-manager")?.addEventListener("click", (e) => {
        e.preventDefault();
        showQuickBackup();
    });
    document.getElementById("nav-reset-data")?.addEventListener("click", resetAllDataConfirmed); 

    // Checkout Dialog Listeners
    document.getElementById('close-checkout-dialog')?.addEventListener('click', closeCheckoutDialog);
    document.getElementById('clear-input')?.addEventListener('click', clearInput);
    document.getElementById('apply-discount-code')?.addEventListener('click', applyDiscountCode);
    document.getElementById('clear-discount')?.addEventListener('click', clearDiscount);
    document.getElementById('cash-btn')?.addEventListener('click', () => processPayment("Cash"));
    document.getElementById('mobile-btn')?.addEventListener('click', () => processPayment("Mobile"));
    document.getElementById('complete-btn')?.addEventListener('click', completePayment);

    // Keypad and Quick Amounts
    document.querySelectorAll('#keypad button[data-num]').forEach(button => {
        button.addEventListener('click', () => appendNumber(button.dataset.num));
    });
    document.querySelectorAll('#quick-amounts button[data-amount]').forEach(button => {
        button.addEventListener('click', () => setQuickAmount(parseFloat(button.dataset.amount)));
    });
    document.querySelectorAll('#discount-section button[data-discount]').forEach(button => {
        button.addEventListener('click', () => applyDiscount(parseInt(button.dataset.discount)));
    });

    // QR Code Dialog
    document.getElementById('close-qr-code-dialog')?.addEventListener('click', closeQRCodeDialog);

    // Search input debounce
    const searchInput = document.getElementById('search');
    if (searchInput) {
        let searchTimeout;
        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                searchMenu();
            }, 300);
        });
    }

    // Add click sound feedback for buttons and interactive items
    document.body.addEventListener('click', (event) => {
        const menuItem = event.target.closest('.menu-item');
        if (menuItem) {
            playSoundPreset('pling');
            return;
        }

        const button = event.target.closest('button');
        if (!button) return;

        if (button.classList.contains('view-receipt-btn') || button.classList.contains('reprint-btn')) {
            const orderNumber = button.dataset.orderNumber;
            const order = orderHistory.find(o => o.orderNumber === orderNumber);
            if (order) {
                generateReceipt(order);
            } else {
                notifications.show('Order not found.', 'error');
            }
        }

        if (button.classList.contains('void-order-btn')) {
            const orderNumber = button.dataset.orderNumber;
            const order = orderHistory.find(o => o.orderNumber === orderNumber);
            if (order) {
                voidOrderFromHistory(order);
            } else {
                notifications.show('Order not found.', 'error');
            }
        }

        playButtonClickSound(button);
    });

    // Initialize theme
    loadTheme();
    initAudio();
    updateNetworkStatusIndicator();

    window.addEventListener('online', () => {
        updateNetworkStatusIndicator();
        notifications.show('Back online', 'success');
    });
    window.addEventListener('offline', () => {
        updateNetworkStatusIndicator();
        notifications.show('Offline mode - data saved locally', 'warning');
    });

    // Initial table selection (optional, auto-select first table if none selected)
    if (!currentTable && tableList.length > 0) {
        selectTable(tableList[0]);
    }
});

// Global event listener for closing modals/sidebars
document.addEventListener('click', function(e) {
    const customCloseSelectors = '.close-modal, .close-sidebar, .qr-close-btn';
    const customCloseBtn = e.target.closest(customCloseSelectors);

    if (customCloseBtn) {
        e.preventDefault();
        const containerToClose = customCloseBtn.closest('.modal, .sidebar, #qr-code-dialog');
        if (containerToClose) {
            containerToClose.style.display = 'none';
        }
    }
});

function toggleSidebar(e) {
    e?.preventDefault();
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) {
        console.warn("Sidebar element not found.");
        return;
    }
    sidebar.classList.toggle('active');
}

function startBlinking(table) {
    const tableBtn = document.getElementById(`table-btn-${table}`);
    if (tableBtn) {
        tableBtn.classList.add('blinking');
        // Start timer if not already running
        if (!tableTimers[table]) {
            tableTimers[table] = {
                start: Date.now(),
                elapsed: 0,
                lastUpdated: Date.now()
            };
            persistAllData();
        }
    }
}

function stopBlinking(table) {
    const tableBtn = document.getElementById(`table-btn-${table}`);
    if (tableBtn) {
        tableBtn.classList.remove('blinking');
    }
}

// Modified searchMenu to integrate with the new navigation flow
function searchMenu() {
    const searchTerm = document.getElementById('search')?.value.toLowerCase().trim() || '';
    const menu = document.getElementById('menu');
    const categoriesContainer = document.getElementById('categories');
    const backButton = document.getElementById('back-button');
    const menuSectionTitle = document.getElementById('menu-section-title');

    if (!menu || !categoriesContainer || !backButton || !menuSectionTitle) return;

    if (!searchTerm) {
        // If search is cleared, revert to normal menu navigation
        renderMenuNavigation();
        return;
    }

    // When searching, bypass the hierarchy and show all matching items
    categoriesContainer.innerHTML = ''; // Clear category buttons
    backButton.style.display = 'block'; // Show back button
    menuSectionTitle.textContent = `Search Results for "${searchTerm}"`;

    const filteredItems = menuItems.filter(item => item.name.toLowerCase().includes(searchTerm));

    menu.innerHTML = '';
    if (filteredItems.length === 0) {
        menu.innerHTML = '<p class="text-muted text-center py-4">No items match your search.</p>';
        return;
    }

    filteredItems.forEach(item => {
        const div = document.createElement('div');
        div.className = `menu-item`;
        
        div.innerHTML = `
            <img src="${item.image}" alt="${item.name}" loading="lazy">
            <p>${item.name}</p>
            <div class="price">Rs ${item.price.toFixed(2)}</div>
        `;

        div.addEventListener('click', () => addToOrder(item));
        menu.appendChild(div);
    });
}
