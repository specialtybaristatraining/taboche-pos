// =========================================================================
// ===================== POS SYSTEM SCRIPT (In-memory with LocalStorage) ======================
// =========================================================================

// =========================================================================
// ===================== DEBUG GUARD =======================================
// =========================================================================
const DEBUG = (
    location.protocol === 'file:' ||
    location.hostname === 'localhost' ||
    location.hostname === '127.0.0.1' ||
    localStorage.getItem('pos-debug') === '1'
);

// =========================================================================

// NEW: Menu Navigation State
let currentMenuLevel = 'topLevelSections'; // 'topLevelSections', 'itemsOfSection', 'itemsOfCategory'
let activeSection = null; // Stores the top-level section selected (e.g., 'Food')
let activeCategoryDisplayGroup = null; // Stores the category selected (e.g., 'Burger with fries')
let menuNavigationHistory = [];

function pushMenuNavigationState() {
    const searchInput = document.getElementById('search');
    menuNavigationHistory.push({
        level: currentMenuLevel,
        activeSection,
        activeCategoryDisplayGroup,
        searchValue: searchInput?.value || ''
    });
    if (menuNavigationHistory.length > 50) menuNavigationHistory.shift();
}

function restoreMenuNavigationState() {
    const previousState = menuNavigationHistory.pop();
    const searchInput = document.getElementById('search');

    if (!previousState) {
        currentMenuLevel = 'topLevelSections';
        activeSection = null;
        activeCategoryDisplayGroup = null;
        if (searchInput) {
            searchInput.value = '';
        }
        return;
    }

    currentMenuLevel = previousState.level;
    activeSection = previousState.activeSection;
    activeCategoryDisplayGroup = previousState.activeCategoryDisplayGroup;
    if (searchInput) {
        searchInput.value = previousState.searchValue || '';
    }
}

// Local-only staff identity; this is attribution, not authentication.
let currentUser = { email: localStorage.getItem('staffName') || 'Local Staff', role: 'Staff' }; 

const SYNC_DATA_KEYS = ['orders', 'tableTimers', 'salesHistory', 'orderHistory', 'voidDetails', 'kotHistory'];
let externalSyncTimer = null;
let lastExternalSyncSnapshot = null;

function getExternalSyncSnapshot() {
    return SYNC_DATA_KEYS.map(key => `${key}:${localStorage.getItem(key) || ''}`).join('|');
}

function scheduleExternalDataRefresh() {
    if (externalSyncTimer) clearTimeout(externalSyncTimer);
    externalSyncTimer = setTimeout(() => {
        externalSyncTimer = null;

        const snapshot = getExternalSyncSnapshot();
        if (snapshot === lastExternalSyncSnapshot) return;
        lastExternalSyncSnapshot = snapshot;

        const checkoutModal = document.getElementById('checkout-dialog');
        if (isProcessingPayment || checkoutModal?.style.display === 'block') return;

        const previousPendingKotCount = kotHistory.filter(kot => kot.status === 'pending').length;
        loadFromLocalStorage();
        renderOrderItems();
        updateTotal();
        initializeTables();
        if (document.getElementById('order-history-list')) renderOrderHistory();
        renderVoidDetails();

        const currentPendingKotCount = kotHistory.filter(kot => kot.status === 'pending').length;
        if (currentPendingKotCount > previousPendingKotCount) {
            playKitchenAlertSound();
            notifications.show('New Kitchen Order Ticket received!', 'info');
        }

        const modalContentArea = document.getElementById('modal-content-area');
        const sidebarContentModal = document.getElementById('sidebar-content-modal');
        if (sidebarContentModal?.style.display === 'block' && modalContentArea?.querySelector('.kitchen-view')) {
            showKitchenView();
        }
    }, 80);
}

// Hardcoded menu and extras
let menuItems = [
    // ================== FOOD GROUPS ==================
{ name: "Burger with Fries (Chicken)", price: 370, category: "Burger with Fries", section: "Kitchen", type: "food", image: "images/burger_chicken_with_fries.jpg" },
    { name: "Burger with Fries (Buff)", price: 350, category: "Burger with Fries", section: "Kitchen", type: "food", image: "images/burger_chicken_with_fries.jpg" },
    { name: "Burger with Fries (Veg)", price: 295, category: "Burger with Fries", section: "Kitchen", type: "food", image: "images/burger_chicken_with_fries.jpg" },
    { name: "Wrap  (Chicken)", price: 350, category: "Wrap with Fries", section: "Kitchen", type: "food", image: "images/wrap_chicken_with_fries.jpg" },
    { name: "Wrap  (Buff)", price: 330, category: "Wrap with Fries", section: "Kitchen", type: "food", image: "images/wrap_chicken_with_fries.jpg" },
    { name: "Wrap  (Veg)", price: 280, category: "Wrap with Fries", section: "Kitchen", type: "food", image: "images/wrap_chicken_with_fries.jpg" },
    
   { name: "Keema Noodles (Chicken)", price: 300, category: "Keema Noodles", section: "Kitchen", type: "food", image: "images/keema_noodles_chicken.jpg" },
{ name: "Keema Noodles (Buff)", price: 280, category: "Keema Noodles", section: "Kitchen", type: "food", image: "images/keema_noodles_chicken.jpg" },
{ name: "Keema Noodles (Egg)", price: 250, category: "Keema Noodles", section: "Kitchen", type: "food", image: "images/keema_noodles_chicken.jpg" },
{ name: "Keema Noodles (Mushroom)", price: 260, category: "Keema Noodles", section: "Kitchen", type: "food", image: "images/keema_noodles_chicken.jpg" },

{ name: "Chow Mein (Chicken)", price: 280, category: "Chow Mein", section: "Kitchen", type: "food", image: "images/chow_mein_chicken.jpg" },
{ name: "Chow Mein (Veg)", price: 200, category: "Chow Mein", section: "Kitchen", type: "food", image: "images/chow_mein_veg.jpg" },
{ name: "Chow Mein (Buff)", price: 260, category: "Chow Mein", section: "Kitchen", type: "food", image: "images/chow_mein_buff.jpg" },
{ name: "Thukpa (Chicken)", price: 300, category: "Thukpa", section: "Kitchen", type: "food", image: "images/thukpa_chicken.jpg" },
{ name: "Thukpa (Veg)", price: 220, category: "Thukpa", section: "Kitchen", type: "food", image: "images/thukpa_veg.jpg" },
{ name: "Thukpa (Buff)", price: 280, category: "Thukpa", section: "Kitchen", type: "food", image: "images/thukpa_buff.jpg" },

    { name: "Steam Mo:Mo (Chicken)", price: 285, category: "Steam Mo:Mo", section: "Kitchen", type: "food", image: "images/momo_chicken.jpg" },
    { name: "Steam Mo:Mo (Buff)", price: 260, category: "Steam Mo:Mo", section: "Kitchen", type: "food", image: "images/momo_chicken.jpg" },
    { name: "Steam Mo:Mo (Veg)", price: 220, category: "Steam Mo:Mo", section: "Kitchen", type: "food", image: "images/momo_chicken.jpg" },
    
    { name: "Jhol Mo:Mo (Chicken)", price: 320, category: "Jhol Mo:Mo", section: "Kitchen", type: "food", image: "images/jhol_momo_chicken.jpg" },
    { name: "Jhol Mo:Mo (Buff)", price: 285, category: "Jhol Mo:Mo", section: "Kitchen", type: "food", image: "images/jhol_momo_chicken.jpg" },
    { name: "Jhol Mo:Mo (Veg)", price: 250, category: "Jhol Mo:Mo", section: "Kitchen", type: "food", image: "images/jhol_momo_chicken.jpg" },
    { name: "Kothey Mo:Mo (Chicken)", price: 350, category: "Kothey Mo:Mo", section: "Kitchen", type: "food", image: "images/kothey_momo_chicken.jpg" },
{ name: "Kothey Mo:Mo (Buff)", price: 300, category: "Kothey Mo:Mo", section: "Kitchen", type: "food", image: "images/kothey_momo_chicken.jpg" },
{ name: "Kothey Mo:Mo (Veg)", price: 280, category: "Kothey Mo:Mo", section: "Kitchen", type: "food", image: "images/kothey_momo_chicken.jpg" },
    
 { name: "Chilly (Chicken)", price: 360, category: "Chilly", section: "Kitchen", type: "food", image: "images/chilly_chicken.jpg" },
 { name: "Chilly (Chips)", price: 300, category: "Chilly", section: "Kitchen", type: "food", image: "images/chilly_chicken.jpg" },
{ name: "Chilly (Buff)", price: 320, category: "Chilly", section: "Kitchen", type: "food", image: "images/chilly_chicken.jpg" },
{ name: "Chilly Momo (Chicken)", price: 300, category: "Chilly", section: "Kitchen", type: "food", image: "images/chilly_chicken.jpg" },
{ name: "Chilly Momo (Veg)", price: 250, category: "Chilly", section: "Kitchen", type: "food", image: "images/chilly_chicken.jpg" },
{ name: "Chilly Momo (Buff)", price: 280, category: "Chilly", section: "Kitchen", type: "food", image: "images/chilly_chicken.jpg" },
{ name: "C Mo:Mo (Chicken)", price: 320, category: "C Mo:Mo", section: "Kitchen", type: "food", image: "images/momo_chicken.jpg" },
{ name: "C Mo:Mo (Buff)", price: 300, category: "C Mo:Mo", section: "Kitchen", type: "food", image: "images/momo_chicken.jpg" },
{ name: "C Mo:Mo (Veg)", price: 270, category: "C Mo:Mo", section: "Kitchen", type: "food", image: "images/momo_chicken.jpg" },
    
    { name: "Pizza (Cheese)", price: 500, category: "Pizza", section: "Kitchen", type: "food", image: "images/pizza_cheese.jpg" },
    { name: "Pizza (Chicken)", price: 580, category: "Pizza", section: "Kitchen", type: "food", image: "images/pizza_cheese.jpg" },
    { name: "Pizza (Mixed)", price: 650, category: "Pizza", section: "Kitchen", type: "food", image: "images/pizza_cheese.jpg" },
    
    { name: "French Fry", price: 350, category: "French Fry", section: "Kitchen", type: "food", image: "images/french_fry.jpg" },
    { name: "Wings", price: 480, category: "Wings", section: "Kitchen", type: "food", image: "images/wings.jpg" },

    { name: "Fried Rice (Chicken)", price: 360, category: "Fried Rice", section: "Kitchen", type: "food", image: "images/fried_rice_chicken.jpg" },
    { name: "Fried Rice (Buff)", price: 320, category: "Fried Rice", section: "Kitchen", type: "food", image: "images/fried_rice_chicken.jpg" },
    { name: "Fried Rice (Egg)", price: 285, category: "Fried Rice", section: "Kitchen", type: "food", image: "images/fried_rice_chicken.jpg" },
     { name: "Fried Rice (Mixed)", price: 395, category: "Fried Rice", section: "Kitchen", type: "food", image: "images/fried_rice_chicken.jpg" },

    { name: "Sausage (Chicken)", price: 340, category: "Sausage", section: "Kitchen", type: "food", image: "images/sausage_chicken.jpg" },
    { name: "Sausage (Buff)", price: 300, category: "Sausage", section: "Kitchen", type: "food", image: "images/sausage_buff.jpg" },

    // ================== BREAKFAST ITEMS ==================
{ name: "Toast", price: 150, category: "Breakfast", section: "Kitchen", type: "food", image: "images/chi_toasty_salsa.jpg" },
{ name: "Plain Omelette", price: 130, category: "Breakfast", section: "Kitchen", type: "food", image: "images/omelet_plain.jpg" },
{ name: "Boiled Egg", price: 120, category: "Breakfast", section: "Kitchen", type: "food", image: "images/boiled_egg.jpg" },
{ name: "Masala Omelette", price: 140, category: "Breakfast", section: "Kitchen", type: "food", image: "images/masala_omelette.jpg" },
{ name: "Sausage (2pcs)", price: 120, category: "Breakfast", section: "Kitchen", type: "food", image: "images/buff_sausage.jpg" },
{ name: "Veg Sandwich", price: 300, category: "Breakfast", section: "Kitchen", type: "food", image: "images/sandwich_veg.jpg" },
{ name: "Chi Sandwich", price: 350, category: "Breakfast", section: "Kitchen", type: "food", image: "images/chi_toasty_salsa.jpg" },


    { name: "Laping (Noodles)", price: 95, category: "Laping", section: "Kitchen", type: "food", image: "images/laping_noodles.jpg" },
    { name: "Laping (Chips)", price: 120, category: "Laping", section: "Kitchen", type: "food", image: "images/laping_chips.jpg" },
    { name: "Laping (Mix)", price: 140, category: "Laping", section: "Kitchen", type: "food", image: "images/laping_mix.jpg" },

    { name: "Banana Muffin", price: 150, category: "Breakfast", section: "Kitchen", type: "food", image: "images/banana_muffin.jpg" },
    { name: "Brownie Walnut", price: 200, category: "Breakfast", section: "Kitchen", type: "food", image: "images/brownie_walnut.jpg" },
    { name: "Chicken Patty", price: 150, category: "Breakfast", section: "Kitchen", type: "food", image: "images/chicken_pie.jpg" },
    
    { name: "Chocolate Muffin", price: 150, category: "Breakfast", section: "Kitchen", type: "food", image: "images/chocolate_muffin.jpg" },

// ================== DRINK GROUPS (now section "Bar", type "drink") ==================
{ name: "Americano", price: 150, category: "Hot Coffee", section: "Bar", type: "drink", image: "images/americano.jpg" },
{ name: "Espresso", price: 140, category: "Hot Coffee", section: "Bar", type: "drink", image: "images/espresso.jpg" },
{ name: "Lungo", price: 150, category: "Hot Coffee", section: "Bar", type: "drink", image: "images/lungo.jpg" },
{ name: "Latte", price: 190, category: "Hot Coffee", section: "Bar", type: "drink", image: "images/latte.jpg" },
{ name: "Cappuccino", price: 200, category: "Hot Coffee", section: "Bar", type: "drink", image: "images/cappuccino.jpg" },
{ name: "Vanilla Latte", price: 260, category: "Hot Coffee", section: "Bar", type: "drink", image: "images/latte_vanilla.jpg" },
{ name: "Hazelnut Latte", price: 260, category: "Hot Coffee", section: "Bar", type: "drink", image: "images/flavored_latte_hazelnut.jpg" },
{ name: "Caramel Latte", price: 260, category: "Hot Coffee", section: "Bar", type: "drink", image: "images/latte_caramel.jpg" },
{ name: "Spanish Latte", price: 280, category: "Hot Coffee", section: "Bar", type: "drink", image: "images/spanish_latte.jpg" },
{ name: "Hot Chocolate", price: 260, category: "Hot Coffee", section: "Bar", type: "drink", image: "images/hot_chocolate.jpg" },
{ name: "Filter Coffee", price: 280, category: "Hot Coffee", section: "Bar", type: "drink", image: "images/filter_coffee.jpg" },


   // Moved Cold Coffee OUT of "Cold Drinks" section to be a top-level category
{ name: "Iced Latte", price: 220, category: "Cold Coffee", section: "Bar", type: "drink", image: "images/iced_latte.jpg" },
{ name: "Iced Americano", price: 200, category: "Cold Coffee", section: "Bar", type: "drink", image: "images/iced_americano.jpg" },
{ name: "Iced Cappuccino", price: 240, category: "Cold Coffee", section: "Bar", type: "drink", image: "images/iced_cappuccino.jpg" },
{ name: "Iced Vanilla", price: 290, category: "Cold Coffee", section: "Bar", type: "drink", image: "images/iced_vanilla_latte.jpg" },
{ name: "Iced Caramel", price: 290, category: "Cold Coffee", section: "Bar", type: "drink", image: "images/iced_caramel_latte.jpg" },
{ name: "Iced Mocha", price: 290, category: "Cold Coffee", section: "Bar", type: "drink", image: "images/iced_mocha.jpg" },
{ name: "Iced Hazelnut", price: 290, category: "Cold Coffee", section: "Bar", type: "drink", image: "images/iced_hazelnut_latte.jpg" },
{ name: "Iced Spanish Latte", price: 300, category: "Cold Coffee", section: "Bar", type: "drink", image: "images/iced_spanish_latte.jpg" },
{ name: "Iced Rose Latte", price: 300, category: "Cold Coffee", section: "Bar", type: "drink", image: "images/iced_rose_latte.jpg" },
{ name: "Iced Filter Coffee", price: 300, category: "Cold Coffee", section: "Bar", type: "drink", image: "images/iced_filter_coffee.jpg" },


    { name: "Mocha Blended ", price: 320, category: "Frappe / Blended", section: "Bar", type: "drink", image: "images/blended.jpg" },
    { name: "Vanilla Blended", price: 320, category: "Frappe / Blended", section: "Bar", type: "drink", image: "images/blended.jpg" },
    { name: "Caramel Blended", price: 320, category: "Frappe / Blended", section: "Bar", type: "drink", image: "images/blended.jpg" },
    { name: "Hazelnut Blended", price: 320, category: "Frappe / Blended", section: "Bar", type: "drink", image: "images/blended.jpg" },
    { name: "Oreo Blended", price: 320, category: "Frappe / Blended", section: "Bar", type: "drink", image: "images/blended.jpg" },

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

    { name: "Lemon Iced Tea", price: 220, category: "Iced Tea", section: "Bar", type: "drink", image: "images/iced_tea_lemon.jpg" },
    { name: "Peach Iced Tea", price: 270, category: "Iced Tea", section: "Bar", type: "drink", image: "images/iced_tea_peach.jpg" },
    { name: "Hibiscus Iced Tea", price: 270, category: "Iced Tea", section: "Bar", type: "drink", image: "images/iced_tea_hibiscus.jpg" },
    { name: "Black Berries Iced Tea", price: 270, category: "Iced Tea", section: "Bar", type: "drink", image: "images/blackberry_iced_tea.jpg" },

    { name: "Bubble Tea", price: 280, category: "Bubble Tea", section: "Bar", type: "drink", image: "images/bubble-tea.jpg" },
    
    { name: "Lassi (Sweet)", price: 195, category: "Lassi", section: "Bar", type: "drink", image: "images/lassi_sweet.jpg" },
    { name: "Lassi (Mango)", price: 250, category: "Lassi", section: "Bar", type: "drink", image: "images/lassi_mango.jpg" },
    { name: "Lassi (Strawberry)", price: 250, category: "Lassi", section: "Bar", type: "drink", image: "images/lassi_strawberry.jpg" },

    // ================== NEW TEA ITEMS ==================
    { name: "Black Rosella Tea", price: 150, category: "Tea", section: "Bar", type: "drink", image: "images/black_rosella.jpg", recipe: [{ materialId: 'tea-bag-rosella', quantity: 1 }, { materialId: 'hot-water', quantity: 0.22 }] },
    { name: "Butterfly Tea", price: 180, category: "Tea", section: "Bar", type: "drink", image: "images/butterfly.jpg", recipe: [{ materialId: 'tea-bag-butterfly-pea', quantity: 1 }, { materialId: 'hot-water', quantity: 0.22 }] },
    { name: "Calming Tea", price: 200, category: "Tea", section: "Bar", type: "drink", image: "images/calming_tea.jpg", recipe: [{ materialId: 'tea-bag-calming', quantity: 1 }, { materialId: 'hot-water', quantity: 0.22 }] },
    { name: "Chamomile Tea", price: 150, category: "Tea", section: "Bar", type: "drink", image: "images/chamomile.jpg", recipe: [{ materialId: 'tea-bag-chamomile', quantity: 1 }, { materialId: 'hot-water', quantity: 0.22 }] },
    { name: "Earl Grey Tea", price: 150, category: "Tea", section: "Bar", type: "drink", image: "images/earl_grey.jpg", recipe: [{ materialId: 'tea-bag-earl-grey', quantity: 1 }, { materialId: 'hot-water', quantity: 0.22 }] },
    { name: "Floral Delight Tea", price: 200, category: "Tea", section: "Bar", type: "drink", image: "images/floral_delight.jpg", recipe: [{ materialId: 'tea-bag-floral-delight', quantity: 1 }, { materialId: 'hot-water', quantity: 0.22 }] },
    { name: "Ginger Honey Hot Lemon", price: 130, category: "Tea", section: "Bar", type: "drink", image: "images/ginger_honey_hot_lemon.jpg", recipe: [{ materialId: 'hot-water', quantity: 0.22 }, { materialId: 'ginger-slice', quantity: 2 }, { materialId: 'honey', quantity: 0.02 }, { materialId: 'lemon-slice', quantity: 1 }] },
    { name: "Green Tea", price: 120, category: "Tea", section: "Bar", type: "drink", image: "images/green_tea.jpg", recipe: [{ materialId: 'tea-bag-green', quantity: 1 }, { materialId: 'hot-water', quantity: 0.22 }] },
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
    { name: "Orange Juice", price: 300, category: "Soft Drinks", section: "Bar", type: "drink", image: "images/orange_juice.jpg" },
{ name: "Apple Juice", price: 300, category: "Soft Drinks", section: "Bar", type: "drink", image: "images/apple_juice.jpg" },

    // ================== RETAIL & MISC ==================
    { name: "Butterfly Pea Packet", price: 400, category: "Retail", section: "Retail", type: "food", image: "images/butterfly_peaPKT.jpg" },
    { name: "Calming Tea Packet", price: 400, category: "Retail", section: "Retail", type: "food", image: "images/calming_teaPKT.jpg" },
    { name: "Coffee Bag Packet", price: 950, category: "Retail", section: "Retail", type: "food", image: "images/coffee_bagPKT.jpg" },
    { name: "Strainer 1", price: 250, category: "Retail", section: "Retail", type: "tool", image: "images/strainer1.jpg" },
    { name: "Strainer 2", price: 300, category: "Retail", section: "Retail", type: "tool", image: "images/strainer2.jpg" },
    { name: "Strainer 3", price: 400, category: "Retail", section: "Retail", type: "tool", image: "images/strainer3.jpg" },
    { name: "Hibiscus PKT", price: 450, category: "Retail", section: "Retail", type: "food", image: "images/hibiscus_PKT.jpg" },
    { name: "Chamomile PKT", price: 350, category: "Retail", section: "Retail", type: "food", image: "images/chamomile_PKT.jpg" },
    { name: "Lavender PKT", price: 300, category: "Retail", section: "Retail", type: "food", image: "images/lavender_PKT.jpg" },
    { name: "Pepper Mint PKT", price: 250, category: "Retail", section: "Retail", type: "food", image: "images/peppermint_PKT.jpg" },
    { name: "Spearmint PKT", price: 250, category: "Retail", section: "Retail", type: "food", image: "images/spearmint_PKT.jpg" },
    { name: "Floral Delight PKT", price: 490, category: "Retail", section: "Retail", type: "food", image: "images/floral_delight_PKT.jpg" },
    { name: "Herbal Tea PKT", price: 400, category: "Retail", section: "Retail", type: "food", image: "images/herbal_tea.jpg" },
    { name: "Jasmine PKT", price: 380, category: "Retail", section: "Retail", type: "food", image: "images/jasmine.jpg" },
     { name: "Lavender Rose  PKT", price: 400, category: "Retail", section: "Retail", type: "food", image: "images/lavender_PKT.jpg" },
      { name: "Himalayan herbal PKT", price: 350, category: "Retail", section: "Retail", type: "food", image: "images/lavender_PKT.jpg" },

    { name: "Artice Brust", price: 30, category: "Misc", section: "Misc", type: "misc", image: "images/artice_brust.jpg", discountable: false },
    { name: "Hukka", price: 550, category: "Misc", section: "Misc", type: "misc", image: "images/hukka.jpg", discountable: false },
    { name: "Juju Dhau", price: 85, category: "Misc", section: "Misc", type: "misc", image: "images/juju_dhau.jpg", discountable: false },
    { name: "Shikhar Ice", price: 25, category: "Misc", section: "Misc", type: "misc", image: "images/shikar_ICE.jpg", discountable: false },
    { name: "Surya Light", price: 30, category: "Misc", section: "Misc", type: "misc", image: "images/surya_light.jpg", discountable: false },
    { name: "Surya Red", price: 30, category: "Misc", section: "Misc", type: "misc", image: "images/surya_red.jpg", discountable: false },
    { name: "Water", price: 50, category: "Misc", section: "Misc", type: "misc", image: "images/water.jpg", discountable: false }
];

const MENU_DATA_VERSION = 2;
const defaultMenuItems = typeof structuredClone === 'function'
    ? structuredClone(menuItems)
    : menuItems.map(item => ({ ...item, extras: item.extras?.map(extra => ({ ...extra })), recipe: item.recipe?.map(recipe => ({ ...recipe })) }));
const savedMenu = getFromLocalStorage('customMenuItems');
const savedMenuItems = Array.isArray(savedMenu)
    ? savedMenu
    : savedMenu?.version === MENU_DATA_VERSION && Array.isArray(savedMenu.items)
        ? savedMenu.items
        : [];
const savedMenuByName = new Map(savedMenuItems.map(item => [item.name, item]));
menuItems = defaultMenuItems.map(item => {
    const savedItem = savedMenuByName.get(item.name);
    return savedItem ? { ...item, isOutOfStock: Boolean(savedItem.isOutOfStock) } : item;
});

function toggleItemStock(itemName) {
    const item = menuItems.find(menuItem => menuItem.name === itemName);
    if (!item) return;
    item.isOutOfStock = !item.isOutOfStock;
    saveToLocalStorage('customMenuItems', {
        version: MENU_DATA_VERSION,
        items: menuItems.map(item => ({ name: item.name, isOutOfStock: Boolean(item.isOutOfStock) }))
    });
    renderMenuNavigation();
    notifications.show(`${item.name} is now ${item.isOutOfStock ? 'Sold Out' : 'Available'}`, 'info');
}

window.toggleItemStock = toggleItemStock;

let extras = [
    // Food Extras
    { name: "Cheese", price: 75, image: "images/cheese.jpg", type: "food" },
    { name: "Sausage", price: 40, image: "images/buff_sausage.jpg", type: "food" },
    { name: "Extra Chicken", price: 120, image: "images/extra_chicken.jpg", type: "food" },
    { name: "Extra Buff", price: 100, image: "images/extra_buff.jpg", type: "food" },
    { name: "Egg", price: 50, image: "images/egg.jpg", type: "food" },
    { name: "Salad", price: 75, image: "images/salad.jpg", type: "food" },
    { name: "Toast", price: 75, image: "images/chi_toasty_salsa.jpg", type: "food" },

    // Drink Extras
    { name: "Boba", price: 50, image: "images/boba.jpg", type: "drink" },
    { name: "Flavour Shot", price: 70, image: "images/flavour.jpg", type: "drink" },
    { name: "Extra Ice", price: 20, image: "images/ice.jpg", type: "drink" },
    { name: "Extra Sugar", price: 20, image: "images/sugar.jpg", type: "drink" },

    // Misc Extras (for hukka, etc.)
    { name: "Extra Coil", price: 50, image: "images/coil.jpg", type: "misc" },
    { name: "Extra Flavour", price: 250, image: "images/extraflavour.jpg", type: "misc" }
];
let discountCodes = {
    "SAVE10": 10,
    "SAVE20": 20,
    "FREEDRINK": 15
};

// MODIFIED: "Cold Coffee" is now a top-level category outside of "Cold Drinks" section
const menuSections = {
    "Food": [
        "Bakery",
        "Burger with Fries",
        "Wrap with Fries",
        "Keema Noodles",
        "Chow Mein",
        "Thukpa",
        "Steam Mo:Mo",
        "Jhol Mo:Mo",
        "Kothey Mo:Mo",
        "C Mo:Mo",
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
    "Retail": [
        "Retail"
    ],
    "Misc": [
        "Misc"
    ]
};


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
    document.getElementById('offline-banner')?.classList.toggle('active', !online);
}

function updateOfflineQueueBadge() {
    const badge = document.getElementById('offline-queue-badge');
    const pendingCountEl = document.getElementById('pending-count');
    const offlineCountEl = document.getElementById('offline-queue-count');
    if (!badge || !pendingCountEl) return;
    const count = window.CloudSync?.getStatus?.().queued || 0;
    pendingCountEl.textContent = count;
    if (offlineCountEl) offlineCountEl.textContent = count;
    badge.classList.toggle('hidden', count === 0);
}

function loadOfflineQueue() {
    updateOfflineQueueBadge();
}

function persistOfflineQueue() {
    updateOfflineQueueBadge();
}

function flushOfflineQueue() {
    if (navigator.onLine) {
        window.CloudSync?.flush?.();
        updateOfflineQueueBadge();
    }
}

// =========================================================================
// =================== UTILITY FUNCTIONS ===================================
// =========================================================================

