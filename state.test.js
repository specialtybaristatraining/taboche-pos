import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { describe, it, expect } from 'vitest';

function loadProductionState(includeStorage = false) {
  const storage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {}
  };
  const context = {
    localStorage: storage,
    console,
    location: { protocol: 'file:' },
    navigator: {},
    document: { getElementById: () => null, querySelector: () => null },
    setInterval: () => 0,
    clearInterval: () => {}
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(
    readFileSync(resolve('js/state.js'), 'utf8'),
    context,
    { filename: 'js/state.js' }
  );
  if (includeStorage) {
    vm.runInContext(
      readFileSync(resolve('js/storage.js'), 'utf8'),
      context,
      { filename: 'js/storage.js' }
    );
  }
  return context;
}

describe('production state', () => {
  it('migrates old data into normalized arrays and objects', () => {
    const { migrateStoredData } = loadProductionState();
    const migrated = migrateStoredData({
      orders: { T1: [{ name: 'Tea', quantity: 0, price: '10', extras: null }] },
      salesHistory: null,
      orderHistory: undefined,
      voidDetails: undefined,
      kotHistory: undefined,
      auditLog: null,
      schemaVersion: 1
    });

    expect(migrated.orders.T1[0].quantity).toBe(1);
    expect(migrated.orders.T1[0].price).toBe(10);
    expect(Array.isArray(migrated.salesHistory)).toBe(true);
    expect(Array.isArray(migrated.auditLog)).toBe(true);
    expect(migrated.orders.T1[0].sentQuantity).toBe(0);
    expect(migrated.schemaVersion).toBe(3);
  });

  it('compresses production history and retains audit records', () => {
    const { compressDataState } = loadProductionState();
    const compressed = compressDataState({
      auditLog: [{ action: 'payment.completed' }, null],
      salesHistory: [{ orderNumber: 'A-1' }, null]
    });

    expect(compressed.auditLog).toEqual([{ action: 'payment.completed' }]);
    expect(compressed.salesHistory).toEqual([{ orderNumber: 'A-1' }]);
  });

  it('identifies active and inactive sales by status', () => {
    const { isActiveSale } = loadProductionState();

    expect(isActiveSale({ status: 'completed' })).toBe(true);
    expect(isActiveSale({ status: 'voided' })).toBe(false);
    expect(isActiveSale({ status: 'refunded' })).toBe(false);
    expect(isActiveSale({})).toBe(true);
    expect(isActiveSale(null)).toBe(null);
  });

  it('creates an independent order-history snapshot', () => {
    const { createOrderHistorySnapshot } = loadProductionState();
    const sale = { orderNumber: 'A-1', items: [{ name: 'Tea', extras: [{ name: 'Milk' }] }] };
    const snapshot = createOrderHistorySnapshot([sale]);

    snapshot[0].items[0].extras[0].name = 'Sugar';
    expect(sale.items[0].extras[0].name).toBe('Milk');
  });

  it('stores and restores checkout state in sessionStorage', () => {
    const { saveCheckoutState, restoreCheckoutState, clearCheckoutState } = loadProductionState(true);
    const storage = { values: {}, setItem(k, v) { this.values[k] = v; }, getItem(k) { return this.values[k] ?? null; }, removeItem(k) { delete this.values[k]; } };

    saveCheckoutState({ paymentAmount: 500 }, storage);
    expect(restoreCheckoutState(storage)).toEqual({ paymentAmount: 500 });
    clearCheckoutState(storage);
    expect(restoreCheckoutState(storage)).toBeNull();
  });
});
