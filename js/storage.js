function saveCheckoutState(state, storage = globalThis.sessionStorage) {
    if (!storage) return;
    storage.setItem('pos-checkout-state', JSON.stringify(state));
}

function restoreCheckoutState(storage = globalThis.sessionStorage) {
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

function clearCheckoutState(storage = globalThis.sessionStorage) {
    if (!storage) return;
    storage.removeItem('pos-checkout-state');
}

function getSettingsSnapshot() {
    return {
        soundEnabled,
        speechEnabled,
        restaurantName,
        restaurantAddress,
        restaurantPan,
        receiptThankYou,
        receiptSocialHandle,
        staffName,
        vatPercent,
        serviceChargePercent,
        largeCheckoutAmount,
        largeCheckoutItemCount,
        theme: localStorage.getItem('theme') || 'light'
    };
}

// ========== STORAGE MONITORING SYSTEM ==========
async function getStorageUsageSnapshot() {
    let usage = 0;
    let quota = 10 * 1024 * 1024;

    if (navigator.storage?.estimate) {
        try {
            const estimate = await navigator.storage.estimate();
            usage = Number(estimate.usage) || 0;
            quota = Number(estimate.quota) || quota;
        } catch (error) {
            console.warn('Storage estimate unavailable:', error);
        }
    }

    if (!usage) {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            const value = localStorage.getItem(key) || '';
            usage += (key.length + value.length) * 2;
        }
    }

    return {
        usedMB: usage / (1024 * 1024),
        quota,
        percentUsed: quota ? (usage / quota) * 100 : 0
    };
}

async function checkStorageAndWarn() {
    const { usedMB, percentUsed } = await getStorageUsageSnapshot();
    
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
    indicator.innerHTML = `💾 ${usedMB.toFixed(1)}MB used`;
    indicator.style.background = percentUsed > 80 ? '#dc2626' : 'rgba(255, 255, 255, 0.15)';
    indicator.style.color = percentUsed > 80 ? '#ffffff' : '#eef2ff';
    
    // Show warning if near full
    if (percentUsed > 85) {
        const warning = document.createElement('div');
        warning.id = 'storage-warning';
        warning.style.cssText = 'position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); background:#dc2626; color:white; padding:20px; border-radius:12px; z-index:10000; text-align:center; box-shadow:0 4px 20px black; min-width:280px;';
        warning.innerHTML = `
            <h3>⚠️ STORAGE ${Math.floor(percentUsed)}% FULL!</h3>
            <p>You have ${salesHistory.length} sales records.</p>
            <p style="font-size:14px;">Origin storage is nearing its browser quota.</p>
            <button data-storage-action="backup" style="background:white; color:black; padding:10px 20px; margin:10px; border:none; border-radius:8px; cursor:pointer;">📥 BACKUP NOW</button>
            <button data-storage-action="dismiss" style="background:transparent; color:white; padding:10px 20px; border:1px solid white; border-radius:8px; cursor:pointer;">Dismiss</button>
        `;
        if (!document.getElementById('storage-warning')) {
            warning.querySelector('[data-storage-action="backup"]').addEventListener('click', quickBackupNow);
            warning.querySelector('[data-storage-action="dismiss"]').addEventListener('click', () => warning.remove());
            document.body.appendChild(warning);
        }
    }
}