function printContent(htmlContent) {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.setAttribute('aria-hidden', 'true');
    iframe.setAttribute('sandbox', 'allow-same-origin allow-modals');
    iframe.srcdoc = htmlContent;
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc || !iframe.contentWindow) {
        iframe.remove();
        notifications.show('Unable to prepare the print preview.', 'error');
        return;
    }

    const cleanup = () => {
        if (document.body.contains(iframe)) iframe.remove();
    };

    let hasPrinted = false;
    const triggerPrint = () => {
        if (hasPrinted || !document.body.contains(iframe)) return;
        hasPrinted = true;
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        setTimeout(cleanup, 1000);
    };

    iframe.contentWindow.addEventListener('afterprint', cleanup, { once: true });
    iframe.contentWindow.addEventListener('load', triggerPrint, { once: true });
    setTimeout(triggerPrint, 250);
}

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
        const previousActiveElement = document.activeElement;

        if (!modal || !titleEl || !messageEl || !inputContainer || !confirmBtn || !cancelBtn) {
            resolve(null);
            return;
        }

        titleEl.textContent = title || '';
        messageEl.textContent = String(message || '');

        inputContainer.innerHTML = '';
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
        inputContainer.style.display = 'block';
        
        modal.style.display = 'flex';
        modal.setAttribute('aria-hidden', 'false');
        const modalContent = modal.querySelector('.generic-modal-content');
        if (modalContent) {
            modalContent.focus();
        }
        requestAnimationFrame(() => {
            inputEl.focus({ preventScroll: true });
            inputEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
        });

        const handleKeydown = (event) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                cleanupAndResolve(null);
            }
        };

        modal.addEventListener('keydown', handleKeydown);

        const cleanupAndResolve = (value) => {
            modal.style.display = 'none';
            modal.setAttribute('aria-hidden', 'true');
            modal.removeEventListener('keydown', handleKeydown);
            inputContainer.style.display = 'block';
            confirmBtn.onclick = null;
            cancelBtn.onclick = null;
            if (previousActiveElement && typeof previousActiveElement.focus === 'function') {
                previousActiveElement.focus();
            }
            resolve(value == null ? null : String(value).trim());
        };

        confirmBtn.onclick = () => cleanupAndResolve(inputEl.value);
        cancelBtn.onclick = () => cleanupAndResolve(null);
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
        const previousActiveElement = document.activeElement;

        if (!modal || !titleEl || !messageEl || !inputContainer || !confirmBtn || !cancelBtn) {
            resolve(false);
            return;
        }

        titleEl.textContent = title || '';
        messageEl.textContent = String(message || '');
        inputContainer.style.display = 'none'; // Hide the input field
        
        modal.style.display = 'flex';
        modal.setAttribute('aria-hidden', 'false');
        const modalContent = modal.querySelector('.generic-modal-content');
        if (modalContent) {
            modalContent.focus();
        }

        const handleKeydown = (event) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                cleanupAndResolve(false);
            }
        };

        modal.addEventListener('keydown', handleKeydown);

        const cleanupAndResolve = (value) => {
            modal.style.display = 'none';
            modal.setAttribute('aria-hidden', 'true');
            modal.removeEventListener('keydown', handleKeydown);
            inputContainer.style.display = 'block'; // Show input field again for next use
            confirmBtn.onclick = null;
            cancelBtn.onclick = null;
            if (previousActiveElement && typeof previousActiveElement.focus === 'function') {
                previousActiveElement.focus();
            }
            resolve(value);
        };
        
        confirmBtn.onclick = () => cleanupAndResolve(true);
        cancelBtn.onclick = () => cleanupAndResolve(false);
    });
}

class NotificationSystem {
    constructor() {
        this.notificationQueue = [];
        this.activeCount = 0;
        this.maxVisible = 3;
        this.maxQueueLength = 5;
    }

    show(message, type = 'info', duration = 2400) {
        if (!message) return;
        if (this.notificationQueue.length >= this.maxQueueLength) this.notificationQueue.shift();
        const baseDuration = Math.max(3000, String(message).length * 45);
        this.notificationQueue.push({
            message,
            type,
            duration: Math.min(6000, Math.max(baseDuration, Number(duration) || 0))
        });
        this.processQueue();
    }

    processQueue() {
        while (this.activeCount < this.maxVisible && this.notificationQueue.length > 0) {
            const { message, type, duration } = this.notificationQueue.shift();
            this.activeCount += 1;
            this.displayNotification(message, type, duration);
        }
    }

    displayNotification(message, type, duration) {
        const stack = document.getElementById('notification-toast');
        if (!stack) {
            this.activeCount = Math.max(0, this.activeCount - 1);
            return;
        }

        const toast = document.createElement('div');
        toast.className = `notification-item notification-${type}`;
        toast.setAttribute('role', type === 'error' || type === 'warning' ? 'alert' : 'status');

        const icon = document.createElement('div');
        icon.className = 'notification-icon';
        icon.innerHTML = this.getIconForType(type);

        const messageEl = document.createElement('div');
        messageEl.className = 'notification-message';
        messageEl.textContent = String(message || '');

        toast.appendChild(icon);
        toast.appendChild(messageEl);
        stack.appendChild(toast);
        
        requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateY(0)';
        });

        if (navigator.vibrate) navigator.vibrate(type === 'error' ? [35, 35, 35] : 25);

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
                toast.remove();
                this.activeCount = Math.max(0, this.activeCount - 1);
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
window.addEventListener('cloud-sync-queue-changed', () => updateOfflineQueueBadge());
window.addEventListener('cloud-sync-failing', () => {
    const failed = window.CloudSync?.getStatus?.().deadLetter || 0;
    notifications.show(`Cloud sync failed for ${failed} sale${failed === 1 ? '' : 's'}. Check Settings before retrying.`, 'error', 8000);
});

function logAudit(action, details = {}) {
    const entry = {
        id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        action,
        timestamp: new Date().toISOString(),
        user: currentUser?.email || 'Guest',
        role: currentUser?.role || 'Staff',
        table: details.table ?? null,
        orderId: details.orderId ?? null,
        amountPaisa: details.amountPaisa ?? null,
        reason: details.reason ?? null,
        details
    };
    auditLog.push(entry);
    if (auditLog.length > 5000) auditLog = auditLog.slice(-5000);
    debouncedPersistAllData();
}

// Date and Time
let lastKnownDate = new Date().toDateString();

function updateDateTime() {
    const now = new Date();
    const datetimeEl = document.getElementById('datetime');
    if (datetimeEl) datetimeEl.textContent = now.toLocaleString();

    const currentDateStr = now.toDateString();
    if (currentDateStr === lastKnownDate) return;

    lastKnownDate = currentDateStr;
    const todayMidnight = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        0,
        0,
        0,
        0
    ).toISOString();
    const nextShift = {
        shiftId: `SHIFT-${new Date(todayMidnight).getTime()}`,
        startedAt: todayMidnight,
        autoReset: true
    };

    localStorage.setItem('pos_last_shift_close', todayMidnight);
    localStorage.setItem(CURRENT_SHIFT_KEY, JSON.stringify(nextShift));
    console.log('[Auto Shift Reset] Shift baseline automatically reset to midnight.');
    notifications.show('Shift automatically reset for the new day.', 'info');
}

// Theme Management
function loadTheme() {
    const theme = localStorage.getItem('theme') || 'light';
    const isDark = theme === 'dark';
    if (isDark) document.body.classList.add('dark-mode');
    const toggleEl = document.getElementById('theme-toggle');
    if (toggleEl) {
        toggleEl.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
        toggleEl.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
    }
    updateSettingsThemeControl(isDark);
}

function toggleTheme() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    const toggleEl = document.getElementById('theme-toggle');
    if (toggleEl) {
        toggleEl.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
        toggleEl.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
    }
    updateSettingsThemeControl(isDark);
}

function updateSettingsThemeControl(isDark = document.body.classList.contains('dark-mode')) {
    const themeButton = document.getElementById('theme-toggle-settings');
    if (!themeButton) return;
    themeButton.innerHTML = `<i class="fas ${isDark ? 'fa-sun' : 'fa-moon'}"></i> ${isDark ? 'Light' : 'Dark'}`;
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

function playKitchenAlertSound() {
    if (!soundEnabled) return;
    try {
        const ctx = getClickAudioContext();
        if (ctx.state === 'suspended') ctx.resume();
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(587.33, ctx.currentTime);
        oscillator.frequency.setValueAtTime(880, ctx.currentTime + 0.15);
        gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        oscillator.start();
        oscillator.stop(ctx.currentTime + 0.6);
    } catch (error) {
        console.warn('Kitchen alert audio unavailable:', error);
    }
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
    if (!soundEnabled) return;
    
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

let cachedVoice = null;

function getPreferredVoice() {
    if (cachedVoice) return cachedVoice;
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return null;
    const femaleKeywords = ['samantha', 'victoria', 'moira', 'karen', 'zira', 'susan', 'amelia', 'woman', 'female', 'google uk', 'natural'];
    cachedVoice = voices.find(voice => femaleKeywords.some(keyword => voice.name.toLowerCase().includes(keyword)))
        || voices[1]
        || voices[0];
    return cachedVoice;
}

if ('speechSynthesis' in window) {
    window.speechSynthesis.addEventListener?.('voiceschanged', () => {
        cachedVoice = null;
    });
}

let lastSpeakAt = 0;

function speakText(message) {
    if (!speechEnabled) return;

    if (!('speechSynthesis' in window)) {
        console.warn('Speech synthesis not supported');
        return;
    }

    const now = Date.now();
    if (now - lastSpeakAt < 2500) return;
    lastSpeakAt = now;

    try {
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(message);
        utterance.lang = 'en-US';
        utterance.rate = 0.9;
        utterance.pitch = 1.4;
        utterance.volume = 1;

        const preferredVoice = getPreferredVoice();
        if (preferredVoice) utterance.voice = preferredVoice;

        window.speechSynthesis.speak(utterance);
    } catch (err) {
        console.error('Speech error:', err);
    }
}

const PIN_HASH_KEY = 'pos-staff-pin-hash';
let enteredPin = '';
let pinFailedAttempts = 0;
let pinLockedUntil = 0;

const PIN_HASH_VERSION = 2;
const PIN_HASH_ITERATIONS = 150000;

function bytesToBase64(bytes) {
    return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}

function base64ToBytes(value) {
    return Uint8Array.from(atob(value), char => char.charCodeAt(0));
}

async function derivePinHash(pin, salt, iterations = PIN_HASH_ITERATIONS) {
    if (!window.crypto?.subtle) throw new Error('Secure PIN hashing is unavailable in this browser.');
    const key = await window.crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(pin),
        'PBKDF2',
        false,
        ['deriveBits']
    );
    const bits = await window.crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
        key,
        256
    );
    return new Uint8Array(bits);
}

