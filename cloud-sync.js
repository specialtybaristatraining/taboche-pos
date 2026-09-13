// Sends completed sales to Supabase when cloud settings are configured.
(function () {
    'use strict';

    const CDN_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
    let client = null;
    let isReady = false;
    const queue = [];

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
        if (isReady) return true;
        const config = getConfig();
        if (!config.url || !config.key || !config.storeId) {
            log('Not configured. Skipping init.');
            return false;
        }
        try {
            await loadSupabaseLib();
            client = window.supabase.createClient(config.url, config.key, {
                auth: { persistSession: false }
            });
            isReady = true;
            log('Ready for store:', config.storeId);
            await flushQueue();
            return true;
        } catch (error) {
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
            payment_method: Array.isArray(sale.paymentMethods)
                ? sale.paymentMethods.map(payment => payment.method).join('+') || 'Cash'
                : (sale.payment_method || 'Cash'),
            staff_name: sale.user || sale.staff_name || 'Local Staff'
        };

        if (!isReady && !(await init())) {
            queue.push(payload);
            log('Queued:', payload.order_number);
            return false;
        }

        try {
            const { error } = await client.from('sales').insert(payload);
            if (error) throw error;
            log('Synced:', payload.order_number);
            return true;
        } catch (error) {
            console.warn('[CloudSync] insert failed, queued:', error);
            queue.push(payload);
            return false;
        }
    }

    async function flushQueue() {
        if (!isReady || queue.length === 0) return;
        const pending = queue.splice(0);
        for (const payload of pending) {
            try {
                const { error } = await client.from('sales').insert(payload);
                if (error) throw error;
            } catch (error) {
                console.warn('[CloudSync] flush failed, requeueing:', error);
                queue.push(payload);
            }
        }
    }

    window.CloudSync = {
        init,
        insertSale,
        flush: flushQueue,
        isReady: () => isReady,
        getStatus: () => {
            const config = getConfig();
            return {
                ready: isReady,
                queued: queue.length,
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
    setInterval(flushQueue, 60000);
    window.addEventListener('online', flushQueue);
})();
