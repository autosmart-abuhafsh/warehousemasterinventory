import React, { useState, useMemo, useRef } from 'react';
import {
  FileSpreadsheet,
  Printer,
  Search,
  History,
  Shield,
  Users,
  Settings,
  Download,
  Upload,
  RotateCcw,
  KeyRound,
  Plus,
} from 'lucide-react';
import { useWms } from '../context/WmsContext';
import {
  getStockStatus,
  classifyItemMovement,
  formatRupiah,
} from '../utils/inventoryLogic';
import { downloadExcelReport } from '../utils/exportUtils';
import { UserRoleId, NavMenuId } from '../types/wms';
import { GoogleSheetsDatabasePanel } from './GoogleSheetsDatabaseModal';

type ReportType =
  // 9.1 Laporan Persediaan
  | 'INV_ALL_MASTER'
  | 'INV_AVAILABLE'
  | 'INV_LOW_STOCK'
  | 'INV_OVER_STOCK'
  | 'INV_CRITICAL'
  | 'INV_VALUATION'
  | 'INV_NON_MOVING'
  // 9.2 Laporan Transaksi
  | 'TRX_STOCK_IN'
  | 'TRX_STOCK_OUT'
  | 'TRX_BY_DATE'
  | 'TRX_MOVEMENT'
  | 'TRX_BY_SUPPLIER'
  | 'TRX_BY_PURPOSE';

