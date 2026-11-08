import {
  MasterItem,
  StockInTransaction,
  StockOutTransaction,
  StockAdjustment,
  StockStatus,
  CriticalStatus,
  MovementCategory,
  SystemSettings,
  PeriodFilterType,
} from '../types/wms';

/**
 * 18.1 Perhitungan Stok
 * Stok Saat Ini = Stok Awal + Stock In - Stock Out ± Penyesuaian
 */
export function calculateItemCurrentStock(
  initialStock: number,
  stockInList: Pick<StockInTransaction, 'quantity' | 'status'>[],
  stockOutList: Pick<StockOutTransaction, 'quantity' | 'status'>[],
  adjustments: Pick<StockAdjustment, 'difference'>[]
): number {
  const totalIn = stockInList
    .filter((t) => t.status === 'APPROVED')
    .reduce((sum, t) => sum + t.quantity, 0);
  const totalOut = stockOutList
    .filter((t) => t.status === 'APPROVED')
    .reduce((sum, t) => sum + t.quantity, 0);
  const totalAdj = adjustments.reduce((sum, a) => sum + a.difference, 0);

  return Math.max(0, initialStock + totalIn - totalOut + totalAdj);
}

/**
 * 18.2 Status Ketersediaan
 * - Out of Stock: Stok sama dengan nol.
 * - Low: Stok sama dengan atau lebih rendah dari Minimum Stock.
 * - Safe: Stok di atas Minimum Stock dan tidak melebihi Maximum Stock apabila batas maksimum ditetapkan.
 * - Over: Stok melebihi Maximum Stock (hanya jika Maximum Stock ditentukan).
 */
export function getStockStatus(
  currentStock: number,
  minStock: number,
  maxStock: number | null
): StockStatus {
  if (currentStock <= 0) {
    return 'OUT_OF_STOCK';
  }
  if (currentStock <= minStock) {
    return 'LOW';
  }
  if (maxStock !== null && maxStock > 0 && currentStock > maxStock) {
    return 'OVER';
  }
  return 'SAFE';
}

/**
 * Untuk KPI 5 (Stock Status Distribution) yang membagi menjadi 3 kelompok utama:
 * 1. Low Stock / Tidak Cukup (termasuk Out of Stock, yaitu currentStock <= minStock)
 * 2. Safe Stock / Cukup
 * 3. Over Stock / Berlebih
 */
export function getThreeTierStockStatus(
  currentStock: number,
  minStock: number,
  maxStock: number | null
): 'LOW' | 'SAFE' | 'OVER' {
  if (currentStock <= minStock) {
    return 'LOW';
  }
  if (maxStock !== null && maxStock > 0 && currentStock > maxStock) {
    return 'OVER';
  }
  return 'SAFE';
}

/**
 * 18.3 Critical Stock Status
 * - HABIS: stok sama dengan nol.
 * - KURANG: stok berada pada atau di bawah batas minimum tetapi masih tersedia (> 0).
 * - AMAN: stok berada di atas batas minimum.
 */
export function getCriticalItemStatus(
  currentStock: number,
  minStock: number
): CriticalStatus {
  if (currentStock <= 0) {
    return 'HABIS';
  }
  if (currentStock <= minStock) {
    return 'KURANG';
  }
  return 'AMAN';
}

/**
 * 8.3 Validasi Stock Out
 * Sistem tidak boleh mengizinkan pengeluaran barang melebihi stok tersedia.
 */
export function validateStockOutQuantity(
  availableStock: number,
  requestedQuantity: number
): { valid: boolean; error?: string } {
  if (!Number.isFinite(requestedQuantity) || requestedQuantity <= 0) {
    return {
      valid: false,
      error: 'Jumlah pengeluaran harus lebih dari 0.',
    };
  }
  if (requestedQuantity > availableStock) {
    return {
      valid: false,
      error: `Stok tidak mencukupi! Stok tersedia: ${availableStock} unit, Permintaan keluar: ${requestedQuantity} unit.`,
    };
  }
  return { valid: true };
}

