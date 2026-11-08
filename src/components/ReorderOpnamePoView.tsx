import React, { useState, useMemo } from 'react';
import {
  AlertTriangle,
  FileSpreadsheet,
  Printer,
  ShoppingCart,
  ClipboardCheck,
  CheckCircle2,
  XCircle,
  Plus,
  FileText,
  ArrowDownRight,
} from 'lucide-react';
import { useWms } from '../context/WmsContext';
import {
  calculateRecommendedRefill,
  getStockStatus,
  getCriticalItemStatus,
  formatRupiah,
} from '../utils/inventoryLogic';
import { downloadExcelReport } from '../utils/exportUtils';
import { POStatus, StockOpnameItem, PurchaseOrderItem } from '../types/wms';

export const ReorderView: React.FC = () => {
  const {
    items,
    suppliers,
    settings,
    currentUser,
    createPurchaseOrder,
    setPrintableReport,
    setActiveMenu,
  } = useWms();

  const [filterMode, setFilterMode] = useState<'NEEDS_REFILL' | 'CRITICAL_ONLY' | 'ALL'>('NEEDS_REFILL');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [manualOverrides, setManualOverrides] = useState<Record<string, number>>({});
  const [poFeedback, setPoFeedback] = useState<string | null>(null);

  const reorderRows = useMemo(() => {
    return items
      .filter((i) => i.status === 'ACTIVE')
      .map((item) => {
        const st = getStockStatus(item.currentStock, item.minStock, item.maxStock);
        const critStatus = getCriticalItemStatus(item.currentStock, item.minStock);
        const refill = calculateRecommendedRefill(item.currentStock, item.targetStock);
        const effectiveQty =
          manualOverrides[item.id] !== undefined
            ? manualOverrides[item.id]
            : refill.recommendedQty ?? Math.max(0, item.minStock * 2 - item.currentStock);

        return {
          ...item,
          stockStatus: st,
          critStatus,
          recommendedQty: refill.recommendedQty,
          needsManualTarget: refill.needsManualTarget,
          effectiveQty,
          estimatedCost: effectiveQty * item.unitPrice,
        };
      })
      .filter((row) => {
        if (filterMode === 'CRITICAL_ONLY') return row.isCritical;
        if (filterMode === 'NEEDS_REFILL')
          return row.currentStock <= row.minStock || (row.recommendedQty ?? 0) > 0;
        return true;
      })
      .sort((a, b) => a.currentStock - b.currentStock);
  }, [items, filterMode, manualOverrides]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selectAllVisible = () => {
    if (selectedIds.length === reorderRows.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(reorderRows.map((r) => r.id));
    }
  };

  const rowsForExport = useMemo(() => {
    if (selectedIds.length > 0) {
      return reorderRows.filter((r) => selectedIds.includes(r.id));
    }
    return reorderRows;
  }, [reorderRows, selectedIds]);

  const handleExportExcel = () => {
    downloadExcelReport(
      `Laporan_Reorder_Request_Jatirejo_${settings.referenceDate}.xls`,
      'LAPORAN KEBUTUHAN PENGISIAN ULANG STOK GUDANG (REORDER & REFILL REQUEST)',
      `Total Item Diajukan: ${rowsForExport.length} Jenis Barang`,
      [
        { header: 'No', accessor: (_, i) => i + 1 },
        { header: 'Part Number', accessor: (r) => r.partNumber },
        { header: 'Nama Barang', accessor: (r) => r.name },
        { header: 'Kategori', accessor: (r) => r.categoryName },
        { header: 'Tingkat Kekritisan', accessor: (r) => (r.isCritical ? `CRITICAL (${r.critStatus})` : 'Non-Kritikal') },
        { header: 'Stok Tersedia', accessor: (r) => r.currentStock },
        { header: 'Minimum Stock', accessor: (r) => r.minStock },
        { header: 'Maximum Stock', accessor: (r) => r.maxStock ?? '-' },
        { header: 'Target Stock', accessor: (r) => r.targetStock ?? 'Perlu Ditentukan' },
        {
          header: 'Rekomendasi Refill (Target - Current)',
          accessor: (r) =>
            r.needsManualTarget ? 'Perlu Ditentukan Petugas' : r.recommendedQty ?? 0,
        },
        { header: 'Kuantitas Diajukan', accessor: (r) => r.effectiveQty },
        { header: 'Satuan', accessor: (r) => r.unit },
        { header: 'Harga Satuan (Rp)', accessor: (r) => r.unitPrice },
        { header: 'Estimasi Biaya (Rp)', accessor: (r) => r.estimatedCost },
        { header: 'Supplier Utama', accessor: (r) => r.supplierName },
      ],
      rowsForExport
    );
  };

  const handlePrintPdf = () => {
    const totalBiaya = rowsForExport.reduce((s, r) => s + r.estimatedCost, 0);
    setPrintableReport({
      title: 'LAPORAN PERMINTAAN PENGISIAN ULANG STOK (REORDER MANAGEMENT REPORT)',
      subtitle: 'Daftar barang stok rendah / kritikal yang diajukan untuk pengadaan ulang',
      documentNumber: `REQ-REORDER-${settings.referenceDate.replace(/-/g, '')}`,
      summaryItems: [
        { label: 'Jumlah Jenis Barang', value: `${rowsForExport.length} SKU` },
        {
          label: 'Barang Kritikal',
          value: `${rowsForExport.filter((r) => r.isCritical).length} SKU`,
        },
        {
          label: 'Total Unit Diajukan',
          value: `${rowsForExport.reduce((s, r) => s + r.effectiveQty, 0)} Unit`,
        },
        { label: 'Total Estimasi Pengadaan', value: formatRupiah(totalBiaya) },
      ],
      headers: [
        'Part Number',
        'Nama Barang',
        'Kategori',
        'Kekritisan',
        'Stok Saat Ini',
        'Min / Target',
        'Jml Refill',
        'Harga Satuan',
        'Subtotal Estimasi',
      ],
      rows: rowsForExport.map((r) => [
        r.partNumber,
        r.name,
        r.categoryName,
        r.isCritical ? `CRITICAL (${r.critStatus})` : 'Standard',
        `${r.currentStock} ${r.unit}`,
        `${r.minStock} / ${r.targetStock ?? 'Manual'}`,
        `${r.effectiveQty} ${r.unit}`,
        formatRupiah(r.unitPrice),
        formatRupiah(r.estimatedCost),
      ]),
    });
  };

  const handleCreatePoFromSelected = () => {
    const targetRows = rowsForExport.filter((r) => r.effectiveQty > 0);
    if (targetRows.length === 0) return;
    const primarySupplier =
      suppliers.find((s) => s.id === targetRows[0].supplierId) || suppliers[0];
    const poItems: PurchaseOrderItem[] = targetRows.map((r) => ({
      itemId: r.id,
      partNumber: r.partNumber,
      itemName: r.name,
      unit: r.unit,
      quantityOrdered: r.effectiveQty,
      quantityReceived: 0,
      unitPrice: r.unitPrice,
      subtotal: r.estimatedCost,
    }));

    const created = createPurchaseOrder({
      date: settings.referenceDate,
      expectedDate: '2026-11-15',
      supplierId: primarySupplier.id,
      supplierName: primarySupplier.companyName,
      status: 'WAITING_APPROVAL',
      items: poItems,
      createdBy: currentUser?.fullName || 'Admin Gudang',
      notes: `Dibuat otomatis dari modul Reorder Management (${poItems.length} item).`,
    });

    setPoFeedback(
      `Dokumen Purchase Order ${created.poNumber} berhasil dibuat untuk ${poItems.length} jenis barang!`
    );
  };

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-xl bg-[#151F32] border border-[#25334A] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-[#F59E0B]" />
            <h2 className="text-lg font-bold text-white">
              Critical Stock Alert & Reorder Management
            </h2>
          </div>
          <p className="text-xs text-[#94A3B8] mt-1">
            Rumus Rekomendasi Pengisian:{' '}
            <strong className="font-mono text-white">
              Recommended Refill Quantity = Target Stock - Current Stock
            </strong>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleCreatePoFromSelected}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] text-white text-xs font-semibold cursor-pointer"
          >
            <ShoppingCart className="w-4 h-4" />
            Buat PO dari Daftar ({rowsForExport.length})
          </button>
          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#10B981]/15 border border-[#10B981]/40 text-[#10B981] text-xs font-semibold cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Download Excel
          </button>
          <button
            type="button"
            onClick={handlePrintPdf}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#0B1220] border border-[#25334A] hover:border-[#3B82F6] text-white text-xs font-semibold cursor-pointer"
          >
            <Printer className="w-4 h-4 text-[#3B82F6]" />
            Download PDF / Cetak
          </button>
        </div>
      </div>

      {poFeedback && (
        <div className="p-4 rounded-xl bg-[#10B981]/15 border border-[#10B981]/40 text-[#10B981] text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{poFeedback}</span>
          </div>
          <button
            type="button"
            onClick={() => setActiveMenu('purchase_order')}
            className="underline font-bold cursor-pointer"
          >
            Buka Modul Purchase Order →
          </button>
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-[#151F32] border border-[#25334A]">
        <div className="flex items-center gap-1.5 p-1 rounded-lg bg-[#0B1220] border border-[#25334A]">
          {(
            [
              { id: 'NEEDS_REFILL', label: 'Perlu Pengisian Ulang' },
              { id: 'CRITICAL_ONLY', label: 'Hanya Barang Kritikal' },
              { id: 'ALL', label: 'Seluruh Master Item' },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilterMode(f.id)}
              className={`px-3 py-1.5 rounded text-xs font-medium cursor-pointer ${
                filterMode === f.id
                  ? 'bg-[#3B82F6] text-white'
                  : 'text-[#94A3B8] hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="text-xs font-mono text-[#94A3B8]">
          Total Estimasi Biaya Pengadaan:{' '}
          <strong className="text-[#10B981] text-sm">
            {formatRupiah(rowsForExport.reduce((s, r) => s + r.estimatedCost, 0))}
          </strong>
        </div>
      </div>

      {/* Reorder Table */}
      <div className="rounded-xl bg-[#151F32] border border-[#25334A] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#111C30] text-[#94A3B8] border-b border-[#25334A]">
                <th className="py-3 px-4">
                  <input
                    type="checkbox"
                    aria-label="Pilih semua barang"
                    checked={
                      reorderRows.length > 0 &&
                      selectedIds.length === reorderRows.length
                    }
                    onChange={selectAllVisible}
                    className="accent-[#3B82F6]"
                  />
                </th>
                <th className="py-3 px-4">Part Number</th>
                <th className="py-3 px-4">Nama Barang & Kategori</th>
                <th className="py-3 px-4">Tingkat Kekritisan</th>
                <th className="py-3 px-4 text-right">Stok Tersedia</th>
                <th className="py-3 px-4 text-right">Min / Max</th>
                <th className="py-3 px-4 text-right">Target Stock</th>
                <th className="py-3 px-4 text-right">Rekomendasi Refill</th>
                <th className="py-3 px-4 text-right">Jml Diajukan</th>
                <th className="py-3 px-4 text-right">Estimasi Biaya</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#25334A]">
              {reorderRows.map((row) => (
                <tr key={row.id} className="hover:bg-[#111C30]/70">
                  <td className="py-3 px-4">
                    <input
                      type="checkbox"
                      aria-label={`Pilih ${row.partNumber}`}
                      checked={selectedIds.includes(row.id)}
                      onChange={() => toggleSelect(row.id)}
                      className="accent-[#3B82F6]"
                    />
                  </td>
                  <td className="py-3 px-4 font-mono font-bold text-[#3B82F6]">
                    {row.partNumber}
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-semibold text-white">{row.name}</div>
                    <div className="text-[11px] text-[#94A3B8]">
                      {row.categoryName} · {row.supplierName}
                    </div>
                  </td>
                  <td className="py-3 px-4 font-mono font-bold">
                    {row.isCritical ? (
                      <span
                        className={
                          row.critStatus === 'HABIS'
                            ? 'text-[#F43F5E]'
                            : row.critStatus === 'KURANG'
                            ? 'text-[#F59E0B]'
                            : 'text-[#10B981]'
                        }
                      >
                        CRITICAL ({row.critStatus})
                      </span>
                    ) : (
                      <span className="text-[#94A3B8]">NON-KRITIKAL</span>
                    )}
                  </td>
                  <td className="py-3 px-4 font-mono font-bold text-right text-white">
                    {row.currentStock} {row.unit}
                  </td>
                  <td className="py-3 px-4 font-mono text-right text-[#94A3B8]">
                    {row.minStock} / {row.maxStock ?? '-'}
                  </td>
                  <td className="py-3 px-4 font-mono text-right text-white">
                    {row.targetStock ?? (
                      <span className="text-[#F59E0B] text-[11px]">
                        Perlu Ditentukan
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 font-mono font-bold text-right text-[#F59E0B]">
                    {row.needsManualTarget
                      ? 'Perlu Ditentukan'
                      : `+${row.recommendedQty} ${row.unit}`}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <input
                      type="number"
                      min={0}
                      aria-label={`Jumlah pengajuan untuk ${row.partNumber}`}
                      value={row.effectiveQty}
                      onChange={(e) =>
                        setManualOverrides({
                          ...manualOverrides,
                          [row.id]: Math.max(0, Number(e.target.value)),
                        })
                      }
                      className="w-20 px-2 py-1 rounded bg-[#0B1220] border border-[#25334A] text-right font-mono font-bold text-white"
                    />
                  </td>
                  <td className="py-3 px-4 font-mono font-semibold text-right text-[#10B981]">
                    {formatRupiah(row.estimatedCost)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export const StockOpnameView: React.FC = () => {
  const {
    items,
    opnameSessions,
    currentRole,
    createOpnameSession,
    approveOpnameSession,
    rejectOpnameSession,
    setPrintableReport,
  } = useWms();

  const activeItems = useMemo(
    () => items.filter((i) => i.status === 'ACTIVE'),
    [items]
  );

  const [isCreating, setIsCreating] = useState(false);
  const [title, setTitle] = useState('Stock Opname Pemeriksaan Fisik Gudang Jatirejo');
  const [areaFilter, setAreaFilter] = useState('Seluruh Zona Gudang');
  const [notes, setNotes] = useState('');
  const [physicalCounts, setPhysicalCounts] = useState<Record<string, number>>({});
  const [itemNotes, setItemNotes] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const startNewOpname = () => {
    const initCounts: Record<string, number> = {};
    activeItems.forEach((i) => {
      initCounts[i.id] = i.currentStock;
    });
    setPhysicalCounts(initCounts);
    setItemNotes({});
    setIsCreating(true);
  };

  const handleSaveSession = (e: React.FormEvent) => {
    e.preventDefault();
    const opnameItems: StockOpnameItem[] = activeItems.map((i) => {
      const phys =
        physicalCounts[i.id] !== undefined ? physicalCounts[i.id] : i.currentStock;
      return {
        itemId: i.id,
        partNumber: i.partNumber,
        itemName: i.name,
        categoryName: i.categoryName,
        locationCode: i.locationCode,
        unit: i.unit,
        systemStock: i.currentStock,
        physicalStock: phys,
        difference: phys - i.currentStock,
        notes: itemNotes[i.id] || (phys === i.currentStock ? 'Sesuai' : 'Selisih hitung fisik'),
      };
    });

    const created = createOpnameSession(title, areaFilter, notes, opnameItems);
    setIsCreating(false);
    setFeedback({
      type: 'success',
      msg: `Sesi Stock Opname ${created.opnameNumber} disimpan dengan status MENUNGGU PERSETUJUAN. Stok sistem belum berubah sebelum disetujui.`,
    });
  };

  const handleApprove = (opnameId: string) => {
    const res = approveOpnameSession(opnameId);
    if (!res.success) {
      setFeedback({ type: 'error', msg: res.error || 'Gagal menyetujui opname.' });
    } else {
      setFeedback({
        type: 'success',
        msg: 'Stock Opname disetujui! Penyesuaian stok (Stock Adjustment) telah diterapkan ke stok sistem dan dicatat di Audit Log.',
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-xl bg-[#151F32] border border-[#25334A] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-[#3B82F6]" />
            <h2 className="text-lg font-bold text-white">
              Modul Stock Opname & Penyesuaian Stok Fisik
            </h2>
          </div>
          <p className="text-xs text-[#94A3B8] mt-1">
            Stok sistem tidak berubah saat hasil penghitungan dimasukkan. Penyesuaian stok
            hanya terjadi setelah disetujui oleh pejabat berwenang.
          </p>
        </div>

        <button
          type="button"
          onClick={startNewOpname}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] text-white text-xs font-semibold cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Buat Sesi Stock Opname Baru
        </button>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-center justify-between ${
            feedback.type === 'success'
              ? 'bg-[#10B981]/15 border-[#10B981]/40 text-[#10B981]'
              : 'bg-[#F43F5E]/15 border-[#F43F5E]/40 text-[#F43F5E]'
          }`}
        >
          <span>{feedback.msg}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="underline ml-4 cursor-pointer"
          >
            Tutup
          </button>
        </div>
      )}

      {isCreating && (
        <form
          onSubmit={handleSaveSession}
          className="p-6 rounded-xl bg-[#151F32] border border-[#3B82F6] space-y-4"
        >
          <h3 className="text-base font-bold text-white">
            Formulir Sesi Pemeriksaan Fisik (Stock Opname)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
                Judul Sesi Opname *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#0B1220] border border-[#25334A] text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
                Area / Zona Pemeriksaan
              </label>
              <input
                type="text"
                value={areaFilter}
                onChange={(e) => setAreaFilter(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#0B1220] border border-[#25334A] text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
                Catatan Pemeriksaan
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Catatan audit fisik..."
                className="w-full px-3 py-2 rounded-lg bg-[#0B1220] border border-[#25334A] text-xs text-white"
              />
            </div>
          </div>

          <div className="overflow-x-auto border border-[#25334A] rounded-lg max-h-96">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#111C30] text-[#94A3B8] border-b border-[#25334A]">
                  <th className="py-2.5 px-3">Part Number</th>
                  <th className="py-2.5 px-3">Nama Barang</th>
                  <th className="py-2.5 px-3">Lokasi Rak</th>
                  <th className="py-2.5 px-3 text-right">Stok Sistem</th>
                  <th className="py-2.5 px-3 text-right">Stok Fisik Aktual</th>
                  <th className="py-2.5 px-3 text-right">Selisih</th>
                  <th className="py-2.5 px-3">Keterangan Selisih</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#25334A]">
                {activeItems.map((item) => {
                  const phys =
                    physicalCounts[item.id] !== undefined
                      ? physicalCounts[item.id]
                      : item.currentStock;
                  const diff = phys - item.currentStock;
                  return (
                    <tr key={item.id}>
                      <td className="py-2 px-3 font-mono font-bold text-[#3B82F6]">
                        {item.partNumber}
                      </td>
                      <td className="py-2 px-3 text-white">{item.name}</td>
                      <td className="py-2 px-3 font-mono text-[#94A3B8]">
                        {item.locationCode}
                      </td>
                      <td className="py-2 px-3 font-mono text-right text-white">
                        {item.currentStock} {item.unit}
                      </td>
                      <td className="py-2 px-3 text-right">
                        <input
                          type="number"
                          min={0}
                          aria-label={`Stok fisik ${item.partNumber}`}
                          value={phys}
                          onChange={(e) =>
                            setPhysicalCounts({
                              ...physicalCounts,
                              [item.id]: Math.max(0, Number(e.target.value)),
                            })
                          }
                          className="w-20 px-2 py-1 rounded bg-[#0B1220] border border-[#25334A] text-right font-mono font-bold text-white"
                        />
                      </td>
                      <td
                        className={`py-2 px-3 font-mono font-bold text-right ${
                          diff === 0
                            ? 'text-[#10B981]'
                            : diff > 0
                            ? 'text-[#3B82F6]'
                            : 'text-[#F43F5E]'
                        }`}
                      >
                        {diff > 0 ? `+${diff}` : diff} {item.unit}
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          value={itemNotes[item.id] || ''}
                          onChange={(e) =>
                            setItemNotes({ ...itemNotes, [item.id]: e.target.value })
                          }
                          placeholder="Alasan selisih jika ada..."
                          className="w-full px-2 py-1 rounded bg-[#0B1220] border border-[#25334A] text-xs text-white"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="px-4 py-2 rounded-lg bg-[#0B1220] border border-[#25334A] text-xs text-[#94A3B8] cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-[#3B82F6] text-white text-xs font-semibold cursor-pointer"
            >
              Simpan Hasil & Ajukan Persetujuan
            </button>
          </div>
        </form>
      )}

      {/* List of Opname Sessions */}
      <div className="space-y-4">
        {opnameSessions.map((session) => (
          <div
            key={session.id}
            className="p-5 rounded-xl bg-[#151F32] border border-[#25334A] space-y-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#25334A] pb-3">
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="font-mono font-bold text-sm text-[#3B82F6]">
                    {session.opnameNumber}
                  </span>
                  <span className="text-sm font-bold text-white">{session.title}</span>
                </div>
                <div className="text-xs text-[#94A3B8] mt-0.5">
                  Tanggal: {session.date} · Area: {session.areaFilter} · Dibuat Oleh:{' '}
                  {session.createdBy}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`font-mono text-xs font-bold ${
                    session.status === 'APPROVED'
                      ? 'text-[#10B981]'
                      : session.status === 'REJECTED'
                      ? 'text-[#F43F5E]'
                      : 'text-[#F59E0B]'
                  }`}
                >
                  STATUS: {session.status}
                </span>

                {session.status === 'PENDING_APPROVAL' && currentRole?.canApproveOpname && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleApprove(session.id)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#10B981] text-slate-950 font-bold text-xs cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Setujui & Sesuaikan Stok
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        rejectOpnameSession(session.id, 'Perlu hitung ulang fisik')
                      }
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#F43F5E]/20 border border-[#F43F5E]/40 text-[#F43F5E] font-semibold text-xs cursor-pointer"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Tolak
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={() =>
                    setPrintableReport({
                      title: `BERITA ACARA STOCK OPNAME (${session.opnameNumber})`,
                      subtitle: `${session.title} | Status: ${session.status}`,
                      documentNumber: session.opnameNumber,
                      headers: [
                        'Part Number',
                        'Nama Barang',
                        'Lokasi Rak',
                        'Stok Sistem',
                        'Stok Fisik',
                        'Selisih',
                        'Keterangan',
                      ],
                      rows: session.items.map((i) => [
                        i.partNumber,
                        i.itemName,
                        i.locationCode,
                        `${i.systemStock} ${i.unit}`,
                        `${i.physicalStock} ${i.unit}`,
                        `${i.difference > 0 ? '+' : ''}${i.difference} ${i.unit}`,
                        i.notes,
                      ]),
                    })
                  }
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#0B1220] border border-[#25334A] text-xs text-white cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-[#3B82F6]" /> Cetak BA
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="text-[#94A3B8] border-b border-[#25334A]">
                    <th className="py-2 px-3">Part Number</th>
                    <th className="py-2 px-3">Nama Barang</th>
                    <th className="py-2 px-3">Lokasi</th>
                    <th className="py-2 px-3 text-right">Stok Sistem</th>
                    <th className="py-2 px-3 text-right">Stok Fisik</th>
                    <th className="py-2 px-3 text-right">Selisih</th>
                    <th className="py-2 px-3">Keterangan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#25334A]/60">
                  {session.items.map((item) => (
                    <tr key={item.itemId}>
                      <td className="py-2 px-3 font-mono font-bold text-[#3B82F6]">
                        {item.partNumber}
                      </td>
                      <td className="py-2 px-3 text-white">{item.itemName}</td>
                      <td className="py-2 px-3 font-mono text-[#94A3B8]">
                        {item.locationCode}
                      </td>
                      <td className="py-2 px-3 font-mono text-right text-[#94A3B8]">
                        {item.systemStock} {item.unit}
                      </td>
                      <td className="py-2 px-3 font-mono font-bold text-right text-white">
                        {item.physicalStock} {item.unit}
                      </td>
                      <td
                        className={`py-2 px-3 font-mono font-bold text-right ${
                          item.difference === 0
                            ? 'text-[#10B981]'
                            : 'text-[#F43F5E]'
                        }`}
                      >
                        {item.difference > 0 ? `+${item.difference}` : item.difference}{' '}
                        {item.unit}
                      </td>
                      <td className="py-2 px-3 text-[#94A3B8]">{item.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const PurchaseOrderView: React.FC = () => {
  const {
    items,
    suppliers,
    purchaseOrders,
    currentUser,
    settings,
    createPurchaseOrder,
    updatePurchaseOrderStatus,
    setPrintableReport,
    setActiveMenu,
  } = useWms();

  const [isCreating, setIsCreating] = useState(false);
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id || '');
  const [expectedDate, setExpectedDate] = useState('2026-11-18');
  const [notes, setNotes] = useState('');
  const [selectedItemId, setSelectedItemId] = useState(items[0]?.id || '');
  const [qtyOrdered, setQtyOrdered] = useState(10);
  const [draftItems, setDraftItems] = useState<PurchaseOrderItem[]>([]);

  const handleAddDraftItem = () => {
    const found = items.find((i) => i.id === selectedItemId);
    if (!found || qtyOrdered <= 0) return;
    setDraftItems((prev) => [
      ...prev,
      {
        itemId: found.id,
        partNumber: found.partNumber,
        itemName: found.name,
        unit: found.unit,
        quantityOrdered: qtyOrdered,
        quantityReceived: 0,
        unitPrice: found.unitPrice,
        subtotal: qtyOrdered * found.unitPrice,
      },
    ]);
  };

  const handleCreatePo = (e: React.FormEvent) => {
    e.preventDefault();
    if (draftItems.length === 0) return;
    const sup = suppliers.find((s) => s.id === supplierId) || suppliers[0];
    createPurchaseOrder({
      date: settings.referenceDate,
      expectedDate,
      supplierId: sup.id,
      supplierName: sup.companyName,
      status: 'WAITING_APPROVAL',
      items: draftItems,
      createdBy: currentUser?.fullName || 'Admin Gudang',
      notes,
    });
    setDraftItems([]);
    setIsCreating(false);
  };

  const statusLabels: Record<POStatus, string> = {
    DRAFT: 'Draft',
    WAITING_APPROVAL: 'Menunggu Persetujuan',
    APPROVED: 'Disetujui',
    ORDERED: 'Dipesan ke Supplier',
    PARTIAL_RECEIVED: 'Sebagian Diterima',
    COMPLETED: 'Selesai',
    CANCELLED: 'Dibatalkan',
  };

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-xl bg-[#151F32] border border-[#25334A] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#3B82F6]" />
            <h2 className="text-lg font-bold text-white">
              Modul Purchase Order (PO) & Pengadaan Barang
            </h2>
          </div>
          <p className="text-xs text-[#94A3B8] mt-1">
            Sesuai ketentuan PRD: Dokumen PO tidak menambah stok secara otomatis. Penambahan
            stok dilakukan saat barang fisik diterima melalui modul Stock In.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsCreating(!isCreating)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] text-white text-xs font-semibold cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Buat Dokumen PO Baru
        </button>
      </div>

      {isCreating && (
        <form
          onSubmit={handleCreatePo}
          className="p-6 rounded-xl bg-[#151F32] border border-[#3B82F6] space-y-4"
        >
          <h3 className="text-base font-bold text-white">Buat Dokumen Purchase Order Baru</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
                Pilih Supplier *
              </label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#0B1220] border border-[#25334A] text-xs text-white"
              >
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.companyName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
                Estimasi Tanggal Pengiriman
              </label>
              <input
                type="date"
                value={expectedDate}
                onChange={(e) => setExpectedDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#0B1220] border border-[#25334A] text-xs font-mono text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
                Catatan PO
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Keterangan pengiriman..."
                className="w-full px-3 py-2 rounded-lg bg-[#0B1220] border border-[#25334A] text-xs text-white"
              />
            </div>
          </div>

          <div className="p-4 rounded-lg bg-[#0B1220] border border-[#25334A] space-y-3">
            <div className="text-xs font-semibold text-white">Tambah Item ke PO:</div>
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={selectedItemId}
                onChange={(e) => setSelectedItemId(e.target.value)}
                className="flex-1 min-w-[240px] px-3 py-2 rounded-lg bg-[#151F32] border border-[#25334A] text-xs text-white"
              >
                {items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.partNumber} — {i.name} ({formatRupiah(i.unitPrice)}/{i.unit})
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={1}
                value={qtyOrdered}
                onChange={(e) => setQtyOrdered(Number(e.target.value))}
                className="w-28 px-3 py-2 rounded-lg bg-[#151F32] border border-[#25334A] text-xs font-mono text-white"
              />
              <button
                type="button"
                onClick={handleAddDraftItem}
                className="px-4 py-2 rounded-lg bg-[#10B981] text-slate-950 font-bold text-xs cursor-pointer"
              >
                + Tambah Barang ke Daftar PO
              </button>
            </div>

            {draftItems.length > 0 && (
              <table className="w-full text-left text-xs mt-3 border-t border-[#25334A]">
                <thead>
                  <tr className="text-[#94A3B8]">
                    <th className="py-2">Part Number</th>
                    <th className="py-2">Nama Barang</th>
                    <th className="py-2 text-right">Qty Pesan</th>
                    <th className="py-2 text-right">Harga Satuan</th>
                    <th className="py-2 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {draftItems.map((di, idx) => (
                    <tr key={idx} className="border-t border-[#25334A]/60">
                      <td className="py-2 font-mono text-[#3B82F6]">{di.partNumber}</td>
                      <td className="py-2 text-white">{di.itemName}</td>
                      <td className="py-2 font-mono text-right">
                        {di.quantityOrdered} {di.unit}
                      </td>
                      <td className="py-2 font-mono text-right">
                        {formatRupiah(di.unitPrice)}
                      </td>
                      <td className="py-2 font-mono font-bold text-right text-[#10B981]">
                        {formatRupiah(di.subtotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="px-4 py-2 rounded-lg bg-[#0B1220] border border-[#25334A] text-xs text-[#94A3B8] cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={draftItems.length === 0}
              className="px-5 py-2 rounded-lg bg-[#3B82F6] disabled:opacity-40 text-white text-xs font-semibold cursor-pointer"
            >
              Simpan Dokumen Purchase Order
            </button>
          </div>
        </form>
      )}

      {/* PO List */}
      <div className="space-y-4">
        {purchaseOrders.map((po) => (
          <div
            key={po.id}
            className="p-5 rounded-xl bg-[#151F32] border border-[#25334A] space-y-4"
          >
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-[#25334A] pb-3">
              <div>
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-sm text-[#3B82F6]">
                    {po.poNumber}
                  </span>
                  <span className="font-bold text-white">{po.supplierName}</span>
                  <span className="font-mono text-xs text-[#10B981] font-bold">
                    {formatRupiah(po.totalAmount)}
                  </span>
                </div>
                <div className="text-xs text-[#94A3B8] mt-0.5">
                  Tanggal PO: {po.date} · Estimasi Tiba: {po.expectedDate} · Dibuat:{' '}
                  {po.createdBy}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  aria-label={`Ubah status ${po.poNumber}`}
                  value={po.status}
                  onChange={(e) =>
                    updatePurchaseOrderStatus(po.id, e.target.value as POStatus)
                  }
                  className="px-3 py-1.5 rounded-lg bg-[#0B1220] border border-[#25334A] text-xs font-mono font-semibold text-white"
                >
                  {(Object.keys(statusLabels) as POStatus[]).map((st) => (
                    <option key={st} value={st}>
                      Status: {statusLabels[st]}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => setActiveMenu('stock_in')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#10B981]/15 border border-[#10B981]/40 text-[#10B981] text-xs font-semibold cursor-pointer"
                >
                  <ArrowDownRight className="w-3.5 h-3.5" />
                  Catat Penerimaan di Stock In
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setPrintableReport({
                      title: `PURCHASE ORDER (${po.poNumber})`,
                      subtitle: `Kepada Supplier: ${po.supplierName} | Status: ${statusLabels[po.status]}`,
                      documentNumber: po.poNumber,
                      summaryItems: [
                        { label: 'No. PO', value: po.poNumber },
                        { label: 'Tanggal PO', value: po.date },
                        { label: 'Supplier', value: po.supplierName },
                        { label: 'Total Nilai PO', value: formatRupiah(po.totalAmount) },
                      ],
                      headers: [
                        'Part Number',
                        'Nama Barang',
                        'Kuantitas Pesan',
                        'Satuan',
                        'Harga Satuan',
                        'Subtotal',
                      ],
                      rows: po.items.map((i) => [
                        i.partNumber,
                        i.itemName,
                        i.quantityOrdered,
                        i.unit,
                        formatRupiah(i.unitPrice),
                        formatRupiah(i.subtotal),
                      ]),
                    })
                  }
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#0B1220] border border-[#25334A] text-xs text-white cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-[#3B82F6]" /> Cetak PO
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-[#94A3B8] border-b border-[#25334A]">
                    <th className="py-2 px-3">Part Number</th>
                    <th className="py-2 px-3">Nama Barang</th>
                    <th className="py-2 px-3 text-right">Jumlah Dipesan</th>
                    <th className="py-2 px-3 text-right">Harga Satuan</th>
                    <th className="py-2 px-3 text-right">Subtotal Estimasi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#25334A]/60">
                  {po.items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="py-2 px-3 font-mono font-bold text-[#3B82F6]">
                        {item.partNumber}
                      </td>
                      <td className="py-2 px-3 text-white">{item.itemName}</td>
                      <td className="py-2 px-3 font-mono font-bold text-right text-white">
                        {item.quantityOrdered} {item.unit}
                      </td>
                      <td className="py-2 px-3 font-mono text-right text-[#94A3B8]">
                        {formatRupiah(item.unitPrice)}
                      </td>
                      <td className="py-2 px-3 font-mono font-bold text-right text-[#10B981]">
                        {formatRupiah(item.subtotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