export const ReportsView: React.FC = () => {
  const {
    items,
    stockInList,
    stockOutList,
    categories,
    settings,
    setPrintableReport,
  } = useWms();

  const [reportType, setReportType] = useState<ReportType>('INV_ALL_MASTER');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dateFrom, setDateFrom] = useState('2026-08-01');
  const [dateTo, setDateTo] = useState(settings.referenceDate);

  const reportDefinitions: { id: ReportType; group: 'INV' | 'TRX'; label: string }[] = [
    { id: 'INV_ALL_MASTER', group: 'INV', label: '1. Laporan Seluruh Master Item' },
    { id: 'INV_AVAILABLE', group: 'INV', label: '2. Laporan Stok Tersedia' },
    { id: 'INV_LOW_STOCK', group: 'INV', label: '3. Laporan Stok Rendah (Low Stock)' },
    { id: 'INV_OVER_STOCK', group: 'INV', label: '4. Laporan Stok Berlebih (Over Stock)' },
    { id: 'INV_CRITICAL', group: 'INV', label: '5. Laporan Barang Kritikal' },
    { id: 'INV_VALUATION', group: 'INV', label: '6. Laporan Nilai Inventaris' },
    { id: 'INV_NON_MOVING', group: 'INV', label: '7. Laporan Barang Tidak Bergerak (Non-Moving)' },
    { id: 'TRX_STOCK_IN', group: 'TRX', label: '8. Laporan Transaksi Stock In' },
    { id: 'TRX_STOCK_OUT', group: 'TRX', label: '9. Laporan Transaksi Stock Out' },
    { id: 'TRX_BY_DATE', group: 'TRX', label: '10. Laporan Transaksi Berdasarkan Tanggal' },
    { id: 'TRX_MOVEMENT', group: 'TRX', label: '11. Laporan Pergerakan Barang' },
    { id: 'TRX_BY_SUPPLIER', group: 'TRX', label: '12. Laporan Penerimaan Berdasarkan Supplier' },
    { id: 'TRX_BY_PURPOSE', group: 'TRX', label: '13. Laporan Pengeluaran Berdasarkan Tujuan Penggunaan' },
  ];

  const generatedReport = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const activeReportDef = reportDefinitions.find((r) => r.id === reportType)!;

    if (reportType.startsWith('INV_') || reportType === 'TRX_MOVEMENT') {
      const enriched = items
        .filter((i) => {
          const matchQ =
            !q ||
            i.partNumber.toLowerCase().includes(q) ||
            i.name.toLowerCase().includes(q);
          const matchCat = categoryFilter === 'ALL' || i.categoryName === categoryFilter;
          const st = getStockStatus(i.currentStock, i.minStock, i.maxStock);
          const matchSt = statusFilter === 'ALL' || st === statusFilter;
          return matchQ && matchCat && matchSt;
        })
        .map((item) => {
          const mv = classifyItemMovement(
            item.id,
            stockOutList,
            settings.referenceDate,
            settings
          );
          const st = getStockStatus(item.currentStock, item.minStock, item.maxStock);
          return { ...item, mv, st };
        })
        .filter((row) => {
          if (reportType === 'INV_AVAILABLE') return row.currentStock > 0;
          if (reportType === 'INV_LOW_STOCK') return row.currentStock <= row.minStock;
          if (reportType === 'INV_OVER_STOCK') return row.st === 'OVER';
          if (reportType === 'INV_CRITICAL') return row.isCritical;
          if (reportType === 'INV_NON_MOVING') return row.mv.category === 'NON_MOVING';
          return true;
        });

      const headers = [
        'Part Number',
        'Nama Barang',
        'Kategori',
        'Lokasi',
        'Stok Awal',
        'Stok Saat Ini',
        'Min / Max',
        'Status Stok',
        'Pergerakan',
        'Harga Satuan',
        'Total Nilai Inventaris',
      ];

      const rows = enriched.map((r) => [
        r.partNumber,
        r.name,
        r.categoryName,
        r.locationCode,
        `${r.initialStock} ${r.unit}`,
        `${r.currentStock} ${r.unit}`,
        `${r.minStock} / ${r.maxStock ?? '-'}`,
        r.st,
        `${r.mv.category} (${r.mv.lastOutDate || 'Belum Keluar'})`,
        formatRupiah(r.unitPrice),
        formatRupiah(r.currentStock * r.unitPrice),
      ]);

      return {
        title: activeReportDef.label.replace(/^\d+\.\s*/, '').toUpperCase(),
        subtitle: `Filter Kategori: ${categoryFilter} | Total Data: ${rows.length} Baris`,
        headers,
        rows,
      };
    }

    if (reportType === 'TRX_STOCK_IN' || reportType === 'TRX_BY_SUPPLIER') {
      const list = stockInList.filter((t) => {
        const matchQ =
          !q ||
          t.partNumber.toLowerCase().includes(q) ||
          t.itemName.toLowerCase().includes(q) ||
          t.supplierName.toLowerCase().includes(q);
        const matchCat = categoryFilter === 'ALL' || t.categoryName === categoryFilter;
        const matchDate =
          (!dateFrom || t.date >= dateFrom) && (!dateTo || t.date <= dateTo);
        return matchQ && matchCat && matchDate;
      });

      return {
        title: activeReportDef.label.replace(/^\d+\.\s*/, '').toUpperCase(),
        subtitle: `Periode: ${dateFrom} s/d ${dateTo} | Total Transaksi: ${list.length}`,
        headers: [
          'No. Transaksi',
          'Tanggal',
          'Supplier',
          'Part Number',
          'Nama Barang',
          'Kategori',
          'Qty Masuk',
          'Harga Satuan',
          'Total Nilai',
          'No. Referensi',
        ],
        rows: list.map((t) => [
          t.transactionNumber,
          t.date,
          t.supplierName,
          t.partNumber,
          t.itemName,
          t.categoryName,
          `${t.quantity} ${t.unit}`,
          formatRupiah(t.unitPrice),
          formatRupiah(t.totalValue),
          t.referenceDoc,
        ]),
      };
    }

    if (reportType === 'TRX_STOCK_OUT' || reportType === 'TRX_BY_PURPOSE') {
      const list = stockOutList.filter((t) => {
        const matchQ =
          !q ||
          t.partNumber.toLowerCase().includes(q) ||
          t.itemName.toLowerCase().includes(q) ||
          t.unitFleetDept.toLowerCase().includes(q) ||
          t.usagePurpose.toLowerCase().includes(q);
        const matchCat = categoryFilter === 'ALL' || t.categoryName === categoryFilter;
        const matchDate =
          (!dateFrom || t.date >= dateFrom) && (!dateTo || t.date <= dateTo);
        return matchQ && matchCat && matchDate;
      });

      return {
        title: activeReportDef.label.replace(/^\d+\.\s*/, '').toUpperCase(),
        subtitle: `Periode: ${dateFrom} s/d ${dateTo} | Total Transaksi: ${list.length}`,
        headers: [
          'No. Transaksi',
          'Tanggal',
          'Tujuan Penggunaan',
          'Unit / Armada Pemakai',
          'Part Number',
          'Nama Barang',
          'Qty Keluar',
          'Nilai Barang',
          'Penerima',
        ],
        rows: list.map((t) => [
          t.transactionNumber,
          t.date,
          t.usagePurpose,
          t.unitFleetDept,
          t.partNumber,
          t.itemName,
          `${t.quantity} ${t.unit}`,
          formatRupiah(t.totalValue),
          t.recipientName,
        ]),
      };
    }

    // Combined TRX_BY_DATE
    const combined = [
      ...stockInList.map((t) => ({
        date: t.date,
        trxNo: t.transactionNumber,
        type: 'STOCK IN (MASUK)',
        partNumber: t.partNumber,
        itemName: t.itemName,
        categoryName: t.categoryName,
        qty: `+${t.quantity} ${t.unit}`,
        value: formatRupiah(t.totalValue),
        partner: t.supplierName,
      })),
      ...stockOutList.map((t) => ({
        date: t.date,
        trxNo: t.transactionNumber,
        type: 'STOCK OUT (KELUAR)',
        partNumber: t.partNumber,
        itemName: t.itemName,
        categoryName: t.categoryName,
        qty: `-${t.quantity} ${t.unit}`,
        value: formatRupiah(t.totalValue),
        partner: t.unitFleetDept,
      })),
    ]
      .filter((row) => {
        const matchQ =
          !q ||
          row.partNumber.toLowerCase().includes(q) ||
          row.itemName.toLowerCase().includes(q);
        const matchCat = categoryFilter === 'ALL' || row.categoryName === categoryFilter;
        const matchDate =
          (!dateFrom || row.date >= dateFrom) && (!dateTo || row.date <= dateTo);
        return matchQ && matchCat && matchDate;
      })
      .sort((a, b) => b.date.localeCompare(a.date));

    return {
      title: 'LAPORAN GABUNGAN TRANSAKSI BERDASARKAN TANGGAL',
      subtitle: `Periode: ${dateFrom} s/d ${dateTo} | Total Aktivitas: ${combined.length}`,
      headers: [
        'Tanggal',
        'No. Transaksi',
        'Jenis Transaksi',
        'Part Number',
        'Nama Barang',
        'Kategori',
        'Kuantitas',
        'Nilai Rupiah',
        'Supplier / Unit Pemakai',
      ],
      rows: combined.map((c) => [
        c.date,
        c.trxNo,
        c.type,
        c.partNumber,
        c.itemName,
        c.categoryName,
        c.qty,
        c.value,
        c.partner,
      ]),
    };
  }, [
    reportType,
    items,
    stockInList,
    stockOutList,
    searchQuery,
    categoryFilter,
    statusFilter,
    dateFrom,
    dateTo,
    settings,
  ]);

  const handleExportExcel = () => {
    const columns = generatedReport.headers.map((header, idx) => ({
      header,
      accessor: (row: (string | number)[]) => row[idx] ?? '',
    }));
    downloadExcelReport(
      `${generatedReport.title.replace(/[^a-zA-Z0-9]/g, '_')}_${settings.referenceDate}.xls`,
      generatedReport.title,
      generatedReport.subtitle,
      columns,
      generatedReport.rows
    );
  };

  const handlePrintPdf = () => {
    setPrintableReport({
      title: generatedReport.title,
      subtitle: generatedReport.subtitle,
      documentNumber: `RPT-${reportType}-${settings.referenceDate.replace(/-/g, '')}`,
      headers: generatedReport.headers,
      rows: generatedReport.rows,
    });
  };

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-xl bg-[#151F32] border border-[#25334A] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white">
            Modul Riwayat Transaksi & Pusat Laporan Terpadu
          </h2>
          <p className="text-xs text-[#94A3B8] mt-1">
            7 Laporan Persediaan & 6 Laporan Transaksi dengan dukungan ekspor detail ke
            Excel (.xls) dan cetak PDF resmi
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#10B981] text-slate-950 font-bold text-xs cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Download Excel (.xls)
          </button>
          <button
            type="button"
            onClick={handlePrintPdf}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#3B82F6] text-white font-semibold text-xs cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            Download PDF / Tampilan Cetak
          </button>
        </div>
      </div>

      {/* Report Selector & Multi-Filter Controls */}
      <div className="p-5 rounded-xl bg-[#151F32] border border-[#25334A] space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-1">
            <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
              Pilih Jenis Laporan (13 Laporan Tersedia)
            </label>
            <select
              aria-label="Pilih Jenis Laporan"
              value={reportType}
              onChange={(e) => setReportType(e.target.value as ReportType)}
              className="w-full px-3 py-2 rounded-lg bg-[#0B1220] border border-[#25334A] text-xs font-semibold text-white"
            >
              <optgroup label="9.1 Laporan Persediaan">
                {reportDefinitions
                  .filter((r) => r.group === 'INV')
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
              </optgroup>
              <optgroup label="9.2 Laporan Transaksi">
                {reportDefinitions
                  .filter((r) => r.group === 'TRX')
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
              </optgroup>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
              Cari Part Number / Nama Barang / Supplier
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Ketik kata kunci..."
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#0B1220] border border-[#25334A] text-xs text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
                Filter Kategori
              </label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full px-2.5 py-2 rounded-lg bg-[#0B1220] border border-[#25334A] text-xs text-white"
              >
                <option value="ALL">Semua Kategori</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
                Filter Status Stok
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-2.5 py-2 rounded-lg bg-[#0B1220] border border-[#25334A] text-xs text-white"
              >
                <option value="ALL">Semua Status</option>
                <option value="OUT_OF_STOCK">Out of Stock</option>
                <option value="LOW">Low Stock</option>
                <option value="SAFE">Safe Stock</option>
                <option value="OVER">Over Stock</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-[#25334A] text-xs">
          <span className="text-[#94A3B8]">Rentang Tanggal Transaksi:</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-2.5 py-1 rounded bg-[#0B1220] border border-[#25334A] font-mono text-white"
          />
          <span className="text-[#94A3B8]">s/d</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="px-2.5 py-1 rounded bg-[#0B1220] border border-[#25334A] font-mono text-white"
          />
        </div>
      </div>

      {/* Report Preview Table */}
      <div className="rounded-xl bg-[#151F32] border border-[#25334A] overflow-hidden">
        <div className="px-5 py-4 bg-[#111C30] border-b border-[#25334A] flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white">{generatedReport.title}</h3>
            <p className="text-xs text-[#94A3B8]">{generatedReport.subtitle}</p>
          </div>
          <span className="text-xs font-mono text-[#3B82F6]">
            {generatedReport.rows.length} Baris Data
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#0B1220] text-[#94A3B8] border-b border-[#25334A]">
                {generatedReport.headers.map((h, i) => (
                  <th key={i} className="py-3 px-4 font-semibold whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#25334A]">
              {generatedReport.rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={generatedReport.headers.length}
                    className="py-8 text-center text-[#94A3B8]"
                  >
                    Tidak ada data untuk kriteria filter ini.
                  </td>
                </tr>
              ) : (
                generatedReport.rows.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-[#111C30]/60">
                    {row.map((cell, cIdx) => (
                      <td
                        key={cIdx}
                        className="py-2.5 px-4 font-mono text-white whitespace-nowrap"
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export const AuditLogView: React.FC = () => {
  const { auditLogs, settings } = useWms();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');

  const filteredLogs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return auditLogs.filter((l) => {
      const matchQ =
        !q ||
        l.userName.toLowerCase().includes(q) ||
        l.entityName.toLowerCase().includes(q) ||
        l.notes.toLowerCase().includes(q);
      const matchType = typeFilter === 'ALL' || l.actionType === typeFilter;
      return matchQ && matchType;
    });
  }, [auditLogs, search, typeFilter]);

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-xl bg-[#151F32] border border-[#25334A] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-[#3B82F6]" />
            <h2 className="text-lg font-bold text-white">
              Modul Audit Log & Jejak Aktivitas Pengguna
            </h2>
          </div>
          <p className="text-xs text-[#94A3B8] mt-1">
            Mencatat secara permanen setiap penambahan/perubahan barang, transaksi Stock
            In/Out, Stock Opname, PO, dan perubahan hak akses
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            downloadExcelReport(
              `Audit_Log_WMS_Jatirejo_${settings.referenceDate}.xls`,
              'LAPORAN AUDIT LOG AKTIVITAS SISTEM',
              `Total Rekaman Audit: ${filteredLogs.length}`,
              [
                { header: 'Waktu Aktivitas', accessor: (r) => r.timestamp },
                { header: 'Nama Pengguna', accessor: (r) => r.userName },
                { header: 'Role', accessor: (r) => r.userRole },
                { header: 'Jenis Aktivitas', accessor: (r) => r.actionType },
                { header: 'Entitas / Data', accessor: (r) => r.entityName },
                { header: 'Nilai Sebelum', accessor: (r) => r.beforeValue },
                { header: 'Nilai Sesudah', accessor: (r) => r.afterValue },
                { header: 'Keterangan', accessor: (r) => r.notes },
              ],
              filteredLogs
            )
          }
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#10B981]/15 border border-[#10B981]/40 text-[#10B981] text-xs font-semibold cursor-pointer"
        >
          <FileSpreadsheet className="w-4 h-4" />
          Export Audit Log (.xls)
        </button>
      </div>

      <div className="p-4 rounded-xl bg-[#151F32] border border-[#25334A] flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[240px] relative">
          <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari pengguna, Part Number, atau keterangan aktivitas..."
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#0B1220] border border-[#25334A] text-xs text-white"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2 rounded-lg bg-[#0B1220] border border-[#25334A] text-xs text-white"
        >
          <option value="ALL">Semua Jenis Aktivitas</option>
          <option value="STOCK_IN">STOCK_IN</option>
          <option value="STOCK_OUT">STOCK_OUT</option>
          <option value="ADD_ITEM">ADD_ITEM</option>
          <option value="EDIT_ITEM">EDIT_ITEM</option>
          <option value="STOCK_OPNAME">STOCK_OPNAME</option>
          <option value="STOCK_ADJUSTMENT">STOCK_ADJUSTMENT</option>
          <option value="PO_STATUS">PO_STATUS</option>
          <option value="ROLE_CHANGE">ROLE_CHANGE</option>
          <option value="SYSTEM_CONFIG">SYSTEM_CONFIG</option>
          <option value="GOOGLE_SHEETS_SYNC">GOOGLE_SHEETS_SYNC</option>
        </select>
      </div>

      <div className="rounded-xl bg-[#151F32] border border-[#25334A] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#111C30] text-[#94A3B8] border-b border-[#25334A]">
                <th className="py-3 px-4">Waktu Aktivitas</th>
                <th className="py-3 px-4">Pengguna & Role</th>
                <th className="py-3 px-4">Jenis Aktivitas</th>
                <th className="py-3 px-4">Data yang Diubah</th>
                <th className="py-3 px-4">Nilai Sebelum</th>
                <th className="py-3 px-4">Nilai Setelah</th>
                <th className="py-3 px-4">Keterangan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#25334A]">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-[#111C30]/60">
                  <td className="py-3 px-4 font-mono text-[#94A3B8] whitespace-nowrap">
                    {log.timestamp}
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-semibold text-white">{log.userName}</div>
                    <div className="text-[10px] font-mono text-[#3B82F6]">
                      {log.userRole}
                    </div>
                  </td>
                  <td className="py-3 px-4 font-mono font-bold text-[#F59E0B]">
                    {log.actionType}
                  </td>
                  <td className="py-3 px-4 font-medium text-white">{log.entityName}</td>
                  <td className="py-3 px-4 font-mono text-[#94A3B8]">{log.beforeValue}</td>
                  <td className="py-3 px-4 font-mono text-[#10B981]">{log.afterValue}</td>
                  <td className="py-3 px-4 text-[#94A3B8]">{log.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export const UserManagementView: React.FC = () => {
  const {
    users,
    roles,
    loginHistory,
    currentUser,
    saveUser,
    toggleUserStatus,
    changePassword,
    updateRolePermissions,
  } = useWms();

  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [roleId, setRoleId] = useState<UserRoleId>('STOREKEEPER');
  const [department, setDepartment] = useState('Warehouse Jatirejo');
  const [password, setPassword] = useState('gel123');
  const [newPassInput, setNewPassInput] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    const res = saveUser({
      username,
      fullName,
      email,
      roleId,
      department,
      status: 'ACTIVE',
      passwordHash: password || 'gel123',
    });
    if (!res.success) {
      setMsg(res.error || 'Gagal menyimpan pengguna.');
      return;
    }
    setUsername('');
    setFullName('');
    setEmail('');
    setMsg('Akun pengguna baru berhasil ditambahkan.');
  };

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-xl bg-[#151F32] border border-[#25334A]">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-[#3B82F6]" />
          <h2 className="text-lg font-bold text-white">
            Manajemen Pengguna, Hak Akses (RBAC) & Riwayat Login
          </h2>
        </div>
        <p className="text-xs text-[#94A3B8] mt-1">
          Kelola akun Super Admin, Admin Gudang, Storekeeper, dan Management beserta matriks
          hak akses modul
        </p>
      </div>

      {msg && (
        <div className="p-3.5 rounded-xl bg-[#10B981]/15 border border-[#10B981]/40 text-[#10B981] text-xs">
          {msg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Add User Form & Change Password (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          <form
            onSubmit={handleAddUser}
            className="p-5 rounded-xl bg-[#151F32] border border-[#25334A] space-y-3 text-xs"
          >
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Plus className="w-4 h-4 text-[#3B82F6]" /> Tambah Pengguna Baru
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[#94A3B8] mb-1">Username *</label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="petugas02"
                  className="w-full px-3 py-2 rounded bg-[#0B1220] border border-[#25334A] font-mono text-white"
                />
              </div>
              <div>
                <label className="block text-[#94A3B8] mb-1">Password Awal *</label>
                <input
                  type="text"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-[#0B1220] border border-[#25334A] font-mono text-white"
                />
              </div>
            </div>
            <div>
              <label className="block text-[#94A3B8] mb-1">Nama Lengkap *</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Nama lengkap petugas..."
                className="w-full px-3 py-2 rounded bg-[#0B1220] border border-[#25334A] text-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[#94A3B8] mb-1">Role Pengguna</label>
                <select
                  value={roleId}
                  onChange={(e) => setRoleId(e.target.value as UserRoleId)}
                  className="w-full px-3 py-2 rounded bg-[#0B1220] border border-[#25334A] text-white"
                >
                  <option value="SUPER_ADMIN">Super Admin</option>
                  <option value="ADMIN_GUDANG">Admin Gudang</option>
                  <option value="STOREKEEPER">Storekeeper</option>
                  <option value="MANAGEMENT">Management</option>
                </select>
              </div>
              <div>
                <label className="block text-[#94A3B8] mb-1">Departemen</label>
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-[#0B1220] border border-[#25334A] text-white"
                />
              </div>
            </div>
            <button
              type="submit"
              className="w-full py-2 rounded-lg bg-[#3B82F6] text-white font-semibold cursor-pointer"
            >
              Simpan Pengguna Baru
            </button>
          </form>

          {/* Ganti Password Akun Aktif */}
          <div className="p-5 rounded-xl bg-[#151F32] border border-[#25334A] space-y-3 text-xs">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-[#10B981]" /> Ganti Password Akun Saya (
              {currentUser?.username})
            </h3>
            <div className="flex gap-2">
              <input
                type="password"
                value={newPassInput}
                onChange={(e) => setNewPassInput(e.target.value)}
                placeholder="Password baru..."
                className="flex-1 px-3 py-2 rounded bg-[#0B1220] border border-[#25334A] text-white"
              />
              <button
                type="button"
                onClick={() => {
                  if (currentUser && newPassInput.trim()) {
                    changePassword(currentUser.id, newPassInput.trim());
                    setNewPassInput('');
                    setMsg('Password akun Anda berhasil diperbarui.');
                  }
                }}
                className="px-4 py-2 rounded bg-[#10B981] text-slate-950 font-bold cursor-pointer"
              >
                Update
              </button>
            </div>
          </div>
        </div>

        {/* Users List & Role Matrix (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="p-5 rounded-xl bg-[#151F32] border border-[#25334A] space-y-3">
            <h3 className="text-sm font-bold text-white">Daftar Akun Pengguna</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-[#94A3B8] border-b border-[#25334A]">
                    <th className="py-2">Username & Nama</th>
                    <th className="py-2">Role</th>
                    <th className="py-2">Login Terakhir</th>
                    <th className="py-2">Status</th>
                    <th className="py-2 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#25334A]">
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td className="py-2.5">
                        <div className="font-bold text-white">{u.fullName}</div>
                        <div className="font-mono text-[11px] text-[#3B82F6]">
                          @{u.username} · {u.department}
                        </div>
                      </td>
                      <td className="py-2.5 font-mono text-white">{u.roleId}</td>
                      <td className="py-2.5 font-mono text-[#94A3B8]">{u.lastLogin}</td>
                      <td className="py-2.5 font-mono font-bold">
                        <span
                          className={
                            u.status === 'ACTIVE' ? 'text-[#10B981]' : 'text-[#F43F5E]'
                          }
                        >
                          {u.status}
                        </span>
                      </td>
                      <td className="py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => toggleUserStatus(u.id)}
                          className="px-2.5 py-1 rounded bg-[#0B1220] border border-[#25334A] text-xs text-white cursor-pointer"
                        >
                          {u.status === 'ACTIVE' ? 'Nonaktifkan' : 'Aktifkan'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* RBAC Role Permission Customization */}
          <div className="p-5 rounded-xl bg-[#151F32] border border-[#25334A] space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#F59E0B]" /> Matriks Pengaturan Hak Akses
              Role (Dapat Disesuaikan Super Admin)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-[#94A3B8] border-b border-[#25334A]">
                    <th className="py-2">Role</th>
                    <th className="py-2 text-center">Kelola Master</th>
                    <th className="py-2 text-center">Stock In/Out</th>
                    <th className="py-2 text-center">Approve Opname</th>
                    <th className="py-2 text-center">Export Laporan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#25334A]">
                  {roles.map((r) => (
                    <tr key={r.roleId}>
                      <td className="py-2.5">
                        <div className="font-bold text-white">{r.roleName}</div>
                        <div className="text-[10px] text-[#94A3B8]">
                          {r.allowedMenus.length} menu diizinkan
                        </div>
                      </td>
                      <td className="py-2.5 text-center">
                        <input
                          type="checkbox"
                          checked={r.canEditMaster}
                          onChange={(e) =>
                            updateRolePermissions(r.roleId, {
                              canCreateMaster: e.target.checked,
                              canEditMaster: e.target.checked,
                            })
                          }
                          className="accent-[#3B82F6]"
                        />
                      </td>
                      <td className="py-2.5 text-center">
                        <input
                          type="checkbox"
                          checked={r.canRecordStockIn}
                          onChange={(e) =>
                            updateRolePermissions(r.roleId, {
                              canRecordStockIn: e.target.checked,
                              canRecordStockOut: e.target.checked,
                            })
                          }
                          className="accent-[#3B82F6]"
                        />
                      </td>
                      <td className="py-2.5 text-center">
                        <input
                          type="checkbox"
                          checked={r.canApproveOpname}
                          onChange={(e) =>
                            updateRolePermissions(r.roleId, {
                              canApproveOpname: e.target.checked,
                            })
                          }
                          className="accent-[#3B82F6]"
                        />
                      </td>
                      <td className="py-2.5 text-center">
                        <input
                          type="checkbox"
                          checked={r.canExportReports}
                          onChange={(e) =>
                            updateRolePermissions(r.roleId, {
                              canExportReports: e.target.checked,
                            })
                          }
                          className="accent-[#3B82F6]"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Riwayat Login */}
          <div className="p-5 rounded-xl bg-[#151F32] border border-[#25334A] space-y-3">
            <h3 className="text-sm font-bold text-white">Riwayat Login Pengguna</h3>
            <div className="space-y-2 max-h-44 overflow-y-auto text-xs">
              {loginHistory.map((lh) => (
                <div
                  key={lh.id}
                  className="p-2.5 rounded bg-[#0B1220] border border-[#25334A] flex items-center justify-between"
                >
                  <div>
                    <span className="font-bold text-white">{lh.fullName}</span>{' '}
                    <span className="font-mono text-[#3B82F6]">({lh.roleId})</span>
                    <div className="text-[11px] text-[#94A3B8]">{lh.device}</div>
                  </div>
                  <div className="text-right font-mono text-[11px] text-[#94A3B8]">
                    <div>{lh.timestamp}</div>
                    <div>IP: {lh.ipAddress}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const SystemSettingsView: React.FC = () => {
  const {
    settings,
    updateSettings,
    switchDataMode,
    resetDemoData,
    exportDatabaseJson,
    importDatabaseJson,
  } = useWms();

  const [fastDays, setFastDays] = useState(settings.fastMovingDays);
  const [mediumDays, setMediumDays] = useState(settings.mediumMovingDays);
  const [slowDays, setSlowDays] = useState(settings.slowMovingDays);
  const [warehouseName, setWarehouseName] = useState(settings.warehouseName);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const backupInputRef = useRef<HTMLInputElement | null>(null);

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({
      warehouseName,
      fastMovingDays: Number(fastDays),
      mediumMovingDays: Number(mediumDays),
      slowMovingDays: Number(slowDays),
    });
    setSavedNotice(
      'Konfigurasi parameter klasifikasi pergerakan stok berhasil disimpan dan diterapkan ke Dashboard!'
    );
  };

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-xl bg-[#151F32] border border-[#25334A]">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-[#3B82F6]" />
          <h2 className="text-lg font-bold text-white">
            Pengaturan Sistem, Parameter Pergerakan & Backup Database
          </h2>
        </div>
        <p className="text-xs text-[#94A3B8] mt-1">
          Sesuaikan rentang hari klasifikasi Fast/Medium/Slow/Non-Moving, pemisahan Data
          Simulasi vs Data Operasional, serta pencadangan data
        </p>
      </div>

      {savedNotice && (
        <div className="p-4 rounded-xl bg-[#10B981]/15 border border-[#10B981]/40 text-[#10B981] text-xs">
          {savedNotice}
        </div>
      )}

      {/* Dedicated Google Sheets Cloud Database Integration Panel */}
      <div className="p-5 sm:p-6 rounded-xl bg-[#151F32] border border-[#25334A]">
        <GoogleSheetsDatabasePanel />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <form
          onSubmit={handleSaveConfig}
          className="p-6 rounded-xl bg-[#151F32] border border-[#25334A] space-y-4 text-xs"
        >
          <h3 className="text-sm font-bold text-white">
            Parameter Klasifikasi Pergerakan Barang (KPI 3)
          </h3>
          <div>
            <label className="block text-[#94A3B8] mb-1">Nama Lokasi Gudang</label>
            <input
              type="text"
              value={warehouseName}
              onChange={(e) => setWarehouseName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[#0B1220] border border-[#25334A] text-white"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[#10B981] font-semibold mb-1">
                Batas Fast Moving (Hari)
              </label>
              <input
                type="number"
                min={1}
                value={fastDays}
                onChange={(e) => setFastDays(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg bg-[#0B1220] border border-[#25334A] font-mono text-white"
              />
            </div>
            <div>
              <label className="block text-[#3B82F6] font-semibold mb-1">
                Batas Medium Moving (Hari)
              </label>
              <input
                type="number"
                min={fastDays + 1}
                value={mediumDays}
                onChange={(e) => setMediumDays(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg bg-[#0B1220] border border-[#25334A] font-mono text-white"
              />
            </div>
            <div>
              <label className="block text-[#F59E0B] font-semibold mb-1">
                Batas Slow Moving (Hari)
              </label>
              <input
                type="number"
                min={mediumDays + 1}
                value={slowDays}
                onChange={(e) => setSlowDays(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg bg-[#0B1220] border border-[#25334A] font-mono text-white"
              />
            </div>
          </div>
          <p className="text-[11px] text-[#94A3B8]">
            Barang tanpa transaksi keluar melebihi {slowDays} hari otomatis dikategorikan
            sebagai <strong className="text-[#8B5CF6]">Non-Moving</strong>.
          </p>
          <button
            type="submit"
            className="px-5 py-2.5 rounded-lg bg-[#3B82F6] text-white font-semibold cursor-pointer"
          >
            Simpan Parameter Sistem
          </button>
        </form>

        {/* Data Simulation Control & Backup */}
        <div className="p-6 rounded-xl bg-[#151F32] border border-[#25334A] space-y-5 text-xs">
          <div>
            <h3 className="text-sm font-bold text-white">
              Manajemen Data Simulasi (Demo) vs Data Operasional (PRD Bab 21)
            </h3>
            <p className="text-[#94A3B8] mt-1">
              Data demo diberi tanda khusus dan dipisahkan dari ruang kerja data operasional
              agar tidak tercampur tanpa persetujuan.
            </p>
            <div className="flex flex-wrap gap-2.5 mt-3">
              <button
                type="button"
                onClick={() => switchDataMode('DEMO')}
                className={`px-4 py-2 rounded-lg font-semibold cursor-pointer ${
                  settings.dataMode === 'DEMO'
                    ? 'bg-[#F59E0B] text-slate-950'
                    : 'bg-[#0B1220] border border-[#25334A] text-white'
                }`}
              >
                Gunakan Mode Data Simulasi (Demo)
              </button>
              <button
                type="button"
                onClick={() => switchDataMode('OPERATIONAL', false)}
                className={`px-4 py-2 rounded-lg font-semibold cursor-pointer ${
                  settings.dataMode === 'OPERATIONAL'
                    ? 'bg-[#10B981] text-slate-950'
                    : 'bg-[#0B1220] border border-[#25334A] text-white'
                }`}
              >
                Gunakan Mode Data Operasional (Bersih)
              </button>
              <button
                type="button"
                onClick={() => {
                  resetDemoData();
                  setSavedNotice('Data Simulasi (Demo) telah di-reset ke kondisi awal PRD.');
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0B1220] border border-[#25334A] text-[#94A3B8] hover:text-white cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset Data Demo
              </button>
            </div>
          </div>

          <div className="pt-4 border-t border-[#25334A]">
            <h3 className="text-sm font-bold text-white">
              Mekanisme Backup & Restore Database (Nonfunctional Requirement)
            </h3>
            <p className="text-[#94A3B8] mt-1">
              Unduh seluruh database WMS Jatirejo dalam format JSON atau pulihkan dari file
              cadangan.
            </p>
            <input
              ref={backupInputRef}
              type="file"
              accept=".json"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                  const res = importDatabaseJson(String(ev.target?.result || ''));
                  setSavedNotice(
                    res.success
                      ? 'Database berhasil dipulihkan dari file backup!'
                      : res.error || 'Gagal restore database.'
                  );
                };
                reader.readAsText(file);
              }}
              className="hidden"
            />
            <div className="flex gap-2.5 mt-3">
              <button
                type="button"
                onClick={exportDatabaseJson}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#3B82F6] text-white font-semibold cursor-pointer"
              >
                <Download className="w-4 h-4" /> Backup Database (.json)
              </button>
              <button
                type="button"
                onClick={() => backupInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0B1220] border border-[#25334A] text-white font-semibold cursor-pointer"
              >
                <Upload className="w-4 h-4 text-[#10B981]" /> Restore Database (.json)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