function quickBackupNow() {
    const data = {
        schemaVersion: BACKUP_SCHEMA_VERSION,
        timestamp: new Date().toISOString(),
        orders,
        tableTimers,
        salesHistory,
        orderHistory,
        voidDetails: voidDetails,
        kotHistory,
        menuItems,
        extras,
        discountCodes,
        settings: getSettingsSnapshot(),
        exportDate: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pos_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notifications.show('Backup saved to Downloads/Files.', 'success', 5000);
    const warning = document.getElementById('storage-warning');
    if (warning) warning.remove();
}

async function showQuickBackup() {
    const { usedMB, quota, percentUsed } = await getStorageUsageSnapshot();
    showSidebarContentModal('Storage Manager', `
        <div class="report-container storage-manager">
            <div class="report-header"><h4><i class="fas fa-database text-primary me-2"></i>Storage Manager</h4><span class="report-badge">Local estimate</span></div>
            <div class="storage-usage"><div class="storage-bar-bg"><div class="storage-bar-fill" style="width:${Math.min(100, percentUsed)}%"></div></div><div class="storage-stats"><span>${usedMB.toFixed(1)} MB used</span><span>${(quota / (1024 * 1024)).toFixed(1)} MB quota</span></div></div>
            <div class="storage-actions-grid"><button id="storage-backup" class="btn-storage backup"><i class="fas fa-download"></i><span>Backup Data</span><small>Download JSON backup</small></button><button id="storage-restore" class="btn-storage restore"><i class="fas fa-upload"></i><span>Restore Data</span><small>Upload a backup file</small></button><button id="storage-reset" class="btn-storage danger"><i class="fas fa-trash-restore"></i><span>Reset All Data</span><small>This cannot be undone</small></button></div>
            <div class="storage-info"><i class="fas fa-info-circle"></i> Data is stored locally in this browser. Regular backups are recommended.</div>
        </div>
    `, () => {
        document.getElementById('storage-backup')?.addEventListener('click', backupData);
        document.getElementById('storage-restore')?.addEventListener('click', () => {
            const input = document.createElement('input'); input.type = 'file'; input.accept = '.json'; input.onchange = event => restoreData(event.target.files[0]); input.click();
        });
        document.getElementById('storage-reset')?.addEventListener('click', resetAllDataConfirmed);
    });
}

// Make functions globally available for onclick handlers
window.quickBackupNow = quickBackupNow;
window.showQuickBackup = showQuickBackup;

// Run the origin-quota monitor only when deployed over HTTP(S).
if (location.protocol !== 'file:') {
    checkStorageAndWarn();
    setInterval(checkStorageAndWarn, 60 * 60 * 1000);
}

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

// =========================================================================
// =================== LOCAL STORAGE MANAGEMENT ==========================
// =========================================================================
function saveToLocalStorage(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
        console.error(`Error saving '${key}' to localStorage:`, error);
        notifications.show(`Error saving data locally for '${key}'.`, 'error');
    }
}

const IDB_DB_NAME = 'taboche-pos-db';
const IDB_STORE_NAME = 'largeState';
const IDB_VERSION = 1;
const BACKUP_SCHEMA_VERSION = 2;

// Settings
let soundEnabled = localStorage.getItem('soundEnabled') !== 'false';
let speechEnabled = localStorage.getItem('speechEnabled') !== 'false';
let restaurantName = localStorage.getItem('restaurantName') || 'Taboche Restaurant';
let restaurantAddress = localStorage.getItem('restaurantAddress') || 'Bhaktapur, Nepal';
let restaurantPan = localStorage.getItem('restaurantPan') || '600XXXXXX';
let receiptThankYou = localStorage.getItem('receiptThankYou') || 'Thank you for your visit!';
let receiptSocialHandle = localStorage.getItem('receiptSocialHandle') || 'Find us on social media @Taboche';
let staffName = localStorage.getItem('staffName') || 'Local Staff';
let vatPercent = Math.min(100, Math.max(0, Number(localStorage.getItem('vatPercent')) || 0));
let serviceChargePercent = Math.min(100, Math.max(0, Number(localStorage.getItem('serviceChargePercent')) || 0));
let largeCheckoutAmount = Math.min(100000, Math.max(0, Number(localStorage.getItem('largeCheckoutAmount')) || 5000));
let largeCheckoutItemCount = Math.min(1000, Math.max(0, Number(localStorage.getItem('largeCheckoutItemCount')) || 12));