/**
 * 5.2 Reorder Management
 * Recommended Refill Quantity = Target Stock - Current Stock
 * Apabila Target Stock belum ditentukan, tandai sebagai perlu ditentukan oleh petugas (null).
 */
export function calculateRecommendedRefill(
  currentStock: number,
  targetStock: number | null
): { recommendedQty: number | null; needsManualTarget: boolean } {
  if (targetStock === null || targetStock <= 0) {
    return { recommendedQty: null, needsManualTarget: true };
  }
  const diff = Math.max(0, targetStock - currentStock);
  return { recommendedQty: diff, needsManualTarget: false };
}

/**
 * 18.4 Klasifikasi Pergerakan Barang (Fast, Medium, Slow, Non Moving)
 * Berdasarkan tanggal transaksi Stock Out terakhir yang disahkan terhadap referenceDate:
 * - Fast Moving: 0 - fastMovingDays (default 30 hari)
 * - Medium Moving: (fastMovingDays + 1) - mediumMovingDays (default 31 - 60 hari)
 * - Slow Moving: (mediumMovingDays + 1) - slowMovingDays (default 61 - 90 hari)
 * - Non Moving: > slowMovingDays atau belum pernah mengalami Stock Out
 */
export function classifyItemMovement(
  itemId: string,
  stockOutTransactions: Pick<StockOutTransaction, 'itemId' | 'date' | 'status'>[],
  referenceDateStr: string,
  settings: Pick<SystemSettings, 'fastMovingDays' | 'mediumMovingDays' | 'slowMovingDays'>
): { category: MovementCategory; lastOutDate: string | null; daysSinceLastOut: number | null } {
  const validOuts = stockOutTransactions.filter(
    (t) => t.itemId === itemId && t.status === 'APPROVED' && t.date <= referenceDateStr
  );

  if (validOuts.length === 0) {
    return { category: 'NON_MOVING', lastOutDate: null, daysSinceLastOut: null };
  }

  let latestDateStr = validOuts[0].date;
  for (const t of validOuts) {
    if (t.date > latestDateStr) {
      latestDateStr = t.date;
    }
  }

  const refTime = new Date(`${referenceDateStr}T00:00:00Z`).getTime();
  const lastTime = new Date(`${latestDateStr}T00:00:00Z`).getTime();
  const diffDays = Math.max(0, Math.floor((refTime - lastTime) / (1000 * 60 * 60 * 24)));

  if (diffDays <= settings.fastMovingDays) {
    return { category: 'FAST', lastOutDate: latestDateStr, daysSinceLastOut: diffDays };
  }
  if (diffDays <= settings.mediumMovingDays) {
    return { category: 'MEDIUM', lastOutDate: latestDateStr, daysSinceLastOut: diffDays };
  }
  if (diffDays <= settings.slowMovingDays) {
    return { category: 'SLOW', lastOutDate: latestDateStr, daysSinceLastOut: diffDays };
  }
  return { category: 'NON_MOVING', lastOutDate: latestDateStr, daysSinceLastOut: diffDays };
}

/**
 * KPI 1 - Stock Readiness (%)
 * Rumus: (Jumlah Item dengan stok di atas minimum / Total Master Item Aktif) * 100%
 */
export function calculateStockReadiness(items: MasterItem[]): {
  readinessPercentage: number;
  sufficientCount: number;
  insufficientCount: number;
  totalActiveCount: number;
} {
  const activeItems = items.filter((item) => item.status === 'ACTIVE');
  const totalActiveCount = activeItems.length;
  if (totalActiveCount === 0) {
    return {
      readinessPercentage: 0,
      sufficientCount: 0,
      insufficientCount: 0,
      totalActiveCount: 0,
    };
  }

  const sufficientCount = activeItems.filter(
    (item) => item.currentStock > item.minStock
  ).length;
  const insufficientCount = totalActiveCount - sufficientCount;
  const readinessPercentage = Number(
    ((sufficientCount / totalActiveCount) * 100).toFixed(1)
  );

  return {
    readinessPercentage,
    sufficientCount,
    insufficientCount,
    totalActiveCount,
  };
}

