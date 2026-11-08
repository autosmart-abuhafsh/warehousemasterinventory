import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateItemCurrentStock,
  getStockStatus,
  getThreeTierStockStatus,
  getCriticalItemStatus,
  validateStockOutQuantity,
  calculateRecommendedRefill,
  classifyItemMovement,
  calculateStockReadiness,
  calculateTotalStockValue,
  calculateMovementRatio,
} from './inventoryLogic';
import { MasterItem } from '../types/wms';

test('calculateItemCurrentStock computes Stok Awal + Stock In - Stock Out +- Adjustment accurately', () => {
  const current = calculateItemCurrentStock(
    20,
    [
      { quantity: 15, status: 'APPROVED' },
      { quantity: 10, status: 'CANCELLED' },
    ],
    [{ quantity: 8, status: 'APPROVED' }],
    [{ difference: -2 }]
  );
  // 20 + 15 - 8 - 2 = 25
  assert.equal(current, 25);
});

test('getStockStatus and getThreeTierStockStatus follow PRD 18.2 rules including null maxStock', () => {
  assert.equal(getStockStatus(0, 5, 20), 'OUT_OF_STOCK');
  assert.equal(getStockStatus(5, 5, 20), 'LOW');
  assert.equal(getStockStatus(12, 5, 20), 'SAFE');
  assert.equal(getStockStatus(25, 5, 20), 'OVER');
  // When maxStock is null, it must never invent OVER status
  assert.equal(getStockStatus(500, 5, null), 'SAFE');
  assert.equal(getThreeTierStockStatus(0, 5, 20), 'LOW');
  assert.equal(getThreeTierStockStatus(5, 5, 20), 'LOW');
  assert.equal(getThreeTierStockStatus(10, 5, 20), 'SAFE');
  assert.equal(getThreeTierStockStatus(25, 5, 20), 'OVER');
});

test('getCriticalItemStatus classifies AMAN, KURANG, and HABIS accurately', () => {
  assert.equal(getCriticalItemStatus(0, 5), 'HABIS');
  assert.equal(getCriticalItemStatus(3, 5), 'KURANG');
  assert.equal(getCriticalItemStatus(5, 5), 'KURANG');
  assert.equal(getCriticalItemStatus(6, 5), 'AMAN');
});

test('validateStockOutQuantity rejects negative, zero, or exceeding available stock', () => {
  const overResult = validateStockOutQuantity(5, 7);
  assert.equal(overResult.valid, false);
  assert.ok(overResult.error?.includes('Stok tidak mencukupi'));

  const zeroResult = validateStockOutQuantity(5, 0);
  assert.equal(zeroResult.valid, false);

  const okResult = validateStockOutQuantity(5, 5);
  assert.equal(okResult.valid, true);
});

test('calculateRecommendedRefill computes Target Stock - Current Stock or flags missing target', () => {
  const normal = calculateRecommendedRefill(4, 20);
  assert.equal(normal.recommendedQty, 16);
  assert.equal(normal.needsManualTarget, false);

  const noTarget = calculateRecommendedRefill(4, null);
  assert.equal(noTarget.recommendedQty, null);
  assert.equal(noTarget.needsManualTarget, true);
});

test('classifyItemMovement categorizes Fast, Medium, Slow, and Non Moving based on last Stock Out', () => {
  const settings = { fastMovingDays: 30, mediumMovingDays: 60, slowMovingDays: 90 };
  const refDate = '2026-11-08';

  const fast = classifyItemMovement(
    'item-1',
    [{ itemId: 'item-1', date: '2026-10-25', status: 'APPROVED' }],
    refDate,
    settings
  );
  assert.equal(fast.category, 'FAST');

  const medium = classifyItemMovement(
    'item-2',
    [{ itemId: 'item-2', date: '2026-09-20', status: 'APPROVED' }],
    refDate,
    settings
  );
  assert.equal(medium.category, 'MEDIUM');

  const slow = classifyItemMovement(
    'item-3',
    [{ itemId: 'item-3', date: '2026-08-20', status: 'APPROVED' }],
    refDate,
    settings
  );
  assert.equal(slow.category, 'SLOW');

  const nonMoving = classifyItemMovement('item-4', [], refDate, settings);
  assert.equal(nonMoving.category, 'NON_MOVING');
});

test('calculateStockReadiness and calculateTotalStockValue compute exact KPIs', () => {
  const mockItems: MasterItem[] = [
    {
      id: '1',
      partNumber: 'PN-001',
      name: 'Item 1',
      categoryId: 'cat-1',
      categoryName: 'Hydraulics',
      description: '',
      specification: '',
      unit: 'PCS',
      unitPrice: 100000,
      initialStock: 10,
      currentStock: 10,
      minStock: 5,
      maxStock: 20,
      targetStock: 15,
      locationId: 'loc-1',
      locationCode: 'A-01',
      supplierId: 'sup-1',
      supplierName: 'Supplier A',
      isCritical: true,
      status: 'ACTIVE',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
    {
      id: '2',
      partNumber: 'PN-002',
      name: 'Item 2',
      categoryId: 'cat-1',
      categoryName: 'Hydraulics',
      description: '',
      specification: '',
      unit: 'PCS',
      unitPrice: 250000,
      initialStock: 2,
      currentStock: 2,
      minStock: 5,
      maxStock: 20,
      targetStock: 15,
      locationId: 'loc-1',
      locationCode: 'A-02',
      supplierId: 'sup-1',
      supplierName: 'Supplier A',
      isCritical: true,
      status: 'ACTIVE',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
  ];

  const readiness = calculateStockReadiness(mockItems);
  assert.equal(readiness.totalActiveCount, 2);
  assert.equal(readiness.sufficientCount, 1);
  assert.equal(readiness.insufficientCount, 1);
  assert.equal(readiness.readinessPercentage, 50);

  const totalValue = calculateTotalStockValue(mockItems);
  // (10 * 100,000) + (2 * 250,000) = 1,500,000
  assert.equal(totalValue, 1500000);
});

test('calculateMovementRatio avoids division by zero when Stock In is 0', () => {
  const zeroIn = calculateMovementRatio(0, 25);
  assert.equal(zeroIn.ratio, null);
  assert.equal(zeroIn.formatted, '-');

  const validRatio = calculateMovementRatio(100, 75);
  assert.equal(validRatio.ratio, 75);
  assert.equal(validRatio.formatted, '75%');
});
