// Sends completed sales to Supabase when cloud settings are configured.
(function () {
    'use strict';

    const CDN_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
    const QUEUE_STORAGE_KEY = 'cloudSyncQueue';
    const DEAD_LETTER_STORAGE_KEY = 'cloudSyncDeadLetter';
    const MAX_ATTEMPTS = 5;
    const RETRY_BACKOFF_MS = 5000;
    const FLUSH_INTERVAL_MS = 15000;
    let client = null;
    let isReady = false;
    let queue = loadQueue();
    let deadLetter = loadDeadLetter();
    let activeConfigKey = '';
    let flushIntervalId = null;
    let lastError = '';

    function loadQueue() {
        try {
            const stored = JSON.parse(localStorage.getItem(QUEUE_STORAGE_KEY) || '[]');
            return Array.isArray(stored) ? stored.map(entry => entry.payload ? entry : ({
                payload: entry,
                attempts: 0,
                lastAttemptAt: 0
            })) : [];
        } catch (error) {
            console.warn('[CloudSync] queue load failed:', error);
            return [];
        }
    }

    function persistQueue() {
        try {
            localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
            window.dispatchEvent(new CustomEvent('cloud-sync-queue-changed', {
                detail: { queued: queue.length }
            }));
        } catch (error) {
            console.warn('[CloudSync] queue persistence failed:', error);
        }
    }

    function loadDeadLetter() {
        try {
            const stored = JSON.parse(localStorage.getItem(DEAD_LETTER_STORAGE_KEY) || '[]');
            return Array.isArray(stored) ? stored : [];
        } catch (error) {
            console.warn('[CloudSync] dead-letter load failed:', error);
            return [];
        }
    }

    function persistDeadLetter() {
        try {
            localStorage.setItem(DEAD_LETTER_STORAGE_KEY, JSON.stringify(deadLetter));
        } catch (error) {
            console.warn('[CloudSync] dead-letter persistence failed:', error);
        }
    }

    function moveToDeadLetter(entry, error) {
        if (deadLetter.some(item =>
            item.payload?.store_id === entry.payload?.store_id &&
            item.payload?.order_number === entry.payload?.order_number
        )) return;
        deadLetter.push({
            ...entry,
            failedAt: new Date().toISOString(),
            lastError: String(error?.message || error || 'Cloud sync failed')
        });
        persistDeadLetter();
    }

    function requeueDeadLetter() {
        if (deadLetter.length === 0) return;
        deadLetter.forEach(entry => enqueue(entry.payload));
        deadLetter = [];
        persistDeadLetter();
    }

    function enqueue(payload) {
        const duplicate = queue.some(item =>
            item.payload?.store_id === payload.store_id && item.payload?.order_number === payload.order_number
        );
        if (duplicate) return;
        queue.push({ payload, attempts: 0, lastAttemptAt: 0 });
        persistQueue();
    }

    function removeQueuedSale(payload) {
        const remaining = queue.filter(item => !(
            item.payload?.store_id === payload.store_id &&
            item.payload?.order_number === payload.order_number
        ));
        if (remaining.length !== queue.length) {
            queue = remaining;
            persistQueue();
        }
    }

    function log(...args) {
        if (location.hostname === 'localhost' || localStorage.getItem('pos-debug') === '1') {
            console.log('[CloudSync]', ...args);
        }
    }

    function getConfig() {
        return {
            url: (localStorage.getItem('supabase-url') || '').trim(),
            key: (localStorage.getItem('supabase-key') || '').trim(),
            storeId: (localStorage.getItem('store-id') || '').trim()
        };
    }

    function loadSupabaseLib() {
        return new Promise((resolve, reject) => {
            if (window.supabase?.createClient) {
                resolve();
                return;
            }
            const script = document.createElement('script');
            script.src = CDN_URL;
            script.async = true;
            script.onload = resolve;
            script.onerror = () => reject(new Error('Failed to load Supabase library'));
            document.head.appendChild(script);
        });
    }

    async function init() {
        const config = getConfig();
        if (!config.url || !config.key || !config.storeId) {
            log('Not configured. Skipping init.');
            return false;
        }
        const configKey = `${config.url}|${config.key}|${config.storeId}`;
        if (isReady && configKey === activeConfigKey) {
            requeueDeadLetter();
            await flushQueue(true);
            return true;
        }
        if (isReady && configKey !== activeConfigKey) {
            isReady = false;
            client = null;
            if (flushIntervalId) clearInterval(flushIntervalId);
            flushIntervalId = null;
        }
        try {
            await loadSupabaseLib();
            client = window.supabase.createClient(config.url, config.key, {
                auth: { persistSession: false }
            });
            const { error: accessError } = await client
                .from('sales')
                .select('order_number')
                .limit(1);
            if (accessError) throw accessError;
            isReady = true;
            lastError = '';
            activeConfigKey = configKey;
            if (!flushIntervalId) flushIntervalId = setInterval(flushQueue, FLUSH_INTERVAL_MS);
            log('Ready for store:', config.storeId);
            await flushQueue();
            return true;
        } catch (error) {
            lastError = String(error?.message || error || 'Cloud connection failed');
            console.warn('[CloudSync] init failed:', error);
            isReady = false;
            return false;
        }
    }

    async function insertSale(sale) {
        const config = getConfig();
        if (!config.storeId) return false;

        const payload = {
            order_number: String(sale.orderNumber || sale.order_number || ''),
            store_id: config.storeId,
            items: Array.isArray(sale.items) ? sale.items : [],
            total: Number(sale.total) || 0,
            created_at: sale.timestamp || sale.created_at || new Date().toISOString(),
            payment_method: Array.isArray(sale.paymentMethods)
                ? sale.paymentMethods.map(payment => payment.method).join('+') || 'Cash'
                : (sale.payment_method || 'Cash'),
            staff_name: sale.user || sale.staff_name || 'Local Staff'
        };

        if (!isReady && !(await init())) {
            enqueue(payload);
            log('Queued:', payload.order_number);
            return false;
        }

        try {
            await writeSale(payload);
            removeQueuedSale(payload);
            log('Synced:', payload.order_number);
            return true;
        } catch (error) {
            lastError = String(error?.message || error || 'Sale sync failed');
            console.warn('[CloudSync] insert failed, queued:', error);
            enqueue(payload);
            return false;
        }
    }

    async function writeSale(payload) {
        const { error } = await client
            .from('sales')
            .upsert(payload, { onConflict: 'store_id,order_number' });
        if (!error) return;
        if (error.code !== '42P10') throw error;

        const { data: existing, error: lookupError } = await client
            .from('sales')
            .select('id')
            .eq('store_id', payload.store_id)
            .eq('order_number', payload.order_number)
            .maybeSingle();
        if (lookupError) throw lookupError;

        if (existing?.id != null) {
            const { error: updateError } = await client
                .from('sales')
                .update(payload)
                .eq('id', existing.id);
            if (updateError) throw updateError;
            return;
        }

        const { error: insertError } = await client
            .from('sales')
            .insert(payload);
        if (insertError) throw insertError;
    }

    async function syncHistoricalSales(sales = globalThis.salesHistory) {
        if (!Array.isArray(sales) || sales.length === 0) return;
        for (const sale of sales) {
            await insertSale(sale);
        }
    }

    async function flushQueue(resetAttempts = false) {
        if (!isReady || queue.length === 0) return;
        const now = Date.now();
        const anyReady = resetAttempts || queue.some(entry =>
            entry.attempts < MAX_ATTEMPTS &&
            now - (Number(entry.lastAttemptAt) || 0) >= RETRY_BACKOFF_MS * (2 ** entry.attempts)
        );
        if (!anyReady) return;
        const pending = [...queue];
        const failed = [];
        for (const entry of pending) {
            const current = resetAttempts && entry.attempts >= MAX_ATTEMPTS
                ? { ...entry, attempts: 0, lastAttemptAt: 0 }
                : entry;
            if (current.attempts >= MAX_ATTEMPTS) {
                moveToDeadLetter(current, 'Maximum retry attempts reached');
                continue;
            }

            const elapsed = Date.now() - (Number(current.lastAttemptAt) || 0);
            const backoff = RETRY_BACKOFF_MS * (2 ** current.attempts);
            if (elapsed < backoff) {
                failed.push(current);
                continue;
            }

            const attempt = {
                ...current,
                attempts: current.attempts + 1,
                lastAttemptAt: Date.now()
            };
            try {
                await writeSale(attempt.payload);
            } catch (error) {
                lastError = String(error?.message || error || 'Sale sync failed');
                console.warn('[CloudSync] flush failed, requeueing:', error);
                window.dispatchEvent(new CustomEvent('cloud-sync-error', {
                    detail: { message: lastError, orderNumber: attempt.payload.order_number }
                }));
                if (attempt.attempts >= MAX_ATTEMPTS) {
                    moveToDeadLetter(attempt, error);
                    window.dispatchEvent(new CustomEvent('cloud-sync-failing', {
                        detail: { orderNumber: attempt.payload.order_number, deadLetter: true }
                    }));
                } else {
                    failed.push(attempt);
                }
            }
        }
        queue = failed;
        persistQueue();
    }

    function disconnect() {
        lastError = '';
        isReady = false;
        client = null;
        activeConfigKey = '';
        if (flushIntervalId) clearInterval(flushIntervalId);
        flushIntervalId = null;
        localStorage.removeItem('store-id');
        localStorage.removeItem('supabase-url');
        localStorage.removeItem('supabase-key');
    }

    window.CloudSync = {
        init,
        disconnect,
        insertSale,
        syncHistoricalSales,
        flush: flushQueue,
        isReady: () => isReady,
        getStatus: () => {
            const config = getConfig();
            return {
                ready: isReady,
                queued: queue.length,
                deadLetter: deadLetter.length,
                lastError,
                storeId: config.storeId,
                configured: Boolean(config.url && config.key && config.storeId)
            };
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
    window.addEventListener('online', () => flushQueue(true));
})();