function handleCriticalError(context, error) {
    console.error(`${context} failed:`, error);
    try {
        notifications.show(`${context} failed. Check console for details.`, 'error');
    } catch {
        // Notifications may not be initialized while startup code is running.
    }
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
            { key: 'auditLog', value: auditLog }
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
        const readStore = key => new Promise(resolve => {
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result ? request.result.value : null);
            request.onerror = () => resolve(null);
        });
        const [loadedSales, loadedOrderHistory, loadedVoids, loadedKots, loadedAudit] = await Promise.all([
            readStore('salesHistory'),
            readStore('orderHistory'),
            readStore('voidDetails'),
            readStore('kotHistory'),
            readStore('auditLog')
        ]);

        if (Array.isArray(loadedSales)) salesHistory = loadedSales;
        orderHistory = Array.isArray(loadedOrderHistory)
            ? loadedOrderHistory
            : createOrderHistorySnapshot(salesHistory);
        if (Array.isArray(loadedVoids)) voidDetails = loadedVoids;
        if (Array.isArray(loadedKots)) kotHistory = loadedKots;
        if (Array.isArray(loadedAudit)) auditLog = loadedAudit;
        db.close();
    } catch (error) {
        console.warn('IndexedDB load failed, staying on localStorage.', error);
    }
}

async function clearLargeStateFromIndexedDB() {
    try {
        const db = await openIndexedDB();
        const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
        tx.objectStore(IDB_STORE_NAME).clear();
        await new Promise((resolve, reject) => {
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error);
        });
        db.close();
    } catch (error) {
        console.warn('IndexedDB reset skipped:', error);
    }
}

function validateBackupData(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
    if (data.schemaVersion !== BACKUP_SCHEMA_VERSION && data.schemaVersion !== 1) {
        console.warn('Backup schema version mismatch:', data.schemaVersion);
        return false;
    }

    const requiredFields = ['orders', 'salesHistory', 'voidDetails', 'kotHistory'];
    const hasRequiredFields = requiredFields.every(field => Object.prototype.hasOwnProperty.call(data, field));
    if (!hasRequiredFields) return false;

    if (typeof data.orders !== 'object' || data.orders === null || Array.isArray(data.orders)) return false;
    if (!Array.isArray(data.salesHistory)) return false;
    if (!Array.isArray(data.voidDetails)) return false;
    if (!Array.isArray(data.kotHistory)) return false;

    const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
    if (data.tableTimers !== undefined && !isPlainObject(data.tableTimers)) return false;
    if (!isPlainObject(data.orders)) return false;

    for (const [table, items] of Object.entries(data.orders)) {
        if (typeof table !== 'string') return false;
        if (!Array.isArray(items)) return false;
        for (const item of items) {
            if (!isPlainObject(item)) return false;
            if (typeof item.name !== 'string') return false;
            if (typeof item.price !== 'number' || Number.isNaN(item.price)) return false;
            if (typeof item.quantity !== 'number' || Number.isNaN(item.quantity) || item.quantity < 1) return false;
        }
    }

    return true;
}

function loadFromLocalStorage() {
    try {
        const normalized = migrateStoredData({
            orders: getFromLocalStorage('orders') || {},
            tableTimers: getFromLocalStorage('tableTimers') || {},
            salesHistory: getFromLocalStorage('salesHistory') ?? salesHistory,
            voidDetails: getFromLocalStorage('voidDetails') ?? voidDetails,
            kotHistory: getFromLocalStorage('kotHistory') ?? kotHistory,
            auditLog: getFromLocalStorage('auditLog') ?? auditLog
        });

        orders = normalized.orders || {};
        tableTimers = normalized.tableTimers || {};
        salesHistory = normalized.salesHistory || [];
        orderHistory = createOrderHistorySnapshot(salesHistory);
        voidDetails = normalized.voidDetails || [];
        kotHistory = normalized.kotHistory || [];
        auditLog = normalized.auditLog || [];
    } catch (error) {
        handleCriticalError('Loading state from localStorage', error);
        orders = {};
        tableTimers = {};
        salesHistory = [];
        orderHistory = [];
        voidDetails = [];
        kotHistory = [];
        auditLog = [];
    }
}

