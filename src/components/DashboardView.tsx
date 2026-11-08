import React, { useState, useMemo } from 'react';
import {
  FileSpreadsheet,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  CheckCircle2,
  Package,
  Layers,
  Activity,
  DollarSign,
  Eye,
  X,
  RefreshCw,
  Calendar,
  ShieldAlert,
} from 'lucide-react';
import { useWms } from '../context/WmsContext';
import {
  calculateStockReadiness,
  calculateTotalStockValue,
  classifyItemMovement,
  getThreeTierStockStatus,
  getCriticalItemStatus,
  calculateMovementRatio,
  calculateRecommendedRefill,
  getDateRangeForPeriod,
  formatRupiah,
  formatNumber,
} from '../utils/inventoryLogic';
import { downloadExcelReport } from '../utils/exportUtils';
import { MovementCategory, PeriodFilterType } from '../types/wms';

export const DashboardView: React.FC = () => {
  const {
    items,
    stockInList,
    stockOutList,
    adjustments,
    settings,
    periodFilter,
    setPeriodFilter,
    customStartDate,
    setCustomStartDate,
    customEndDate,
    setCustomEndDate,
    setActiveMenu,
    switchDataMode,
  } = useWms();

  const [chartGranularity, setChartGranularity] = useState<'DAY' | 'WEEK' | 'MONTH' | 'YEAR'>('DAY');
  const [selectedMovementTab, setSelectedMovementTab] = useState<MovementCategory | 'ALL'>('ALL');
  const [selectedStatusTab, setSelectedStatusTab] = useState<'ALL' | 'LOW' | 'SAFE' | 'OVER'>('ALL');
  const [drilldownModal, setDrilldownModal] = useState<'READINESS' | 'VALUE' | null>(null);

  const activeItems = useMemo(
    () => items.filter((item) => item.status === 'ACTIVE'),
    [items]
  );

  // Date range for selected period
  const dateRange = useMemo(
    () =>
      getDateRangeForPeriod(
        periodFilter,
        settings.referenceDate,
        customStartDate,
        customEndDate
      ),
    [periodFilter, settings.referenceDate, customStartDate, customEndDate]
  );

  // Filtered transactions within period
  const periodStockIn = useMemo(
    () =>
      stockInList.filter(
        (t) =>
          t.status === 'APPROVED' &&
          t.date >= dateRange.startDate &&
          t.date <= dateRange.endDate
      ),
    [stockInList, dateRange]
  );

  const periodStockOut = useMemo(
    () =>
      stockOutList.filter(
        (t) =>
          t.status === 'APPROVED' &&
          t.date >= dateRange.startDate &&
          t.date <= dateRange.endDate
      ),
    [stockOutList, dateRange]
  );

  // KPI 1: Stock Readiness
  const readiness = useMemo(
    () => calculateStockReadiness(activeItems),
    [activeItems]
  );

  // KPI 2: Total Value Stock & Value by Category
  const totalValueStock = useMemo(
    () => calculateTotalStockValue(activeItems),
    [activeItems]
  );

  const valueByCategory = useMemo(() => {
    const map = new Map<string, { name: string; count: number; totalStock: number; value: number }>();
    activeItems.forEach((item) => {
      const existing = map.get(item.categoryName) || {
        name: item.categoryName,
        count: 0,
        totalStock: 0,
        value: 0,
      };
      existing.count += 1;
      existing.totalStock += item.currentStock;
      existing.value += item.currentStock * item.unitPrice;
      map.set(item.categoryName, existing);
    });
    return Array.from(map.values()).sort((a, b) => b.value - a.value);
  }, [activeItems]);

  // KPI 3: Stock Movement Ranking
  const itemsWithMovement = useMemo(() => {
    return activeItems.map((item) => {
      const mv = classifyItemMovement(
        item.id,
        stockOutList,
        dateRange.endDate,
        settings
      );
      const threeTier = getThreeTierStockStatus(
        item.currentStock,
        item.minStock,
        item.maxStock
      );
      return {
        ...item,
        movementCategory: mv.category,
        lastOutDate: mv.lastOutDate,
        daysSinceLastOut: mv.daysSinceLastOut,
        threeTierStatus: threeTier,
      };
    });
  }, [activeItems, stockOutList, dateRange.endDate, settings]);

  const movementStats = useMemo(() => {
    const total = itemsWithMovement.length || 1;
    const fast = itemsWithMovement.filter((i) => i.movementCategory === 'FAST').length;
    const medium = itemsWithMovement.filter((i) => i.movementCategory === 'MEDIUM').length;
    const slow = itemsWithMovement.filter((i) => i.movementCategory === 'SLOW').length;
    const nonMoving = itemsWithMovement.filter((i) => i.movementCategory === 'NON_MOVING').length;
    return [
      {
        key: 'FAST' as MovementCategory,
        label: 'Fast Moving',
        rangeLabel: `1–${settings.fastMovingDays} Hari`,
        count: fast,
        pct: Number(((fast / total) * 100).toFixed(1)),
        color: '#10B981',
      },
      {
        key: 'MEDIUM' as MovementCategory,
        label: 'Medium Moving',
        rangeLabel: `${settings.fastMovingDays + 1}–${settings.mediumMovingDays} Hari`,
        count: medium,
        pct: Number(((medium / total) * 100).toFixed(1)),
        color: '#3B82F6',
      },
      {
        key: 'SLOW' as MovementCategory,
        label: 'Slow Moving',
        rangeLabel: `${settings.mediumMovingDays + 1}–${settings.slowMovingDays} Hari`,
        count: slow,
        pct: Number(((slow / total) * 100).toFixed(1)),
        color: '#F59E0B',
      },
      {
        key: 'NON_MOVING' as MovementCategory,
        label: 'Non Moving',
        rangeLabel: `> ${settings.slowMovingDays} Hari / Belum Keluar`,
        count: nonMoving,
        pct: Number(((nonMoving / total) * 100).toFixed(1)),
        color: '#8B5CF6',
      },
    ];
  }, [itemsWithMovement, settings]);

  // KPI 4: Total Stock In & Stock Out in selected period
  const stockInOutSummary = useMemo(() => {
    const totalInQty = periodStockIn.reduce((s, t) => s + t.quantity, 0);
    const totalOutQty = periodStockOut.reduce((s, t) => s + t.quantity, 0);
    const uniqueInItems = new Set(periodStockIn.map((t) => t.itemId)).size;
    const uniqueOutItems = new Set(periodStockOut.map((t) => t.itemId)).size;
    return {
      totalInQty,
      inTrxCount: periodStockIn.length,
      uniqueInItems,
      totalOutQty,
      outTrxCount: periodStockOut.length,
      uniqueOutItems,
    };
  }, [periodStockIn, periodStockOut]);

  // Chart buckets for Stock In vs Stock Out
  const inOutChartData = useMemo(() => {
    const map = new Map<string, { label: string; stockIn: number; stockOut: number }>();

    const getBucketKey = (dateStr: string) => {
      if (chartGranularity === 'YEAR') return dateStr.slice(0, 4);
      if (chartGranularity === 'MONTH') return dateStr.slice(0, 7);
      if (chartGranularity === 'WEEK') {
        const d = new Date(`${dateStr}T00:00:00Z`);
        const firstDay = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        const weekNo = Math.ceil(
          ((d.getTime() - firstDay.getTime()) / 86400000 + firstDay.getUTCDay() + 1) / 7
        );
        return `${dateStr.slice(0, 4)}-W${String(weekNo).padStart(2, '0')}`;
      }
      return dateStr.slice(5); // MM-DD
    };

    periodStockIn.forEach((t) => {
      const k = getBucketKey(t.date);
      const cur = map.get(k) || { label: k, stockIn: 0, stockOut: 0 };
      cur.stockIn += t.quantity;
      map.set(k, cur);
    });

    periodStockOut.forEach((t) => {
      const k = getBucketKey(t.date);
      const cur = map.get(k) || { label: k, stockIn: 0, stockOut: 0 };
      cur.stockOut += t.quantity;
      map.set(k, cur);
    });

    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, val]) => val);
  }, [periodStockIn, periodStockOut, chartGranularity]);

  // KPI 5: Stock Status Distribution (Low, Safe, Over)
  const statusDistribution = useMemo(() => {
    const total = itemsWithMovement.length || 1;
    const low = itemsWithMovement.filter((i) => i.threeTierStatus === 'LOW').length;
    const safe = itemsWithMovement.filter((i) => i.threeTierStatus === 'SAFE').length;
    const over = itemsWithMovement.filter((i) => i.threeTierStatus === 'OVER').length;
    return {
      lowCount: low,
      lowPct: Number(((low / total) * 100).toFixed(1)),
      safeCount: safe,
      safePct: Number(((safe / total) * 100).toFixed(1)),
      overCount: over,
      overPct: Number(((over / total) * 100).toFixed(1)),
    };
  }, [itemsWithMovement]);

  // 4.2 Advanced Analytics (A - F)
  const totalPhysicalStock = useMemo(
    () => activeItems.reduce((sum, i) => sum + i.currentStock, 0),
    [activeItems]
  );

  const totalInitialStock = useMemo(
    () => activeItems.reduce((sum, i) => sum + i.initialStock, 0),
    [activeItems]
  );

  const totalAdjustmentDiff = useMemo(
    () => adjustments.reduce((sum, a) => sum + a.difference, 0),
    [adjustments]
  );

  const movementRatio = useMemo(
    () =>
      calculateMovementRatio(
        stockInOutSummary.totalInQty,
        stockInOutSummary.totalOutQty
      ),
    [stockInOutSummary]
  );

  const criticalItems = useMemo(() => {
    return activeItems
      .filter((i) => i.isCritical)
      .map((item) => {
        const critStatus = getCriticalItemStatus(item.currentStock, item.minStock);
        const refill = calculateRecommendedRefill(item.currentStock, item.targetStock);
        return {
          ...item,
          critStatus,
          recommendedRefill: refill.recommendedQty,
        };
      })
      .sort((a, b) => a.currentStock - b.currentStock);
  }, [activeItems]);

  const criticalEmptyOrLowCount = useMemo(
    () => criticalItems.filter((i) => i.critStatus !== 'AMAN').length,
    [criticalItems]
  );

  // Download Excel Stock Replenishment Request (KPI 1 Function)
  const handleDownloadReplenishmentExcel = () => {
    const insufficientItems = activeItems.filter(
      (i) => i.currentStock <= i.minStock
    );
    const rowsToExport =
      insufficientItems.length > 0 ? insufficientItems : activeItems;

    downloadExcelReport(
      `Stock_Replenishment_Request_Jatirejo_${settings.referenceDate}.xls`,
      'LAPORAN PERMINTAAN PENGISIAN KEMBALI STOK GUDANG (STOCK REPLENISHMENT REQUEST)',
      `Stock Readiness: ${readiness.readinessPercentage}% | Item Cukup: ${readiness.sufficientCount} | Item Tidak Cukup: ${readiness.insufficientCount}`,
      [
        { header: 'No', accessor: (_, idx) => idx + 1 },
        { header: 'Part Number', accessor: (r) => r.partNumber },
        { header: 'Nama Barang', accessor: (r) => r.name },
        { header: 'Kategori', accessor: (r) => r.categoryName },
        { header: 'Lokasi Rak', accessor: (r) => r.locationCode },
        { header: 'Critical Item', accessor: (r) => (r.isCritical ? 'YA (KRITIKAL)' : 'TIDAK') },
        { header: 'Stok Saat Ini', accessor: (r) => r.currentStock },
        { header: 'Minimum Stock', accessor: (r) => r.minStock },
        { header: 'Target Stock', accessor: (r) => r.targetStock ?? 'Perlu Ditentukan' },
        {
          header: 'Rekomendasi Refill',
          accessor: (r) => {
            const ref = calculateRecommendedRefill(r.currentStock, r.targetStock);
            return ref.recommendedQty !== null ? ref.recommendedQty : 'Perlu Ditentukan';
          },
        },
        { header: 'Satuan', accessor: (r) => r.unit },
        { header: 'Harga Satuan (Rp)', accessor: (r) => r.unitPrice },
        {
          header: 'Estimasi Biaya Refill (Rp)',
          accessor: (r) => {
            const ref = calculateRecommendedRefill(r.currentStock, r.targetStock);
            return ref.recommendedQty !== null ? ref.recommendedQty * r.unitPrice : 0;
          },
        },
        { header: 'Supplier Utama', accessor: (r) => r.supplierName },
      ],
      rowsToExport
    );
  };

  return (
    <div className="space-y-6">
      {/* Simulation / Operational Mode Notice & Period Filter Toolbar */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 p-4 rounded-xl bg-[#151F32] border border-[#25334A]">
        <div className="flex flex-wrap items-center gap-3">
          {settings.dataMode === 'DEMO' ? (
            <div className="flex items-center gap-2 text-xs text-[#F59E0B]">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                <strong className="font-bold">MODE DATA SIMULASI (DEMO):</strong> Menampilkan
                simulasi persediaan sparepart alat berat & armada logistik Warehouse Jatirejo.
              </span>
              <button
                type="button"
                onClick={() => switchDataMode('OPERATIONAL', false)}
                className="underline font-semibold text-white hover:text-[#3B82F6] ml-1 cursor-pointer"
              >
                Beralih ke Data Operasional Kosong
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-[#10B981]">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>
                <strong className="font-bold">MODE DATA OPERASIONAL AKTUAL:</strong> Terpisah
                dari data simulasi.
              </span>
              <button
                type="button"
                onClick={() => switchDataMode('DEMO')}
                className="underline font-semibold text-white hover:text-[#3B82F6] ml-1 cursor-pointer"
              >
                Kembali ke Data Simulasi (Demo)
              </button>
            </div>
          )}
        </div>

        {/* Period Filter (PRD 18.5) */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-[#94A3B8]">
            <Calendar className="w-3.5 h-3.5 text-[#3B82F6]" />
            <span>Periode Analisis:</span>
          </div>
          <select
            aria-label="Filter Periode Analisis Dashboard"
            value={periodFilter}
            onChange={(e) => setPeriodFilter(e.target.value as PeriodFilterType)}
            className="px-3 py-1.5 rounded-lg bg-[#0B1220] border border-[#25334A] text-xs font-medium text-white focus:outline-none focus:border-[#3B82F6]"
          >
            <option value="ALL_TIME">Semua Periode (s/d {settings.referenceDate})</option>
            <option value="TODAY">Hari Ini ({settings.referenceDate})</option>
            <option value="LAST_7_DAYS">7 Hari Terakhir</option>
            <option value="LAST_30_DAYS">30 Hari Terakhir</option>
            <option value="THIS_MONTH">Bulan Ini (November 2026)</option>
            <option value="LAST_MONTH">Bulan Sebelumnya (Oktober 2026)</option>
            <option value="THIS_YEAR">Tahun Ini (2026)</option>
            <option value="CUSTOM">Rentang Tanggal Khusus</option>
          </select>

          {periodFilter === 'CUSTOM' && (
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                aria-label="Tanggal Mulai"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-2.5 py-1 rounded bg-[#0B1220] border border-[#25334A] text-xs font-mono text-white"
              />
              <span className="text-xs text-[#94A3B8]">s/d</span>
              <input
                type="date"
                aria-label="Tanggal Akhir"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-2.5 py-1 rounded bg-[#0B1220] border border-[#25334A] text-xs font-mono text-white"
              />
            </div>
          )}
        </div>
      </div>

      {/* Executive Decision Answer Banner (PRD Section 24 Target Akhir) */}
      <div className="p-5 rounded-xl bg-[#151F32] border border-[#25334A] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="text-xs font-mono text-[#94A3B8]">
            STATUS KESIAPAN OPERASIONAL GUDANG • WAREHOUSE JATIREJO
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-white">
            {readiness.insufficientCount > 0 ? (
              <>
                Perhatian: Terdapat{' '}
                <span className="text-[#F43F5E] font-mono">
                  {readiness.insufficientCount} jenis barang
                </span>{' '}
                di bawah batas minimum ({criticalEmptyOrLowCount} barang kritikal) yang
                perlu segera dilakukan pengadaan ulang.
              </>
            ) : (
              <>
                Kondisi Persediaan Optimal: Seluruh{' '}
                <span className="text-[#10B981] font-mono">
                  {readiness.totalActiveCount} jenis barang
                </span>{' '}
                aktif berada di atas batas minimum dan siap mendukung operasional.
              </>
            )}
          </h2>
          <p className="text-xs text-[#94A3B8]">
            Tingkat kesiapan persediaan saat ini mencapai{' '}
            <strong className="text-white font-mono">{readiness.readinessPercentage}%</strong>{' '}
            ({readiness.sufficientCount} item cukup dari {readiness.totalActiveCount} Master Item aktif)
            dengan total nilai inventaris{' '}
            <strong className="text-[#10B981] font-mono">
              {formatRupiah(totalValueStock)}
            </strong>.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setActiveMenu('reorder')}
            className="px-4 py-2.5 rounded-lg bg-[#F43F5E] hover:bg-[#E11D48] text-white text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
          >
            Buka Reorder Management ({readiness.insufficientCount})
          </button>
          <button
            type="button"
            onClick={handleDownloadReplenishmentExcel}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#10B981]/15 border border-[#10B981]/40 text-[#10B981] hover:bg-[#10B981]/25 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Download Excel Refill Request
          </button>
        </div>
      </div>

      {/* 4.1 LIMA KARTU KPI UTAMA */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3.5">
        {/* KPI 1: Stock Readiness / Inventory Availability */}
        <div className="p-4 rounded-xl bg-[#151F32] border border-[#25334A] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-[#94A3B8] mb-2">
              <span className="font-semibold text-white whitespace-nowrap">KPI 1 · Stock Readiness</span>
              <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-extrabold font-mono tabular-nums text-[#10B981]">
                {readiness.readinessPercentage}%
              </span>
              <span className="text-[11px] text-[#94A3B8] whitespace-nowrap">Availability</span>
            </div>
            <div className="w-full h-2 rounded-full bg-[#0B1220] overflow-hidden my-2.5">
              <div
                className="h-full bg-[#10B981]"
                style={{ width: `${Math.min(100, readiness.readinessPercentage)}%` }}
              />
            </div>
            <div className="space-y-1 text-[11px] font-mono">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[#94A3B8] whitespace-nowrap">Item Cukup (&gt; Min):</span>
                <span className="text-[#10B981] font-semibold whitespace-nowrap">{readiness.sufficientCount}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[#94A3B8] whitespace-nowrap">Tidak Cukup (≤ Min):</span>
                <span className="text-[#F43F5E] font-semibold whitespace-nowrap">{readiness.insufficientCount}</span>
              </div>
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#25334A]">
                <span className="text-[#94A3B8] whitespace-nowrap">Master Item Aktif:</span>
                <span className="text-white font-bold whitespace-nowrap">{readiness.totalActiveCount}</span>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-[#25334A] flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setDrilldownModal('READINESS')}
              className="text-xs font-semibold text-[#3B82F6] hover:underline inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
            >
              <Eye className="w-3.5 h-3.5" /> Rincian
            </button>
            <button
              type="button"
              onClick={handleDownloadReplenishmentExcel}
              className="text-xs font-semibold text-[#10B981] hover:underline inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
            </button>
          </div>
        </div>

        {/* KPI 2: Total Value Stock */}
        <div className="p-4 rounded-xl bg-[#151F32] border border-[#25334A] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-[#94A3B8] mb-2">
              <span className="font-semibold text-white whitespace-nowrap">KPI 2 · Total Value Stock</span>
              <DollarSign className="w-4 h-4 text-[#3B82F6] shrink-0" />
            </div>
            <div className="text-xl font-extrabold font-mono tabular-nums text-white tracking-tight whitespace-nowrap">
              {formatRupiah(totalValueStock)}
            </div>
            <p className="text-[11px] text-[#94A3B8] mt-0.5 whitespace-nowrap">
              Σ (Stok Tersedia × Harga Satuan)
            </p>

            <div className="mt-2.5 space-y-1 text-xs">
              <div className="text-[10px] font-semibold text-[#94A3B8]">
                Top Kategori Nilai Stok:
              </div>
              {valueByCategory.slice(0, 3).map((cat) => (
                <div
                  key={cat.name}
                  className="flex items-center justify-between gap-2 font-mono text-[11px]"
                >
                  <span className="text-[#94A3B8] truncate">{cat.name}</span>
                  <span className="text-white font-medium whitespace-nowrap shrink-0">
                    {formatRupiah(cat.value)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-[#25334A] flex items-center justify-between">
            <span className="text-[11px] font-mono text-[#94A3B8] whitespace-nowrap">
              {valueByCategory.length} Kategori
            </span>
            <button
              type="button"
              onClick={() => setDrilldownModal('VALUE')}
              className="text-xs font-semibold text-[#3B82F6] hover:underline inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
            >
              <Eye className="w-3.5 h-3.5" /> Detail Nilai
            </button>
          </div>
        </div>

        {/* KPI 3: Stock Movement Ranking */}
        <div className="p-4 rounded-xl bg-[#151F32] border border-[#25334A] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-[#94A3B8] mb-2">
              <span className="font-semibold text-white whitespace-nowrap">KPI 3 · Stock Movement</span>
              <Activity className="w-4 h-4 text-[#8B5CF6] shrink-0" />
            </div>
            <div className="space-y-1.5 mt-1">
              {movementStats.map((m) => (
                <div key={m.key} className="text-[11px] font-mono">
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-[#94A3B8] font-sans truncate">{m.label}</span>
                    <span className="text-white font-semibold whitespace-nowrap shrink-0">
                      {m.count} ({m.pct}%)
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-[#0B1220] overflow-hidden mt-0.5">
                    <div
                      className="h-full"
                      style={{ width: `${m.pct}%`, backgroundColor: m.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-[#25334A] flex items-center justify-between text-[11px] text-[#94A3B8]">
            <span className="truncate">Tgl Out Terakhir</span>
            <button
              type="button"
              onClick={() => setActiveMenu('settings')}
              className="text-[#3B82F6] font-semibold hover:underline cursor-pointer whitespace-nowrap shrink-0"
            >
              Atur Hari
            </button>
          </div>
        </div>

        {/* KPI 4: Total Stock In & Stock Out */}
        <div className="p-4 rounded-xl bg-[#151F32] border border-[#25334A] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-[#94A3B8] mb-2">
              <span className="font-semibold text-white whitespace-nowrap">KPI 4 · Stock In & Out</span>
              <RefreshCw className="w-4 h-4 text-[#10B981] shrink-0" />
            </div>

            <div className="grid grid-cols-2 gap-2 mt-1">
              <div className="p-2 rounded-lg bg-[#0B1220] border border-[#25334A]">
                <div className="flex items-center gap-1 text-[11px] text-[#10B981] font-semibold whitespace-nowrap">
                  <ArrowDownRight className="w-3 h-3 shrink-0" /> Stock In
                </div>
                <div className="text-lg font-extrabold font-mono text-white mt-0.5 whitespace-nowrap">
                  +{formatNumber(stockInOutSummary.totalInQty)}
                </div>
                <div className="text-[10px] font-mono text-[#94A3B8] mt-0.5 whitespace-nowrap">
                  {stockInOutSummary.inTrxCount} Trx · {stockInOutSummary.uniqueInItems} SKU
                </div>
              </div>

              <div className="p-2 rounded-lg bg-[#0B1220] border border-[#25334A]">
                <div className="flex items-center gap-1 text-[11px] text-[#F59E0B] font-semibold whitespace-nowrap">
                  <ArrowUpRight className="w-3 h-3 shrink-0" /> Stock Out
                </div>
                <div className="text-lg font-extrabold font-mono text-white mt-0.5 whitespace-nowrap">
                  -{formatNumber(stockInOutSummary.totalOutQty)}
                </div>
                <div className="text-[10px] font-mono text-[#94A3B8] mt-0.5 whitespace-nowrap">
                  {stockInOutSummary.outTrxCount} Trx · {stockInOutSummary.uniqueOutItems} SKU
                </div>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-[#25334A] flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => setActiveMenu('stock_in')}
              className="text-[#10B981] font-semibold hover:underline cursor-pointer whitespace-nowrap"
            >
              + Stock In
            </button>
            <button
              type="button"
              onClick={() => setActiveMenu('stock_out')}
              className="text-[#F59E0B] font-semibold hover:underline cursor-pointer whitespace-nowrap"
            >
              - Stock Out
            </button>
          </div>
        </div>

        {/* KPI 5: Stock Status Distribution */}
        <div className="p-4 rounded-xl bg-[#151F32] border border-[#25334A] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-[#94A3B8] mb-2">
              <span className="font-semibold text-white whitespace-nowrap">KPI 5 · Status Stok</span>
              <Layers className="w-4 h-4 text-[#F59E0B] shrink-0" />
            </div>

            {/* Stacked Composition Bar */}
            <div className="w-full h-2.5 rounded-full bg-[#0B1220] overflow-hidden flex my-2">
              <div
                style={{ width: `${statusDistribution.lowPct}%` }}
                className="bg-[#F43F5E]"
                title={`Low Stock: ${statusDistribution.lowCount} (${statusDistribution.lowPct}%)`}
              />
              <div
                style={{ width: `${statusDistribution.safePct}%` }}
                className="bg-[#10B981]"
                title={`Safe Stock: ${statusDistribution.safeCount} (${statusDistribution.safePct}%)`}
              />
              <div
                style={{ width: `${statusDistribution.overPct}%` }}
                className="bg-[#F59E0B]"
                title={`Over Stock: ${statusDistribution.overCount} (${statusDistribution.overPct}%)`}
              />
            </div>

            <div className="space-y-1.5 text-[11px] font-mono mt-2.5">
              <div className="flex items-center justify-between gap-1.5">
                <span className="text-[#F43F5E] font-sans font-medium truncate">
                  1. Low / Kurang
                </span>
                <span className="text-white font-semibold whitespace-nowrap shrink-0">
                  {statusDistribution.lowCount} ({statusDistribution.lowPct}%)
                </span>
              </div>
              <div className="flex items-center justify-between gap-1.5">
                <span className="text-[#10B981] font-sans font-medium truncate">
                  2. Safe / Cukup
                </span>
                <span className="text-white font-semibold whitespace-nowrap shrink-0">
                  {statusDistribution.safeCount} ({statusDistribution.safePct}%)
                </span>
              </div>
              <div className="flex items-center justify-between gap-1.5">
                <span className="text-[#F59E0B] font-sans font-medium truncate">
                  3. Over / Lebih
                </span>
                <span className="text-white font-semibold whitespace-nowrap shrink-0">
                  {statusDistribution.overCount} ({statusDistribution.overPct}%)
                </span>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-[#25334A] flex items-center justify-between text-xs">
            <span className="text-[#94A3B8] text-[11px] whitespace-nowrap">Komposisi</span>
            <button
              type="button"
              onClick={() => setActiveMenu('master_item')}
              className="text-[#3B82F6] font-semibold hover:underline cursor-pointer whitespace-nowrap"
            >
              Master Item
            </button>
          </div>
        </div>
      </div>

      {/* 4.2 ANALISIS DASHBOARD LANJUTAN (A - E) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* A. Total Master Item */}
        <div className="p-4 rounded-xl bg-[#151F32] border border-[#25334A]">
          <div className="text-xs text-[#94A3B8]">A. Total Master Item</div>
          <div className="text-2xl font-bold font-mono text-white mt-1">
            {items.length} <span className="text-xs font-normal text-[#94A3B8]">SKU</span>
          </div>
          <div className="text-[11px] font-mono text-[#94A3B8] mt-1">
            Aktif: {activeItems.length} · Nonaktif: {items.length - activeItems.length}
          </div>
        </div>

        {/* B. Total Stok Fisik */}
        <div className="p-4 rounded-xl bg-[#151F32] border border-[#25334A]">
          <div className="text-xs text-[#94A3B8]">B. Total Stok Fisik Tersedia</div>
          <div className="text-2xl font-bold font-mono text-[#3B82F6] mt-1">
            {formatNumber(totalPhysicalStock)}{' '}
            <span className="text-xs font-normal text-[#94A3B8]">Unit/Set</span>
          </div>
          <div className="text-[11px] font-mono text-[#94A3B8] mt-1">
            Akumulasi seluruh barang aktif
          </div>
        </div>

        {/* C. Low Stock Alert */}
        <div className="p-4 rounded-xl bg-[#151F32] border border-[#25334A]">
          <div className="text-xs text-[#94A3B8]">C. Low Stock Alert</div>
          <div className="text-2xl font-bold font-mono text-[#F43F5E] mt-1">
            {statusDistribution.lowCount}{' '}
            <span className="text-xs font-normal text-[#94A3B8]">Jenis Barang</span>
          </div>
          <div className="text-[11px] font-mono text-[#F59E0B] mt-1">
            {criticalEmptyOrLowCount} di antaranya Critical Item
          </div>
        </div>

        {/* D. Inventory Movement Ratio */}
        <div className="p-4 rounded-xl bg-[#151F32] border border-[#25334A]">
          <div className="text-xs text-[#94A3B8]">D. Inventory Movement Ratio</div>
          <div className="text-2xl font-bold font-mono text-[#10B981] mt-1">
            {movementRatio.formatted}
          </div>
          <div className="text-[11px] font-mono text-[#94A3B8] mt-1">
            Out ({stockInOutSummary.totalOutQty}) ÷ In ({stockInOutSummary.totalInQty})
          </div>
        </div>

        {/* E. Residual Inventory / Net Stock Balance */}
        <div className="p-4 rounded-xl bg-[#151F32] border border-[#25334A]">
          <div className="text-xs text-[#94A3B8]">E. Residual Inventory Balance</div>
          <div className="text-lg font-bold font-mono text-white mt-1">
            {formatRupiah(totalValueStock)}
          </div>
          <div className="text-[11px] font-mono text-[#94A3B8] mt-1">
            Awal {totalInitialStock} + In {stockInOutSummary.totalInQty} - Out{' '}
            {stockInOutSummary.totalOutQty}{' '}
            {totalAdjustmentDiff >= 0 ? `+ Adj ${totalAdjustmentDiff}` : `- Adj ${Math.abs(totalAdjustmentDiff)}`} ={' '}
            <strong className="text-white">{totalPhysicalStock}</strong>
          </div>
        </div>
      </div>

      {/* CHARTS SECTION: Stock In vs Stock Out & Stock Movement Donut Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Stock In vs Stock Out Comparison Chart (7 Cols) */}
        <div className="lg:col-span-7 p-6 rounded-xl bg-[#151F32] border border-[#25334A] flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
              <div>
                <h3 className="text-base font-bold text-white">
                  Grafik Perbandingan Transaksi Stock In & Stock Out
                </h3>
                <p className="text-xs text-[#94A3B8]">
                  Kuantitas penerimaan vs pengeluaran barang gudang ({dateRange.label})
                </p>
              </div>
              <div className="flex items-center gap-1 p-1 rounded-lg bg-[#0B1220] border border-[#25334A] self-start sm:self-auto">
                {(
                  [
                    { id: 'DAY', label: 'Hari' },
                    { id: 'WEEK', label: 'Minggu' },
                    { id: 'MONTH', label: 'Bulan' },
                    { id: 'YEAR', label: 'Tahun' },
                  ] as const
                ).map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setChartGranularity(g.id)}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                      chartGranularity === g.id
                        ? 'bg-[#3B82F6] text-white'
                        : 'text-[#94A3B8] hover:text-white'
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>

            {inOutChartData.length === 0 ? (
              <div className="h-56 flex items-center justify-center text-xs text-[#94A3B8] border border-dashed border-[#25334A] rounded-lg">
                Tidak ada aktivitas Stock In / Stock Out pada rentang periode ini.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="h-56 flex items-end gap-1.5 pt-6 px-1 border-b border-[#25334A] overflow-x-auto">
                  {(() => {
                    const maxVal = Math.max(
                      10,
                      ...inOutChartData.map((d) => Math.max(d.stockIn, d.stockOut))
                    );
                    return inOutChartData.map((bucket) => {
                      const inHeight = Math.round((bucket.stockIn / maxVal) * 155);
                      const outHeight = Math.round((bucket.stockOut / maxVal) * 155);
                      return (
                        <div
                          key={bucket.label}
                          className="flex-1 min-w-[36px] flex flex-col items-center group"
                        >
                          <div className="w-full flex items-end justify-center gap-1 h-44">
                            <div className="flex flex-col items-center">
                              {bucket.stockIn > 0 && (
                                <span className="text-[9px] font-mono text-[#10B981] mb-1">
                                  +{bucket.stockIn}
                                </span>
                              )}
                              <div
                                style={{ height: `${Math.max(bucket.stockIn > 0 ? 6 : 0, inHeight)}px` }}
                                className="w-3 sm:w-3.5 rounded-t bg-[#10B981] transition-opacity group-hover:opacity-90"
                                title={`${bucket.label} Stock In: ${bucket.stockIn}`}
                              />
                            </div>
                            <div className="flex flex-col items-center">
                              {bucket.stockOut > 0 && (
                                <span className="text-[9px] font-mono text-[#F59E0B] mb-1">
                                  -{bucket.stockOut}
                                </span>
                              )}
                              <div
                                style={{ height: `${Math.max(bucket.stockOut > 0 ? 6 : 0, outHeight)}px` }}
                                className="w-3 sm:w-3.5 rounded-t bg-[#F59E0B] transition-opacity group-hover:opacity-90"
                                title={`${bucket.label} Stock Out: ${bucket.stockOut}`}
                              />
                            </div>
                          </div>
                          <div className="text-[10px] font-mono text-[#94A3B8] mt-2 whitespace-nowrap">
                            {bucket.label}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-[#94A3B8]">
                  <div className="flex items-center gap-5">
                    <span className="inline-flex items-center gap-2">
                      <span className="w-3 h-3 rounded-xs bg-[#10B981] inline-block" />
                      Stock In: <strong className="font-mono text-white">+{stockInOutSummary.totalInQty} unit</strong> ({stockInOutSummary.inTrxCount} transaksi)
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <span className="w-3 h-3 rounded-xs bg-[#F59E0B] inline-block" />
                      Stock Out: <strong className="font-mono text-white">-{stockInOutSummary.totalOutQty} unit</strong> ({stockInOutSummary.outTrxCount} transaksi)
                    </span>
                  </div>
                  <span className="font-mono">
                    Selisih Periode:{' '}
                    <strong className="text-white">
                      {stockInOutSummary.totalInQty - stockInOutSummary.totalOutQty >= 0 ? '+' : ''}
                      {stockInOutSummary.totalInQty - stockInOutSummary.totalOutQty} unit
                    </strong>
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Stock Movement Ranking Donut Chart & Breakdown (5 Cols) */}
        <div className="lg:col-span-5 p-6 rounded-xl bg-[#151F32] border border-[#25334A] flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-white">
              Distribusi Pergerakan Barang (Donut Chart)
            </h3>
            <p className="text-xs text-[#94A3B8]">
              Klasifikasi berdasarkan aktivitas pengeluaran (Stock Out) terakhir
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center mt-5">
              {/* Interactive SVG Donut Chart */}
              <div className="flex justify-center">
                <svg viewBox="0 0 160 160" className="w-40 h-40">
                  {(() => {
                    const radius = 58;
                    const circumference = 2 * Math.PI * radius;
                    let accumulatedPct = 0;
                    return movementStats.map((seg) => {
                      const strokeDasharray = `${(seg.pct / 100) * circumference} ${circumference}`;
                      const strokeDashoffset = -((accumulatedPct / 100) * circumference);
                      accumulatedPct += seg.pct;
                      return (
                        <circle
                          key={seg.key}
                          cx="80"
                          cy="80"
                          r={radius}
                          fill="transparent"
                          stroke={seg.color}
                          strokeWidth="22"
                          strokeDasharray={strokeDasharray}
                          strokeDashoffset={strokeDashoffset}
                          transform="rotate(-90 80 80)"
                        />
                      );
                    });
                  })()}
                  <text
                    x="80"
                    y="75"
                    textAnchor="middle"
                    className="fill-white font-mono text-xl font-bold"
                  >
                    {activeItems.length}
                  </text>
                  <text
                    x="80"
                    y="94"
                    textAnchor="middle"
                    className="fill-[#94A3B8] text-[10px]"
                  >
                    Item Aktif
                  </text>
                </svg>
              </div>

              {/* Legend & Clickable Filter */}
              <div className="space-y-2.5">
                {movementStats.map((seg) => (
                  <button
                    key={seg.key}
                    type="button"
                    onClick={() =>
                      setSelectedMovementTab(
                        selectedMovementTab === seg.key ? 'ALL' : seg.key
                      )
                    }
                    className={`w-full text-left p-2 rounded-lg border transition-colors cursor-pointer ${
                      selectedMovementTab === seg.key
                        ? 'bg-[#0B1220] border-[#3B82F6]'
                        : 'bg-[#0B1220]/50 border-[#25334A] hover:border-[#3B82F6]/50'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-white flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-xs inline-block"
                          style={{ backgroundColor: seg.color }}
                        />
                        {seg.label}
                      </span>
                      <span className="font-mono font-bold text-white">
                        {seg.count} ({seg.pct}%)
                      </span>
                    </div>
                    <div className="text-[10px] font-mono text-[#94A3B8] mt-0.5 pl-4">
                      {seg.rangeLabel}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4.2 F. CRITICAL INVENTORY MONITORING TABLE */}
      <div className="p-6 rounded-xl bg-[#151F32] border border-[#25334A]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-[#F43F5E]" />
              <h3 className="text-base font-bold text-white">
                F. Critical Inventory Monitoring (Pemantauan Barang Kritikal)
              </h3>
            </div>
            <p className="text-xs text-[#94A3B8] mt-0.5">
              Daftar suku cadang kritikal yang tidak boleh kosong beserta status ketersediaan
              (AMAN, KURANG, HABIS) dan rekomendasi pengisian
            </p>
          </div>
          <button
            type="button"
            onClick={() => setActiveMenu('reorder')}
            className="px-3.5 py-2 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] text-white text-xs font-semibold transition-colors cursor-pointer self-start sm:self-auto whitespace-nowrap"
          >
            Ajukan Pengadaan Ulang
          </button>
        </div>

        <div className="overflow-x-auto border border-[#25334A] rounded-lg">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#111C30] text-[#94A3B8] border-b border-[#25334A]">
                <th className="py-3 px-4 font-semibold">Part Number</th>
                <th className="py-3 px-4 font-semibold">Nama Barang Kritikal</th>
                <th className="py-3 px-4 font-semibold">Kategori</th>
                <th className="py-3 px-4 font-semibold">Lokasi</th>
                <th className="py-3 px-4 font-semibold text-right">Stok Saat Ini</th>
                <th className="py-3 px-4 font-semibold text-right">Min / Target</th>
                <th className="py-3 px-4 font-semibold text-right">Rekomendasi Refill</th>
                <th className="py-3 px-4 font-semibold">Status Kritikal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#25334A]">
              {criticalItems.map((item) => (
                <tr key={item.id} className="hover:bg-[#111C30]/70 transition-colors">
                  <td className="py-3 px-4 font-mono font-bold text-[#3B82F6]">
                    {item.partNumber}
                  </td>
                  <td className="py-3 px-4 font-medium text-white">{item.name}</td>
                  <td className="py-3 px-4 text-[#94A3B8]">{item.categoryName}</td>
                  <td className="py-3 px-4 font-mono text-[#94A3B8]">{item.locationCode}</td>
                  <td className="py-3 px-4 font-mono font-bold text-right text-white">
                    {item.currentStock} {item.unit}
                  </td>
                  <td className="py-3 px-4 font-mono text-right text-[#94A3B8]">
                    {item.minStock} / {item.targetStock ?? '-'} {item.unit}
                  </td>
                  <td className="py-3 px-4 font-mono font-semibold text-right text-[#F59E0B]">
                    {item.recommendedRefill !== null && item.recommendedRefill > 0
                      ? `+${item.recommendedRefill} ${item.unit}`
                      : '-'}
                  </td>
                  <td className="py-3 px-4 font-mono font-bold">
                    {item.critStatus === 'HABIS' && (
                      <span className="text-[#F43F5E]">HABIS (0 STOK)</span>
                    )}
                    {item.critStatus === 'KURANG' && (
                      <span className="text-[#F59E0B]">KURANG (≤ MIN)</span>
                    )}
                    {item.critStatus === 'AMAN' && (
                      <span className="text-[#10B981]">AMAN</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* TABEL RINCIAN PERGERAKAN & STATUS KETERSEDIAAN BARANG */}
      <div className="p-6 rounded-xl bg-[#151F32] border border-[#25334A]">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="text-base font-bold text-white">
              Tabel Rincian Pergerakan, Status Ketersediaan & Nilai Persediaan Barang
            </h3>
            <p className="text-xs text-[#94A3B8]">
              Filter interaktif berdasarkan klasifikasi pergerakan (KPI 3) dan status
              ketersediaan stok (KPI 5)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Movement Filter Buttons */}
            <div className="flex items-center gap-1 p-1 rounded-lg bg-[#0B1220] border border-[#25334A]">
              {(
                [
                  { id: 'ALL', label: 'Semua Pergerakan' },
                  { id: 'FAST', label: 'Fast' },
                  { id: 'MEDIUM', label: 'Medium' },
                  { id: 'SLOW', label: 'Slow' },
                  { id: 'NON_MOVING', label: 'Non-Moving' },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedMovementTab(t.id)}
                  className={`px-2.5 py-1 rounded text-xs font-medium cursor-pointer whitespace-nowrap ${
                    selectedMovementTab === t.id
                      ? 'bg-[#3B82F6] text-white'
                      : 'text-[#94A3B8] hover:text-white'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Status Filter Buttons */}
            <div className="flex items-center gap-1 p-1 rounded-lg bg-[#0B1220] border border-[#25334A]">
              {(
                [
                  { id: 'ALL', label: 'Semua Status' },
                  { id: 'LOW', label: 'Low Stock' },
                  { id: 'SAFE', label: 'Safe Stock' },
                  { id: 'OVER', label: 'Over Stock' },
                ] as const
              ).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelectedStatusTab(s.id)}
                  className={`px-2.5 py-1 rounded text-xs font-medium cursor-pointer whitespace-nowrap ${
                    selectedStatusTab === s.id
                      ? 'bg-[#3B82F6] text-white'
                      : 'text-[#94A3B8] hover:text-white'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto border border-[#25334A] rounded-lg">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#111C30] text-[#94A3B8] border-b border-[#25334A]">
                <th className="py-3 px-4 font-semibold">Part Number</th>
                <th className="py-3 px-4 font-semibold">Nama Barang</th>
                <th className="py-3 px-4 font-semibold">Kategori</th>
                <th className="py-3 px-4 font-semibold text-right">Stok Tersedia</th>
                <th className="py-3 px-4 font-semibold text-right">Min / Max</th>
                <th className="py-3 px-4 font-semibold">Status Stok</th>
                <th className="py-3 px-4 font-semibold">Klasifikasi Pergerakan</th>
                <th className="py-3 px-4 font-semibold">Stock Out Terakhir</th>
                <th className="py-3 px-4 font-semibold text-right">Total Nilai Stok</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#25334A]">
              {itemsWithMovement
                .filter(
                  (i) =>
                    (selectedMovementTab === 'ALL' ||
                      i.movementCategory === selectedMovementTab) &&
                    (selectedStatusTab === 'ALL' ||
                      i.threeTierStatus === selectedStatusTab)
                )
                .map((item) => (
                  <tr key={item.id} className="hover:bg-[#111C30]/70 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-[#3B82F6]">
                      {item.partNumber}
                    </td>
                    <td className="py-3 px-4 font-medium text-white">
                      {item.name}
                      {item.isCritical && (
                        <span className="ml-2 text-[10px] font-mono text-[#F43F5E]">
                          [CRITICAL]
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-[#94A3B8]">{item.categoryName}</td>
                    <td className="py-3 px-4 font-mono font-bold text-right text-white">
                      {item.currentStock} {item.unit}
                    </td>
                    <td className="py-3 px-4 font-mono text-right text-[#94A3B8]">
                      {item.minStock} / {item.maxStock ?? '-'}
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold">
                      {item.threeTierStatus === 'LOW' && (
                        <span className="text-[#F43F5E]">
                          {item.currentStock === 0 ? 'OUT OF STOCK' : 'LOW STOCK'}
                        </span>
                      )}
                      {item.threeTierStatus === 'SAFE' && (
                        <span className="text-[#10B981]">SAFE STOCK</span>
                      )}
                      {item.threeTierStatus === 'OVER' && (
                        <span className="text-[#F59E0B]">OVER STOCK</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold">
                      {item.movementCategory === 'FAST' && (
                        <span className="text-[#10B981]">FAST MOVING</span>
                      )}
                      {item.movementCategory === 'MEDIUM' && (
                        <span className="text-[#3B82F6]">MEDIUM MOVING</span>
                      )}
                      {item.movementCategory === 'SLOW' && (
                        <span className="text-[#F59E0B]">SLOW MOVING</span>
                      )}
                      {item.movementCategory === 'NON_MOVING' && (
                        <span className="text-[#8B5CF6]">NON MOVING</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-[#94A3B8]">
                      {item.lastOutDate
                        ? `${item.lastOutDate} (${item.daysSinceLastOut} hr lalu)`
                        : 'Belum Pernah Keluar'}
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold text-right text-white">
                      {formatRupiah(item.currentStock * item.unitPrice)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* DRILLDOWN MODAL FOR KPI 1 (STOCK READINESS) OR KPI 2 (TOTAL VALUE) */}
      {drilldownModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-4xl rounded-xl bg-[#151F32] border border-[#25334A] text-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-[#111C30] border-b border-[#25334A]">
              <div>
                <h3 className="text-base font-bold">
                  {drilldownModal === 'READINESS'
                    ? `Rincian Kesiapan Stok Gudang (Stock Readiness: ${readiness.readinessPercentage}%)`
                    : `Rincian Nilai Inventaris Gudang (${formatRupiah(totalValueStock)})`}
                </h3>
                <p className="text-xs text-[#94A3B8]">
                  {drilldownModal === 'READINESS'
                    ? `Menampilkan ${readiness.sufficientCount} item cukup dan ${readiness.insufficientCount} item tidak cukup`
                    : 'Estimasi nilai stok berdasarkan kategori dan harga satuan masing-masing barang'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDrilldownModal(null)}
                aria-label="Tutup rincian KPI"
                className="p-2 rounded-lg bg-[#0B1220] text-[#94A3B8] hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 max-h-[70vh] overflow-y-auto space-y-4">
              {drilldownModal === 'VALUE' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                  {valueByCategory.map((cat) => (
                    <div
                      key={cat.name}
                      className="p-3 rounded-lg bg-[#0B1220] border border-[#25334A]"
                    >
                      <div className="text-xs font-semibold text-white">{cat.name}</div>
                      <div className="text-sm font-mono font-bold text-[#10B981] mt-1">
                        {formatRupiah(cat.value)}
                      </div>
                      <div className="text-[11px] font-mono text-[#94A3B8]">
                        {cat.count} jenis barang · {cat.totalStock} unit
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="overflow-x-auto border border-[#25334A] rounded-lg">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#111C30] text-[#94A3B8] border-b border-[#25334A]">
                      <th className="py-2.5 px-3">Part Number</th>
                      <th className="py-2.5 px-3">Nama Barang</th>
                      <th className="py-2.5 px-3 text-right">Stok Tersedia</th>
                      <th className="py-2.5 px-3 text-right">Min Stock</th>
                      <th className="py-2.5 px-3 text-right">Harga Satuan</th>
                      <th className="py-2.5 px-3 text-right">Nilai Inventaris</th>
                      <th className="py-2.5 px-3">Kesiapan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#25334A]">
                    {activeItems.map((i) => {
                      const isSufficient = i.currentStock > i.minStock;
                      return (
                        <tr key={i.id} className="hover:bg-[#111C30]/50">
                          <td className="py-2.5 px-3 font-mono font-bold text-[#3B82F6]">
                            {i.partNumber}
                          </td>
                          <td className="py-2.5 px-3 text-white">{i.name}</td>
                          <td className="py-2.5 px-3 font-mono text-right font-bold">
                            {i.currentStock} {i.unit}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-right text-[#94A3B8]">
                            {i.minStock} {i.unit}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-right text-[#94A3B8]">
                            {formatRupiah(i.unitPrice)}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-right font-bold text-white">
                            {formatRupiah(i.currentStock * i.unitPrice)}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-semibold">
                            {isSufficient ? (
                              <span className="text-[#10B981]">CUKUP</span>
                            ) : (
                              <span className="text-[#F43F5E]">TIDAK CUKUP</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="px-6 py-3 bg-[#111C30] border-t border-[#25334A] flex justify-end gap-2">
              <button
                type="button"
                onClick={handleDownloadReplenishmentExcel}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#10B981] text-slate-950 font-semibold text-xs cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Download Excel Replenishment
              </button>
              <button
                type="button"
                onClick={() => setDrilldownModal(null)}
                className="px-4 py-2 rounded-lg bg-[#0B1220] border border-[#25334A] text-xs font-semibold text-[#94A3B8] hover:text-white cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