/**
 * KPI 2 - Total Value Stock
 * Rumus: Σ (Stok Tersedia × Harga Satuan)
 */
export function calculateTotalStockValue(items: MasterItem[]): number {
  return items
    .filter((item) => item.status === 'ACTIVE')
    .reduce((sum, item) => sum + item.currentStock * item.unitPrice, 0);
}

/**
 * 4.2 D - Inventory Movement Ratio (%)
 * Rumus: (Total Kuantitas Stock Out / Total Kuantitas Stock In) * 100%
 * Jika tidak ada transaksi Stock In dalam periode tersebut, tampilkan tanda "-" dan hindari pembagian dengan nol.
 */
export function calculateMovementRatio(
  totalStockInQty: number,
  totalStockOutQty: number
): { ratio: number | null; formatted: string } {
  if (totalStockInQty <= 0) {
    return { ratio: null, formatted: '-' };
  }
  const ratio = Number(((totalStockOutQty / totalStockInQty) * 100).toFixed(1));
  return { ratio, formatted: `${ratio}%` };
}

/**
 * Filter rentang tanggal berdasarkan PeriodFilterType terhadap referenceDate (YYYY-MM-DD)
 */
export function getDateRangeForPeriod(
  period: PeriodFilterType,
  referenceDateStr: string,
  customStart?: string,
  customEnd?: string
): { startDate: string; endDate: string; label: string } {
  const refDate = new Date(`${referenceDateStr}T00:00:00Z`);

  const formatYMD = (d: Date) => d.toISOString().slice(0, 10);

  switch (period) {
    case 'TODAY':
      return {
        startDate: referenceDateStr,
        endDate: referenceDateStr,
        label: 'Hari Ini',
      };
    case 'LAST_7_DAYS': {
      const start = new Date(refDate);
      start.setUTCDate(start.getUTCDate() - 6);
      return {
        startDate: formatYMD(start),
        endDate: referenceDateStr,
        label: '7 Hari Terakhir',
      };
    }
    case 'LAST_30_DAYS': {
      const start = new Date(refDate);
      start.setUTCDate(start.getUTCDate() - 29);
      return {
        startDate: formatYMD(start),
        endDate: referenceDateStr,
        label: '30 Hari Terakhir',
      };
    }
    case 'THIS_MONTH': {
      const start = new Date(Date.UTC(refDate.getUTCFullYear(), refDate.getUTCMonth(), 1));
      return {
        startDate: formatYMD(start),
        endDate: referenceDateStr,
        label: 'Bulan Ini',
      };
    }
    case 'LAST_MONTH': {
      const start = new Date(Date.UTC(refDate.getUTCFullYear(), refDate.getUTCMonth() - 1, 1));
      const end = new Date(Date.UTC(refDate.getUTCFullYear(), refDate.getUTCMonth(), 0));
      return {
        startDate: formatYMD(start),
        endDate: formatYMD(end),
        label: 'Bulan Sebelumnya',
      };
    }
    case 'THIS_YEAR': {
      const start = new Date(Date.UTC(refDate.getUTCFullYear(), 0, 1));
      return {
        startDate: formatYMD(start),
        endDate: referenceDateStr,
        label: 'Tahun Ini',
      };
    }
    case 'CUSTOM': {
      return {
        startDate: customStart || '2026-01-01',
        endDate: customEnd || referenceDateStr,
        label: `${customStart || '2026-01-01'} s/d ${customEnd || referenceDateStr}`,
      };
    }
    case 'ALL_TIME':
    default:
      return {
        startDate: '2020-01-01',
        endDate: referenceDateStr,
        label: 'Semua Periode',
      };
  }
}

export function formatRupiah(amount: number): string {
  const rounded = Math.round(amount);
  return 'Rp' + rounded.toLocaleString('id-ID');
}

export function formatNumber(num: number): string {
  return num.toLocaleString('id-ID');
}