// Automatically save all main state variables
function persistAllData() {
    try {
        trimHistoryIfNeeded();
        const normalized = compressDataState({ orders, tableTimers, salesHistory, orderHistory, voidDetails, kotHistory, auditLog });

        saveToLocalStorage('orders', normalized.orders);
        saveToLocalStorage('tableTimers', normalized.tableTimers);
        saveToLocalStorage('auditLog', normalized.auditLog);
        ['salesHistory', 'orderHistory', 'voidDetails', 'kotHistory'].forEach(key => localStorage.removeItem(key));

        orders = normalized.orders;
        tableTimers = normalized.tableTimers;
        salesHistory = normalized.salesHistory;
        orderHistory = normalized.orderHistory || createOrderHistorySnapshot(salesHistory);
        voidDetails = normalized.voidDetails;
        kotHistory = normalized.kotHistory;
        auditLog = normalized.auditLog;
        saveLargeStateToIndexedDB();

        posSyncChannel?.postMessage('data-changed');
    } catch (error) {
        handleCriticalError('Persisting all data', error);
    }
}

function debouncedPersistAllData() {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => persistAllData(), 300);
}

function estimateLocalStorageBytes() {
    let total = 0;
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        const value = localStorage.getItem(key) || '';
        total += (key.length + value.length) * 2;
    }
    return total;
}

function trimHistoryIfNeeded() {
    const orderRetentionDate = Date.now() - ORDER_HISTORY_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const voidRetentionDate = Date.now() - VOID_DETAILS_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const salesRetentionDate = Date.now() - SALES_HISTORY_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const kotRetentionDate = Date.now() - KOT_HISTORY_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const auditRetentionDate = Date.now() - 180 * 24 * 60 * 60 * 1000;

    orderHistory = orderHistory.filter(order => {
        const created = order?.timestamp ? new Date(order.timestamp).getTime() : Date.now();
        return created >= orderRetentionDate;
    });
    salesHistory = salesHistory.filter(sale => {
        const created = sale?.timestamp ? new Date(sale.timestamp).getTime() : Date.now();
        return created >= salesRetentionDate;
    });
    voidDetails = voidDetails.filter(voidEntry => {
        const created = voidEntry?.timestamp ? new Date(voidEntry.timestamp).getTime() : Date.now();
        return created >= voidRetentionDate;
    });
    kotHistory = kotHistory.filter(kot => {
        const created = kot?.timestamp ? new Date(kot.timestamp).getTime() : Date.now();
        return created >= kotRetentionDate;
    });
    auditLog = auditLog.filter(entry => {
        const created = entry?.timestamp ? new Date(entry.timestamp).getTime() : Date.now();
        return created >= auditRetentionDate;
    }).slice(-5000);

    if (orderHistory.length > MAX_HISTORY_ITEMS) {
        orderHistory = orderHistory.slice(-MAX_HISTORY_ITEMS);
    }
    if (salesHistory.length > MAX_HISTORY_ITEMS) {
        salesHistory = salesHistory.slice(-MAX_HISTORY_ITEMS);
    }
    if (voidDetails.length > MAX_VOID_DETAILS_ENTRIES) {
        voidDetails = voidDetails.slice(-MAX_VOID_DETAILS_ENTRIES);
    }
    if (kotHistory.length > MAX_KOT_HISTORY_ENTRIES) {
        kotHistory = kotHistory.slice(-MAX_KOT_HISTORY_ENTRIES);
    }
    const storageBytes = estimateLocalStorageBytes();
    if (storageBytes > STORAGE_AUTO_CLEAN_LIMIT_BYTES) {
        const keepCount = Math.max(150, Math.floor(MAX_VOID_DETAILS_ENTRIES * 0.6));
        voidDetails = voidDetails.slice(-keepCount);
        orderHistory = orderHistory.slice(-Math.min(300, MAX_HISTORY_ITEMS));
        salesHistory = salesHistory.slice(-Math.min(300, MAX_HISTORY_ITEMS));
        kotHistory = kotHistory.slice(-180);
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
            timestamp: new Date().toISOString(),
            orders, tableTimers, salesHistory, orderHistory, voidDetails, kotHistory,
            menuItems, extras, discountCodes,
            settings: getSettingsSnapshot(),
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
        notifications.show('Full data backup downloaded successfully', 'success');
    } catch (error) {
        handleCriticalError('Backing up data', error);
    }
}

