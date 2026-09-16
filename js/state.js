function migrateStoredData(data = {}) {
    const next = {
        orders: {},
        tableTimers: {},
        salesHistory: [],
        orderHistory: [],
        voidDetails: [],
        kotHistory: [],
        auditLog: [],
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
            notes: typeof item.notes === 'string' ? item.notes : '',
            sentQuantity: Number.isFinite(Number(item.sentQuantity))
                ? Math.min(Number(item.quantity) || 1, Math.max(0, Number(item.sentQuantity)))
                : item.finalized ? (Number(item.quantity) || 1) : 0
        }));
    });
    next.orders = normalizedOrders;

    next.tableTimers = next.tableTimers && typeof next.tableTimers === 'object' && !Array.isArray(next.tableTimers) ? next.tableTimers : {};
    next.salesHistory = Array.isArray(next.salesHistory) ? next.salesHistory : [];
    next.orderHistory = Array.isArray(next.orderHistory) ? next.orderHistory : [];
    next.voidDetails = Array.isArray(next.voidDetails) ? next.voidDetails : [];
    next.kotHistory = Array.isArray(next.kotHistory) ? next.kotHistory : [];
    next.auditLog = Array.isArray(next.auditLog) ? next.auditLog : [];

    if (!next.schemaVersion || next.schemaVersion < 3) {
        next.schemaVersion = 3;
    }

    return next;
}

function compressDataState(data = {}) {
    const next = migrateStoredData(data);

    next.voidDetails = (next.voidDetails || []).filter(entry => entry && typeof entry === 'object');
    next.kotHistory = (next.kotHistory || []).filter(entry => entry && typeof entry === 'object');
    next.orderHistory = (next.orderHistory || []).filter(entry => entry && typeof entry === 'object');
    next.salesHistory = (next.salesHistory || []).filter(entry => entry && typeof entry === 'object');
    next.auditLog = (next.auditLog || []).filter(entry => entry && typeof entry === 'object').slice(-5000);

    return next;
}

function isActiveSale(sale) {
    return sale && sale.status !== 'voided' && sale.status !== 'refunded';
}

function createOrderHistorySnapshot(sales = []) {
    return sales.map(sale => ({
        ...sale,
        items: Array.isArray(sale.items) ? sale.items.map(item => ({
            ...item,
            extras: Array.isArray(item.extras) ? item.extras.map(extra => ({ ...extra })) : []
        })) : []
    }));
}

// Global state variables, loaded from localStorage or initialized empty
let currentTable = localStorage.getItem('selectedTable') || null;
let orders = {}; // { tableNumber: [item1, item2, ...] }
let tableTimers = {}; // { tableNumber: { start: timestamp, elapsed: ms, lastUpdated: ms } }
let salesHistory = []; // [sale1, sale2, ...]
// orderHistory is a persisted view snapshot; update it whenever salesHistory changes.
let orderHistory = []; // Independent snapshots used by the history view
let voidDetails = []; // [void1, void2, ...]
let kotHistory = []; // [kot1, kot2, ...]
let auditLog = []; // Append-only operational audit records
let paymentAmount = 0;
let discount = 0;
let discountCodeApplied = null;
let paymentAllocations = [];
let currentItemIndex = null;
let currentPage = 1;
const itemsPerPage = 10;
const MAX_HISTORY_ITEMS = 1000;
const ORDER_HISTORY_RETENTION_DAYS = 3;
const VOID_DETAILS_RETENTION_DAYS = 3;
const SALES_HISTORY_RETENTION_DAYS = 90;
const KOT_HISTORY_RETENTION_DAYS = 30;
const MAX_VOID_DETAILS_ENTRIES = 300;
const MAX_KOT_HISTORY_ENTRIES = 250;
const STORAGE_AUTO_CLEAN_LIMIT_BYTES = 8 * 1024 * 1024;
let saveTimeout;
let appendNumberTimeout; // Debounce timeout for number input
let isProcessingPayment = false;
let paymentResetTimer = null;
let timerUpdateQueued = false;
let isFinalizingOrder = false;
let orderHistoryShowAll = false;
let kitchenElapsedInterval = null;
let activeChartInstances = {};
let suppressMenuItemClickUntil = 0;
const posSyncChannel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('pos-sync');