async function hashLegacyPin(pin) {
    const input = new TextEncoder().encode(`taboche-pos:${pin}`);
    const digest = await window.crypto.subtle.digest('SHA-256', input);
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

async function hashPin(pin) {
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const hash = await derivePinHash(pin, salt);
    return JSON.stringify({
        version: PIN_HASH_VERSION,
        iterations: PIN_HASH_ITERATIONS,
        salt: bytesToBase64(salt),
        hash: bytesToBase64(hash)
    });
}

async function verifyPin(pin, storedValue) {
    try {
        const record = JSON.parse(storedValue);
        if (record?.version !== PIN_HASH_VERSION || !record.salt || !record.hash) return { valid: false, legacy: true };
        const actual = await derivePinHash(pin, base64ToBytes(record.salt), Number(record.iterations) || PIN_HASH_ITERATIONS);
        const expected = base64ToBytes(record.hash);
        if (actual.length !== expected.length) return { valid: false, legacy: false };
        const valid = actual.every((byte, index) => byte === expected[index]);
        return { valid, legacy: false };
    } catch {
        const actual = await hashLegacyPin(pin);
        return { valid: actual === storedValue, legacy: true };
    }
}

function renderPinDots() {
    const dots = document.getElementById('pin-dots');
    if (!dots) return;
    dots.innerHTML = Array.from({ length: 8 }, (_, index) => `<span class="pin-dot${index < enteredPin.length ? ' filled' : ''}" aria-hidden="true"></span>`).join('');
}

function setPinError(message = '') {
    const error = document.getElementById('pin-error');
    if (error) error.textContent = message;
}

function lockScreen() {
    if (!localStorage.getItem(PIN_HASH_KEY)) {
        notifications.show('Set a Staff PIN in Settings before locking.', 'warning');
        return;
    }
    if (!window.crypto?.subtle) {
        notifications.show('PIN lock unavailable: requires HTTPS or Web Crypto support.', 'warning', 8000);
        return;
    }
    enteredPin = '';
    renderPinDots();
    setPinError();
    const overlay = document.getElementById('pin-lock-overlay');
    if (overlay) {
        overlay.classList.add('active');
        overlay.setAttribute('aria-hidden', 'false');
        overlay.querySelector('[data-pin-digit]')?.focus();
    }
    document.body.classList.add('pin-locked');
}

function unlockScreen() {
    enteredPin = '';
    renderPinDots();
    setPinError();
    const overlay = document.getElementById('pin-lock-overlay');
    if (overlay) {
        if (overlay.contains(document.activeElement)) document.activeElement.blur();
        overlay.classList.remove('active');
        overlay.setAttribute('aria-hidden', 'true');
    }
    document.body.classList.remove('pin-locked');
}

async function submitPin() {
    if (Date.now() < pinLockedUntil) {
        setPinError(`Try again in ${Math.ceil((pinLockedUntil - Date.now()) / 1000)} seconds.`);
        return;
    }
    if (enteredPin.length < 4) {
        setPinError('Enter at least 4 digits.');
        return;
    }
    try {
        const expectedHash = localStorage.getItem(PIN_HASH_KEY);
        const verification = expectedHash ? await verifyPin(enteredPin, expectedHash) : { valid: false };
        if (verification.valid) {
            if (verification.legacy) await saveStaffPin(enteredPin);
            pinFailedAttempts = 0;
            unlockScreen();
            notifications.show('POS unlocked.', 'success');
            return;
        }
    } catch (error) {
        console.error('PIN verification failed:', error);
    }
    pinFailedAttempts += 1;
    enteredPin = '';
    renderPinDots();
    if (pinFailedAttempts >= 5) {
        pinFailedAttempts = 0;
        pinLockedUntil = Date.now() + 30000;
        setPinError('Too many attempts. Try again in 30 seconds.');
    } else {
        setPinError('Incorrect PIN.');
    }
}

async function saveStaffPin(pin) {
    const normalizedPin = String(pin || '').trim();

    // Empty string = REMOVE the PIN lock
    if (!normalizedPin) {
        localStorage.removeItem(PIN_HASH_KEY);
        pinFailedAttempts = 0;
        pinLockedUntil = 0;
        enteredPin = '';
        return true;
    }
    if (!/^\d{4,8}$/.test(normalizedPin)) return false;
    localStorage.setItem(PIN_HASH_KEY, await hashPin(normalizedPin));
    pinFailedAttempts = 0;
    pinLockedUntil = 0;
    return true;
}

function refreshPinStatusUI() {
    const hasPin = Boolean(localStorage.getItem(PIN_HASH_KEY));
    const badge = document.getElementById('pin-status-badge');
    const desc = document.getElementById('pin-status-text');
    const removeBtn = document.getElementById('remove-pin-btn');

    if (badge) {
        badge.textContent = hasPin ? 'Enabled' : 'Disabled';
        badge.style.background = hasPin ? '#d1fae5' : '#fee2e2';
        badge.style.color = hasPin ? '#065f46' : '#991b1b';
        badge.style.padding = '2px 10px';
        badge.style.borderRadius = '999px';
        badge.style.fontSize = '0.7rem';
        badge.style.fontWeight = '700';
    }
    if (desc) {
        desc.textContent = hasPin
            ? 'A PIN is set. The POS locks on startup and when "Lock Screen" is used.'
            : 'No PIN set. Lock Screen is disabled until a PIN is created.';
    }
    if (removeBtn) {
        removeBtn.disabled = !hasPin;
        removeBtn.style.opacity = hasPin ? '1' : '0.5';
        removeBtn.style.cursor = hasPin ? 'pointer' : 'not-allowed';
    }
}
window.refreshPinStatusUI = refreshPinStatusUI;

function initializePinLock() {
    const keypad = document.getElementById('pin-keypad');
    keypad?.addEventListener('click', event => {
        const digitButton = event.target.closest('[data-pin-digit]');
        const actionButton = event.target.closest('[data-pin-action]');
        if (digitButton && enteredPin.length < 8) {
            enteredPin += digitButton.dataset.pinDigit;
            renderPinDots();
            if (enteredPin.length === 8) submitPin();
        } else if (actionButton?.dataset.pinAction === 'clear') {
            enteredPin = '';
            renderPinDots();
            setPinError();
        } else if (actionButton?.dataset.pinAction === 'submit') {
            submitPin();
        }
    });
    renderPinDots();
    if (!window.crypto?.subtle && localStorage.getItem(PIN_HASH_KEY)) {
        notifications.show('PIN lock unavailable: requires HTTPS. Deploy over HTTPS to enable it.', 'warning', 8000);
    }
    if (localStorage.getItem(PIN_HASH_KEY) && window.crypto?.subtle) {
        lockScreen();
    }
}

function generateOrderId() {
    const now = new Date();
    return `TAB-${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
}

const SETTLEMENT_GUARD_KEY = 'pos-last-settlement';
const SETTLEMENT_RESERVATION_TTL_MS = 15000;
const CURRENT_SHIFT_KEY = 'pos-current-shift';
const SHIFT_REPORTS_KEY = 'pos-shift-reports';

function getCurrentShift() {
    let storedShift = null;
    try {
        storedShift = JSON.parse(localStorage.getItem(CURRENT_SHIFT_KEY) || 'null');
    } catch {
        storedShift = null;
    }

    const now = new Date();
    const todayMidnight = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        0, 0, 0, 0
    ).toISOString();

    if (!storedShift?.startedAt || new Date(storedShift.startedAt) < new Date(todayMidnight)) {
        const nextShift = {
            shiftId: `SHIFT-${new Date(todayMidnight).getTime()}`,
            startedAt: todayMidnight,
            autoReset: true
        };

        localStorage.setItem(CURRENT_SHIFT_KEY, JSON.stringify(nextShift));
        localStorage.setItem('pos_last_shift_close', todayMidnight);
        console.log('[Auto Shift Reset] Shift baseline automatically reset to midnight on startup.');
        notifications.show('Shift automatically reset for the new day.', 'info');
        return nextShift;
    }

    return storedShift;
}

function archiveShiftReport(report) {
    let reports = [];
    try {
        const storedReports = JSON.parse(localStorage.getItem(SHIFT_REPORTS_KEY) || '[]');
        reports = Array.isArray(storedReports) ? storedReports : [];
    } catch {
        reports = [];
    }
    reports.push(report);
    localStorage.setItem(SHIFT_REPORTS_KEY, JSON.stringify(reports.slice(-100)));
}

function getArchivedShiftReports() {
    try {
        const reports = JSON.parse(localStorage.getItem(SHIFT_REPORTS_KEY) || '[]');
        return Array.isArray(reports) ? reports : [];
    } catch {
        return [];
    }
}

function printArchivedShiftReport(report) {
    if (!report) return;
    const varianceLabel = report.cashVariance == null
        ? 'Not counted'
        : `${report.cashVariance >= 0 ? 'Over' : 'Short'} by Rs ${Math.abs(report.cashVariance).toFixed(2)}`;
    const printHTML = `
        <!DOCTYPE html>
        <html><head><title>Archived Z-Report - ${escapeHtml(report.shiftId || '')}</title>
        <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
            .report { max-width: 700px; margin: 0 auto; }
            h1 { border-bottom: 2px solid #111; padding-bottom: 10px; }
            .meta, .row { display: flex; justify-content: space-between; gap: 20px; padding: 7px 0; border-bottom: 1px solid #ddd; }
            .section { margin-top: 22px; }
            .total { font-size: 18px; font-weight: 700; border-top: 2px solid #111; margin-top: 18px; padding-top: 10px; }
            .signatures { display: flex; justify-content: space-between; gap: 30px; margin-top: 60px; }
            .signatures span { width: 45%; padding-top: 22px; border-top: 1px solid #111; text-align: center; }
        </style></head>
        <body><main class="report">
            <h1>Z-Report (Archived Shift)</h1>
            <div class="meta"><span>Shift</span><strong>${escapeHtml(report.shiftId || 'Unknown')}</strong></div>
            <div class="meta"><span>Period</span><span>${escapeHtml(new Date(report.startedAt).toLocaleString())} - ${escapeHtml(new Date(report.closedAt).toLocaleString())}</span></div>
            <div class="meta"><span>Closed By</span><span>${escapeHtml(report.closedBy || 'Local Staff')}</span></div>
            <section class="section"><h2>Summary</h2>
                <div class="row"><span>Orders</span><strong>${report.orderCount || 0}</strong></div>
                <div class="row"><span>Items Sold</span><strong>${report.itemCount || 0}</strong></div>
                <div class="row"><span>Gross Sales</span><strong>Rs ${Number(report.grossSales || 0).toFixed(2)}</strong></div>
                <div class="row"><span>Net Sales</span><strong>Rs ${Number(report.netSales || 0).toFixed(2)}</strong></div>
                <div class="row"><span>Discounts</span><strong>Rs ${Number(report.discounts || 0).toFixed(2)}</strong></div>
                <div class="row"><span>Voids</span><strong>Rs ${Number(report.voids || 0).toFixed(2)}</strong></div>
            </section>
            <section class="section"><h2>Cash Reconciliation</h2>
                <div class="row"><span>Expected Cash</span><strong>Rs ${Number(report.expectedCash || 0).toFixed(2)}</strong></div>
                <div class="row"><span>Actual Cash</span><strong>${report.actualCash == null ? 'Not counted' : `Rs ${Number(report.actualCash).toFixed(2)}`}</strong></div>
                <div class="row"><span>Over / Short</span><strong>${varianceLabel}</strong></div>
            </section>
            <div class="total"><span>Net Shift Total</span><span>Rs ${Number(report.netSales || 0).toFixed(2)}</span></div>
            <div class="signatures"><span>Cashier</span><span>Manager</span></div>
        </main></body></html>
    `;
    printContent(printHTML);
}

function showShiftReportHistory() {
    const reports = getArchivedShiftReports().slice().reverse();
    const content = reports.length === 0
        ? '<div class="empty-state"><i class="fas fa-folder-open"></i><p>No archived shifts yet.</p></div>'
        : `<div class="shift-history-list">${reports.map((report, index) => `
            <div class="shift-history-row">
                <div><strong>${escapeHtml(report.shiftId || 'Shift')}</strong><span>${escapeHtml(new Date(report.startedAt).toLocaleString())} - ${escapeHtml(new Date(report.closedAt).toLocaleString())}</span></div>
                <div><strong>Rs ${Number(report.netSales || 0).toFixed(2)}</strong><span>${report.orderCount || 0} orders</span></div>
                <button type="button" class="btn-export archived-shift-print" data-report-index="${index}"><i class="fas fa-print"></i> Print</button>
            </div>`).join('')}</div>`;

    showSidebarContentModal('Archived Z-Reports', `<div class="report-container shift-history-report">${content}</div>`, () => {
        document.querySelectorAll('.archived-shift-print').forEach(button => {
            button.addEventListener('click', () => printArchivedShiftReport(reports[Number(button.dataset.reportIndex)]));
        });
    });
}

function getSettlementFingerprint(table, items) {
    const normalizedItems = (items || []).map(item => ({
        name: item.name || '',
        price: Number(item.price) || 0,
        quantity: Number(item.quantity) || 0,
        extras: (item.extras || []).map(extra => ({ name: extra.name || '', price: Number(extra.price) || 0 }))
            .sort((a, b) => a.name.localeCompare(b.name)),
        notes: item.notes || ''
    })).sort((a, b) => `${a.name}|${a.price}`.localeCompare(`${b.name}|${b.price}`));

    return JSON.stringify({
        table: String(table),
        sessionId: items?.[0]?.orderSessionId || null,
        items: normalizedItems
    });
}

function reserveSettlement(table, items) {
    const fingerprint = getSettlementFingerprint(table, items);
    const now = Date.now();
    let previous = null;

    try {
        previous = JSON.parse(localStorage.getItem(SETTLEMENT_GUARD_KEY) || 'null');
    } catch {
        previous = null;
    }

    if (previous && previous.fingerprint === fingerprint) {
        const age = now - Number(previous.timestamp || 0);
        if (age >= 0 && age < SETTLEMENT_RESERVATION_TTL_MS) {
            return { duplicate: true, fingerprint };
        }
        localStorage.removeItem(SETTLEMENT_GUARD_KEY);
    }

    localStorage.setItem(SETTLEMENT_GUARD_KEY, JSON.stringify({ fingerprint, timestamp: now }));
    return { duplicate: false, fingerprint };
}

function releaseSettlementReservation(fingerprint) {
    try {
        const current = JSON.parse(localStorage.getItem(SETTLEMENT_GUARD_KEY) || 'null');
        if (current?.fingerprint === fingerprint) {
            localStorage.removeItem(SETTLEMENT_GUARD_KEY);
        }
    } catch {
        // A stale guard will expire automatically.
    }
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

function formatElapsedTime(timestamp) {
    const createdAt = new Date(timestamp).getTime();
    if (!Number.isFinite(createdAt)) return '00:00';
    return formatTime(Math.max(0, Math.floor((Date.now() - createdAt) / 1000)));
}

function updateTableTimers() {
    try {
        if (timerUpdateQueued) return;
        timerUpdateQueued = true;

        requestAnimationFrame(() => {
            timerUpdateQueued = false;
            const now = Date.now();
            let timerStopped = false;

            Object.entries(tableTimers).forEach(([table, timer]) => {
                const orderItems = orders[table] && Array.isArray(orders[table]) ? orders[table] : [];
                if (orderItems.length > 0) {
                    const previousElapsed = Number(timer?.elapsed) || 0;
                    const start = Number(timer?.start);
                    const normalizedStart = Number.isFinite(start) && start > 1e12
                        ? start
                        : now - previousElapsed;
                    const elapsed = Math.max(previousElapsed, now - normalizedStart);
                    timer.elapsed = elapsed;
                    timer.lastUpdated = now;
                    const timerElement = document.getElementById(`timer-${table}`);
                    if (timerElement) {
                        timerElement.textContent = formatTime(Math.floor(elapsed / 1000));
                        const minutes = elapsed / 60000;
                        timerElement.classList.toggle('timer-warn', minutes >= 30 && minutes < 45);
                        timerElement.classList.toggle('timer-danger', minutes >= 45);
                    }
                } else {
                    delete tableTimers[table];
                    timerStopped = true;
                    const tableBtn = document.getElementById(`table-btn-${table}`);
                    if (tableBtn) {
                        tableBtn.classList.remove('occupied', 'blinking');
                        tableBtn.classList.add('available');
                        const timerElement = tableBtn.querySelector('.timer');
                        if (timerElement) timerElement.textContent = '00:00';
                    }
                }
            });

            if (timerStopped || Object.values(tableTimers).some(timer =>
                timer && now - (Number(timer.lastPersisted) || 0) >= 30000
            )) {
                Object.values(tableTimers).forEach(timer => {
                    if (timer) timer.lastPersisted = now;
                });
                persistAllData();
            }
        });
    } catch (error) {
        handleCriticalError('Updating table timers', error);
    }
}

function createKotsFor(table, itemsToFinalize) {
    const kotNumberBase = `KOT-${Date.now()}`;
    const kitchenItems = itemsToFinalize.filter(({ item }) => item.section === 'Kitchen');
    const barItems = itemsToFinalize.filter(({ item }) => item.section === 'Bar');

    const addKot = (items, type) => {
        if (items.length === 0) return;
        const kotId = `${kotNumberBase}-${type.toUpperCase()}`;
        kotHistory.push({
            kotId,
            table,
            items: items.map(({ item, deltaQty }, index) => ({
                ...item,
                quantity: deltaQty,
                isReady: false,
                kotItemId: `${kotId}-ITEM-${index}`
            })),
            timestamp: new Date().toISOString(),
            status: 'pending',
            type,
            kotNumber: kotNumberBase
        });
    };

    addKot(kitchenItems, 'kitchen');
    addKot(barItems, 'bar');
    itemsToFinalize.forEach(({ item }) => {
        item.sentQuantity = Number(item.quantity) || 0;
        item.finalized = true;
        item.kotNumber = kotNumberBase;
    });

    return {
        kotNumber: kotNumberBase,
        itemCount: itemsToFinalize.reduce((sum, entry) => sum + entry.deltaQty, 0),
        kotCreated: kitchenItems.length > 0 || barItems.length > 0
    };
}

function sendPendingItemsToKitchen(table) {
    const tableItems = orders[table];
    if (!Array.isArray(tableItems) || tableItems.length === 0) {
        return { itemCount: 0, kotCreated: false };
    }

    const itemsToFinalize = tableItems
        .map(item => ({ item, deltaQty: Math.max(0, (Number(item.quantity) || 0) - (Number(item.sentQuantity) || 0)) }))
        .filter(entry => entry.deltaQty > 0);
    if (itemsToFinalize.length === 0) return { itemCount: 0, kotCreated: false };

    return createKotsFor(table, itemsToFinalize);
}

async function selectTable(tableNumber) {
    if (currentTable && currentTable !== tableNumber && Array.isArray(orders[currentTable]) && orders[currentTable].length) {
        const pendingCount = orders[currentTable].filter(item => !item.finalized).length;
        if (pendingCount > 0) {
            const confirmed = await showConfirmModal(
                'Send Pending Items?',
                `Table ${currentTable} has ${pendingCount} pending item${pendingCount === 1 ? '' : 's'}. Send them to the kitchen before switching?`
            );
            if (!confirmed) return;
            const result = sendPendingItemsToKitchen(currentTable);
            if (result.itemCount > 0) {
                notifications.show(
                    result.kotCreated ? `Pending items sent to kitchen for Table ${currentTable}.` : 'Pending items finalized.',
                    'success'
                );
            }
        }
        persistAllData();
    }

    orders[tableNumber] = orders[tableNumber] || [];
    localStorage.setItem('selectedTable', tableNumber);

    showLoadingSpinner();
    currentTable = tableNumber;
    document.getElementById('selected-table').textContent = tableNumber;
    document.getElementById('selected-table-checkout').textContent = tableNumber;
    loadTableNotes(tableNumber);

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
    setOrderDrawerOpen(true);
    stopBlinking(tableNumber);
    initializeTables(); // Update table status visual
    hideLoadingSpinner();
}

function setOrderDrawerOpen(isOpen) {
    const orderSection = document.getElementById('order-section');
    const toggle = document.getElementById('order-drawer-toggle');
    if (!orderSection || !toggle) return;

    orderSection.classList.toggle('open', isOpen);
    toggle.setAttribute('aria-expanded', String(isOpen));
    const itemCount = currentTable && Array.isArray(orders[currentTable])
        ? orders[currentTable].reduce((total, item) => total + (Number(item.quantity) || 0), 0)
        : 0;
    const countBadge = document.getElementById('order-item-count');
    if (countBadge) {
        countBadge.textContent = itemCount;
        countBadge.setAttribute('aria-label', `${itemCount} item${itemCount === 1 ? '' : 's'}`);
    }
    toggle.innerHTML = isOpen
        ? `<i class="fas fa-chevron-down" aria-hidden="true"></i> Hide Order <span id="order-item-count">${itemCount}</span>`
        : `<i class="fas fa-receipt" aria-hidden="true"></i> Order <span id="order-item-count">${itemCount}</span>`;
}

// Helper to get image for category or section
function getRepresentativeImage(name, isSection = false) {
    if (isSection) {
        // For top-level sections (Food, Cold Drinks, Retail & Misc), pick a representative category's image
        const categoriesInSection = menuSections[name];
        if (categoriesInSection && categoriesInSection.length > 0) {
            const firstItemInCategory = menuItems.find(item =>
                categoriesInSection.includes(item.category) && item.image
            );
            if (firstItemInCategory) return getSafeImagePath(firstItemInCategory.image);
        }
    } else {
        // For individual categories (including all drink categories), pick the first item's image
        const firstItemInCategory = menuItems.find(item => item.category === name && item.image);
        if (firstItemInCategory) return getSafeImagePath(firstItemInCategory.image);
    }
    return getSafeImagePath('images/placeholder.jpg');
}

const missingImagePaths = new Set([
    'images/apple_juice.jpg', 'images/blackberry_iced_tea.jpg', 'images/blended.jpg', 'images/boba.jpg',
    'images/chow_mein_buff.jpg', 'images/chow_mein_chicken.jpg', 'images/chow_mein_veg.jpg', 'images/egg.jpg',
    'images/espresso.jpg', 'images/extra_buff.jpg', 'images/extra_chicken.jpg', 'images/extraflavour.jpg',
    'images/filter_coffee.jpg', 'images/flower_tea.jpg', 'images/ginger_honey_hot_lemon.jpg', 'images/herbal_tea.jpg',
    'images/ice.jpg', 'images/iced_cappuccino.jpg', 'images/iced_filter_coffee.jpg', 'images/iced_hazelnut_latte.jpg',
    'images/iced_mocha.jpg', 'images/iced_rose_latte.jpg', 'images/iced_spanish_latte.jpg', 'images/kothey_momo_chicken.jpg',
    'images/lassi_strawberry.jpg', 'images/latte_vanilla.jpg', 'images/lavender_PKT.jpg', 'images/lungo.jpg',
    'images/masala_omelette.jpg', 'images/orange_juice.jpg', 'images/organic_black_tea.jpg', 'images/peach_lemonade.jpg',
    'images/peach_mojito.jpg', 'images/pearl_green_tea.jpg', 'images/sausage_buff.jpg', 'images/sparkling_lemon.jpg',
    'images/sparkling_peach.jpg', 'images/strawberry_lemonade.jpg', 'images/sugar.jpg', 'images/thukpa_buff.jpg',
    'images/thukpa_chicken.jpg', 'images/thukpa_veg.jpg', 'images/placeholder.jpg'
]);

function getSafeImagePath(imagePath) {
    return imagePath && !missingImagePaths.has(imagePath) ? imagePath : 'images/logo.png';
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
        backButton.style.display = 'none';
        menuSectionTitle.textContent = '';

        const sectionNames = Object.keys(menuSections).sort();
        const topLevelDrinkCategoriesOrder = [
            "Hot Coffee",
            "Cold Coffee",
            "Frappe / Blended",
            "Mojito",
            "Iced Tea",
            "Lemonade",
            "Lassi",
            "Tea",
            "Soft Drinks",
            "Bubble Tea"
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
                pushMenuNavigationState();
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
        const isSoldOut = Boolean(item.isOutOfStock);
        div.className = `menu-item${isSoldOut ? ' sold-out' : ''}`;
        div.style.opacity = isSoldOut ? '0.45' : '1';
        div.innerHTML = `
            <img src="${getSafeImagePath(item.image)}" alt="${escapeHtml(item.name)}" loading="lazy" onerror="handleImageError(this)">
            <p>${escapeHtml(item.name)}</p>
            <div class="price">${isSoldOut ? 'SOLD OUT' : `Rs ${item.price.toFixed(2)}`}</div>
        `;
        div.addEventListener('contextmenu', event => {
            event.preventDefault();
            suppressMenuItemClickUntil = Date.now() + 450;
            toggleItemStock(item.name);
        });
        div.addEventListener('click', () => {
            if (Date.now() < suppressMenuItemClickUntil || isSoldOut) return;
            addToOrder(item);
        });
        menu.appendChild(div);
    });
}

// MODIFIED: Navigate back function to always go to topLevelSections
function navigateBackMenu() {
    const searchInput = document.getElementById('search');
    
    if (searchInput?.value.trim() !== '') {
        searchInput.value = '';
        restoreMenuNavigationState();
        renderMenuNavigation();
        return;
    }
     
    restoreMenuNavigationState();
    renderMenuNavigation();
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
        const isSoldOut = Boolean(item.isOutOfStock);
        div.className = `menu-item${isSoldOut ? ' sold-out' : ''}`;
        div.style.opacity = isSoldOut ? '0.45' : '1';
        
        div.innerHTML = `
            <img src="${getSafeImagePath(item.image)}" alt="${escapeHtml(item.name)}" loading="lazy" onerror="handleImageError(this)">
            <p>${escapeHtml(item.name)}</p>
            <div class="price">${isSoldOut ? 'SOLD OUT' : `Rs ${item.price.toFixed(2)}`}</div>
        `;

        div.addEventListener('contextmenu', event => {
            event.preventDefault();
            suppressMenuItemClickUntil = Date.now() + 450;
            toggleItemStock(item.name);
        });
        div.addEventListener('click', () => {
            if (Date.now() < suppressMenuItemClickUntil || isSoldOut) return;
            addToOrder(item);
        });
        menu.appendChild(div);
    });
}

async function addToOrder(item) {
    if (item?.isOutOfStock) {
        notifications.show(`${item.name} is sold out.`, 'warning');
        return;
    }

    if (!currentTable) {
        notifications.show('Please select a table first!', 'warning');
        return;
    }

    orders[currentTable] ??= [];
    const orderSessionId = orders[currentTable][0]?.orderSessionId || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    orders[currentTable].forEach(orderItem => {
        if (!orderItem.orderSessionId) orderItem.orderSessionId = orderSessionId;
    });
    const existingItem = orders[currentTable].find(i =>
        i.name === item.name &&
        JSON.stringify(i.extras || []) === JSON.stringify(item.extras || []) &&
        (i.notes || '') === (item.notes || '')
    );

    if (existingItem) {
        existingItem.quantity += 1;
        if (existingItem.finalized) {
            existingItem.finalized = false;
            delete existingItem.kotNumber;
        }
    } else {
        orders[currentTable].push({
            ...item,
            quantity: 1,
            sentQuantity: 0,
            extras: item.extras || [],
            notes: item.notes || '',
            orderSessionId,
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

    const orderSection = document.getElementById('order-section');
    setOrderDrawerOpen(orderSection?.classList.contains('open') ?? false);

    if (!currentTable || !orders[currentTable] || orders[currentTable].length === 0) {
        orderItemsDiv.innerHTML = '<div class="no-items">No items added to this table</div>';
        updateTotal();
        return;
    }

    orderItemsDiv.innerHTML = '';
    const fragment = document.createDocumentFragment();

    orders[currentTable].forEach((item, index) => {
        const extrasTotal = item.extras?.reduce((sum, e) => sum + (Number(e.price) || 0), 0) || 0;
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
                <button class="void-btn" style="background-color: #ef4444; color: white;">Void</button>
            </div>
        `;

        fragment.appendChild(itemDiv);
    });

    orderItemsDiv.appendChild(fragment);
    updateTotal();

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
        releaseSettlementReservation(settlementReservation.fingerprint);
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
    itemEntry.sentQuantity = Math.min(Number(itemEntry.sentQuantity) || 0, itemEntry.quantity - 1);
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
    const item = orders[currentTable][index];

    if ((Number(item.sentQuantity) || 0) > 0) {
        notifications.show("Portions of this item were already sent to kitchen. Use 'Void' instead.", 'warning');
        return;
    }

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

    const currentItem = orders[currentTable][currentItemIndex];
    const currentExtras = currentItem.extras || [];
    const extrasChanged = JSON.stringify(selectedExtras.sort((a,b)=>a.name.localeCompare(b.name))) !== JSON.stringify(currentExtras.sort((a,b)=>a.name.localeCompare(b.name)));

    if (currentItem.quantity > 1 && extrasChanged) {
        // Split: create a new item with quantity 1 and the new extras
        const newItem = {
            ...currentItem,
            quantity: 1,
            extras: selectedExtras
        };
        orders[currentTable].push(newItem);
        currentItem.quantity -= 1;
        notifications.show("Extras added to one item. Quantity split.", "success");
    } else {
        // Update the existing item
        currentItem.extras = selectedExtras;
        notifications.show("Extras updated successfully!", "success");
    }

    persistAllData();
    renderOrderItems();
    updateTotal();
    closeExtrasModal();
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
    requestAnimationFrame(() => {
        textarea.focus({ preventScroll: true });
        textarea.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
}

async function saveNotes() {
    const textarea = document.getElementById('item-notes');
    const notesValue = textarea.value.trim();

    if (currentItemIndex === null || !orders[currentTable]?.[currentItemIndex]) {
        notifications.show("Error: No item selected to save notes for.", "error");
        closeNotesModal();
        return;
    }

    const currentItem = orders[currentTable][currentItemIndex];
    const currentNotes = currentItem.notes || '';
    const notesChanged = notesValue !== currentNotes;

    if (currentItem.quantity > 1 && notesChanged) {
        // Split: create a new item with quantity 1 and the new notes
        const newItem = {
            ...currentItem,
            quantity: 1,
            notes: notesValue
        };
        orders[currentTable].push(newItem);
        currentItem.quantity -= 1;
        notifications.show("Note added to one item. Quantity split.", "success");
    } else {
        // Update the existing item
        currentItem.notes = notesValue;
        notifications.show("Note saved successfully.", "success");
    }

    persistAllData();
    renderOrderItems();
    closeNotesModal();
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

    const reason = await showPromptModal('Remove Item', 'Enter reason for removing this item (optional):');
    const removalReason = reason && reason.trim() ? reason.trim() : 'Removed from order';

    showLoadingSpinner();

    const removalId = `remove_${Date.now()}`;
    const timestamp = new Date().toISOString();
    const removalEntry = {
        removalId,
        table: currentTable,
        item: itemToRemove,
        items: [itemToRemove],
        total: (itemToRemove.price + (itemToRemove.extras?.reduce((sum, extra) => sum + (extra.price || 0), 0) || 0)) * itemToRemove.quantity,
        reason: removalReason,
        user: currentUser?.email || staffName,
        timestamp,
        actionType: 'removed'
    };

    voidDetails.push(removalEntry);

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

    closeSidebarContentModal();
    
    // CRITICAL: Clear all previous event listeners to prevent memory leaks
    const newContentArea = contentArea.cloneNode(false);
    if (contentArea.parentNode) {
        contentArea.parentNode.replaceChild(newContentArea, contentArea);
    }
    
    const updatedContentArea = document.getElementById('modal-content-area');
    if (!updatedContentArea) return;
    const hasDedicatedReportHeader = contentHTML.includes('class="report-container sales-report"');
    const modalContent = modal.querySelector('.modal-content');
    modalContent?.classList.toggle('sales-report-modal', hasDedicatedReportHeader);
    updatedContentArea.innerHTML = `${hasDedicatedReportHeader ? '' : `<h3>${escapeHtml(title)}</h3>`}${contentHTML}`;
    modal.style.display = 'block';
    document.documentElement.classList.add('modal-open');
    document.body.classList.add('modal-open');
    if (setupCallback) setupCallback();
    closeSidebar();
}

function closeSidebarContentModal() {
    const modal = document.getElementById('sidebar-content-modal');
    if (modal) modal.style.display = 'none';
    document.documentElement.classList.remove('modal-open');
    document.body.classList.remove('modal-open');
    const contentArea = document.getElementById('modal-content-area');
    if (contentArea) contentArea.replaceChildren();
    modal?.querySelector('.modal-content')?.classList.remove('sales-report-modal');
    if (kitchenElapsedInterval) {
        clearInterval(kitchenElapsedInterval);
        kitchenElapsedInterval = null;
    }
    Object.values(activeChartInstances || {}).forEach(chart => chart?.destroy?.());
    activeChartInstances = {};
}

function loadTableNotes(table) {
    const notesInput = document.getElementById('table-notes');
    if (notesInput) notesInput.value = table ? (localStorage.getItem(`table-notes-${table}`) || '') : '';
}

async function clearAllItems() {
    if (!currentTable || !orders[currentTable]?.length) {
        notifications.show('No items to clear.', 'warning');
        return;
    }

    const pendingItems = orders[currentTable].filter(item => !item.finalized);
    if (pendingItems.length === 0) {
        notifications.show('All items are finalized. Use Void to cancel them.', 'warning');
        return;
    }

    const finalizedCount = orders[currentTable].length - pendingItems.length;
    const confirmed = await showConfirmModal(
        'Clear Pending Items',
        `Remove ${pendingItems.length} pending item${pendingItems.length === 1 ? '' : 's'} from this order${finalizedCount > 0 ? `? Finalized items will remain.` : '?'}`
    );
    if (!confirmed) return;

    orders[currentTable] = orders[currentTable].filter(item => item.finalized);
    if (orders[currentTable].length === 0) {
        delete orders[currentTable];
        delete tableTimers[currentTable];
    }
    persistAllData();
    renderOrderItems();
    initializeTables();
    updateTotal();
    notifications.show('Pending items cleared.', 'success');
}

function toLocalISODate(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function showSalesReportsContent(e) {
    e.preventDefault();
    const reportStaff = [...new Set(salesHistory.map(sale => sale.user || 'Unknown'))].sort();
    const reportCategories = [...new Set(menuItems.map(item => item.category))].sort();
    const reportTables = [...new Set(salesHistory.map(sale => String(sale.table || '')).filter(Boolean))].sort();
    const optionList = (values, label) => `<option value="all">All ${label}</option>${values.map(value => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('')}`;
    const reportId = `SR-${Date.now().toString(36).toUpperCase()}`;

    showSidebarContentModal('Sales Reports', `
        <div class="report-container sales-report">
            <div class="sales-report-header"><h3><i class="fas fa-chart-line me-2"></i>Sales Report</h3><p>Taboche Restaurant | Branch: Main | VAT/PAN: Not configured</p><p class="report-definition">Report ID: ${reportId} | Generated by: ${escapeHtml(currentUser.email || 'Local Staff')} | Generated at: ${new Date().toLocaleString('en-GB')}</p><p class="report-definition">VAT and service charge are added at checkout. Net sales exclude VAT and service charge.</p></div>
            <div class="sales-report-toolbar">
                <div class="filter-group"><label for="start-date">From</label><input type="date" id="start-date" class="filter-input" value="${toLocalISODate()}"></div>
                <div class="filter-group"><label for="end-date">To</label><input type="date" id="end-date" class="filter-input" value="${toLocalISODate()}"></div>
                <div class="filter-group"><label for="sales-payment-filter">Payment</label><select id="sales-payment-filter" class="filter-select"><option value="all">All payments</option><option value="Cash">Cash</option><option value="Mobile">Mobile</option></select></div>
                <div class="filter-group"><label for="sales-staff-filter">Staff</label><select id="sales-staff-filter" class="filter-select">${optionList(reportStaff, 'staff')}</select></div>
                <div class="filter-group"><label for="sales-category-filter">Category</label><select id="sales-category-filter" class="filter-select">${optionList(reportCategories, 'categories')}</select></div>
                <div class="filter-group"><label for="sales-status-filter">Status</label><select id="sales-status-filter" class="filter-select"><option value="all">All statuses</option><option value="completed">Completed</option><option value="voided">Voided</option><option value="refunded">Refunded</option></select></div>
                <div class="filter-group"><label for="sales-table-filter">Table</label><select id="sales-table-filter" class="filter-select">${optionList(reportTables, 'tables')}</select></div>
                <button id="generate-report" class="btn-primary-action"><i class="fas fa-sync-alt"></i> Generate Report</button>
                <div class="quick-filters"><button type="button" class="quick-filter" data-range="today">Today</button><button type="button" class="quick-filter" data-range="yesterday">Yesterday</button><button type="button" class="quick-filter" data-range="week">This Week</button><button type="button" class="quick-filter" data-range="month">This Month</button></div>
            </div>
            <nav class="sales-report-tabs" aria-label="Sales report sections">
                <button type="button" class="sales-report-tab active" data-sales-tab="overview">Overview</button>
                <button type="button" class="sales-report-tab" data-sales-tab="trends">Trends</button>
                <button type="button" class="sales-report-tab" data-sales-tab="items">Items</button>
                <button type="button" class="sales-report-tab" data-sales-tab="staff">Staff</button>
            </nav>
            <div id="sales-report-content" class="report-content-inner"><div class="empty-state"><i class="fas fa-chart-line"></i><p>Select a date range to generate the report.</p></div></div>
            <div class="report-actions"><div class="export-menu"><button id="sales-export-toggle" class="btn-primary-action" type="button" aria-expanded="false"><i class="fas fa-share-from-square"></i> Export</button><div id="sales-export-menu" class="export-menu-popover" hidden><button id="export-sales-excel" class="btn-export" style="display:none"><i class="fas fa-file-excel"></i> Excel</button><button id="export-sales-pdf" class="btn-export pdf" style="display:none"><i class="fas fa-file-pdf"></i> PDF</button><button id="export-sales-csv" class="btn-export" style="display:none"><i class="fas fa-file-csv"></i> CSV</button><button id="print-sales-summary" class="btn-primary-action" style="display:none"><i class="fas fa-print"></i> Print</button><button id="email-sales-report" class="btn-primary-action" style="display:none"><i class="fas fa-envelope"></i> Email</button></div></div></div>
        </div>
    `, () => {
        document.getElementById('generate-report')?.addEventListener('click', generateSalesReport);
        document.getElementById('export-sales-csv')?.addEventListener('click', exportSalesReport);
        document.getElementById('export-sales-excel')?.addEventListener('click', exportSalesExcel);
        document.getElementById('export-sales-pdf')?.addEventListener('click', () => exportToPDF('sales-report-content', 'sales-report'));
        document.getElementById('print-sales-summary')?.addEventListener('click', printSalesSummary);
        document.getElementById('email-sales-report')?.addEventListener('click', emailSalesReport);
        document.querySelectorAll('.quick-filter').forEach(button => button.addEventListener('click', () => applySalesQuickFilter(button.dataset.range)));
        document.querySelectorAll('.sales-report-tab').forEach(button => button.addEventListener('click', () => {
            const activeTab = button.dataset.salesTab;
            document.querySelectorAll('.sales-report-tab').forEach(tab => tab.classList.toggle('active', tab === button));
            document.querySelectorAll('[data-sales-tab-section]').forEach(section => {
                section.hidden = section.dataset.salesTabSection !== activeTab;
            });
            activeChartInstances['sales-trend-chart']?.resize?.();
        }));
        const exportToggle = document.getElementById('sales-export-toggle');
        const exportMenu = document.getElementById('sales-export-menu');
        exportToggle?.addEventListener('click', () => {
            const isOpen = !exportMenu.hidden;
            exportMenu.hidden = isOpen;
            exportToggle.setAttribute('aria-expanded', String(!isOpen));
        });
        generateSalesReport();
    });
}

function applySalesQuickFilter(range) {
    const now = new Date();
    const start = new Date(now);
    const end = new Date(now);
    if (range === 'yesterday') {
        start.setDate(start.getDate() - 1);
        end.setDate(end.getDate() - 1);
    } else if (range === 'week') {
        start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    } else if (range === 'month') {
        start.setDate(1);
    }
    const startInput = document.getElementById('start-date');
    const endInput = document.getElementById('end-date');
    if (startInput) startInput.value = toLocalISODate(start);
    if (endInput) endInput.value = toLocalISODate(end);
    document.querySelectorAll('.quick-filter').forEach(button => button.classList.toggle('active', button.dataset.range === range));
    generateSalesReport();
}

function generateSalesReport() {
    showLoadingSpinner();
    const reportContentEl = document.getElementById('sales-report-content');
    const exportButton = document.getElementById('export-sales-csv');
    const excelButton = document.getElementById('export-sales-excel');
    const exportPDFButton = document.getElementById('export-sales-pdf');
    const printButton = document.getElementById('print-sales-summary');
    const emailButton = document.getElementById('email-sales-report');
    if (!reportContentEl || !exportButton) {
        hideLoadingSpinner();
        return;
    }
    reportContentEl.innerHTML = `<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>Loading report...</p></div>`;
    exportButton.style.display = 'none';
    if (excelButton) excelButton.style.display = 'none';
    exportPDFButton.style.display = 'none';
    if (printButton) printButton.style.display = 'none';
    if (emailButton) emailButton.style.display = 'none';

    const startDate = new Date(document.getElementById('start-date').value);
    const endDate = new Date(document.getElementById('end-date').value);
    endDate.setHours(23, 59, 59, 999);

    const filteredSales = salesHistory.filter(sale => {
        const saleDate = new Date(sale.timestamp);
        return saleDate >= startDate && saleDate <= endDate;
    });

    const paymentFilter = document.getElementById('sales-payment-filter')?.value || 'all';
    const staffFilter = document.getElementById('sales-staff-filter')?.value || 'all';
    const categoryFilter = document.getElementById('sales-category-filter')?.value || 'all';
    const statusFilter = document.getElementById('sales-status-filter')?.value || 'all';
    const tableFilter = document.getElementById('sales-table-filter')?.value || 'all';
    const reportSales = filteredSales.filter(sale => {
        const paymentMatches = paymentFilter === 'all' || (sale.paymentMethods || []).some(payment => payment.method === paymentFilter);
        const staffMatches = staffFilter === 'all' || (sale.user || 'Unknown') === staffFilter;
        const categoryMatches = categoryFilter === 'all' || (sale.items || []).some(item => (menuItems.find(menuItem => menuItem.name === item.name)?.category || 'Other') === categoryFilter);
        const statusMatches = statusFilter === 'all' || (sale.status || 'completed') === statusFilter;
        const tableMatches = tableFilter === 'all' || String(sale.table || '') === tableFilter;
        return paymentMatches && staffMatches && categoryMatches && statusMatches && tableMatches;
    });
    const metrics = calculateSalesMetrics(reportSales);
    metrics.trend = calculateSalesTrend(startDate, endDate);
    metrics.comparisons = calculateManagementComparisons(new Date());
    metrics.voidedItems = collectVoidedItems(startDate, endDate);
    metrics.voidReasons = collectVoidReasons(startDate, endDate);

    reportContentEl.innerHTML = reportSales.length ? buildSalesAnalysisHTML(metrics, reportSales) : '<div class="empty-state"><i class="fas fa-receipt"></i><p>No sales in the selected period.</p></div>';
    if (reportSales.length > 0) {
        document.querySelectorAll('[data-sales-tab-section]').forEach(section => {
            section.hidden = section.dataset.salesTabSection !== 'overview';
        });
        renderSalesCharts(metrics);
    }
    if (reportSales.length > 0) {
        exportButton.style.display = 'block';
        if (excelButton) excelButton.style.display = 'block';
        exportPDFButton.style.display = 'block';
        if (printButton) printButton.style.display = 'block';
        if (emailButton) emailButton.style.display = 'block';
    }
    hideLoadingSpinner();
}

function calculateSalesMetrics(sales) {
    let totalSales = 0;
    let totalCash = 0; // Will be net cash received
    let totalMobile = 0;
    let totalDiscount = 0;
    let transactionCount = 0;
    let completedTransactions = 0;
    let completedTotal = 0;
    let totalServiceCharge = 0;
    let totalVat = 0;
    let voidedTransactions = 0;
    let voidedTotal = 0;
    let refundedTransactions = 0;
    let refundedTotal = 0;
    let discountedTransactions = 0;
    const discountUsage = {};
    const paymentTotals = {};
    const itemTotals = {};
    const categoryTotals = {};
    const hourlyTotals = {};
    const staffTotals = {};

    sales.forEach(sale => {
        const saleTotal = typeof sale.total === 'number' ? sale.total : 0;
        transactionCount++;
        if (sale.status === 'refunded') {
            refundedTransactions++;
            refundedTotal += saleTotal;
            return;
        }
        if (sale.status === 'voided') {
            voidedTransactions++;
            voidedTotal += saleTotal;
            return;
        }
        completedTransactions++;
        completedTotal += saleTotal;
        totalSales += saleTotal;
        const saleBreakdown = calculateSaleBreakdown(sale);
        totalServiceCharge += saleBreakdown.serviceCharge;
        totalVat += saleBreakdown.vat;
        const discountAmount = parseFloat(sale.discountAmount || 0);
        totalDiscount += discountAmount;
        if (discountAmount > 0) {
            discountedTransactions++;
            const discountLabel = sale.discount && sale.discount !== 'None' ? sale.discount : 'Manual discount';
            discountUsage[discountLabel] = (discountUsage[discountLabel] || 0) + 1;
        }

        let cashTenderedForSale = 0;
        let mobilePaidForSale = 0;

        if (Array.isArray(sale.paymentMethods)) {
            sale.paymentMethods.forEach(pm => {
                const amount = parseFloat(pm.amount) || 0;
                paymentTotals[pm.method] = (paymentTotals[pm.method] || 0) + amount;
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
        (sale.items || []).forEach(item => {
            const itemQuantity = Number(item.quantity) || 0;
            const itemRevenue = ((Number(item.price) || 0) + (item.extras || []).reduce((sum, extra) => sum + (Number(extra.price) || 0), 0)) * itemQuantity;
            itemTotals[item.name] = itemTotals[item.name] || { quantity: 0, revenue: 0 };
            itemTotals[item.name].quantity += itemQuantity;
            itemTotals[item.name].revenue += itemRevenue;
            const category = menuItems.find(menuItem => menuItem.name === item.name)?.category || 'Other';
            categoryTotals[category] = (categoryTotals[category] || 0) + itemRevenue;
        });
        const hour = new Date(sale.timestamp).getHours();
        hourlyTotals[hour] = (hourlyTotals[hour] || 0) + saleTotal;
        const staff = sale.user || 'Unknown';
        staffTotals[staff] = staffTotals[staff] || { revenue: 0, transactions: 0 };
        staffTotals[staff].revenue += saleTotal;
        staffTotals[staff].transactions += 1;
    });

    const atv = completedTransactions > 0 ? totalSales / completedTransactions : 0;
    const grossSales = sales.filter(isActiveSale).reduce((sum, sale) => sum + calculateSaleBreakdown(sale).grossSales, 0);
    const categoryDetails = Object.entries(categoryTotals).map(([name, revenue]) => ({
        name,
        revenue,
        quantity: menuItems.filter(item => item.category === name).reduce((sum, item) => sum + (itemTotals[item.name]?.quantity || 0), 0),
        topItem: Object.entries(itemTotals).filter(([itemName]) => menuItems.find(item => item.name === itemName)?.category === name).sort((a, b) => b[1].quantity - a[1].quantity)[0]?.[0] || name,
        image: menuItems.find(item => item.category === name)?.image || 'images/placeholder.jpg'
    })).sort((a, b) => b.revenue - a.revenue);
    const mostUsedDiscount = Object.entries(discountUsage).sort((a, b) => b[1] - a[1])[0]?.[0] || 'None';

    return {
        totalSales: totalSales,
        totalCash: Math.max(0, totalCash), // Ensure net cash is not negative
        totalMobile: totalMobile,
        totalDiscount: totalDiscount,
        transactionCount: transactionCount,
        completedTransactions,
        completedTotal,
        voidedTransactions,
        voidedTotal,
        refundedTransactions,
        refundedTotal,
        discountedTransactions,
        averageDiscountPercent: discountedTransactions > 0 ? sales.filter(sale => sale.status !== 'voided' && sale.status !== 'refunded' && Number(sale.discountAmount) > 0).reduce((sum, sale) => { const discountAmount = Number(sale.discountAmount) || 0; const discountedBase = (Number(sale.total) || 0) + discountAmount; return sum + (discountedBase ? discountAmount / discountedBase * 100 : 0); }, 0) / discountedTransactions : 0,
        paymentTotals,
        paymentShareBase: totalCash + totalMobile,
        topItems: Object.entries(itemTotals).sort((a, b) => b[1].quantity - a[1].quantity).slice(0, 5),
        categoryTotals,
        hourlyTotals,
        staffTotals,
        atv: atv
        ,grossSales
        ,totalTax: totalVat
        ,totalVat
        ,totalServiceCharge
        ,netSales: sales.filter(isActiveSale).reduce((sum, sale) => sum + calculateSaleBreakdown(sale).netSales, 0)
        ,categoryDetails
        ,mostUsedDiscount
    };
}

function calculateSaleBreakdown(sale) {
    const grossSales = (sale.items || []).reduce((sum, item) => sum + ((Number(item.price) || 0) + (item.extras || []).reduce((extraSum, extra) => extraSum + (Number(extra.price) || 0), 0)) * (Number(item.quantity) || 0), 0);
    const discountAmount = Number(sale.discountAmount) || 0;
    const afterDiscount = Math.max(0, grossSales - discountAmount);
    const serviceCharge = afterDiscount * ((Number(sale.serviceChargePercent) || 0) / 100);
    const vat = (afterDiscount + serviceCharge) * ((Number(sale.vatPercent) || 0) / 100);
    return { grossSales, discountAmount, netSales: afterDiscount, serviceCharge, vat, totalCollected: afterDiscount + serviceCharge + vat };
}

function calculateSalesTrend(startDate, endDate) {
    const rangeDays = Math.max(1, Math.ceil((endDate - startDate) / 86400000));
    const previousEnd = new Date(startDate);
    previousEnd.setMilliseconds(-1);
    const previousStart = new Date(previousEnd);
    previousStart.setDate(previousStart.getDate() - rangeDays);
    const sumActiveSales = sales => sales.filter(isActiveSale).reduce((sum, sale) => sum + (Number(sale.total) || 0), 0);
    const current = salesHistory.filter(sale => new Date(sale.timestamp) >= startDate && new Date(sale.timestamp) <= endDate);
    const previous = salesHistory.filter(sale => new Date(sale.timestamp) >= previousStart && new Date(sale.timestamp) <= previousEnd);
    const currentSales = sumActiveSales(current);
    const previousSales = sumActiveSales(previous);
    const currentTransactions = current.filter(isActiveSale).length;
    const previousTransactions = previous.filter(isActiveSale).length;
    const change = previousSales ? ((currentSales - previousSales) / previousSales) * 100 : 0;
    const transactionChange = previousTransactions ? ((currentTransactions - previousTransactions) / previousTransactions) * 100 : 0;
    return { currentSales, previousSales, change, currentTransactions, previousTransactions, transactionChange };
}

function calculateManagementComparisons(referenceDate = new Date()) {
    const getWindow = (daysBack, length) => {
        const end = new Date(referenceDate);
        end.setDate(end.getDate() - daysBack);
        end.setHours(23, 59, 59, 999);
        const start = new Date(end);
        start.setDate(start.getDate() - length + 1);
        start.setHours(0, 0, 0, 0);
        return { start, end };
    };
    const sum = (start, end) => salesHistory.filter(sale => {
        const timestamp = new Date(sale.timestamp);
        return isActiveSale(sale) && timestamp >= start && timestamp <= end;
    }).reduce((total, sale) => total + (Number(sale.total) || 0), 0);
    const percentChange = (current, previous) => previous ? ((current - previous) / previous) * 100 : 0;
    const today = getWindow(0, 1);
    const yesterday = getWindow(1, 1);
    const week = getWindow(0, 7);
    const lastWeek = getWindow(7, 7);
    const todaySales = sum(today.start, today.end);
    const yesterdaySales = sum(yesterday.start, yesterday.end);
    const weekSales = sum(week.start, week.end);
    const lastWeekSales = sum(lastWeek.start, lastWeek.end);
    return {
        today: { current: todaySales, previous: yesterdaySales, change: percentChange(todaySales, yesterdaySales) },
        week: { current: weekSales, previous: lastWeekSales, change: percentChange(weekSales, lastWeekSales) }
    };
}

function collectVoidedItems(startDate, endDate) {
    const totals = {};
    voidDetails.filter(entry => {
        const timestamp = new Date(entry.timestamp);
        return entry.actionType !== 'removed' && timestamp >= startDate && timestamp <= endDate;
    }).forEach(entry => (entry.items || (entry.item ? [entry.item] : [])).forEach(item => {
        const name = item.name || 'Unknown';
        totals[name] = (totals[name] || 0) + (Number(item.quantity) || 1);
    }));
    return Object.entries(totals).sort((a, b) => b[1] - a[1]);
}

function collectVoidReasons(startDate, endDate) {
    const reasons = {};
    voidDetails.filter(entry => {
        const timestamp = new Date(entry.timestamp);
        return entry.actionType !== 'removed' && timestamp >= startDate && timestamp <= endDate;
    }).forEach(entry => {
        const reason = String(entry.reason || 'No reason recorded').trim();
        reasons[reason] = (reasons[reason] || 0) + 1;
    });
    return Object.entries(reasons).sort((a, b) => b[1] - a[1]);
}

function buildSalesAnalysisHTML(metrics, reportSales = []) {
    const paymentBase = metrics.paymentShareBase || 0;
    const paymentRows = Object.entries({ Cash: metrics.totalCash, Mobile: metrics.totalMobile }).map(([method, amount]) => `<tr><td class="payment-method-${method.toLowerCase()}"><strong>${method}</strong></td><td class="numeric">Rs ${amount.toFixed(2)}</td><td class="numeric">${paymentBase ? ((amount / paymentBase) * 100).toFixed(1) : '0.0'}%</td></tr>`).join('');
    const maxCategoryRevenue = metrics.categoryDetails[0]?.revenue || 1;
    const categoryCards = metrics.categoryDetails.map(category => `<div class="category-card-report"><div class="category-card-report-main"><img src="${getSafeImagePath(category.image)}" alt="${escapeHtml(category.name)}" onerror="handleImageError(this)"><div><small>Category: ${escapeHtml(category.name)}</small><strong>Rs ${category.revenue.toFixed(2)}</strong></div></div><div class="category-card-report-meta"><span>Top item: ${escapeHtml(category.topItem || category.name)}</span><span>${category.quantity} sold</span></div><div class="category-progress"><span style="width:${Math.min(100, (category.revenue / maxCategoryRevenue) * 100)}%"></span></div></div>`).join('');
    const bestItemRows = metrics.topItems.map(([name, item], index) => `<tr><td><strong>${index + 1}. ${escapeHtml(name)}</strong></td><td class="numeric">${item.quantity}</td><td class="numeric">Rs ${item.revenue.toFixed(2)}</td></tr>`).join('');
    const staffRows = Object.entries(metrics.staffTotals).sort((a, b) => b[1].revenue - a[1].revenue).map(([staff, data]) => `<tr><td>${escapeHtml(staff)}</td><td class="numeric">${data.transactions}</td><td class="numeric">Rs ${data.revenue.toFixed(2)}</td><td class="numeric">Rs ${(data.revenue / Math.max(1, data.transactions)).toFixed(2)}</td></tr>`).join('');
    const comparisons = metrics.comparisons || { today: { current: 0, previous: 0, change: 0 }, week: { current: 0, previous: 0, change: 0 } };
    const trendCard = (label, currentLabel, previousLabel, comparison) => {
        const change = comparison.current - comparison.previous;
        const hasPrevious = comparison.previous > 0;
        const changeClass = change > 0 ? 'positive' : change < 0 ? 'negative' : 'neutral';
        const samePeriod = comparison.current === comparison.previous && comparison.current > 0;
        const changeLabel = samePeriod
            ? 'Same'
            : hasPrevious
            ? `${change >= 0 ? '+' : '-'}Rs ${Math.abs(change).toFixed(2)} (${change >= 0 ? '+' : ''}${((change / comparison.previous) * 100).toFixed(1)}%)`
            : 'New';
        return `<div class="trend-card ${changeClass}">
            <div class="trend-card-heading"><span>${escapeHtml(label)}</span><span class="trend-change">${changeLabel}</span></div>
            <div class="trend-card-values"><div><small>${escapeHtml(currentLabel)}</small><strong>Rs ${comparison.current.toFixed(2)}</strong></div><div><small>${escapeHtml(previousLabel)}</small><strong>Rs ${comparison.previous.toFixed(2)}</strong></div></div>
        </div>`;
    };
    const peakHour = Object.entries(metrics.hourlyTotals).sort((a, b) => b[1] - a[1])[0];
    const orderRows = reportSales.map(sale => {
        const breakdown = calculateSaleBreakdown(sale);
        const items = (sale.items || []).map(item => `${escapeHtml(item.name)} x${Number(item.quantity) || 0}`).join(', ');
        return `<tr><td>${escapeHtml(sale.orderNumber || '-')}</td><td>${escapeHtml(new Date(sale.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }))}</td><td>${escapeHtml(String(sale.table || '-'))}</td><td>${items || '-'}</td><td class="numeric">${(sale.items || []).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)}</td><td class="numeric">Rs ${breakdown.grossSales.toFixed(2)}</td><td class="numeric">Rs ${breakdown.discountAmount.toFixed(2)}</td><td class="numeric">Rs ${breakdown.vat.toFixed(2)}</td><td class="numeric">Rs ${Number(sale.total || 0).toFixed(2)}</td><td>${escapeHtml((sale.paymentMethods || []).map(payment => payment.method).join(' + ') || '-')}</td><td>${escapeHtml(sale.status || 'completed')}</td><td>${escapeHtml(sale.user || 'Unknown')}</td></tr>`;
    }).join('');
    const voidRefundDetails = reportSales.filter(sale => ['voided', 'refunded'].includes(sale.status)).map(sale => `<tr><td>${escapeHtml(sale.status)}</td><td>${escapeHtml(sale.orderNumber || '-')}</td><td>Rs ${Number(sale.total || 0).toFixed(2)}</td><td>${escapeHtml(sale.reason || 'No reason recorded')}</td><td>${escapeHtml(sale.user || 'Unknown')}</td><td>${escapeHtml(new Date(sale.timestamp).toLocaleString('en-GB'))}</td></tr>`).join('');
    return `<div class="sales-analysis">
        <div class="executive-summary" data-sales-tab-section="overview"><div class="executive-card primary"><span class="metric-label">Total Collected</span><span class="metric-value">Rs ${metrics.totalSales.toFixed(2)}</span><small class="metric-subvalue">Completed orders after VAT and service charge</small></div><div class="executive-card orders"><span class="metric-label">Orders</span><span class="metric-value">${metrics.completedTransactions}</span><small class="metric-subvalue">${metrics.voidedTransactions} voided (${metrics.voidedTotal.toFixed(2)}) | ${metrics.refundedTransactions} refunded (${metrics.refundedTotal.toFixed(2)})</small></div><div class="executive-card average"><span class="metric-label">Average Order</span><span class="metric-value">Rs ${metrics.atv.toFixed(2)}</span><small class="metric-subvalue">Per completed order</small></div><div class="executive-card peak"><span class="metric-label">Peak Hour</span><span class="metric-value">${peakHour ? `${String(peakHour[0]).padStart(2, '0')}:00-${String(Number(peakHour[0]) + 1).padStart(2, '0')}:00` : 'Not enough data'}</span><small class="metric-subvalue">${peakHour ? `Rs ${peakHour[1].toFixed(2)} · ${metrics.hourlyTotals[peakHour[0]] ? 1 : 0} order(s)` : 'No completed orders'}</small></div></div>
        <div class="payment-tally" data-sales-tab-section="overview"><div class="payment-tally-card cash"><div><span class="metric-label"><i class="fas fa-money-bill-wave"></i> Net Cash Collected</span><strong>Rs ${metrics.totalCash.toFixed(2)}</strong></div><small>Cash tendered less change</small></div><div class="payment-tally-card mobile"><div><span class="metric-label"><i class="fas fa-mobile-screen-button"></i> Mobile Collected</span><strong>Rs ${metrics.totalMobile.toFixed(2)}</strong></div><small>Supported digital payments</small></div></div>
        <div class="trend-grid" data-sales-tab-section="overview">${trendCard('Today vs yesterday', 'Today', 'Yesterday', comparisons.today)}${trendCard('Week to date vs same days last week', 'This week', 'Last week', comparisons.week)}</div>
        <section class="report-panel trend-panel" data-sales-tab-section="trends"><div class="report-panel-title"><h4><i class="fas fa-chart-line text-primary me-2"></i>Sales Trend</h4><small>Hourly revenue</small></div><div class="trend-chart-wrap"><canvas id="sales-trend-chart"></canvas></div></section>
        <section class="report-panel" data-sales-tab-section="overview"><div class="report-panel-title"><h4><i class="fas fa-credit-card text-primary me-2"></i>Payment Split</h4><small>Completed transactions</small></div><div class="payment-panel-grid"><div class="report-table-wrap payment-split-wrap"><table class="modern-table payment-split-table"><thead><tr><th>Method</th><th class="numeric">Total</th><th class="numeric">Share</th></tr></thead><tbody>${paymentRows}</tbody></table></div><div class="payment-chart-wrap"><canvas id="payment-chart"></canvas></div></div></section>
        <section class="report-panel" data-sales-tab-section="items"><div class="report-panel-title"><h4><i class="fas fa-layer-group text-primary me-2"></i>Category Revenue</h4><small>Revenue and quantity sold</small></div><div class="category-grid">${categoryCards || '<div class="empty-state">No category sales</div>'}</div></section>
        <section class="report-panel" data-sales-tab-section="items"><div class="report-panel-title"><h4><i class="fas fa-ranking-star text-primary me-2"></i>Best Selling Items</h4><small>Top 5 by quantity</small></div><div class="report-table-wrap"><table class="modern-table"><thead><tr><th>Item</th><th class="numeric">Qty Sold</th><th class="numeric">Revenue</th></tr></thead><tbody>${bestItemRows || '<tr><td colspan="3">No items sold</td></tr>'}</tbody></table></div></section>
        <section class="report-panel" data-sales-tab-section="staff"><div class="report-panel-title"><h4><i class="fas fa-users text-primary me-2"></i>Staff Performance</h4><small>Orders, sales and average bill</small></div><div class="report-table-wrap"><table class="modern-table"><thead><tr><th>Staff</th><th class="numeric">Orders</th><th class="numeric">Sales</th><th class="numeric">Avg Bill</th></tr></thead><tbody>${staffRows || '<tr><td colspan="4">No staff sales</td></tr>'}</tbody></table></div></section>
        <section class="report-panel" data-sales-tab-section="overview"><div class="report-panel-title"><h4><i class="fas fa-tags text-warning me-2"></i>Discount Summary</h4><small>Applied discounts</small></div><div class="discount-grid"><div class="discount-card"><span>Total Discount</span><strong>Rs ${metrics.totalDiscount.toFixed(2)}</strong></div><div class="discount-card"><span>Discounted Orders</span><strong>${metrics.discountedTransactions}</strong></div><div class="discount-card"><span>Most Used</span><strong>${escapeHtml(metrics.mostUsedDiscount)}</strong></div></div></section>
        <section class="report-panel" data-sales-tab-section="overview"><div class="report-panel-title"><h4><i class="fas fa-calculator text-primary me-2"></i>Accounting Summary</h4><small>VAT added at checkout</small></div><div class="report-footer-summary"><div><span>Gross Sales</span><strong>Rs ${metrics.grossSales.toFixed(2)}</strong></div><div><span>Discounts</span><strong>- Rs ${metrics.totalDiscount.toFixed(2)}</strong></div><div><span>Net Sales</span><strong>Rs ${metrics.netSales.toFixed(2)}</strong></div><div><span>Service Charge</span><strong>Rs ${metrics.totalServiceCharge.toFixed(2)}</strong></div><div><span>VAT</span><strong>Rs ${metrics.totalVat.toFixed(2)}</strong></div><div><span>Total Collected</span><strong>Rs ${metrics.totalSales.toFixed(2)}</strong></div></div></section>
        <section class="report-panel" data-sales-tab-section="overview"><div class="report-panel-title"><h4><i class="fas fa-cash-register text-primary me-2"></i>Cash Reconciliation</h4><small>Drawer count can be completed at shift close</small></div><div class="report-footer-summary"><div><span>Cash Tendered</span><strong>Rs ${(metrics.totalCash + reportSales.filter(isActiveSale).reduce((sum, sale) => sum + Number(sale.change || 0), 0)).toFixed(2)}</strong></div><div><span>Change Given</span><strong>Rs ${reportSales.filter(isActiveSale).reduce((sum, sale) => sum + Number(sale.change || 0), 0).toFixed(2)}</strong></div><div><span>Net Cash Collected</span><strong>Rs ${metrics.totalCash.toFixed(2)}</strong></div><div><span>Expected / Actual Drawer</span><strong>Not counted</strong></div><div><span>Over / Short</span><strong>Not counted</strong></div></div></section>
        <section class="report-panel order-detail-panel" data-sales-tab-section="overview"><div class="report-panel-title"><h4><i class="fas fa-receipt text-primary me-2"></i>Order Detail</h4><small>Completed, voided, and refunded records</small></div><div class="report-table-wrap order-detail-wrap"><table class="modern-table order-detail-table"><thead><tr><th>Order #</th><th>Time</th><th>Table</th><th>Items</th><th>Qty</th><th>Gross</th><th>Discount</th><th>VAT</th><th>Net / Total</th><th>Payment</th><th>Status</th><th>Staff</th></tr></thead><tbody>${orderRows || '<tr><td colspan="12">No sales in selected period.</td></tr>'}</tbody></table></div></section>
        <section class="report-panel" data-sales-tab-section="overview"><div class="report-panel-title"><h4><i class="fas fa-flag text-warning me-2"></i>Voids and Refunds</h4><small>Amount, reason, staff, and time</small></div><div class="report-table-wrap"><table class="modern-table"><thead><tr><th>Status</th><th>Order #</th><th>Amount</th><th>Reason</th><th>Staff</th><th>Time</th></tr></thead><tbody>${voidRefundDetails || '<tr><td colspan="6">No voids or refunds.</td></tr>'}</tbody></table></div></section>
        <p class="report-generated text-muted mt-3 mb-0"><i class="fas fa-clock me-1"></i>Report generated on ${new Date().toLocaleString('en-GB')}</p>
    </div>`;
}

function emailSalesReport() {
    const startDate = document.getElementById('start-date')?.value || '';
    const endDate = document.getElementById('end-date')?.value || '';
    const subject = encodeURIComponent(`Taboche POS Sales Report: ${startDate} to ${endDate}`);
    const body = encodeURIComponent(`Sales report for ${startDate} to ${endDate}. Please attach the exported CSV or PDF report.`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
}

function printSalesSummary() {
    const content = document.getElementById('sales-report-content');
    if (!content) return;
    printContent(`<!DOCTYPE html><html><head><title>Sales Summary</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#111}.modern-table{width:100%;border-collapse:collapse;margin-bottom:18px}.modern-table th,.modern-table td{padding:8px;border-bottom:1px solid #ddd;text-align:left}.numeric{text-align:right}.analysis-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px}</style></head><body><h1>Sales Summary</h1>${content.innerHTML}</body></html>`);
}

function renderSalesCharts(metrics) {
    if (typeof Chart === 'undefined') return;
    Object.values(activeChartInstances).forEach(chart => chart.destroy());
    activeChartInstances = {};
    ['payment-chart', 'sales-trend-chart'].forEach(id => {
        const canvas = document.getElementById(id);
        const existingChart = canvas && Chart.getChart(canvas);
        if (existingChart) existingChart.destroy();
    });
    const paymentLabels = ['Cash', 'Mobile'];
    const paymentValues = [metrics.totalCash, metrics.totalMobile];
    const paymentCanvas = document.getElementById('payment-chart');
    const paymentPercentPlugin = { id: 'paymentPercentLabels', afterDraw(chart) { const total = paymentValues.reduce((sum, value) => sum + value, 0); if (!total) return; const context = chart.ctx; const meta = chart.getDatasetMeta(0); context.save(); context.fillStyle = '#fff'; context.font = '700 12px Inter, sans-serif'; context.textAlign = 'center'; context.textBaseline = 'middle'; meta.data.forEach((arc, index) => { const position = arc.tooltipPosition(); context.fillText(`${((paymentValues[index] / total) * 100).toFixed(0)}%`, position.x, position.y); }); context.restore(); } };
    if (paymentCanvas) activeChartInstances['payment-chart'] = new Chart(paymentCanvas, { type: 'doughnut', data: { labels: paymentLabels, datasets: [{ data: paymentValues, backgroundColor: ['#16a34a', '#2563eb', '#7c3aed'], borderWidth: 3, borderColor: '#fff' }] }, plugins: [paymentPercentPlugin], options: { cutout: '58%', responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: context => `${context.label}: Rs ${Number(context.raw || 0).toFixed(2)}` } } } } });
    const hours = Object.keys(metrics.hourlyTotals).sort((a, b) => Number(a) - Number(b));
    const peakHour = hours.reduce((peak, hour) => metrics.hourlyTotals[hour] > (metrics.hourlyTotals[peak] || 0) ? hour : peak, hours[0]);
    const trendCanvas = document.getElementById('sales-trend-chart');
    if (trendCanvas) activeChartInstances['sales-trend-chart'] = new Chart(trendCanvas, { type: 'line', data: { labels: hours.map(hour => `${String(hour).padStart(2, '0')}:00`), datasets: [{ label: 'Hourly Revenue', data: hours.map(hour => metrics.hourlyTotals[hour]), borderColor: '#2563eb', backgroundColor: 'rgba(37, 99, 235, .12)', pointBackgroundColor: hours.map(hour => hour === peakHour ? '#dc2626' : '#2563eb'), pointRadius: hours.map(hour => hour === peakHour ? 7 : 3), fill: true, tension: .35 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: context => `Rs ${Number(context.raw || 0).toFixed(2)}` } } }, scales: { y: { beginAtZero: true, ticks: { callback: value => `Rs ${value}` } } } } });
}

function exportSalesExcel() {
    const startDate = document.getElementById('start-date').value;
    const endDate = document.getElementById('end-date').value;
    const rows = salesHistory.filter(sale => {
        const date = new Date(sale.timestamp);
        return isActiveSale(sale) && date >= new Date(startDate) && date <= new Date(`${endDate}T23:59:59`);
    });
    const tableRows = rows.map(sale => `<tr><td>${escapeHtml(sale.orderNumber)}</td><td>${escapeHtml(String(sale.table || ''))}</td><td>${Number(sale.total || 0).toFixed(2)}</td><td>${escapeHtml((sale.paymentMethods || []).map(pm => pm.method).join(' + '))}</td><td>${escapeHtml(new Date(sale.timestamp).toLocaleString('en-GB'))}</td></tr>`).join('');
    const workbook = `<table><thead><tr><th>Order ID</th><th>Table</th><th>Total Rs</th><th>Payment</th><th>Timestamp</th></tr></thead><tbody>${tableRows}</tbody></table>`;
    const blob = new Blob([`<html><body>${workbook}</body></html>`], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sales_report_${startDate}_to_${endDate}.xls`;
    link.click();
    URL.revokeObjectURL(url);
    notifications.show('Excel report exported.', 'success');
}

function exportSalesReport() {
    const startDate = document.getElementById('start-date').value;
    const endDate = document.getElementById('end-date').value;
    const filteredSales = salesHistory.filter(sale => {
        const saleDate = new Date(sale.timestamp);
        return isActiveSale(sale) && saleDate >= new Date(startDate) && saleDate <= new Date(endDate);
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

    const csvContent = csvRows.join('\n');
    const csvBlob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const encodedUri = URL.createObjectURL(csvBlob);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `sales_report_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(encodedUri);
    notifications.show('Sales report exported to CSV.', 'success');
}

function showItemsSoldContent(e) {
    e.preventDefault();

    const getMarkup = () => {
        // Collect all unique categories from menuItems
        const categories = [...new Set(menuItems.map(item => item.category))];
        const categoryOptions = categories.map(cat => `<option value="${cat}">${cat}</option>`).join('');

        return `
            <div class="items-sold-dashboard report-container items-sold">
                <div class="report-header"><h4><i class="fas fa-boxes-stacked text-success me-2"></i>Items Sold</h4><span class="report-badge">Performance</span></div>
                <div class="filter-bar items-sold-filters">
                    <div class="filter-group items-sold-date-group"><label><i class="far fa-calendar-alt"></i> Date Range</label><div class="date-range"><div class="date-field"><span>From</span><input type="date" id="items-sold-start-date" class="filter-input" aria-label="Items sold start date"></div><span class="date-separator">to</span><div class="date-field"><span>To</span><input type="date" id="items-sold-end-date" class="filter-input" aria-label="Items sold end date"></div></div></div>
                    <div class="filter-group"><label for="items-sold-category"><i class="fas fa-tag"></i> Category</label><select id="items-sold-category" class="filter-select">
                            <option value="all">All Categories</option>${categoryOptions}
                        </select>
                    </div>
                    <div class="filter-group"><label for="items-sold-sort"><i class="fas fa-arrow-up-wide-short"></i> Sort By</label><select id="items-sold-sort" class="filter-select">
                            <option value="revenue">Revenue</option>
                            <option value="quantity">Quantity</option>
                        </select>
                    </div>
                </div>
                <div id="items-sold-table-container" class="table-responsive">
                    <table class="modern-table" id="items-sold-table">
                        <thead><tr><th>Item</th><th class="numeric">Qty Sold</th><th class="numeric">Revenue</th><th class="numeric">% of Total</th></tr></thead>
                        <tbody id="items-sold-tbody"></tbody>
                    </table>
                </div>
                <div id="no-data-container" class="empty-state" style="display: none;"><i class="fas fa-box-open"></i><p>No items sold in this period</p><span class="text-muted small">Try adjusting your filters</span></div>
                <button id="export-items-sold-csv" class="export-btn items-sold-export mt-3 w-100"><i class="fas fa-file-csv"></i> Export Full Report to CSV</button>
            </div>
        `;
    };

    const renderReport = () => {
        showLoadingSpinner();
        const reportBody = document.getElementById('items-sold-tbody');
        if (reportBody) reportBody.innerHTML = '<tr><td colspan="4"><div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>Loading...</p></div></td></tr>';
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
            return isActiveSale(s) && saleDate >= start && saleDate <= end;
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
            const totalRevenue = displayData.reduce((sum, item) => sum + item.totalRevenue, 0);
            tbody.innerHTML = displayData.map(item => `<tr><td class="item-name-col">${escapeHtml(item.name)}</td><td class="numeric">${item.quantity.toLocaleString()}</td><td class="numeric">Rs ${item.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td><td class="numeric">${totalRevenue ? ((item.totalRevenue / totalRevenue) * 100).toFixed(1) : '0.0'}%</td></tr>`).join('');
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
            return isActiveSale(s) && saleDate >= start && saleDate <= end;
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
        document.querySelectorAll('.filter-input, .filter-select').forEach(el => el.addEventListener('change', renderReport));
        document.getElementById('export-items-sold-csv').addEventListener('click', exportToCSV);
        renderReport();
    });
}

function showOrderHistoryContent(e) {
    e.preventDefault();

    showSidebarContentModal('Order History', `
        <div class="report-container order-history">
            <div class="report-header"><h4><i class="fas fa-history text-info me-2"></i>Order History</h4><span class="report-badge" id="order-count-badge">0 orders</span></div>
            <div class="filter-bar order-history-filters">
                <div class="filter-group"><label for="history-start-date"><i class="fas fa-calendar-days"></i> Date Range</label><div class="date-range"><input type="date" id="history-start-date" class="filter-input" value="${toLocalISODate()}"><span class="date-separator">to</span><input type="date" id="history-end-date" class="filter-input" value="${toLocalISODate()}"></div></div>
                <div class="filter-group"><label for="history-status-filter">Status</label><select id="history-status-filter" class="filter-select">
                    <option value="all">All Statuses</option>
                    <option value="completed">Completed</option>
                    <option value="pending">Pending</option>
                    <option value="voided">Voided</option>
                </select>
                </div>
                <div class="filter-group search-group"><label for="history-search"><i class="fas fa-magnifying-glass"></i> Search</label><input type="text" id="history-search" class="filter-input" placeholder="Order ID, table, item..."></div>
                <div class="history-filter-actions"><button id="filter-history" class="btn-primary-action" type="button"><i class="fas fa-filter"></i> Apply Filters</button>
                <button id="show-all-history" class="btn-export" type="button"><i class="fas fa-list"></i> Show All</button></div>
            </div>
            <div id="order-history-results">
                <div class="summary-grid">
                    <div class="summary-card history-summary-total"><i class="fas fa-receipt"></i><span class="summary-label">Total Orders</span><span class="summary-value" id="total-orders-count">0</span></div>
                    <div class="summary-card history-summary-completed"><i class="fas fa-circle-check"></i><span class="summary-label">Completed Orders</span><span class="summary-value" id="completed-orders-count">0</span></div>
                    <div class="summary-card history-summary-voided"><i class="fas fa-ban"></i><span class="summary-label">Voided Orders</span><span class="summary-value" id="voided-orders-count">0</span></div>
                    <div class="summary-card history-summary-revenue"><i class="fas fa-coins"></i><span class="summary-label">Revenue</span><span class="summary-value" id="total-revenue">Rs 0.00</span></div>
                    <div class="summary-card history-summary-average"><i class="fas fa-chart-line"></i><span class="summary-label">Average Order</span><span class="summary-value" id="avg-order-value">Rs 0.00</span></div>
                </div>
                <div id="order-history-list"></div>
            </div>
            <div id="pagination" class="modern-pagination"></div>
        </div>
    `, () => {
        document.getElementById('filter-history')?.addEventListener('click', () => renderOrderHistory(1, false));
        document.getElementById('show-all-history')?.addEventListener('click', () => renderOrderHistory(1, true));

        document.getElementById('history-search')?.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                renderOrderHistory(1, false);
            }
        });

        const today = new Date();
        const earliestHistoryDate = orderHistory.length
            ? new Date(Math.min(...orderHistory.map(order => new Date(order.timestamp).getTime())))
            : today;

        const startDateEl = document.getElementById('history-start-date');
        const endDateEl = document.getElementById('history-end-date');
        if (startDateEl) startDateEl.valueAsDate = earliestHistoryDate;
        if (endDateEl) endDateEl.valueAsDate = today;

        currentPage = 1;
        orderHistoryShowAll = false;
        renderOrderHistory(currentPage, false);
    });
}

function renderOrderHistory(pageToShow = currentPage, showAll = orderHistoryShowAll) {
    try {
        const requestedPage = Number.isInteger(pageToShow) && pageToShow > 0
            ? pageToShow
            : parseInt(pageToShow, 10) || currentPage || 1;

        currentPage = Math.max(1, requestedPage);
        orderHistoryShowAll = Boolean(showAll);

        const startDateElement = document.getElementById('history-start-date');
        const endDateElement = document.getElementById('history-end-date');
        const statusFilterElement = document.getElementById('history-status-filter');
        const searchElement = document.getElementById('history-search');
        if (!startDateElement || !endDateElement || !statusFilterElement || !searchElement) return;
        const historyLoading = document.getElementById('order-history-list');
        if (historyLoading) historyLoading.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>Loading orders...</p></div>';

        const startDate = new Date(startDateElement.value);
        const endDate = new Date(endDateElement.value);
        endDate.setHours(23, 59, 59, 999);

        const statusFilter = statusFilterElement.value || 'all';
        const searchQuery = (searchElement.value || '').trim().toLowerCase();

        const filteredHistory = orderHistory.filter(order => {
            if (!order || !order.timestamp) return false;
            const orderDate = new Date(order.timestamp);

            return (
                orderDate >= startDate &&
                orderDate <= endDate &&
                (statusFilter === 'all' || (order.status && order.status.toLowerCase() === statusFilter.toLowerCase())) &&
                (!searchQuery || matchesSearch(order, searchQuery))
            );
        }).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        const paginatedHistory = orderHistoryShowAll
            ? filteredHistory
            : paginateOrders(filteredHistory, currentPage);

        updateOrderHistorySummaryUI(filteredHistory);

        const historyDiv = document.getElementById('order-history-list');
        if (historyDiv) {
            historyDiv.innerHTML = paginatedHistory.length > 0
                ? paginatedHistory.map(order => renderOrderHistoryItem(order)).join('')
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
    const status = String(order.status || 'pending').replace(/_/g, ' ').toUpperCase();
    const tableLabel = order.table ? String(order.table) : 'N/A';
    const paymentLabel = Array.isArray(order.paymentMethods) && order.paymentMethods.length
        ? order.paymentMethods.map(pm => pm.method).join(' + ')
        : 'Not recorded';
    const timestamp = order.timestamp
        ? new Date(order.timestamp).toLocaleString('en-GB', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        })
        : 'Unknown';
    const itemSummary = order.items?.length
        ? order.items.map(item => `${escapeHtml(item.name || 'Unknown')} x${item.quantity || 1} (Rs ${((Number(item.price) || 0) + (item.extras || []).reduce((sum, extra) => sum + (Number(extra.price) || 0), 0)).toFixed(2)})`).join(', ')
        : 'No items available';
    return `
        <div class="order-history-item">
            <div class="order-history-header">
                <strong>Order ID: #${escapeHtml(String(order.orderNumber || 'N/A'))}</strong>
                <span class="order-history-status ${statusClass}">${status}</span>
            </div>
            <div class="order-history-meta">
                <span><i class="fas fa-calendar-days"></i> Date &amp; Time: ${escapeHtml(timestamp)}</span>
                <span><i class="fas fa-chair"></i> Table: ${escapeHtml(tableLabel)}</span>
            </div>
            <div class="order-history-items-line">
                <span class="order-history-line-label">Items:</span>
                <span>${itemSummary}</span>
            </div>
            <div class="order-history-payment-line">
                <span><span class="order-history-line-label">Payment Method:</span> ${escapeHtml(paymentLabel)}</span>
                <strong>Total: Rs ${Number(order.total || 0).toFixed(2)}</strong>
            </div>
            <div class="order-history-actions">
                <button class="view-receipt-btn" data-order-number="${escapeHtml(order.orderNumber)}"><i class="fas fa-receipt"></i> View Receipt</button>
                ${order.status === 'completed' && order.paymentMethods?.length ? `<button class="edit-payment-btn" data-order-number="${escapeHtml(order.orderNumber)}"><i class="fas fa-pen"></i> Edit Payment</button>` : ''}
                ${order.status === 'completed'
                    ? `<button class="void-order-btn" data-order-number="${escapeHtml(order.orderNumber)}"><i class="fas fa-ban"></i> Void Order</button>`
                    : `<button class="void-reason-btn" data-order-number="${escapeHtml(order.orderNumber)}"><i class="fas fa-circle-info"></i> Void Reason</button>`}
            </div>
        </div>
    `;
}

async function editPaymentMethod(orderNumber) {
    const order = orderHistory.find(item => item.orderNumber === orderNumber);
    if (!order || order.status !== 'completed' || !Array.isArray(order.paymentMethods) || order.paymentMethods.length === 0) {
        notifications.show('Payment details are unavailable for this order.', 'warning');
        return;
    }

    if (order.paymentMethods.length !== 1) {
        notifications.show('Editing split payments is not supported yet.', 'warning');
        return;
    }

    const currentPayment = order.paymentMethods[0];
    const currentMethod = currentPayment.method;
    const requestedMethod = await showPromptModal(
        'Edit Payment Method',
        `Order ${orderNumber} is recorded as ${currentMethod}. Enter Cash or Mobile.`,
        { initialValue: currentMethod, placeholder: 'Cash or Mobile' }
    );
    if (!requestedMethod) return;

    const normalizedMethod = requestedMethod.trim().toLowerCase();
    const method = normalizedMethod === 'cash' ? 'Cash' : normalizedMethod === 'mobile' ? 'Mobile' : null;
    if (!method) {
        notifications.show('Payment method must be Cash or Mobile.', 'warning');
        return;
    }

    const requestedAmount = await showPromptModal(
        'Edit Payment Amount',
        `Enter the actual ${method} payment amount for order ${orderNumber}.`,
        { initialValue: Number(currentPayment.amount || 0).toFixed(2), placeholder: 'Amount' }
    );
    if (!requestedAmount) return;

    const amount = Number(requestedAmount);
    if (!Number.isFinite(amount) || amount < 0) {
        notifications.show('Payment amount must be a valid positive number.', 'warning');
        return;
    }

    const updatePaymentMethod = sale => {
        if (sale?.orderNumber === orderNumber && Array.isArray(sale.paymentMethods) && sale.paymentMethods.length === 1) {
            sale.paymentMethods[0].method = method;
            sale.paymentMethods[0].amount = Number(amount.toFixed(2));
            const recalculated = calculateSaleAmountsForSale(sale);
            sale.total = recalculated.total;
            sale.vatAmount = recalculated.vatAmount;
            sale.serviceChargeAmount = recalculated.serviceChargeAmount;
            sale.change = Math.max(0, Number((amount - recalculated.total).toFixed(2)));
        }
    };
    const saleEntry = salesHistory.find(sale => sale.orderNumber === orderNumber);
    if (!saleEntry) {
        notifications.show('Order not found in sales history.', 'error');
        return;
    }
    updatePaymentMethod(order);
    updatePaymentMethod(saleEntry);
    persistAllData();
    renderOrderHistory(currentPage, orderHistoryShowAll);
    notifications.show(`Payment updated to ${method} Rs ${amount.toFixed(2)}. Reports will reflect the change.`, 'success');
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
    const completedOrders = filteredHistory.filter(order => order.status === 'completed').length;
    const voidedOrders = filteredHistory.filter(order => order.status === 'voided').length;
    const totalRevenue = filteredHistory.reduce((sum, order) => sum + (order.total || 0), 0);
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    document.getElementById('total-orders-count').textContent = totalOrders;
    document.getElementById('completed-orders-count').textContent = completedOrders;
    document.getElementById('voided-orders-count').textContent = voidedOrders;
    document.getElementById('total-revenue').textContent = `Rs ${totalRevenue.toFixed(2)}`;
    document.getElementById('avg-order-value').textContent = `Rs ${avgOrderValue.toFixed(2)}`;
    const badge = document.getElementById('order-count-badge');
    if (badge) badge.textContent = `${totalOrders} order${totalOrders === 1 ? '' : 's'}`;
}

function renderOrderHistoryPagination(totalOrders, page) {
    const pagination = document.getElementById('pagination');
    if (!pagination) return;

    pagination.innerHTML = '';
    const totalPages = Math.max(1, Math.ceil(totalOrders / itemsPerPage));

    const makeButton = (label, handler, isActive = false) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = label;
        if (isActive) btn.classList.add('active');
        btn.addEventListener('click', handler);
        return btn;
    };

    if (orderHistoryShowAll) {
        const allInfo = document.createElement('span');
        allInfo.textContent = `Showing all ${totalOrders} records.`;
        allInfo.style.color = '#444';
        pagination.appendChild(allInfo);

        if (totalOrders > itemsPerPage) {
            pagination.appendChild(makeButton('Show paged view', () => renderOrderHistory(1, false)));
        }
        return;
    }

    if (totalPages <= 1) return;

    if (page > 1) {
        pagination.appendChild(makeButton('« Previous', () => renderOrderHistory(page - 1)));
    }

    let startPage = Math.max(1, page - 2);
    let endPage = Math.min(totalPages, page + 2);

    if (startPage > 1) {
        pagination.appendChild(makeButton('1', () => renderOrderHistory(1)));
        if (startPage > 2) {
            const ellipsis = document.createElement('span');
            ellipsis.textContent = '...';
            pagination.appendChild(ellipsis);
        }
    }

    for (let i = startPage; i <= endPage; i++) {
        pagination.appendChild(makeButton(String(i), () => renderOrderHistory(i), i === page));
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            const ellipsis = document.createElement('span');
            ellipsis.textContent = '...';
            pagination.appendChild(ellipsis);
        }
        pagination.appendChild(makeButton(String(totalPages), () => renderOrderHistory(totalPages)));
    }

    if (page < totalPages) {
        pagination.appendChild(makeButton('Next »', () => renderOrderHistory(page + 1)));
    }
}


function showVoidDetailsContent(e) {
    if (e) e.preventDefault();
    
    showSidebarContentModal('Void / Remove Details', `
        <div class="report-container void-details">
            <div class="report-header"><h4><i class="fas fa-ban text-danger me-2"></i>Void / Removal Log</h4><span class="report-badge warning">Audit Trail</span></div>
            <p class="text-muted">Shows voids and item removals with date, time, table, reason, and staff name.</p>
            <div class="filter-bar">
                <div class="filter-group"><label for="void-start-date">From</label><input type="date" id="void-start-date" class="filter-input"></div>
                <div class="filter-group"><label for="void-end-date">To</label><input type="date" id="void-end-date" class="filter-input"></div>
                <div class="filter-group"><label for="void-type-filter">Type</label><select id="void-type-filter" class="filter-select"><option value="all">All Types</option><option value="voided">Voided</option><option value="removed">Removed</option></select></div>
                <button id="filter-voids" class="btn-primary-action">Filter</button><button id="export-voids" class="btn-export"><i class="fas fa-file-csv"></i> Export</button>
            </div>
            <div id="void-details-list" class="table-responsive">
                <p class="text-center text-muted mt-4">Loading void/remove records...</p>
            </div>
        </div>
    `, () => {
        try {
            // Set dates to today
            const today = toLocalISODate();
            const startDateEl = document.getElementById('void-start-date');
            const endDateEl = document.getElementById('void-end-date');
            
            if (startDateEl) startDateEl.value = today;
            if (endDateEl) endDateEl.value = today;

            // Render void details
            renderVoidDetails();
            
            // Attach event listeners
            const filterBtn = document.getElementById('filter-voids');
            const exportBtn = document.getElementById('export-voids');
            
            if (filterBtn) {
                filterBtn.removeEventListener('click', filterVoidDetails);
                filterBtn.addEventListener('click', filterVoidDetails);
            }
            
            if (exportBtn) {
                exportBtn.removeEventListener('click', exportVoidDetails);
                exportBtn.addEventListener('click', exportVoidDetails);
            }
            
            console.log('Void Details modal initialized. Total records:', voidDetails.length);
        } catch (error) {
            console.error('Error initializing Void Details modal:', error);
            notifications.show('Error initializing Void Details: ' + error.message, 'error');
        }
    });
}

function renderVoidDetails() {
    try {
        const list = document.getElementById('void-details-list');
        if (!list) {
            return;
        }
        
        // Get date inputs
        const startDateInput = document.getElementById('void-start-date');
        const endDateInput = document.getElementById('void-end-date');
        
        if (!startDateInput || !endDateInput) {
            return;
        }
        
        const startDate = new Date(startDateInput.value);
        const endDate = new Date(endDateInput.value);
        endDate.setHours(23, 59, 59, 999);
        
        const filteredVoids = voidDetails.filter(item => {
            if (!item.timestamp) return false;
            const itemDate = new Date(item.timestamp);
            const typeFilter = document.getElementById('void-type-filter')?.value || 'all';
            return itemDate >= startDate && itemDate <= endDate && (typeFilter === 'all' || (item.actionType || 'voided') === typeFilter);
        });

        console.log('Filtered void records:', filteredVoids.length);

        const removedCount = filteredVoids.filter(item => item.actionType === 'removed').length;
        const voidCount = filteredVoids.length - removedCount;

        if (filteredVoids.length === 0) {
            list.innerHTML = '<p class="text-center text-muted mt-4">No void/remove records found for the selected dates.</p>';
            return;
        }

        // Create professional table format
        let tableHTML = `
            <div class="text-muted mb-2">Showing ${filteredVoids.length} records (${removedCount} removed, ${voidCount} voided).</div>
            <table class="void-report-table">
                <thead>
                    <tr>
                        <th>Date & Time</th>
                        <th>Table</th>
                        <th>Type</th>
                        <th>Items</th>
                        <th>Amount</th>
                        <th>Reason</th>
                        <th>Action By</th>
                    </tr>
                </thead>
                <tbody>
        `;

        filteredVoids.forEach(voidItem => {
            const date = voidItem.timestamp 
                ? new Date(voidItem.timestamp).toLocaleString('en-IN', { 
                    year: 'numeric', 
                    month: '2-digit', 
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                })
                : 'Unknown';
            
            const total = voidItem.total ? `Rs ${voidItem.total.toFixed(2)}` : 'Rs 0.00';
            
            let itemsList = '';
            if (voidItem.items && Array.isArray(voidItem.items)) {
                itemsList = voidItem.items
                    .map(i => `<div class="item-line">${escapeHtml(i.name || 'Unknown')} <span class="qty">x${i.quantity || 1}</span></div>`)
                    .join('');
            } else if (voidItem.item) {
                itemsList = `<div class="item-line">${escapeHtml(voidItem.item.name || 'Unknown')} <span class="qty">x${voidItem.item.quantity || 1}</span></div>`;
            } else {
                itemsList = '<div class="item-line text-muted">No items</div>';
            }
            
            const table = escapeHtml(String(voidItem.table || 'Unknown'));
            const actionType = voidItem.actionType === 'removed' ? 'Removed' : 'Voided';
            const actionTypeClass = voidItem.actionType === 'removed' ? 'removed' : 'voided';
            const reason = escapeHtml(voidItem.reason || 'No reason');
            const user = escapeHtml(voidItem.user || 'Unknown');

            tableHTML += `
                <tr>
                    <td class="date-cell">${date}</td>
                    <td class="table-cell"><strong>${table}</strong></td>
                    <td class="type-cell"><span class="void-status ${actionTypeClass}">${actionType}</span></td>
                    <td class="items-cell">${itemsList}</td>
                    <td class="amount-cell"><strong>${total}</strong></td>
                    <td class="reason-cell">${reason}</td>
                    <td class="user-cell">${user}</td>
                </tr>
            `;
        });

        tableHTML += `
                </tbody>
            </table>
        `;

        list.innerHTML = tableHTML;
    } catch (error) {
        console.error('Error rendering void details:', error);
        const list = document.getElementById('void-details-list');
        if (list) {
            list.innerHTML = '<p class="text-center text-danger mt-4">Error loading void records: ' + error.message + '</p>';
        }
        notifications.show('Unable to render void records: ' + error.message, 'error');
    }
}

function filterVoidDetails() {
    renderVoidDetails(); // Simply re-render with current filter settings
}

function exportVoidDetails() {
    try {
        const startDateInput = document.getElementById('void-start-date');
        const endDateInput = document.getElementById('void-end-date');
        
        if (!startDateInput || !endDateInput) {
            notifications.show('Date inputs not found', 'error');
            return;
        }
        
        const startDate = startDateInput.value;
        const endDate = endDateInput.value;
        
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        const filteredVoids = voidDetails.filter(item => {
            if (!item.timestamp) return false;
            const itemDate = new Date(item.timestamp);
            const typeFilter = document.getElementById('void-type-filter')?.value || 'all';
            return itemDate >= new Date(startDate) && itemDate <= endOfDay && (typeFilter === 'all' || (item.actionType || 'voided') === typeFilter);
        });

        if (filteredVoids.length === 0) {
            notifications.show('No void records to export for the selected dates.', 'warning');
            return;
        }

        const csvContent = "data:text/csv;charset=utf-8," +
            "Table,Type,Items,Total,Reason,User,Timestamp\n" +
            filteredVoids.map(e => {
                const itemsStr = e.items && Array.isArray(e.items) 
                    ? e.items.map(i => `${i.name || 'Unknown'} x${i.quantity || 1}`).join('; ')
                    : 'No items';
                const total = e.total ? e.total.toFixed(2) : '0.00';
                const type = e.actionType === 'removed' ? 'Removed' : 'Voided';
                const timestamp = e.timestamp ? new Date(e.timestamp).toLocaleString() : 'Unknown';
                return `"${e.table}","${type}","${itemsStr}",${total},"${e.reason || 'No reason'}","${e.user || 'Unknown'}","${timestamp}"`;
            }).join("\n");
        
        const csvBlob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
        const encodedUri = URL.createObjectURL(csvBlob);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `void_details_${startDate}_to_${endDate}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(encodedUri);
        notifications.show('Void details exported to CSV.', 'success');
    } catch (error) {
        console.error('Error exporting void details:', error);
        notifications.show('Error exporting void details: ' + error.message, 'error');
    }
}


// =========================================================================
// =================== CHECKOUT & PAYMENT FUNCTIONS ========================
// =========================================================================

function persistCheckoutState() {
    saveCheckoutState({
        currentTable,
        paymentAmount,
        discount,
        discountCodeApplied,
        paymentMethods: paymentAllocations.map(pm => ({ ...pm }))
    });
}

function resetCheckoutState() {
    paymentAllocations = [];
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

    const restoredCheckoutState = restoreCheckoutState();
    if (restoredCheckoutState && restoredCheckoutState.currentTable === currentTable) {
        paymentAllocations = Array.isArray(restoredCheckoutState.paymentMethods) ? restoredCheckoutState.paymentMethods : [];
        paymentAmount = typeof restoredCheckoutState.paymentAmount === 'number' ? restoredCheckoutState.paymentAmount : 0;
        discount = typeof restoredCheckoutState.discount === 'number' ? restoredCheckoutState.discount : 0;
        discountCodeApplied = restoredCheckoutState.discountCodeApplied || null;
        const numericInput = document.getElementById('numeric-input');
        if (numericInput) numericInput.value = paymentAmount.toFixed(2);
    } else {
        resetCheckoutState();
    }

    const numericInput = document.getElementById('numeric-input');
    if (numericInput) {
        numericInput.removeAttribute('readonly');
        numericInput.setAttribute('inputmode', 'decimal');
        numericInput.setAttribute('autocomplete', 'off');
        numericInput.setAttribute('autocorrect', 'off');
        numericInput.setAttribute('spellcheck', 'false');
        numericInput.tabIndex = 0;
    }

    updateTotal(); 
    document.getElementById('dialog-total-amount').textContent = calculateTotal().toFixed(2);
    renderPaymentMethods(); 
    updateChange();         
    
    const checkoutDialog = document.getElementById('checkout-dialog');
    if (checkoutDialog) checkoutDialog.style.display = 'block';
    document.documentElement.classList.add('modal-open');
    document.body.classList.add('modal-open');
    persistCheckoutState();
}

function closeCheckoutDialog() {
    const checkoutDialog = document.getElementById('checkout-dialog');
    if (checkoutDialog) checkoutDialog.style.display = 'none';
    document.documentElement.classList.remove('modal-open');
    document.body.classList.remove('modal-open');
    closeQRCodeDialog();
    resetCheckoutState();
    clearCheckoutState();
    renderOrderItems();
    initializeTables();
    updateTotal();
}

function appendNumber(num) {
    const input = document.getElementById('numeric-input');
    if (!input) return;
    let value = input.value;
    
    // Prevent multiple decimal points
    if (num === '.' && value.includes('.')) return;
    
    // Replace '0' with first digit (unless adding decimal)
    if (value === '0' && num !== '.') value = num;
    else value += num;
    
    input.value = value;
    paymentAmount = validateNumericInput(value, 0);
    
    // Debounce updateChange to reduce DOM updates
    clearTimeout(appendNumberTimeout);
    appendNumberTimeout = setTimeout(() => {
        updateChange();
        persistCheckoutState();
    }, 50);
}

function clearInput() {
    const input = document.getElementById('numeric-input');
    if (input) input.value = '0';
    paymentAmount = 0;
    updateChange();
    persistCheckoutState();
}

function setQuickAmount(amount) {
    const input = document.getElementById('numeric-input');
    if (!input) return;

    const total = calculateTotal();
    const paidSoFar = paymentAllocations.reduce((sum, pm) => sum + pm.amount, 0);
    if (total > 0.01 && paidSoFar >= total - 0.01) {
        notifications.show('The bill is already fully paid.', 'info');
        return;
    }

    let finalAmount;
    if (isNaN(amount)) {
        finalAmount = Math.max(0, total - paidSoFar);
    } else {
        const current = parseFloat(input.value) || 0;
        finalAmount = validateNumericInput(current + amount, 0);
    }

    input.value = finalAmount.toFixed(2);
    paymentAmount = finalAmount;
    updateChange();
    persistCheckoutState();
}

function applyDiscount(percentage) {
    if (typeof percentage !== 'number' || percentage < 0 || percentage > 100) {
        console.error("Invalid discount percentage provided.");
        return;
    }

    if (percentage === 0) {
        clearDiscount();
        return;
    }

    discount = percentage;
    discountCodeApplied = null;

    updateTotal();
    document.getElementById('dialog-total-amount').textContent = calculateTotal().toFixed(2);
    updateChange();
    persistCheckoutState();
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
        persistCheckoutState();

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
    persistCheckoutState();
    notifications.show('Discount has been cleared.', 'success');
}

function processPayment(method) {
    const total = calculateTotal();
    const paidSoFar = paymentAllocations.reduce((sum, pm) => sum + pm.amount, 0);
    const remainingDue = Math.max(0, total - paidSoFar);

    if (total <= 0.01) {
        if (paymentAllocations.some(pm => pm.method === method)) {
            notifications.show(`${method} payment is already recorded.`, 'info');
            return;
        }

        paymentAllocations.push({ method, amount: 0 });
        renderPaymentMethods();
        updateChange();
        persistCheckoutState();
        if (method === 'Mobile') displayQRCode();
        return;
    }
    
    if (remainingDue <= 0.01 && paymentAmount === 0) {
        notifications.show('The bill is already fully paid. Click "Complete Payment".', 'info');
        return;
    }

    // Show the QR code as soon as Mobile is selected, even before an amount is entered.
    if (method === 'Mobile') displayQRCode();

    if (paymentAmount <= 0) {
        notifications.show('Please enter a valid payment amount.', 'warning');
        return;
    }
    
    if (method === 'Mobile' && paymentAmount > remainingDue) {
        notifications.show(`Mobile payment cannot exceed the remaining due amount of Rs ${remainingDue.toFixed(2)}`, 'error');
        return;
    }

    paymentAllocations.push({ method, amount: paymentAmount });
    renderPaymentMethods();
    paymentAmount = 0;
    document.getElementById('numeric-input').value = '0';
    updateChange();
    persistCheckoutState();

    if (method === 'Cash') {
        closeQRCodeDialog(); // Always close QR for cash
    }
}

function renderPaymentMethods() {
    const paymentList = document.getElementById('payment-methods');
    if (!paymentList) {
        console.error("Error: Payment list element not found!");
        return;
    }

    paymentList.innerHTML = paymentAllocations.map((pm, index) => `
        <li class="payment-method-${pm.method.toLowerCase()}">
            <span><i class="fas ${pm.method === 'Cash' ? 'fa-money-bill-wave' : 'fa-mobile-screen-button'}"></i> ${pm.method}<strong>Rs ${pm.amount.toFixed(2)}</strong></span>
            <button class="remove-payment-btn" data-index="${index}"><i class="fas fa-xmark"></i> Remove</button>
        </li>
    `).join('');

    if (!paymentList.dataset.listenersAdded) {
        paymentList.addEventListener('click', handlePaymentListClick);
        paymentList.dataset.listenersAdded = 'true';
    }

    const hasMobilePayment = paymentAllocations.some(pm => pm.method === 'Mobile');
    if (hasMobilePayment) {
        displayQRCode();
    } else {
        closeQRCodeDialog();
    }
}

// Event delegation handler for payment list clicks
function handlePaymentListClick(event) {
    const button = event.target.closest('.remove-payment-btn');
    if (button) {
        const index = parseInt(button.dataset.index);
        removePayment(index);
    }
}

function removePayment(index) {
    if (index < 0 || index >= paymentAllocations.length) {
        console.error("Invalid payment method index:", index);
        return;
    }
    
    paymentAllocations.splice(index, 1);
    renderPaymentMethods();
    updateChange(); // Recalculates remaining due, change amount, and button states
    persistCheckoutState();
}

function updateChange() {
    const exactTotal = roundToTwo(calculateTotal());
    const paidSoFar = roundToTwo(paymentAllocations.reduce((sum, pm) => sum + (Number(pm.amount) || 0), 0));

    const remainingDue = Math.max(0, roundToTwo(exactTotal - paidSoFar));
    const changeAmount = Math.max(0, roundToTwo(paidSoFar - exactTotal));
    
    const remainingDueEl = document.getElementById('remaining-due');
    const changeAmountEl = document.getElementById('change-amount');
    const completeBtn = document.getElementById('complete-btn');
    const insufficientMsgEl = document.getElementById('insufficient-message');

    if (remainingDueEl) remainingDueEl.textContent = `Rs ${remainingDue.toFixed(2)}`;
    if (changeAmountEl) changeAmountEl.textContent = `Rs ${changeAmount.toFixed(2)}`;
    
    // Completion requires both enough recorded payment and a selected method.
    if (completeBtn) {
        const hasPaymentMethod = paymentAllocations.length > 0;
        const canComplete = hasPaymentMethod && paidSoFar >= exactTotal - 0.01;
        completeBtn.disabled = !canComplete;
        completeBtn.classList.toggle('payment-ready', canComplete);
        completeBtn.style.opacity = canComplete ? '1' : '0.5';
        completeBtn.style.cursor = canComplete ? 'pointer' : 'not-allowed';
    }

    [remainingDueEl, changeAmountEl].forEach(element => {
        if (!element) return;
        element.classList.remove('payment-value-updated');
        void element.offsetWidth;
        element.classList.add('payment-value-updated');
    });

    const exactButton = document.querySelector('#quick-amounts button[data-amount="exact"]');
    if (exactButton) exactButton.disabled = exactTotal <= 0.01 || paidSoFar >= exactTotal - 0.01;
    
    // Show insufficient message with more clarity
    if (insufficientMsgEl) {
        if (remainingDue > 0.01) {
            insufficientMsgEl.textContent = `Payment is insufficient. Still owed: Rs ${remainingDue.toFixed(2)}`;
            insufficientMsgEl.style.display = 'block';
        } else {
            insufficientMsgEl.style.display = 'none';
        }
    }

}

// 2. CORE CALCULATION ENGINE
function roundToTwo(value) {
    return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function calculateTotal() {
    const tableKey = currentTable || 'current';
    const currentItems = orders[tableKey] && Array.isArray(orders[tableKey]) ? orders[tableKey] : [];
    const currDiscount = (typeof discount === 'number' && discount >= 0) ? discount : 0;
    
    if (currentItems.length === 0) return 0;

    let discountableTotal = 0;
    let nonDiscountableTotal = 0;

    currentItems.forEach(item => {
        const extrasTotal = (item.extras && Array.isArray(item.extras))
            ? item.extras.reduce((s, e) => s + (Number(e.price) || 0), 0)
            : 0;
        const itemTotal = ((Number(item.price) || 0) + extrasTotal) * (Number(item.quantity) || 1);

        if (item.discountable !== false) {
            discountableTotal += itemTotal;
        } else {
            nonDiscountableTotal += itemTotal;
        }
    });

    const discountedPortion = roundToTwo(discountableTotal * (1 - currDiscount / 100));
    const afterDiscount = roundToTwo(discountedPortion + nonDiscountableTotal);
    const serviceCharge = roundToTwo(afterDiscount * (serviceChargePercent / 100));
    const beforeVAT = roundToTwo(afterDiscount + serviceCharge);
    const vat = roundToTwo(beforeVAT * (vatPercent / 100));
    
    return roundToTwo(beforeVAT + vat);
}

function calculateSaleAmounts(items) {
    let discountableTotal = 0;
    let nonDiscountableTotal = 0;

    (items || []).forEach(item => {
        const extrasTotal = (item.extras || []).reduce((sum, extra) => sum + (Number(extra.price) || 0), 0);
        const itemTotal = (Number(item.price) + extrasTotal) * (Number(item.quantity) || 1);
        if (item.discountable !== false) discountableTotal += itemTotal;
        else nonDiscountableTotal += itemTotal;
    });

    const discountAmount = roundToTwo(discountableTotal * (discount / 100));
    const afterDiscount = roundToTwo(discountableTotal - discountAmount + nonDiscountableTotal);
    const serviceChargeAmount = roundToTwo(afterDiscount * (serviceChargePercent / 100));
    const vatAmount = roundToTwo((afterDiscount + serviceChargeAmount) * (vatPercent / 100));
    return { discountAmount, serviceChargeAmount, vatAmount };
}

function calculateSaleAmountsForSale(sale) {
    const grossSales = (sale.items || []).reduce((sum, item) => sum + (
        (Number(item.price) || 0) + (item.extras || []).reduce((extraSum, extra) => extraSum + (Number(extra.price) || 0), 0)
    ) * (Number(item.quantity) || 0), 0);
    const discountAmount = Number(sale.discountAmount) || 0;
    const afterDiscount = roundToTwo(Math.max(0, grossSales - discountAmount));
    const serviceChargeAmount = roundToTwo(afterDiscount * ((Number(sale.serviceChargePercent) || 0) / 100));
    const vatAmount = roundToTwo((afterDiscount + serviceChargeAmount) * ((Number(sale.vatPercent) || 0) / 100));
    return {
        total: roundToTwo(afterDiscount + serviceChargeAmount + vatAmount),
        serviceChargeAmount,
        vatAmount
    };
}

function calculateOriginalTotal() {
    if (!currentTable || !orders[currentTable]) return 0;
    return orders[currentTable].reduce((sum, item) => {
        const extrasTotal = (item.extras || []).reduce((s, e) => s + (e.price || 0), 0);
        return sum + (item.price + extrasTotal) * item.quantity;
    }, 0);
}

function displayQRCode() {
    const qrCodeImage = document.getElementById('qr-code-image');
    const qrCodeDialog = document.getElementById('qr-code-dialog');

    if (!qrCodeImage || !qrCodeDialog) {
        console.error("Error: QR code elements not found!");
        return;
    }

    qrCodeImage.onerror = () => {
        if (qrCodeImage.src.endsWith('/qr.jpeg')) {
            qrCodeImage.src = './qr.png';
        }
    };
    qrCodeImage.src = './qr.jpeg';
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
    let settlementReservation = null;
    if (paymentResetTimer) clearTimeout(paymentResetTimer);
    paymentResetTimer = setTimeout(() => {
        isProcessingPayment = false;
        hideLoadingSpinner();
    }, 15000);

    try {
        const total = calculateTotal();
        const itemCount = orders[currentTable]?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0;
        if (total > largeCheckoutAmount || itemCount > largeCheckoutItemCount) {
            const confirmed = await showConfirmModal('Large checkout', `Large checkout detected: Rs ${total.toFixed(2)} for ${itemCount} item(s). Proceed?`);
            if (!confirmed) {
                return;
            }
        }

        if (paymentAmount > 0) {
            paymentAllocations.push({ method: 'Cash', amount: paymentAmount });
            paymentAmount = 0;
            document.getElementById('numeric-input').value = '0';
            renderPaymentMethods();
        }

        if (!currentTable || !orders[currentTable] || !orders[currentTable].length) {
            notifications.show("No order to complete!", 'warning');
            return;
        }
        if (paymentAllocations.length === 0) {
            notifications.show('Select Cash or Mobile before completing payment.', 'warning');
            return;
        }
        const paidSoFar = roundToTwo(paymentAllocations.reduce((sum, pm) => sum + (Number(pm.amount) || 0), 0));
        const exactTotal = roundToTwo(total);
        if (paidSoFar < exactTotal && exactTotal > 0) {
            const difference = roundToTwo(exactTotal - paidSoFar);
            notifications.show(`Payment is insufficient. Still due: Rs ${difference.toFixed(2)}`, 'warning');
            renderPaymentMethods();
            updateChange();
            return;
        }

        const settlementItems = orders[currentTable].map(item => ({ ...item }));
        const saleAmounts = calculateSaleAmounts(settlementItems);
        settlementReservation = reserveSettlement(currentTable, settlementItems);
        if (settlementReservation.duplicate) {
            loadFromLocalStorage();
            currentTable = null;
            document.getElementById('selected-table')?.replaceChildren('-');
            document.getElementById('selected-table-checkout')?.replaceChildren('-');
            clearCheckoutState();
            closeCheckoutDialog();
            renderOrderItems();
            initializeTables();
            notifications.show('This order was already settled recently. The current view was refreshed.', 'warning', 5000);
            return;
        }

        showLoadingSpinner();

        const orderId = generateOrderId();
        const sale = {
            orderNumber: orderId,
            table: currentTable,
            items: JSON.parse(JSON.stringify(orders[currentTable])),
            total,
            paymentMethods: JSON.parse(JSON.stringify(paymentAllocations)),
            discount: discountCodeApplied || (discount ? `${discount}%` : 'None'),
            discountAmount: saleAmounts.discountAmount,
            serviceChargeAmount: saleAmounts.serviceChargeAmount,
            vatAmount: saleAmounts.vatAmount,
            timestamp: new Date().toISOString(),
            user: currentUser?.email || 'Guest',
            status: 'completed',
            change: Math.max(0, roundToTwo(paidSoFar - exactTotal)),
            orderType: 'dine-in',
            vatPercent,
            serviceChargePercent
        };

        salesHistory.push(sale);
        orderHistory.push(createOrderHistorySnapshot([sale])[0]);
        if (window.CloudSync) {
            window.CloudSync.insertSale(sale).catch(error => console.warn('[CloudSync] sale sync failed:', error));
        }
        logAudit('payment.completed', {
            table: sale.table,
            orderId: sale.orderNumber,
            amountPaisa: Math.round((sale.total || 0) * 100),
            reason: (sale.paymentMethods || []).map(payment => payment.method).join('+') || 'cash'
        });

        delete orders[currentTable];
        if (tableTimers[currentTable]) delete tableTimers[currentTable];
        currentTable = null;
        localStorage.removeItem('selectedTable');
        const selectedTableEl = document.getElementById('selected-table');
        const selectedTableCheckoutEl = document.getElementById('selected-table-checkout');
        if (selectedTableEl) selectedTableEl.textContent = '-';
        if (selectedTableCheckoutEl) selectedTableCheckoutEl.textContent = '-';

        persistAllData();
        renderOrderItems();
        initializeTables();
        setOrderDrawerOpen(false);
        
        clearCheckoutState();
        closeCheckoutDialog();
        notifications.show('Thank you!', 'success');
        speakText('Thank you!');
        return sale;
    } catch (error) {
        console.error('Payment completion failed:', error);
        if (settlementReservation && !salesHistory.some(sale =>
            getSettlementFingerprint(sale.table, sale.items) === settlementReservation.fingerprint
        )) {
            releaseSettlementReservation(settlementReservation.fingerprint);
        }
        resetCheckoutState();
        notifications.show('Unable to process payment. Please try again.', 'error');
    } finally {
        hideLoadingSpinner();
        isProcessingPayment = false;
        if (paymentResetTimer) {
            clearTimeout(paymentResetTimer);
            paymentResetTimer = null;
        }
    }
}

function updateTotal() {
    const totalEl = document.getElementById('total-amount');
    if (totalEl) totalEl.textContent = calculateTotal().toFixed(2);
    const itemsEl = document.getElementById('total-items');
    if (itemsEl) {
        const items = currentTable && Array.isArray(orders[currentTable]) ? orders[currentTable] : [];
        itemsEl.textContent = items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
    }
}

// =========================================================================
// =================== ORDER ACTIONS =======================================
// =========================================================================

async function finalizeOrder() {
    if (isFinalizingOrder) {
        notifications.show('KOT already being sent. Please wait a moment.', 'info');
        return;
    }

    try {
        if (!currentTable || !orders[currentTable]?.length) {
            notifications.show('No order to finalize!', 'warning');
            return;
        }

        isFinalizingOrder = true;
        const itemsToFinalize = orders[currentTable]
            .map(item => ({ item, deltaQty: Math.max(0, (Number(item.quantity) || 0) - (Number(item.sentQuantity) || 0)) }))
            .filter(entry => entry.deltaQty > 0);
    const nonPreparationItems = itemsToFinalize
        .filter(({ item }) => item.section !== 'Kitchen' && item.section !== 'Bar')
        .map(({ item }) => item);
    if (itemsToFinalize.length === 0) {
        notifications.show('No new items to send.', 'info');
        return;
    }

    showLoadingSpinner();
    const kotResult = createKotsFor(currentTable, itemsToFinalize);

    persistAllData();
    renderOrderItems();
    const message = kotResult.kotCreated
        ? `KOT ${kotResult.kotNumber} sent successfully.${nonPreparationItems.length > 0 ? ` ${nonPreparationItems.length} retail/misc item(s) finalized without a KOT.` : ''}`
        : `${nonPreparationItems.length} item(s) finalized. No KOT sent (Retail/Misc only).`;
    notifications.show(message, 'success');
    hideLoadingSpinner();
    } catch (error) {
        handleCriticalError('Finalizing order', error);
        hideLoadingSpinner();
    } finally {
        isFinalizingOrder = false;
    }
}

function printKOT(kotItems, type, table = currentTable) {
    const safeType = escapeHtml(type || 'kitchen');
    const safeTable = escapeHtml(String(table || 'N/A'));
    const kotHTML = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>KOT - ${safeType.toUpperCase()}</title>
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
                <p>Table: ${safeTable} | Type: ${safeType.toUpperCase()}</p>
                <p>Time: ${new Date().toLocaleTimeString()}</p>
            </div>
            <div class="items">
                ${kotItems.map(item => `
                    <div class="item">
                        <strong>${escapeHtml(item.name || 'Unknown Item')}</strong> x${Number(item.quantity) || 0}
                        ${item.extras?.length ? '<br/>Extras: ' + item.extras.map(e => escapeHtml(e.name || '')).join(', ') : ''}
                    </div>
                `).join('')}
            </div>
            <div class="total">
                <strong>Total Items: ${kotItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)}</strong>
            </div>
        </body>
        </html>
    `;

    printContent(kotHTML);
}

async function changeTable() {
    if (!currentTable || !orders[currentTable]?.length) {
        notifications.show("No order to move!", 'warning');
        return;
    }

    const oldTable = String(currentTable).trim().toUpperCase();
    const requestedTable = await showPromptModal(
        'Change Table',
        `Move order from Table ${oldTable} to which table? (e.g. 1, 2, 8A, 10B)`
    );
    if (!requestedTable) return;

    const newTable = requestedTable
        ?.trim()
        .replace(/^table\s*/i, '')
        .toUpperCase();

    if (!tableList.includes(newTable)) {
        notifications.show(`Table ${newTable} does not exist.`, 'warning');
        return;
    }

    if (newTable === oldTable) {
        notifications.show('Target table must be different from current table.', 'info');
        return;
    }

    if (orders[newTable] && orders[newTable].length > 0) {
        notifications.show(`Table ${newTable} is already occupied. Please checkout or void the existing order first.`, 'error');
        return;
    }

    showLoadingSpinner();
    try {
        const itemsToMove = orders[oldTable].map(item => ({ ...item }));
        const now = Date.now();
        const existingTimer = tableTimers[oldTable];
        const elapsed = Number(existingTimer?.elapsed) || 0;
        const timerToMove = existingTimer
            ? { ...existingTimer, start: Number(existingTimer.start) > 1e12 ? existingTimer.start : now - elapsed, elapsed, lastUpdated: now }
            : { start: now, elapsed: 0, lastUpdated: now };

        orders[newTable] = itemsToMove;
        tableTimers[newTable] = timerToMove;
        delete orders[oldTable];
        delete tableTimers[oldTable];
        kotHistory.forEach(kot => {
            if (String(kot.table).trim().toUpperCase() === oldTable) kot.table = newTable;
        });

        const existingNote = localStorage.getItem(`table-notes-${oldTable}`);
        if (existingNote !== null) {
            localStorage.setItem(`table-notes-${newTable}`, existingNote);
            localStorage.removeItem(`table-notes-${oldTable}`);
        }

        currentTable = newTable;
        localStorage.setItem('selectedTable', newTable);

        persistAllData();
        document.getElementById('selected-table').textContent = currentTable;
        document.getElementById('selected-table-checkout').textContent = currentTable;
        loadTableNotes(newTable);
        renderOrderItems();
        initializeTables();
        setOrderDrawerOpen(true);
        logAudit('table.moved', {
            table: newTable,
            orderId: `moved-from-${oldTable}`
        });
        notifications.show(`Order moved successfully from Table ${oldTable} to ${newTable}.`, 'success');
    } catch (error) {
        handleCriticalError('Changing table', error);
    } finally {
        hideLoadingSpinner();
    }
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
    try {
    const itemToVoid = { ...orders[currentTable][index] };
    if ((Number(itemToVoid.sentQuantity) || 0) > 0) {
        kotHistory.forEach(kot => {
            const sameTable = String(kot.table).trim().toUpperCase() === String(currentTable).trim().toUpperCase();
            const sameTicket = !itemToVoid.kotNumber || kot.kotNumber === itemToVoid.kotNumber;
            if (!sameTable || !sameTicket || kot.status !== 'pending') return;

            kot.items.forEach(kotItem => {
                if (kotItem.name === itemToVoid.name && !kotItem.isCanceled) {
                    kotItem.isCanceled = true;
                    kotItem.name = `[CANCELED] ${kotItem.name}`;
                }
            });
        });
    }

    const voidId = `void_${Date.now()}`;
    const timestamp = new Date().toISOString();
    const voidEntry = {
        voidId,
        table: currentTable,
        item: itemToVoid,
        total: (itemToVoid.price + (itemToVoid.extras?.reduce((s, e) => s + e.price, 0) || 0)) * itemToVoid.quantity,
        reason,
        user: currentUser?.email || 'Guest',
        timestamp: timestamp,
        actionType: 'voided'
    };
    
    voidDetails.push(voidEntry);
    logAudit('order.voided', {
        table: currentTable,
        orderId: itemToVoid.name,
        amountPaisa: Math.round((voidEntry.total || 0) * 100),
        reason
    });
    orders[currentTable].splice(index, 1);
    
    const isOrderEmpty = orders[currentTable].length === 0;
    if (isOrderEmpty) {
        delete orders[currentTable];
        delete tableTimers[currentTable];
    }
    
    persistAllData();
    renderOrderItems();
    initializeTables();
    notifications.show(`${itemToVoid.name} has been voided.`, 'success');
    } catch (error) {
        handleCriticalError('Voiding item', error);
    } finally {
        hideLoadingSpinner();
    }
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
    try {
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
        timestamp: timestamp,
        actionType: 'voided'
    });
    logAudit('order.voided', {
        table: tableToVoid,
        amountPaisa: Math.round((calculateTotal() || 0) * 100),
        reason
    });

    // Remove KOT entries associated with this order
    kotHistory = kotHistory.filter(kot => !kotNumbersInOrder.includes(kot.kotNumber));

    delete orders[tableToVoid];
    delete tableTimers[tableToVoid];
    currentTable = null;
    localStorage.removeItem('selectedTable');

    persistAllData();
    renderOrderItems();
    initializeTables();
    document.getElementById('selected-table').textContent = '-';
    notifications.show(`Order for Table ${tableToVoid} has been voided.`, 'success');
    } catch (error) {
        handleCriticalError('Voiding order', error);
    } finally {
        hideLoadingSpinner();
    }
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
        renderOrderHistory(currentPage, orderHistoryShowAll);
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
    logAudit('order.voided', {
        table: orderToVoid.table,
        orderId: orderToVoid.orderNumber,
        amountPaisa: Math.round((orderToVoid.total || 0) * 100),
        reason
    });

    persistAllData();
    renderOrderHistory(currentPage);
    notifications.show(`Order #${orderToVoid.orderNumber} has been voided.`, 'success');
    hideLoadingSpinner();
}

function showVoidReason(orderNumber) {
    const voidEntry = voidDetails.find(entry => entry.originalOrderNumber === orderNumber);
    if (voidEntry?.reason) {
        notifications.show(`Void reason: ${voidEntry.reason}`, 'info', 5000);
        return;
    }
    notifications.show('No void reason was recorded for this order.', 'warning');
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

    try {
        const timestamp = order.timestamp ? new Date(order.timestamp) : new Date();

        const subtotal = order.items.reduce((sum, item) => {
             const extrasTotal = (item.extras || []).reduce((s, e) => s + (e.price || 0), 0);
             return sum + (item.price + extrasTotal) * item.quantity;
        }, 0);
        
        const discountAmount = parseFloat(order.discountAmount) || 0;
        const subtotalAfterDiscount = subtotal - discountAmount;
        const receiptServiceChargePercent = Number.isFinite(Number(order.serviceChargePercent))
            ? Number(order.serviceChargePercent)
            : serviceChargePercent;
        const receiptVatPercent = Number.isFinite(Number(order.vatPercent))
            ? Number(order.vatPercent)
            : vatPercent;
        const serviceChargeAmount = Number.isFinite(Number(order.serviceChargeAmount))
            ? Number(order.serviceChargeAmount)
            : subtotalAfterDiscount * (receiptServiceChargePercent / 100);
        const taxableAmount = subtotalAfterDiscount + serviceChargeAmount;
        const vatAmount = Number.isFinite(Number(order.vatAmount))
            ? Number(order.vatAmount)
            : taxableAmount * (receiptVatPercent / 100);
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
            const safeItemName = escapeHtml(item.name || 'Unknown Item');
            let itemRow = `
                <tr>
                    <td class="col-item" title="${safeItemName}">${safeItemName}</td>
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
                    <h1>${escapeHtml(restaurantName)}</h1>
                    <p>${escapeHtml(restaurantAddress)}</p>
                    <p>PAN: ${escapeHtml(restaurantPan)}</p>
                </div>

                <div class="dashed-line"></div>
                
                <div class="info-section">
                    <div class="info-line"><span>Bill No:</span><span>${order.orderNumber || 'N/A'}</span></div>
                    <div class="info-line"><span>Table:</span><span>${order.table || 'N/A'}</span></div>
                    <div class="info-line"><span>Date:</span><span>${timestamp.toLocaleString()}</span></div>
                    ${order.user ? `<div class="info-line"><span>Server:</span><span>${escapeHtml(order.user)}</span></div>` : ''}
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
                    <div class="summary-line"><span>Service Charge (${receiptServiceChargePercent}%)</span><span class="text-right">Rs ${serviceChargeAmount.toFixed(2)}</span></div>
                    <div class="summary-line"><span>VAT (${receiptVatPercent}%)</span><span class="text-right">Rs ${vatAmount.toFixed(2)}</span></div>
                    
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
                    <p>${escapeHtml(receiptThankYou)}</p>
                    ${receiptSocialHandle ? `<p>${escapeHtml(receiptSocialHandle)}</p>` : ''}
                </div>
            </div>
        `;

        const fullHTML = `<!DOCTYPE html><html><head><title>Bill - ${order.orderNumber || ''}</title>${receiptCSS}</head><body>${receiptHTML}</body></html>`;
        printContent(fullHTML);

    } catch (error) {
        console.error('Error generating professional receipt:', error);
        notifications.show('Failed to generate professional receipt. Check console for details.', 'error');
    }
}

// NEW: Reset All Data Function
async function resetAllDataConfirmed() {
    const confirmed = await showConfirmModal(
        'Reset All Data',
        'Are you absolutely sure you want to reset ALL data? This will permanently delete all orders, sales history, void details, and KOT history from this device\'s local storage. This action cannot be undone!'
    );

    if (confirmed) {
        showLoadingSpinner();
        try {
            logAudit('data.reset', { reason: 'manual reset' });
            [
                'orders', 'tableTimers', 'salesHistory', 'orderHistory', 'voidDetails',
                'kotHistory', 'customMenuItems',
                'selectedTable', SETTLEMENT_GUARD_KEY, 'pos_last_shift_close',
                CURRENT_SHIFT_KEY, SHIFT_REPORTS_KEY
            ].forEach(key => localStorage.removeItem(key));
            saveToLocalStorage('auditLog', auditLog);
            clearCheckoutState();
            await clearLargeStateFromIndexedDB();
            window.location.reload();
        } catch (error) {
            hideLoadingSpinner();
            console.error('Error resetting all data:', error);
            notifications.show('Failed to reset data. Please try again or check console.', 'error');
        }
    }
}


// =========================================================================
// =================== INITIALIZATION & EVENT LISTENERS ====================
// =========================================================================

document.addEventListener("DOMContentLoaded", () => {
    initializePinLock();

    // Load all data from localStorage on startup
    loadFromLocalStorage();
    getCurrentShift();
    loadOfflineQueue();
    loadLargeStateFromIndexedDB().then(() => {
        trimHistoryIfNeeded();
        renderOrderItems();
        initializeTables();
        window.CloudSync?.syncHistoricalSales?.(salesHistory).catch(error => {
            console.warn('[CloudSync] historical sales sync failed:', error);
        });
    }).catch(async (error) => {
        console.warn('IndexedDB data load skipped:', error);
        const shouldReset = await showConfirmModal('IndexedDB issue', 'IndexedDB is unavailable or corrupted. Reset it and continue with local storage?');
        if (shouldReset) {
            try {
                const deleteRequest = indexedDB.deleteDatabase('taboche-pos-db');
                deleteRequest.onsuccess = () => {
                    notifications.show('IndexedDB reset successfully. You can continue using local storage.', 'success');
                };
                deleteRequest.onerror = () => {
                    notifications.show('IndexedDB could not be reset automatically. Please restore from backup if needed.', 'warning');
                };
            } catch (cleanupError) {
                console.error('IndexedDB reset failed:', cleanupError);
                notifications.show('IndexedDB reset failed. Please restore from backup if needed.', 'warning');
            }
        }
    });

    // Set up BroadcastChannel for real-time sync across tabs
    if (posSyncChannel) posSyncChannel.onmessage = (event) => {
        if (event.data === 'data-changed') {
            scheduleExternalDataRefresh();
        }
    };

    // Listen for changes in localStorage from other tabs/windows
    window.addEventListener('storage', (e) => {
        if (SYNC_DATA_KEYS.includes(e.key)) scheduleExternalDataRefresh();
    });

    // Set up basic UI elements and intervals
    updateDateTime();
    const dateTimeInterval = setInterval(updateDateTime, 1000);
    const tableTimerInterval = setInterval(updateTableTimers, 1000);

    // Cleanup intervals on page unload
    window.addEventListener('beforeunload', () => {
        clearInterval(dateTimeInterval);
        clearInterval(tableTimerInterval);
        posSyncChannel?.close();
    });

    // Service Worker registration (only on web servers, not file://)
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
        navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' })
            .then(registration => {
                console.log('Service Worker registered with scope:', registration.scope);

            // Ask the browser to check for a newer worker whenever the app opens.
            registration.update();

                // Check for updates
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    console.log('New service worker installing...');

                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            // New version available, notify user
                            notifications.show('New version available! Tap to refresh.', 'info', 10000);
                            setTimeout(() => {
                                const toasts = document.querySelectorAll('#notification-toast .notification-item');
                                const latest = toasts[toasts.length - 1];
                                if (latest) {
                                    latest.style.cursor = 'pointer';
                                    latest.title = 'Tap to install update';
                                    latest.addEventListener('click', () => window.location.reload(), { once: true });
                                }
                            }, 50);
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
    document.getElementById("close-sidebar")?.addEventListener("click", closeSidebar);
    document.getElementById("sidebar-overlay")?.addEventListener("click", closeSidebar);
    document.getElementById("theme-toggle")?.addEventListener("click", toggleTheme);
    document.getElementById('table-notes')?.addEventListener('input', event => {
        if (currentTable) localStorage.setItem(`table-notes-${currentTable}`, event.target.value);
    });

    // NEW: Back button for menu navigation
    document.getElementById("back-button")?.addEventListener("click", navigateBackMenu);

    // Footer Buttons
    document.getElementById("finalize-btn")?.addEventListener("click", finalizeOrder);
    document.getElementById("checkout-btn")?.addEventListener("click", showCheckoutDialog);
    document.getElementById("change-table-btn")?.addEventListener("click", changeTable);
    document.getElementById("void-btn")?.addEventListener("click", voidOrder);
    document.getElementById("print-receipt-btn")?.addEventListener("click", printReceipt);
    document.getElementById("clear-all-btn")?.addEventListener("click", clearAllItems);

    // Sidebar navigation uses one delegated router so dynamically rendered content cannot lose handlers.
    document.querySelector('.sidebar-content')?.addEventListener('click', event => {
        const link = event.target.closest('a[id^="nav-"]');
        if (!link) return;
        event.preventDefault();
        closeSidebar();

        const actions = {
            'nav-sales-reports': () => showSalesReportsContent(event),
            'nav-items-sold': () => showItemsSoldContent(event),
            'nav-order-history': () => showOrderHistoryContent(event),
            'nav-void-details': () => showVoidDetailsContent(event),
            'nav-kitchen-view': showKitchenView,
            'nav-settings': showSettings,
            'nav-lock-screen': lockScreen,
            'nav-shift-close': showShiftCloseModal,
            'nav-merge-tables': mergeTables,
            'nav-help': showHelpModal,
            'nav-backup-data': backupData,
            'nav-storage-manager': showQuickBackup,
            'nav-reset-data': resetAllDataConfirmed
        };
        actions[link.id]?.();

        if (link.id === 'nav-restore-data') {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.addEventListener('change', changeEvent => restoreData(changeEvent.target.files[0]), { once: true });
            input.click();
        }
    });

    // Checkout Dialog Listeners
    document.getElementById('close-checkout-dialog')?.addEventListener('click', closeCheckoutDialog);
    document.getElementById('close-extras-modal')?.addEventListener('click', closeExtrasModal);
    document.getElementById('clear-input')?.addEventListener('click', clearInput);
    document.getElementById('apply-discount-code')?.addEventListener('click', applyDiscountCode);
    document.getElementById('clear-discount')?.addEventListener('click', clearDiscount);
    document.getElementById('cash-btn')?.addEventListener('click', () => processPayment("Cash"));
    document.getElementById('mobile-btn')?.addEventListener('click', () => processPayment("Mobile"));
    document.getElementById('complete-btn')?.addEventListener('click', completePayment);
    document.getElementById('numeric-input')?.addEventListener('input', event => {
        const input = event.target;
        const sanitized = input.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
        input.value = sanitized;
        paymentAmount = validateNumericInput(sanitized, 0);
        updateChange();
        persistCheckoutState();
    });
    document.getElementById('order-drawer-toggle')?.addEventListener('click', () => {
        const orderSection = document.getElementById('order-section');
        setOrderDrawerOpen(!orderSection?.classList.contains('open'));
    });

    // Keypad and Quick Amounts - Use event delegation for better performance
    const keypad = document.getElementById('keypad');
    if (keypad) {
        keypad.addEventListener('click', (e) => {
            const button = e.target.closest('button[data-num]');
            if (button) appendNumber(button.dataset.num);
            
            const clearBtn = e.target.closest('#clear-input');
            if (clearBtn) clearInput();
        });
    }

    const quickAmounts = document.getElementById('quick-amounts');
    if (quickAmounts) {
        quickAmounts.addEventListener('click', (e) => {
            const button = e.target.closest('button[data-amount]');
            if (button) setQuickAmount(parseFloat(button.dataset.amount));
        });
    }

    const discountSection = document.getElementById('discount-section');
    if (discountSection) {
        discountSection.addEventListener('click', (e) => {
            const button = e.target.closest('button[data-discount]');
            if (button) applyDiscount(parseInt(button.dataset.discount));
        });
    }

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

        if (button.classList.contains('void-reason-btn')) {
            showVoidReason(button.dataset.orderNumber);
        }

        if (button.classList.contains('edit-payment-btn')) {
            editPaymentMethod(button.dataset.orderNumber);
        }

        playButtonClickSound(button);
    });

    // Initialize theme
    loadTheme();
    initAudio();
    updateNetworkStatusIndicator();

    window.addEventListener('online', () => {
        updateNetworkStatusIndicator();
        flushOfflineQueue();
        notifications.show('Back online', 'success');
        document.getElementById('offline-banner')?.classList.remove('active');
    });
    window.addEventListener('offline', () => {
        updateNetworkStatusIndicator();
        document.getElementById('offline-banner')?.classList.add('active');
        notifications.show('Offline mode - data saved locally', 'warning');
    });

    // Initial table selection (optional, auto-select first table if none selected)
    if (!currentTable && tableList.length > 0) {
        selectTable(tableList[0]);
        loadTableNotes(tableList[0]);
    }
});

// Global event listener for closing modals/sidebars
document.addEventListener('click', function(e) {
    const customCloseSelectors = '.close-modal, .qr-close-btn';
    const customCloseBtn = e.target.closest(customCloseSelectors);

    if (customCloseBtn) {
        e.preventDefault();
        const containerToClose = customCloseBtn.closest('.modal, .sidebar, #qr-code-dialog');
        if (containerToClose?.id === 'sidebar-content-modal') {
            closeSidebarContentModal();
        } else if (containerToClose) {
            containerToClose.style.display = 'none';
        }
    }
});

// --- UTILITIES ---
function toggleSidebar(e) {
    e?.preventDefault();
    const sidebar = document.getElementById('sidebar');
    setSidebarOpen(!sidebar?.classList.contains('active'));
}

function closeSidebar(e) {
    e?.preventDefault();
    setSidebarOpen(false);
}

function setSidebarOpen(isOpen) {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (!sidebar || !overlay) return;

    if (!isOpen && kitchenElapsedInterval) {
        clearInterval(kitchenElapsedInterval);
        kitchenElapsedInterval = null;
    }

    sidebar.classList.toggle('active', isOpen);
    overlay.classList.toggle('active', isOpen);
    overlay.setAttribute('aria-hidden', String(!isOpen));
    document.body.style.overflow = isOpen ? 'hidden' : '';
}

function initializeTableTimer(table) {
    if (!tableTimers[table]) {
        tableTimers[table] = {
            start: Date.now(),
            elapsed: 0,
            lastUpdated: Date.now()
        };
        persistAllData();
        return;
    }

    const now = Date.now();
    const timer = tableTimers[table];
    if (!Number.isFinite(Number(timer.start)) || Number(timer.start) <= 1e12) {
        tableTimers[table] = {
            ...timer,
            start: now - (Number(timer.elapsed) || 0),
            lastUpdated: now
        };
    }
}

// =========================================================================
// =================== SIDEBAR ENHANCEMENTS ===============================
// =========================================================================

/**
 * Initialize sidebar user information display
 */
function initializeSidebarUserInfo() {
    const userNameEl = document.getElementById('sidebar-user-name');
    if (userNameEl && currentUser) {
        userNameEl.textContent = currentUser.email || 'Local Staff';
    }
}

/**
 * Set active state on a sidebar link
 * @param {string} linkId - The ID of the link to set as active
 */
function setSidebarLinkActive(linkId) {
    // Remove active class from all sidebar links
    document.querySelectorAll('.sidebar-content a').forEach(link => {
        link.classList.remove('active');
    });
    
    // Add active class to the specified link
    if (linkId) {
        const link = document.getElementById(linkId);
        if (link) {
            link.classList.add('active');
        }
    }
}

/**
 * Clear active state from all sidebar links
 */
function clearSidebarActiveState() {
    document.querySelectorAll('.sidebar-content a').forEach(link => {
        link.classList.remove('active');
    });
}

// Initialize sidebar user info when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    initializeSidebarUserInfo();
    
    // Add event delegation for sidebar navigation links
    const sidebarContent = document.querySelector('.sidebar-content');
    if (sidebarContent) {
        sidebarContent.addEventListener('click', (e) => {
            const link = e.target.closest('a');
            if (!link) return;
            
            // Set this link as active when clicked
            const linkId = link.id;
            if (linkId && !linkId.startsWith('close')) {
                setSidebarLinkActive(linkId);
            }
        });
    }
    
    // Also initialize on direct navigation link clicks
    const navLinks = document.querySelectorAll('.sidebar-content a[id^="nav-"]');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            setSidebarLinkActive(link.id);
        });
    });
});

