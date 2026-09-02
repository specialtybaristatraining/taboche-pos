export function migrateStoredData(data = {}) {
    const next = {
        orders: {},
        tableTimers: {},
        salesHistory: [],
        orderHistory: [],
        voidDetails: [],
        kotHistory: [],
        itemsSold: [],
        ...data
    };

    if (!next.orders || typeof next.orders !== 'object' || Array.isArray(next.orders)) {
        next.orders = {};
    }

    const normalizedOrders = {};
    Object.entries(next.orders).forEach(([table, items]) => {
        if (!Array.isArray(items)) {
            normalizedOrders[table] = [];
            return;
        }
        normalizedOrders[table] = items.filter(Boolean).map(item => ({
            ...item,
            quantity: Number(item.quantity) > 0 ? Number(item.quantity) : 1,
            price: Number(item.price) || 0,
            extras: Array.isArray(item.extras) ? item.extras : [],
            notes: typeof item.notes === 'string' ? item.notes : ''
        }));
    });
    next.orders = normalizedOrders;

    next.salesHistory = Array.isArray(next.salesHistory) ? next.salesHistory : [];
    next.orderHistory = Array.isArray(next.orderHistory) ? next.orderHistory : [];
    next.voidDetails = Array.isArray(next.voidDetails) ? next.voidDetails : [];
    next.kotHistory = Array.isArray(next.kotHistory) ? next.kotHistory : [];
    next.itemsSold = Array.isArray(next.itemsSold) ? next.itemsSold : [];

    if (!next.schemaVersion || next.schemaVersion < 2) {
        next.schemaVersion = 2;
    }

    return next;
}

export function compressDataState(data = {}) {
    const next = migrateStoredData(data);

    next.voidDetails = (next.voidDetails || []).filter(entry => entry && typeof entry === 'object');
    next.kotHistory = (next.kotHistory || []).filter(entry => entry && typeof entry === 'object');
    next.orderHistory = (next.orderHistory || []).filter(entry => entry && typeof entry === 'object');
    next.salesHistory = (next.salesHistory || []).filter(entry => entry && typeof entry === 'object');

    const itemsSoldMap = new Map();
    (next.itemsSold || []).forEach(entry => {
        if (!entry || typeof entry.name !== 'string') return;
        const key = entry.name.toLowerCase();
        if (!itemsSoldMap.has(key)) {
            itemsSoldMap.set(key, { ...entry, quantity: Number(entry.quantity) || 0, totalRevenue: Number(entry.totalRevenue) || 0 });
            return;
        }
        const target = itemsSoldMap.get(key);
        target.quantity += Number(entry.quantity) || 0;
        target.totalRevenue += Number(entry.totalRevenue) || 0;
    });
    next.itemsSold = Array.from(itemsSoldMap.values()).filter(item => item.quantity > 0);

    return next;
}

export function saveCheckoutState(state, storage = globalThis.sessionStorage) {
    if (!storage) return;
    storage.setItem('pos-checkout-state', JSON.stringify(state));
}

export function restoreCheckoutState(storage = globalThis.sessionStorage) {
    if (!storage) return null;
    try {
        const raw = storage.getItem('pos-checkout-state');
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
        return null;
    }
}

export function clearCheckoutState(storage = globalThis.sessionStorage) {
    if (!storage) return;
    storage.removeItem('pos-checkout-state');
}