function restoreData(file) {
    if (!file || !file.name.toLowerCase().endsWith('.json')) {
        notifications.show('Please select a valid backup JSON file.', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);

            if (!validateBackupData(data)) {
                notifications.show('Invalid backup file: incompatible schema or malformed data.', 'error');
                return;
            }

            const normalized = compressDataState({
                orders: data.orders || {},
                tableTimers: data.tableTimers || {},
                salesHistory: data.salesHistory || [],
                orderHistory: data.orderHistory || data.salesHistory || [],
                voidDetails: data.voidDetails || [],
                kotHistory: data.kotHistory || [],
            });

            orders = normalized.orders || {};
            tableTimers = normalized.tableTimers || {};
            salesHistory = normalized.salesHistory || [];
            orderHistory = normalized.orderHistory || createOrderHistorySnapshot(salesHistory);
            voidDetails = normalized.voidDetails || [];
            kotHistory = normalized.kotHistory || [];
            if (Array.isArray(data.menuItems)) menuItems = data.menuItems;
            if (Array.isArray(data.extras)) extras = data.extras;
            if (data.discountCodes && typeof data.discountCodes === 'object') discountCodes = data.discountCodes;
            if (data.settings && typeof data.settings === 'object') {
                const settings = data.settings;
                const settingKeys = ['soundEnabled', 'speechEnabled', 'restaurantName', 'restaurantAddress', 'restaurantPan', 'receiptThankYou', 'receiptSocialHandle', 'staffName', 'vatPercent', 'serviceChargePercent', 'largeCheckoutAmount', 'largeCheckoutItemCount', 'theme'];
                settingKeys.forEach(key => {
                    if (Object.prototype.hasOwnProperty.call(settings, key)) localStorage.setItem(key, String(settings[key]));
                });
                soundEnabled = settings.soundEnabled !== false;
                speechEnabled = settings.speechEnabled !== false;
                restaurantName = settings.restaurantName || restaurantName;
                restaurantAddress = settings.restaurantAddress || restaurantAddress;
                restaurantPan = settings.restaurantPan || restaurantPan;
                receiptThankYou = settings.receiptThankYou || receiptThankYou;
                receiptSocialHandle = settings.receiptSocialHandle || '';
                staffName = settings.staffName || staffName;
                vatPercent = validateNumericInput(settings.vatPercent, 0, 100);
                serviceChargePercent = validateNumericInput(settings.serviceChargePercent, 0, 100);
                largeCheckoutAmount = validateNumericInput(settings.largeCheckoutAmount, 0, 100000);
                largeCheckoutItemCount = validateNumericInput(settings.largeCheckoutItemCount, 0, 1000);
                currentUser.email = staffName;
            }
            
            trimHistoryIfNeeded();
            persistAllData();
            renderOrderItems();
            initializeTables();
            notifications.show('Data restored successfully', 'success');
        } catch (error) {
            handleCriticalError('Restoring backup data', error);
        }
    };
    reader.onerror = () => {
        notifications.show('The backup file could not be read.', 'error');
    };
    reader.readAsText(file);
}