// Ensure sidebar user info is set when currentUser changes
if (typeof setInterval !== 'undefined') {
    // Check periodically if user info needs to be updated
    setInterval(() => {
        const userNameEl = document.getElementById('sidebar-user-name');
        if (userNameEl && currentUser && userNameEl.textContent !== (currentUser.email || 'Local Staff')) {
            userNameEl.textContent = currentUser.email || 'Local Staff';
        }
    }, 5000);
}

function startBlinking(table) {
    const tableBtn = document.getElementById(`table-btn-${table}`);
    if (tableBtn) {
        tableBtn.classList.add('blinking');
        initializeTableTimer(table);
    }
}

function stopBlinking(table) {
    const tableBtn = document.getElementById(`table-btn-${table}`);
    if (tableBtn) {
        tableBtn.classList.remove('blinking');
    }
}

 // Track navigation state for back button

// --- SEARCH AND NAVIGATION FIX ---
function searchMenu() {
    const searchTerm = document.getElementById('search')?.value.toLowerCase().trim() || '';
    const menu = document.getElementById('menu');
    const categoriesContainer = document.getElementById('categories');
    const backButton = document.getElementById('back-button');
    const menuSectionTitle = document.getElementById('menu-section-title');

    if (!searchTerm) {
        currentMenuLevel = 'topLevelSections';
        renderMenuNavigation();
        return;
    }

    categoriesContainer.innerHTML = ''; 
    backButton.style.display = 'block';
    menuSectionTitle.textContent = `Results for "${searchTerm}"`;

    const filteredItems = menuItems.filter(item => item.name.toLowerCase().includes(searchTerm));
    menu.innerHTML = '';
    
    filteredItems.forEach(item => {
        const div = document.createElement('div');
        const isSoldOut = Boolean(item.isOutOfStock);
        div.className = `menu-item${isSoldOut ? ' sold-out' : ''}`;
        div.style.opacity = isSoldOut ? '0.45' : '1';
        div.innerHTML = `
            <img src="${getSafeImagePath(item.image)}" alt="${escapeHtml(item.name)}" onerror="handleImageError(this)">
            <p>${escapeHtml(item.name)}</p>
            <div class="price">${isSoldOut ? 'SOLD OUT' : `Rs ${item.price.toFixed(2)}`}</div>
        `;
        div.addEventListener('contextmenu', event => {
            event.preventDefault();
            suppressMenuItemClickUntil = Date.now() + 450;
            toggleItemStock(item.name);
        });
        div.addEventListener('click', () => {
            if (Date.now() < suppressMenuItemClickUntil || isSoldOut) return;
            addToOrder(item);
        });
        menu.appendChild(div);
    });
}

