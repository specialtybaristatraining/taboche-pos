import { describe, it, expect } from 'vitest';
import { migrateStoredData, compressDataState, saveCheckoutState, restoreCheckoutState, clearCheckoutState } from './state-utils.js';

describe('state-utils', () => {
  it('migrates old data into normalized arrays and objects', () => {
    const migrated = migrateStoredData({
      orders: { T1: [{ name: 'Tea', quantity: 0, price: '10', extras: null }] },
      salesHistory: null,
      orderHistory: undefined,
      voidDetails: undefined,
      kotHistory: undefined,
      itemsSold: undefined,
      schemaVersion: 1
    });

    expect(migrated.orders.T1[0].quantity).toBe(1);
    expect(migrated.orders.T1[0].price).toBe(10);
    expect(Array.isArray(migrated.salesHistory)).toBe(true);
    expect(migrated.schemaVersion).toBe(2);
  });

  it('compresses duplicate items sold entries', () => {
    const compressed = compressDataState({
      itemsSold: [
        { name: 'Tea', quantity: 2, totalRevenue: 40 },
        { name: 'tea', quantity: 3, totalRevenue: 60 }
      ]
    });

    expect(compressed.itemsSold).toHaveLength(1);
    expect(compressed.itemsSold[0].quantity).toBe(5);
  });

  it('stores and restores checkout state in sessionStorage', () => {
    const storage = { values: {}, setItem(k, v) { this.values[k] = v; }, getItem(k) { return this.values[k] ?? null; }, removeItem(k) { delete this.values[k]; } };

    saveCheckoutState({ paymentAmount: 500 }, storage);
    expect(restoreCheckoutState(storage)).toEqual({ paymentAmount: 500 });
    clearCheckoutState(storage);
    expect(restoreCheckoutState(storage)).toBeNull();
  });
});