// Kitchen Display View
function showKitchenView() {
    if (kitchenElapsedInterval) clearInterval(kitchenElapsedInterval);
    const pendingKOTs = kotHistory.filter(k => k.status === 'pending');
    const content = `
        <div class="report-container kitchen-view">
            <div class="report-header"><h4><i class="fas fa-utensils text-warning me-2"></i>Kitchen Display</h4><div><span class="report-badge">${pendingKOTs.length} pending</span><button id="kitchen-refresh" class="btn-icon" type="button" aria-label="Refresh kitchen display"><i class="fas fa-sync-alt"></i></button></div></div>
            <div class="filter-bar">
                <div class="filter-group search-group"><label for="kitchen-search">Search</label><input type="text" id="kitchen-search" placeholder="Table or item..." class="filter-input"></div>
                <div class="filter-group"><label for="kitchen-type-filter">Section</label><select id="kitchen-type-filter" class="filter-select"><option value="all">All Sections</option><option value="kitchen">Kitchen</option><option value="bar">Bar</option></select></div>
            </div>
            <div id="kitchen-orders" class="kot-grid">
                ${pendingKOTs.length === 0 ? '<p>No pending orders</p>' : 
                    pendingKOTs.map(kot => `
                        <div class="kot-card" data-kot-type="${kot.type}">
                            <div class="kot-header"><div class="kot-info"><span class="kot-number">${escapeHtml(kot.kotNumber)}</span><span class="kot-type ${kot.type}">${kot.type}</span></div><span class="kot-table">Table ${escapeHtml(String(kot.table))}</span></div>
                            <div class="kot-body"><div class="kot-items">${kot.items.map((item, itemIndex) => {
                                const isCanceled = item.isCanceled || item.name.startsWith('[CANCELED]');
                                const isDone = Boolean(item.isDone);
                                const itemStyle = isCanceled
                                    ? 'text-decoration: line-through; color: #dc2626; font-weight: bold; opacity: 0.6;'
                                    : isDone ? 'text-decoration: line-through; color: #16a34a;' : '';
                                return `<div class="kot-item" style="${itemStyle}"><button type="button" class="kot-item-name kot-item-toggle" data-kot-id="${escapeHtml(kot.kotId)}" data-item-id="${escapeHtml(item.kotItemId || '')}" data-item-index="${itemIndex}" style="cursor: pointer; border: 0; background: transparent; padding: 0; text-align: left;"><i class="far ${isDone ? 'fa-check-square text-success' : 'fa-square'} me-1"></i>${escapeHtml(item.name)}</button><span class="kot-item-qty">x${item.quantity}</span>${item.extras?.length ? `<span class="kot-item-extras">+ ${item.extras.map(extra => escapeHtml(extra.name)).join(', ')}</span>` : ''}</div>`;
                            }).join('')}</div><div class="kot-timer" data-created-at="${escapeHtml(kot.timestamp)}"><i class="fas fa-clock"></i> <span>${formatElapsedTime(kot.timestamp)}</span></div></div>
                            <div class="kot-actions">
                                <button class="btn-ready" data-kot-action="ready" data-kot-id="${escapeHtml(kot.kotId)}"><i class="fas fa-check"></i> Ready</button>
                                <button class="btn-print" data-kot-action="print" data-kot-id="${escapeHtml(kot.kotId)}"><i class="fas fa-print"></i> Print</button>
                            </div>
                        </div>
                    `).join('')
                }
            </div>
        </div>
    `;
    
    showSidebarContentModal('Kitchen Display', content, () => {
        document.getElementById('kitchen-refresh')?.addEventListener('click', showKitchenView);
        // Add search functionality
        const searchInput = document.getElementById('kitchen-search');
        const ordersContainer = document.getElementById('kitchen-orders');
        
        if (searchInput && ordersContainer) {
            ordersContainer.addEventListener('click', event => {
                const itemToggle = event.target.closest('.kot-item-toggle');
                if (itemToggle) {
                    toggleKitchenItemDone(itemToggle.dataset.kotId, itemToggle.dataset.itemId, itemToggle.dataset.itemIndex);
                    return;
                }
                const actionButton = event.target.closest('[data-kot-action]');
                if (!actionButton) return;
                if (actionButton.dataset.kotAction === 'ready') markKOTReady(actionButton.dataset.kotId);
                if (actionButton.dataset.kotAction === 'print') printKOTFromView(actionButton.dataset.kotId);
            });
            searchInput.addEventListener('input', () => {
                const searchTerm = searchInput.value.toLowerCase().trim();
                const cards = ordersContainer.querySelectorAll('.kot-card');
                
                cards.forEach(card => {
                    const cardText = card.textContent.toLowerCase();
                    const typeFilter = document.getElementById('kitchen-type-filter')?.value || 'all';
                    const isVisible = (!searchTerm || cardText.includes(searchTerm)) && (typeFilter === 'all' || card.dataset.kotType === typeFilter);
                    card.style.display = isVisible ? 'block' : 'none';
                });
            });
            document.getElementById('kitchen-type-filter')?.addEventListener('change', () => searchInput.dispatchEvent(new Event('input')));
            kitchenElapsedInterval = setInterval(() => {
                ordersContainer.querySelectorAll('.kot-timer').forEach(timer => {
                    const elapsed = timer.querySelector('span');
                    if (elapsed) elapsed.textContent = formatElapsedTime(timer.dataset.createdAt);
                });
            }, 1000);
        }
    });
}

function markKOTReady(kotId) {
    const kot = kotHistory.find(k => k.kotId === kotId);
    if (kot) {
        kot.status = 'ready';
        persistAllData();
        showKitchenView(); // Refresh the view
        notifications.show(`KOT ${kot.kotNumber} marked as ready`, 'success');
    }
}

function toggleKitchenItemDone(kotId, itemId, itemIndex) {
    const kot = kotHistory.find(k => k.kotId === kotId);
    const item = kot?.items?.find(kotItem => kotItem.kotItemId === itemId) || kot?.items?.[Number(itemIndex)];
    if (!item || item.isCanceled) return;

    item.isDone = !item.isDone;
    const activeItems = kot.items.filter(kotItem => !kotItem.isCanceled);
    kot.status = activeItems.length > 0 && activeItems.every(kotItem => kotItem.isDone)
        ? 'ready'
        : 'pending';

    persistAllData();
    showKitchenView();
}

// Make function globally accessible for onclick handlers
window.markKOTReady = markKOTReady;
window.toggleKitchenItemDone = toggleKitchenItemDone;

// Print KOT from Kitchen View
function printKOTFromView(kotId) {
    const kot = kotHistory.find(k => k.kotId === kotId);
    if (kot) {
        printKOT(kot.items, kot.type, kot.table);
    }
}

// Make function globally accessible
window.printKOTFromView = printKOTFromView;

function showShiftCloseModal() {
    const currentShift = getCurrentShift();
    const lastCloseTime = currentShift.startedAt;
    const shiftSales = salesHistory.filter(sale =>
        isActiveSale(sale) && new Date(sale.timestamp) >= new Date(lastCloseTime)
    );
    const shiftVoids = voidDetails.filter(v => new Date(v.timestamp) >= new Date(lastCloseTime));
    const shiftVoidedTransactions = shiftVoids.filter(v => v.actionType === 'voided');

    // Calculate comprehensive totals
    let grossAmount = 0;
    let totalRevenue = 0;
    let discountTotal = 0;
    let cashTotal = 0;
    let mobileTotal = 0;
    let changeTotal = 0;
    let totalItemsCount = 0;
    let voidAmount = 0;
    
    const itemsBreakdown = {};
    
    shiftSales.forEach(sale => {
        totalItemsCount += (sale.items || []).reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);
        totalRevenue += Number(sale.total) || 0;
        
        // Calculate gross item revenue, including extras.
        (sale.items || []).forEach(item => {
            const itemName = item.name || 'Unknown Item';
            const extrasTotal = (item.extras || []).reduce((sum, extra) => sum + (Number(extra.price) || 0), 0);
            const itemTotal = ((Number(item.price) || 0) + extrasTotal) * (Number(item.quantity) || 1);
            grossAmount += itemTotal;
            if (!itemsBreakdown[itemName]) {
                itemsBreakdown[itemName] = { count: 0, total: 0 };
            }
            itemsBreakdown[itemName].count += Number(item.quantity) || 1;
            itemsBreakdown[itemName].total += itemTotal;
        });
        
        // Payment methods
        (sale.paymentMethods || []).forEach(payment => {
            if (payment.method === 'Cash') cashTotal += Number(payment.amount) || 0;
            if (payment.method === 'Mobile') mobileTotal += Number(payment.amount) || 0;
        });
        
        changeTotal += Number(sale.change) || 0;
        discountTotal += Number(sale.discountAmount) || 0;
    });

    shiftVoidedTransactions.forEach(voidEntry => {
        voidAmount += Number(voidEntry.total) || 0;
    });

    // Net calculations
    cashTotal = roundToTwo(Math.max(0, cashTotal - changeTotal));
    mobileTotal = roundToTwo(Math.max(0, mobileTotal));
    const netTotal = roundToTwo(cashTotal + mobileTotal);
    const grossTotal = roundToTwo(grossAmount);
    
    const shiftStartTime = new Date(lastCloseTime).toLocaleString();
    const shiftEndTime = new Date().toLocaleString();

    const topItemsArray = Object.entries(itemsBreakdown)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 5);

    const content = `
        <div class="z-report-container" id="z-report-container">
            <!-- Header Section -->
            <div class="z-report-header">
                <div class="z-report-title">
                    <i class="fas fa-receipt"></i>
                    <div>
                        <h3>Z-Report (Shift Close)</h3>
                        <p class="z-report-subtitle">Complete Shift Summary</p>
                    </div>
                </div>
                <div class="z-report-meta">
                    <span class="z-report-badge">${shiftSales.length} Trans</span>
                </div>
            </div>

            <!-- Shift Period -->
            <div class="z-report-period">
                <div class="period-item">
                    <span class="period-label">📅 Started</span>
                    <span class="period-value">${shiftStartTime}</span>
                </div>
                <div class="period-item">
                    <span class="period-label">⏱️ Ended</span>
                    <span class="period-value">${shiftEndTime}</span>
                </div>
            </div>

            <!-- Key Stats -->
            <div class="z-report-stats">
                <div class="stat-item stat-orders">
                    <i class="fas fa-shopping-bag"></i>
                    <div class="stat-content">
                        <span class="stat-label">Total Orders</span>
                        <span class="stat-value">${shiftSales.length}</span>
                    </div>
                </div>
                <div class="stat-item stat-items">
                    <i class="fas fa-box"></i>
                    <div class="stat-content">
                        <span class="stat-label">Items Sold</span>
                        <span class="stat-value">${totalItemsCount}</span>
                    </div>
                </div>
                <div class="stat-item stat-voids">
                    <i class="fas fa-undo"></i>
                    <div class="stat-content">
                        <span class="stat-label">Voids</span>
                        <span class="stat-value">${shiftVoidedTransactions.length}</span>
                    </div>
                </div>
                <div class="stat-item stat-discount">
                    <i class="fas fa-tag"></i>
                    <div class="stat-content">
                        <span class="stat-label">Discounts</span>
                        <span class="stat-value">Rs ${discountTotal.toFixed(2)}</span>
                    </div>
                </div>
            </div>

            <!-- Top Items Section -->
            ${topItemsArray.length > 0 ? `
            <div class="z-report-section">
                <div class="section-header">
                    <i class="fas fa-fire"></i>
                    <h5>Top Selling Items</h5>
                </div>
                <div class="items-list">
                    ${topItemsArray.map(([name, data]) => `
                        <div class="item-row">
                            <span class="item-name">${escapeHtml(name)}</span>
                            <span class="item-quantity">${data.count}x</span>
                            <span class="item-total">Rs ${data.total.toFixed(2)}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
            ` : ''}

            <!-- Voids Section -->
            ${shiftVoidedTransactions.length > 0 ? `
            <div class="z-report-section void-section">
                <div class="section-header warning">
                    <i class="fas fa-exclamation-circle"></i>
                    <h5>Void Transactions (${shiftVoidedTransactions.length})</h5>
                </div>
                <div class="void-details">
                    ${shiftVoidedTransactions.map(v => `
                        <div class="void-item">
                            <div class="void-info">
                                <span class="void-reason">${escapeHtml(v.reason || 'No reason')}</span>
                                <span class="void-time">${new Date(v.timestamp).toLocaleTimeString()}</span>
                            </div>
                            <span class="void-amount">-Rs ${Number(v.total || 0).toFixed(2)}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
            ` : ''}

            <!-- Revenue Breakdown -->
            <div class="z-report-section">
                <div class="section-header">
                    <i class="fas fa-chart-bar"></i>
                    <h5>Revenue Breakdown</h5>
                </div>
                <div class="breakdown-rows">
                    <div class="breakdown-row highlight">
                        <span class="label">Gross Sales</span>
                        <span class="amount">Rs ${grossTotal.toFixed(2)}</span>
                    </div>
                    <div class="breakdown-row">
                        <span class="label">Net Sales Revenue</span>
                        <span class="amount">Rs ${totalRevenue.toFixed(2)}</span>
                    </div>
                    ${discountTotal > 0 ? `
                    <div class="breakdown-row discount">
                        <span class="label">Total Discounts</span>
                        <span class="amount">-Rs ${discountTotal.toFixed(2)}</span>
                    </div>
                    ` : ''}
                    ${voidAmount > 0 ? `
                    <div class="breakdown-row void">
                        <span class="label">Voided Transactions</span>
                        <span class="amount">-Rs ${voidAmount.toFixed(2)}</span>
                    </div>
                    ` : ''}
                    ${changeTotal > 0 ? `
                    <div class="breakdown-row change">
                        <span class="label">Change Given</span>
                        <span class="amount">-Rs ${changeTotal.toFixed(2)}</span>
                    </div>
                    ` : ''}
                </div>
            </div>

            <!-- Payment Methods -->
            <div class="z-report-section">
                <div class="section-header">
                    <i class="fas fa-wallet"></i>
                    <h5>Payment Methods</h5>
                </div>
                <div class="payment-rows">
                    <div class="payment-row">
                        <div class="payment-method">
                            <i class="fas fa-money-bill-wave"></i>
                            <span>Cash Received</span>
                        </div>
                        <span class="payment-amount cash-amount">Rs ${(cashTotal + changeTotal).toFixed(2)}</span>
                    </div>
                    ${changeTotal > 0 ? `
                    <div class="payment-row sub">
                        <div class="payment-method sub">
                            <i class="fas fa-arrow-down"></i>
                            <span>Less: Change Given</span>
                        </div>
                        <span class="payment-amount sub">-Rs ${changeTotal.toFixed(2)}</span>
                    </div>
                    ` : ''}
                    <div class="payment-row net">
                        <div class="payment-method net">
                            <strong>Net Cash in Drawer</strong>
                        </div>
                        <span class="payment-amount cash-amount net">Rs ${cashTotal.toFixed(2)}</span>
                    </div>
                    <div class="payment-row">
                        <div class="payment-method">
                            <i class="fas fa-mobile-alt"></i>
                            <span>Mobile / QR Payments</span>
                        </div>
                        <span class="payment-amount mobile-amount">Rs ${mobileTotal.toFixed(2)}</span>
                    </div>
                </div>
            </div>

            <div class="z-report-section cash-reconciliation-section">
                <div class="section-header">
                    <i class="fas fa-scale-balanced"></i>
                    <h5>Cash Reconciliation</h5>
                </div>
                <div class="cash-reconciliation-grid">
                    <div class="breakdown-row">
                        <span class="label">Expected Cash</span>
                        <strong class="amount">Rs ${cashTotal.toFixed(2)}</strong>
                    </div>
                    <label class="cash-count-field" for="actual-cash-count">
                        <span>Actual Cash Counted</span>
                        <input id="actual-cash-count" class="filter-input" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0.00">
                    </label>
                    <div class="breakdown-row cash-variance-row">
                        <span class="label">Over / Short</span>
                        <strong id="cash-variance" class="amount">Enter actual cash</strong>
                    </div>
                </div>
            </div>

            <!-- Final Total -->
            <div class="z-report-total">
                <div class="total-row-main">
                        <span class="total-label">SHIFT NET TOTAL</span>
                    <span class="total-value">Rs ${netTotal.toFixed(2)}</span>
                </div>
            </div>

            <div class="z-report-section signature-section">
                <div class="signature-line">
                    <span>Cashier: _________________________</span>
                    <span>Manager: _________________________</span>
                </div>
            </div>

            <p class="report-generated text-muted">Report generated on ${new Date().toLocaleString('en-GB')}</p>

            <div class="z-report-actions" data-html2pdf-ignore="true">
                <button id="print-z-report-btn" class="btn-primary-action">
                    <i class="fas fa-print"></i> Print
                </button>
                <button id="export-z-report-btn" class="btn-export">
                    <i class="fas fa-file-pdf"></i> Export PDF
                </button>
                <button id="view-shift-history-btn" class="btn-export">
                    <i class="fas fa-clock-rotate-left"></i> Past Shifts
                </button>
                <button id="close-shift-btn" class="btn-close-shift">
                    <i class="fas fa-lock"></i>
                    <span>Close Shift & Lock Register</span>
                </button>
            </div>
        </div>
    `;

    showSidebarContentModal('Z-Report', content, () => {
        const actualCashInput = document.getElementById('actual-cash-count');
        const cashVariance = document.getElementById('cash-variance');
        actualCashInput?.addEventListener('input', () => {
            const actualCash = Number(actualCashInput.value);
            if (!Number.isFinite(actualCash) || actualCashInput.value === '') {
                cashVariance.textContent = 'Enter actual cash';
                cashVariance.classList.remove('cash-over', 'cash-short');
                return;
            }
            const variance = roundToTwo(actualCash - cashTotal);
            cashVariance.textContent = `${variance >= 0 ? 'Over' : 'Short'} by Rs ${Math.abs(variance).toFixed(2)}`;
            cashVariance.classList.toggle('cash-over', variance > 0);
            cashVariance.classList.toggle('cash-short', variance < 0);
        });

        document.getElementById('print-z-report-btn')?.addEventListener('click', () => {
            const reportEl = document.getElementById('z-report-container');
            if (!reportEl) return;
            const printHTML = `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Z-Report - ${new Date().toISOString().split('T')[0]}</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 20px; color: #111; font-size: 12px; }
                        .z-report-container { max-width: 700px; margin: 0 auto; }
                        .z-report-header { display: flex; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px; }
                        .z-report-title h3 { margin: 0; font-size: 18px; }
                        .z-report-period { display: flex; justify-content: space-between; margin-bottom: 15px; font-size: 11px; }
                        .z-report-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 15px; }
                        .stat-item, .z-report-section { border: 1px solid #ccc; padding: 8px; border-radius: 4px; margin-bottom: 12px; }
                        .stat-label { display: block; font-size: 10px; color: #555; text-transform: uppercase; }
                        .stat-value { font-size: 14px; font-weight: bold; }
                        .section-header { display: flex; gap: 8px; border-bottom: 1px solid #eee; margin-bottom: 8px; }
                        .section-header h5 { margin: 0 0 8px; font-size: 13px; text-transform: uppercase; }
                        .item-row, .void-item, .breakdown-row, .payment-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 11px; }
                        .cash-count-field { display: flex; justify-content: space-between; align-items: center; padding: 4px 0; }
                        .cash-count-field input { border: 0; border-bottom: 1px solid #999; width: 120px; text-align: right; }
                        .z-report-total { display: flex; justify-content: space-between; font-size: 16px; font-weight: bold; margin-top: 15px; border-top: 2px solid #000; padding-top: 10px; }
                        .signature-section { margin-top: 30px; border: 0; border-top: 1px dashed #000; }
                        .signature-line { display: flex; justify-content: space-between; gap: 30px; }
                        .signature-line span { width: 45%; padding-top: 20px; text-align: center; }
                        .report-generated { text-align: center; font-size: 10px; color: #666; margin-top: 20px; }
                        .z-report-actions { display: none !important; }
                        .cash-reconciliation-section input { background: transparent; }
                    </style>
                </head>
                <body>${reportEl.innerHTML}</body>
                </html>
            `;
            printContent(printHTML);
        });

        document.getElementById('export-z-report-btn')?.addEventListener('click', () => {
            exportToPDF('z-report-container', `Z-Report_${new Date().toISOString().split('T')[0]}`);
        });

        document.getElementById('view-shift-history-btn')?.addEventListener('click', showShiftReportHistory);

        document.getElementById('close-shift-btn')?.addEventListener('click', async () => {
            const confirmed = await showConfirmModal('Close Shift', 'Are you sure you want to close this shift? This will reset the shift baseline and lock the register.');
            if (!confirmed) return;
            const closedAt = new Date().toISOString();
            const actualCashInput = document.getElementById('actual-cash-count');
            const actualCash = actualCashInput?.value === '' ? null : Number(actualCashInput?.value);
            archiveShiftReport({
                ...currentShift,
                closedAt,
                generatedAt: closedAt,
                orderCount: shiftSales.length,
                itemCount: totalItemsCount,
                grossSales: grossTotal,
                netSales: totalRevenue,
                discounts: discountTotal,
                voids: voidAmount,
                expectedCash: cashTotal,
                actualCash: Number.isFinite(actualCash) ? roundToTwo(actualCash) : null,
                cashVariance: Number.isFinite(actualCash) ? roundToTwo(actualCash - cashTotal) : null,
                mobileTotal,
                closedBy: currentUser?.email || staffName || 'Local Staff'
            });
            localStorage.setItem('pos_last_shift_close', closedAt);
            localStorage.setItem(CURRENT_SHIFT_KEY, JSON.stringify({
                shiftId: `SHIFT-${new Date(closedAt).getTime()}`,
                startedAt: closedAt
            }));
            closeSidebarContentModal();
            if (localStorage.getItem(PIN_HASH_KEY) && window.crypto?.subtle) {
                lockScreen();
                notifications.show('Shift closed and register locked.', 'success');
            } else {
                notifications.show('Shift closed. Set a Staff PIN to lock the register.', 'warning');
            }
        });
    });
}

// Settings Panel
function showSettings() {
    const content = `
        <div class="report-container settings-panel">
            <div class="report-header"><h4><i class="fas fa-cog text-secondary me-2"></i>Settings</h4><span class="report-badge">Preferences</span></div>
            <nav class="settings-tabs" aria-label="Settings sections">
                <button type="button" class="settings-tab active" data-settings-tab="general">General</button>
                <button type="button" class="settings-tab" data-settings-tab="charges">Charges</button>
                <button type="button" class="settings-tab" data-settings-tab="receipt">Receipt</button>
                <button type="button" class="settings-tab" data-settings-tab="cloud">Cloud</button>
                <button type="button" class="settings-tab" data-settings-tab="security">Security</button>
            </nav>
            <div class="settings-section"><h5><i class="fas fa-volume-up me-2"></i>Audio</h5><div class="settings-group">
                <div class="setting-item"><div class="setting-info"><span class="setting-label">Sound Effects</span><span class="setting-desc">Button clicks and notifications</span></div><label class="toggle-switch"><input type="checkbox" id="sound-toggle" ${soundEnabled ? 'checked' : ''}><span class="toggle-slider"></span></label></div>
                <div class="setting-item"><div class="setting-info"><span class="setting-label">Voice Feedback</span><span class="setting-desc">Order confirmations and alerts</span></div><label class="toggle-switch"><input type="checkbox" id="speech-toggle" ${speechEnabled ? 'checked' : ''}><span class="toggle-slider"></span></label></div>
            </div></div>
            <div class="settings-section"><h5><i class="fas fa-palette me-2"></i>Appearance</h5><div class="settings-group"><div class="setting-item"><div class="setting-info"><span class="setting-label">Dark Mode</span><span class="setting-desc">Switch the interface theme</span></div><button id="theme-toggle-settings" class="btn-secondary"><i class="fas fa-moon"></i> Toggle</button></div></div></div>
            <div class="settings-section"><h5><i class="fas fa-receipt me-2"></i>Charges</h5><div class="settings-group">
                <div class="setting-item"><div class="setting-info"><span class="setting-label">VAT (%)</span><span class="setting-desc">Applied to the discounted subtotal</span></div><input id="vat-percent-setting" class="filter-input" type="number" min="0" max="100" step="0.01" value="${vatPercent}"></div>
                <div class="setting-item"><div class="setting-info"><span class="setting-label">Service Charge (%)</span><span class="setting-desc">Applied before VAT</span></div><input id="service-charge-percent-setting" class="filter-input" type="number" min="0" max="100" step="0.01" value="${serviceChargePercent}"></div>
            </div></div>
            <div class="settings-section"><h5><i class="fas fa-triangle-exclamation me-2"></i>Checkout Warning</h5><div class="settings-group">
                <div class="setting-item"><div class="setting-info"><span class="setting-label">Amount Threshold (Rs)</span><span class="setting-desc">Ask for confirmation above this amount</span></div><input id="large-checkout-amount-setting" class="filter-input" type="number" min="0" max="100000" step="1" value="${largeCheckoutAmount}"></div>
                <div class="setting-item"><div class="setting-info"><span class="setting-label">Item Count Threshold</span><span class="setting-desc">Ask for confirmation above this item count</span></div><input id="large-checkout-item-count-setting" class="filter-input" type="number" min="0" max="1000" step="1" value="${largeCheckoutItemCount}"></div>
            </div></div>
            <div class="settings-section"><h5><i class="fas fa-store me-2"></i>Receipt & Staff</h5><div class="settings-group">
                <div class="setting-item"><div class="setting-info"><span class="setting-label">Restaurant Name</span><span class="setting-desc">Shown at the top of printed receipts</span></div><input id="restaurant-name-setting" class="filter-input" type="text" maxlength="80" value="${escapeHtml(restaurantName)}"></div>
                <div class="setting-item"><div class="setting-info"><span class="setting-label">Address</span><span class="setting-desc">Shown below the restaurant name</span></div><input id="restaurant-address-setting" class="filter-input" type="text" maxlength="120" value="${escapeHtml(restaurantAddress)}"></div>
                <div class="setting-item"><div class="setting-info"><span class="setting-label">PAN</span><span class="setting-desc">Shown on printed receipts</span></div><input id="restaurant-pan-setting" class="filter-input" type="text" maxlength="40" value="${escapeHtml(restaurantPan)}"></div>
                <div class="setting-item"><div class="setting-info"><span class="setting-label">Thank-you Message</span><span class="setting-desc">Receipt closing message</span></div><input id="receipt-thank-you-setting" class="filter-input" type="text" maxlength="120" value="${escapeHtml(receiptThankYou)}"></div>
                <div class="setting-item"><div class="setting-info"><span class="setting-label">Social Handle</span><span class="setting-desc">Optional receipt footer line</span></div><input id="receipt-social-setting" class="filter-input" type="text" maxlength="120" value="${escapeHtml(receiptSocialHandle)}"></div>
                <div class="setting-item"><div class="setting-info"><span class="setting-label">Staff Name</span><span class="setting-desc">Used for local action attribution</span></div><input id="staff-name-setting" class="filter-input" type="text" maxlength="80" value="${escapeHtml(staffName)}"></div>
            </div></div>
            <div class="settings-section"><h5><i class="fas fa-cloud me-2"></i>Cloud Backup</h5><div class="settings-group">
                <div class="setting-item"><div class="setting-info"><span class="setting-label">Store ID</span><span class="setting-desc">A unique identifier for this branch</span></div><input id="store-id-setting" class="filter-input" type="text" maxlength="30" value="${escapeHtml(localStorage.getItem('store-id') || '')}"></div>
                <div class="setting-item"><div class="setting-info"><span class="setting-label">Supabase URL</span><span class="setting-desc">Project Data API URL</span></div><input id="supabase-url-setting" class="filter-input" type="url" maxlength="120" value="${escapeHtml(localStorage.getItem('supabase-url') || '')}"></div>
                <div class="setting-item"><div class="setting-info"><span class="setting-label">Supabase Publishable Key</span><span class="setting-desc">Stored only on this device</span></div><input id="supabase-key-setting" class="filter-input" type="password" maxlength="300" value="${escapeHtml(localStorage.getItem('supabase-key') || '')}"></div>
                <div class="setting-item"><div class="setting-info"><span class="setting-label">Sync Status</span><span class="setting-desc" id="cloud-sync-status">Not connected</span></div><button id="cloud-sync-toggle" class="btn-secondary" type="button">Connect</button></div>
            </div></div>
            <div class="settings-section">
                <h5><i class="fas fa-lock me-2"></i>Staff PIN Lock</h5>
                <div class="settings-group">
                    <div class="setting-item">
                        <div class="setting-info">
                            <span class="setting-label">PIN Lock Status</span>
                            <span class="setting-desc" id="pin-status-text"></span>
                        </div>
                        <span id="pin-status-badge"></span>
                    </div>
                    <div class="setting-item">
                        <div class="setting-info">
                            <span class="setting-label">New PIN</span>
                            <span class="setting-desc">4-8 digits. Leave blank to keep the current PIN.</span>
                        </div>
                        <input id="staff-pin-setting" class="filter-input" type="password" inputmode="numeric" pattern="[0-9]*" minlength="4" maxlength="8" placeholder="4-8 digits" autocomplete="new-password">
                    </div>
                    <div class="setting-item">
                        <div class="setting-info">
                            <span class="setting-label">Confirm New PIN</span>
                            <span class="setting-desc">Re-enter the new PIN</span>
                        </div>
                        <input id="staff-pin-confirm-setting" class="filter-input" type="password" inputmode="numeric" pattern="[0-9]*" minlength="4" maxlength="8" placeholder="Repeat PIN" autocomplete="new-password">
                    </div>
                </div>
                <div class="settings-actions" style="margin-top:.75rem; gap:.5rem;">
                    <button id="save-pin-btn" class="btn-primary-action" type="button"><i class="fas fa-key"></i> Set / Change PIN</button>
                    <button id="remove-pin-btn" class="btn-warning-action" type="button"><i class="fas fa-unlock"></i> Remove PIN Lock</button>
                </div>
            </div>
            <div class="settings-actions"><button id="lock-screen-now" class="btn-warning-action" type="button"><i class="fas fa-lock"></i> Lock Screen</button><button id="save-settings" class="btn-primary-action"><i class="fas fa-save"></i> Save Settings</button></div>
        </div>
    `;
    
    showSidebarContentModal('Settings', content, () => {
        updateSettingsThemeControl();
        const settingsSections = document.querySelectorAll('.settings-panel > .settings-section');
        const settingsTabGroups = {
            general: [0, 1],
            charges: [2, 3],
            receipt: [4],
            cloud: [5],
            security: [6]
        };
        document.querySelectorAll('.settings-tab').forEach(tab => tab.addEventListener('click', () => {
            const visibleSections = settingsTabGroups[tab.dataset.settingsTab] || settingsTabGroups.general;
            document.querySelectorAll('.settings-tab').forEach(item => item.classList.toggle('active', item === tab));
            settingsSections.forEach((section, index) => { section.hidden = !visibleSections.includes(index); });
        }));
        const refreshCloudConnectionStatus = async () => {
            const statusEl = document.getElementById('cloud-sync-status');
            const button = document.getElementById('cloud-sync-toggle');
            const configured = localStorage.getItem('store-id') &&
                localStorage.getItem('supabase-url') &&
                localStorage.getItem('supabase-key');
            if (!configured || !window.CloudSync) return;
            if (statusEl) statusEl.textContent = 'Checking connection...';
            if (button) {
                button.textContent = 'Connecting...';
                button.disabled = true;
            }
            const ok = await window.CloudSync.init();
            const status = window.CloudSync.getStatus();
            if (ok) {
                window.CloudSync.syncHistoricalSales?.(salesHistory).catch(error => {
                    console.warn('[CloudSync] historical sales sync failed:', error);
                });
            }
            if (statusEl) statusEl.textContent = ok ? `Connected - ${status.storeId}` : `Connection failed: ${status.lastError || 'check URL, key, table, and permissions'}`;
            if (button) {
                button.textContent = ok ? 'Disconnect' : 'Connect';
                button.disabled = false;
            }
        };
        refreshCloudConnectionStatus();
        document.getElementById('sound-toggle')?.addEventListener('change', (e) => {
            soundEnabled = e.target.checked;
        });
        document.getElementById('speech-toggle')?.addEventListener('change', (e) => {
            speechEnabled = e.target.checked;
        });
        document.getElementById('theme-toggle-settings')?.addEventListener('click', toggleTheme);
        document.getElementById('lock-screen-now')?.addEventListener('click', () => {
            if (!localStorage.getItem(PIN_HASH_KEY)) {
                notifications.show('Save a Staff PIN before locking the screen.', 'warning');
                return;
            }
            closeSidebarContentModal();
            lockScreen();
        });
        // Initial status paint
        refreshPinStatusUI();

        // SET / CHANGE PIN
        document.getElementById('save-pin-btn')?.addEventListener('click', async () => {
            const pinInput = document.getElementById('staff-pin-setting');
            const confirmInput = document.getElementById('staff-pin-confirm-setting');
            const pin = (pinInput?.value || '').trim();
            const confirmPin = (confirmInput?.value || '').trim();

            if (!pin) {
                notifications.show('Enter a new PIN to set or change.', 'warning');
                return;
            }
            if (!/^\d{4,8}$/.test(pin)) {
                notifications.show('PIN must be 4-8 digits.', 'warning');
                return;
            }
            if (pin !== confirmPin) {
                notifications.show('PINs do not match.', 'error');
                return;
            }
            if (!window.crypto?.subtle) {
                notifications.show('PIN lock requires HTTPS. Cannot save on HTTP.', 'error', 6000);
                return;
            }

            try {
                const ok = await saveStaffPin(pin);
                if (!ok) {
                    notifications.show('PIN must contain 4 to 8 digits.', 'warning');
                    return;
                }
                if (pinInput) pinInput.value = '';
                if (confirmInput) confirmInput.value = '';
                refreshPinStatusUI();
                notifications.show('Staff PIN saved. Lock Screen is now active.', 'success');
            } catch (error) {
                handleCriticalError('Saving Staff PIN', error);
            }
        });

        // REMOVE PIN
        document.getElementById('remove-pin-btn')?.addEventListener('click', async () => {
            if (!localStorage.getItem(PIN_HASH_KEY)) {
                notifications.show('No PIN is currently set.', 'info');
                return;
            }
            const confirmed = await showConfirmModal(
                'Remove PIN Lock',
                'Remove the staff PIN? The POS will no longer ask for a PIN on startup or when using Lock Screen.'
            );
            if (!confirmed) return;

            try {
                await saveStaffPin('');
                unlockScreen();
                refreshPinStatusUI();
                notifications.show('PIN lock removed.', 'success');
            } catch (error) {
                handleCriticalError('Removing Staff PIN', error);
            }
        });
        document.getElementById('save-settings')?.addEventListener('click', async () => {
            const vatInput = document.getElementById('vat-percent-setting');
            const serviceChargeInput = document.getElementById('service-charge-percent-setting');
            const largeAmountInput = document.getElementById('large-checkout-amount-setting');
            const largeItemCountInput = document.getElementById('large-checkout-item-count-setting');
            const restaurantNameInput = document.getElementById('restaurant-name-setting');
            const restaurantAddressInput = document.getElementById('restaurant-address-setting');
            const restaurantPanInput = document.getElementById('restaurant-pan-setting');
            const receiptThankYouInput = document.getElementById('receipt-thank-you-setting');
            const receiptSocialInput = document.getElementById('receipt-social-setting');
            const staffNameInput = document.getElementById('staff-name-setting');
            vatPercent = Math.min(100, Math.max(0, Number(vatInput?.value) || 0));
            serviceChargePercent = Math.min(100, Math.max(0, Number(serviceChargeInput?.value) || 0));
            largeCheckoutAmount = Math.min(100000, Math.max(0, Number(largeAmountInput?.value) || 0));
            largeCheckoutItemCount = Math.min(1000, Math.max(0, Number(largeItemCountInput?.value) || 0));
            restaurantName = restaurantNameInput?.value.trim() || 'Taboche Restaurant';
            restaurantAddress = restaurantAddressInput?.value.trim() || 'Bhaktapur, Nepal';
            restaurantPan = restaurantPanInput?.value.trim() || '600XXXXXX';
            receiptThankYou = receiptThankYouInput?.value.trim() || 'Thank you for your visit!';
            receiptSocialHandle = receiptSocialInput?.value.trim() || '';
            staffName = staffNameInput?.value.trim() || 'Local Staff';
            currentUser.email = staffName;
            localStorage.setItem('soundEnabled', soundEnabled);
            localStorage.setItem('speechEnabled', speechEnabled);
            localStorage.setItem('vatPercent', String(vatPercent));
            localStorage.setItem('serviceChargePercent', String(serviceChargePercent));
            localStorage.setItem('largeCheckoutAmount', String(largeCheckoutAmount));
            localStorage.setItem('largeCheckoutItemCount', String(largeCheckoutItemCount));
            localStorage.setItem('restaurantName', restaurantName);
            localStorage.setItem('restaurantAddress', restaurantAddress);
            localStorage.setItem('restaurantPan', restaurantPan);
            localStorage.setItem('receiptThankYou', receiptThankYou);
            localStorage.setItem('receiptSocialHandle', receiptSocialHandle);
            localStorage.setItem('staffName', staffName);
            localStorage.setItem('store-id', document.getElementById('store-id-setting')?.value.trim() || '');
            localStorage.setItem('supabase-url', document.getElementById('supabase-url-setting')?.value.trim() || '');
            localStorage.setItem('supabase-key', document.getElementById('supabase-key-setting')?.value.trim() || '');
            if (window.CloudSync) await window.CloudSync.init();
            updateTotal();
            notifications.show('Settings saved', 'success');
            closeSidebarContentModal();
        });
        document.getElementById('cloud-sync-toggle')?.addEventListener('click', async (event) => {
            const statusEl = document.getElementById('cloud-sync-status');
            const button = event.currentTarget;
            if (window.CloudSync?.isReady()) {
                if (window.CloudSync) window.CloudSync.disconnect();
                if (statusEl) statusEl.textContent = 'Not connected';
                button.textContent = 'Connect';
                notifications.show('Cloud sync disconnected. Settings were cleared.', 'info');
                return;
            }
            const storeId = document.getElementById('store-id-setting')?.value.trim() || '';
            const supabaseUrl = document.getElementById('supabase-url-setting')?.value.trim() || '';
            const supabaseKey = document.getElementById('supabase-key-setting')?.value.trim() || '';

            localStorage.setItem('store-id', storeId);
            localStorage.setItem('supabase-url', supabaseUrl);
            localStorage.setItem('supabase-key', supabaseKey);

            if (!window.CloudSync) {
                if (statusEl) statusEl.textContent = 'Cloud sync unavailable';
                return;
            }
            if (!storeId || !supabaseUrl || !supabaseKey) {
                if (statusEl) statusEl.textContent = 'Enter Store ID, URL, and key';
                button.textContent = 'Connect';
                notifications.show('Enter the Store ID, Supabase URL, and publishable key.', 'warning');
                return;
            }
            if (statusEl) statusEl.textContent = 'Connecting...';
            button.disabled = true;
            const ok = await window.CloudSync.init();
            const status = window.CloudSync.getStatus();
            if (statusEl) statusEl.textContent = ok ? `Connected - ${status.storeId}` : `Connection failed: ${status.lastError || 'check URL, key, table, and permissions'}`;
            button.textContent = ok ? 'Disconnect' : 'Connect';
            button.disabled = false;
            notifications.show(ok ? 'Cloud settings saved and connected.' : 'Cloud settings saved, but connection failed. Check URL and key.', ok ? 'success' : 'error');
        });
    });
}

// Table Merge Feature
async function mergeTables() {
    const occupiedTables = tableList.filter(table => orders[table]?.length);
    const tableOptions = (tables, emptyLabel) => `<option value="">${emptyLabel}</option>${tables.map(table => `<option value="${table}">Table ${table}${orders[table]?.length ? ` (${orders[table].reduce((sum, item) => sum + item.quantity, 0)} items)` : ''}</option>`).join('')}`;
    showSidebarContentModal('Merge Tables', `
        <div class="report-container merge-tables">
            <div class="report-header"><h4><i class="fas fa-object-ungroup text-warning me-2"></i>Merge Tables</h4><span class="report-badge warning">Cannot be undone</span></div>
            <div class="merge-info"><p>Select a source table and target table. All source items will move to the target.</p><div class="alert-warning"><i class="fas fa-exclamation-triangle"></i><span>Review the selections carefully before merging.</span></div></div>
            <div class="merge-selectors"><div class="merge-select"><label for="merge-source">Source Table</label><select id="merge-source" class="filter-select">${tableOptions(occupiedTables, 'Select occupied table...')}</select></div><div class="merge-arrow"><i class="fas fa-arrow-right"></i></div><div class="merge-select"><label for="merge-target">Target Table</label><select id="merge-target" class="filter-select">${tableOptions(tableList, 'Select target table...')}</select></div></div>
            <button id="execute-merge" class="btn-warning-action" disabled><i class="fas fa-object-ungroup"></i> Merge Tables</button>
        </div>
    `, () => {
        const source = document.getElementById('merge-source');
        const target = document.getElementById('merge-target');
        const execute = document.getElementById('execute-merge');
        const updateMergeState = () => { execute.disabled = !source.value || !target.value || source.value === target.value; };
        if (currentTable && occupiedTables.includes(currentTable)) {
            source.value = currentTable;
            target.value = '';
        }
        updateMergeState();
        source?.addEventListener('change', updateMergeState); target?.addEventListener('change', updateMergeState);
        execute?.addEventListener('click', async () => {
            const confirmed = await showConfirmModal('Merge Tables', 'Merging tables will combine orders. This action cannot be undone. Continue?');
            if (!confirmed) return;
            const sourceTable = source.value;
            const targetTable = target.value;
            if (!orders[sourceTable]?.length || sourceTable === targetTable) return;

            orders[targetTable] = orders[targetTable] || [];
            const sourceTimer = tableTimers[sourceTable];
            orders[sourceTable].forEach(item => {
                const existing = orders[targetTable].find(existingItem =>
                    existingItem.name === item.name &&
                    existingItem.price === item.price &&
                    JSON.stringify(existingItem.extras || []) === JSON.stringify(item.extras || []) &&
                    (existingItem.notes || '') === (item.notes || '')
                );
                if (existing) {
                    existing.quantity += Number(item.quantity) || 0;
                    existing.sentQuantity = (Number(existing.sentQuantity) || 0) + (Number(item.sentQuantity) || 0);
                    existing.finalized = existing.quantity === existing.sentQuantity;
                } else {
                    orders[targetTable].push({ ...item });
                }
            });

            kotHistory.forEach(kot => {
                if (String(kot.table).trim().toUpperCase() === String(sourceTable).trim().toUpperCase()) {
                    kot.table = targetTable;
                }
            });

            delete orders[sourceTable];
            delete tableTimers[sourceTable];
            if (sourceTimer) {
                const targetTimer = tableTimers[targetTable];
                tableTimers[targetTable] = targetTimer
                    ? { ...targetTimer, elapsed: Math.max(Number(targetTimer.elapsed) || 0, Number(sourceTimer.elapsed) || 0) }
                    : sourceTimer;
            }
            if (currentTable === sourceTable) {
                currentTable = targetTable;
                localStorage.setItem('selectedTable', targetTable);
                document.getElementById('selected-table')?.replaceChildren(targetTable);
                document.getElementById('selected-table-checkout')?.replaceChildren(targetTable);
                loadTableNotes(targetTable);
            }
            const sourceNote = localStorage.getItem(`table-notes-${sourceTable}`);
            if (sourceNote !== null) {
                localStorage.setItem(`table-notes-${targetTable}`, sourceNote);
                localStorage.removeItem(`table-notes-${sourceTable}`);
                if (currentTable === targetTable) loadTableNotes(targetTable);
            }
            persistAllData();
            renderOrderItems();
            initializeTables();
            updateTotal();
            closeSidebarContentModal();
            logAudit('table.merged', {
                table: targetTable,
                orderId: `merged-from-${sourceTable}`
            });
            notifications.show(`Table ${sourceTable} merged into Table ${targetTable}`, 'success');
        });
    });
}

// Keyboard Shortcuts
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const overlayPriority = [
            { id: 'extras-modal', close: closeExtrasModal },
            { id: 'notes-modal', close: closeNotesModal },
            { id: 'checkout-dialog', close: closeCheckoutDialog },
            { id: 'sidebar-content-modal', close: closeSidebarContentModal },
            { id: 'qr-code-dialog', close: closeQRCodeDialog }
        ];
        for (const { id, close } of overlayPriority) {
            const element = document.getElementById(id);
            if (element && getComputedStyle(element).display !== 'none' && element.offsetParent !== null) {
                e.preventDefault();
                close();
                return;
            }
        }
        if (document.getElementById('sidebar')?.classList.contains('active')) {
            closeSidebar(e);
            return;
        }
    }

    // Ctrl+K for search focus
    if (e.ctrlKey && e.key === 'k') {
        e.preventDefault();
        document.getElementById('search')?.focus();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (currentTable && orders[currentTable]?.length) finalizeOrder();
    }
    // F1 for help
    if (e.key === 'F1') {
        e.preventDefault();
        showHelpModal();
    }
    // Ctrl+Shift+C for checkout
    if (e.ctrlKey && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        showCheckoutDialog();
    }
    // Ctrl+Alt+M for merge tables
    if (e.ctrlKey && e.altKey && e.key === 'M') {
        e.preventDefault();
        mergeTables();
    }
});

function showHelpModal() {
    const content = `
        <div class="report-container help-modal">
            <div class="report-header"><h4><i class="fas fa-circle-question text-info me-2"></i>Help & Shortcuts</h4></div>
            <div class="help-grid"><div><h5><i class="fas fa-keyboard me-2"></i>Keyboard Shortcuts</h5><div class="shortcut-list">
                <div class="shortcut-item"><kbd>Ctrl</kbd> + <kbd>K</kbd><span>Focus search bar</span></div><div class="shortcut-item"><kbd>F1</kbd><span>Open this help</span></div><div class="shortcut-item"><kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>C</kbd><span>Open checkout</span></div><div class="shortcut-item"><kbd>Ctrl</kbd> + <kbd>Alt</kbd> + <kbd>M</kbd><span>Merge tables</span></div><div class="shortcut-item"><kbd>Esc</kbd><span>Close modals or sidebar</span></div>
            </div></div><div><h5><i class="fas fa-lightbulb me-2"></i>Tips</h5><ul class="tips-list"><li><i class="fas fa-check-circle text-success me-2"></i>Use the sidebar for reports and utilities</li><li><i class="fas fa-check-circle text-success me-2"></i>Search works across all menu items</li><li><i class="fas fa-check-circle text-success me-2"></i>Tables show timers when occupied</li><li><i class="fas fa-check-circle text-success me-2"></i>Finalize orders to send to kitchen</li></ul></div></div>
        </div>
    `;
    showSidebarContentModal('Help', content);
}

// Export to PDF function
function exportToPDF(elementId, filename) {
    if (typeof html2pdf === 'undefined') {
        notifications.show('PDF library not loaded. Please check your internet connection.', 'error');
        return;
    }
    
    const element = document.getElementById(elementId);
    if (!element) {
        notifications.show('Element not found for PDF export', 'error');
        return;
    }
    
    showLoadingSpinner();
    
    const opt = {
        margin: [0.5, 0.5, 0.5, 0.5],
        filename: `${filename}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
    };
    
    html2pdf().set(opt).from(element).save().then(() => {
        notifications.show('PDF exported successfully', 'success');
    }).catch(error => {
        console.error('PDF export failed:', error);
        notifications.show('PDF export failed', 'error');
    }).finally(() => {
        hideLoadingSpinner();
    });

    }
