import React, { useState, useMemo } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Printer,
  Search,
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
} from 'lucide-react';
import { useWms } from '../context/WmsContext';
import { formatRupiah, validateStockOutQuantity } from '../utils/inventoryLogic';
import { downloadExcelReport } from '../utils/exportUtils';
import { StockInTransaction, StockOutTransaction } from '../types/wms';

export const StockInView: React.FC = () => {
  const {
    items,
    suppliers,
    stockInList,
    currentUser,
    currentRole,
    settings,
    recordStockIn,
    setPrintableReport,
  } = useWms();

  const activeItems = useMemo(
    () => items.filter((i) => i.status === 'ACTIVE'),
    [items]
  );

  const [selectedItemId, setSelectedItemId] = useState(activeItems[0]?.id || '');
  const [date, setDate] = useState(settings.referenceDate);
  const [quantity, setQuantity] = useState(10);
  const [unitPrice, setUnitPrice] = useState(activeItems[0]?.unitPrice || 0);
  const [supplierId, setSupplierId] = useState(activeItems[0]?.supplierId || suppliers[0]?.id || '');
  const [referenceDoc, setReferenceDoc] = useState('SJ-SUP-2026/1109');
  const [receivedBy, setReceivedBy] = useState(currentUser?.fullName || 'Rizky Pratama');
  const [notes, setNotes] = useState('');
  const [attachmentName, setAttachmentName] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const selectedItem = useMemo(
    () => activeItems.find((i) => i.id === selectedItemId) || activeItems[0],
    [activeItems, selectedItemId]
  );

  const handleItemChange = (newId: string) => {
    setSelectedItemId(newId);
    const found = activeItems.find((i) => i.id === newId);
    if (found) {
      setUnitPrice(found.unitPrice);
      setSupplierId(found.supplierId);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    if (!selectedItem) {
      setFeedback({ type: 'error', msg: 'Pilih barang terlebih dahulu.' });
      return;
    }
    const sup = suppliers.find((s) => s.id === supplierId);
    const res = recordStockIn({
      date,
      itemId: selectedItem.id,
      partNumber: selectedItem.partNumber,
      itemName: selectedItem.name,
      categoryName: selectedItem.categoryName,
      quantity: Number(quantity),
      unit: selectedItem.unit,
      unitPrice: Number(unitPrice),
      supplierId: supplierId,
      supplierName: sup?.companyName || selectedItem.supplierName,
      referenceDoc: referenceDoc.trim() || 'SJ-INTERNAL',
      receivedBy: receivedBy.trim() || currentUser?.fullName || 'Petugas Gudang',
      notes: notes.trim(),
      attachmentName: attachmentName.trim() || undefined,
    });

    if (!res.success) {
      setFeedback({ type: 'error', msg: res.error || 'Gagal mencatat Stock In.' });
      return;
    }

    setFeedback({
      type: 'success',
      msg: `Transaksi Stock In ${res.transaction?.transactionNumber} berhasil disimpan! Stok ${selectedItem.partNumber} bertambah +${quantity} ${selectedItem.unit}.`,
    });
    setNotes('');
  };

  const filteredHistory = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return stockInList.filter((t) => {
      const matchQ =
        !q ||
        t.transactionNumber.toLowerCase().includes(q) ||
        t.partNumber.toLowerCase().includes(q) ||
        t.itemName.toLowerCase().includes(q) ||
        t.supplierName.toLowerCase().includes(q) ||
        t.referenceDoc.toLowerCase().includes(q);
      const matchFrom = !dateFrom || t.date >= dateFrom;
      const matchTo = !dateTo || t.date <= dateTo;
      return matchQ && matchFrom && matchTo;
    });
  }, [stockInList, searchQuery, dateFrom, dateTo]);

  const handlePrintReceipt = (trx: StockInTransaction) => {
    setPrintableReport({
      title: 'BUKTI PENERIMAAN BARANG GUDANG (GOODS RECEIPT SLIP / STOCK IN)',
      subtitle: `Supplier / Asal Barang: ${trx.supplierName} | No. Referensi / SJ: ${trx.referenceDoc}`,
      documentNumber: trx.transactionNumber,
      summaryItems: [
        { label: 'No. Transaksi', value: trx.transactionNumber },
        { label: 'Tanggal Penerimaan', value: trx.date },
        { label: 'Petugas Penerima', value: trx.receivedBy },
        { label: 'Total Nilai Penerimaan', value: formatRupiah(trx.totalValue) },
      ],
      headers: [
        'Part Number',
        'Nama Barang',
        'Kategori',
        'Jumlah Diterima',
        'Satuan',
        'Harga Satuan',
        'Total Nilai',
        'Keterangan',
      ],
      rows: [
        [
          trx.partNumber,
          trx.itemName,
          trx.categoryName,
          trx.quantity,
          trx.unit,
          formatRupiah(trx.unitPrice),
          formatRupiah(trx.totalValue),
          trx.notes || '-',
        ],
      ],
      signatures: [
        { role: 'Diserahkan Oleh (Supplier/Ekspedisi)', name: trx.supplierName },
        { role: 'Diterima Oleh (Storekeeper)', name: trx.receivedBy },
        { role: 'Mengetahui (Admin Gudang)', name: 'Budi Santoso, S.T.' },
      ],
    });
  };

  return (
    <div className="space-y-6">
      {/* Form Stock In (14 Fields per PRD 7.1) */}
      {currentRole?.canRecordStockIn ? (
        <div className="p-6 rounded-xl bg-[#151F32] border border-[#25334A]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-[#25334A]">
            <div className="flex items-center gap-2.5">
              <ArrowDownRight className="w-5 h-5 text-[#10B981] shrink-0" />
              <div>
                <h2 className="text-base font-bold text-white">
                  Form Pencatatan Barang Masuk (Stock In)
                </h2>
                <p className="text-xs text-[#94A3B8]">
                  Stok barang, nilai inventaris, dan indikator kesiapan gudang akan diperbarui
                  secara otomatis
                </p>
              </div>
            </div>
            <span className="text-xs font-mono text-[#10B981] whitespace-nowrap shrink-0">
              Auto-ID: SIN-{date.slice(0, 7).replace('-', '')}-
              {String(stockInList.length + 1).padStart(3, '0')}
            </span>
          </div>

          {feedback && (
            <div
              role="alert"
              className={`mb-4 p-3.5 rounded-lg border text-xs flex items-center gap-2.5 ${
                feedback.type === 'success'
                  ? 'bg-[#10B981]/15 border-[#10B981]/40 text-[#10B981]'
                  : 'bg-[#F43F5E]/15 border-[#F43F5E]/40 text-[#F43F5E]'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{feedback.msg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="lg:col-span-2">
                <label
                  htmlFor="sin-item"
                  className="block text-xs font-semibold text-[#94A3B8] mb-1"
                >
                  Pilih Part Number & Nama Barang *
                </label>
                <select
                  id="sin-item"
                  value={selectedItem?.id || ''}
                  onChange={(e) => handleItemChange(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#0B1220] border border-[#25334A] text-xs text-white"
                >
                  {activeItems.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.partNumber} — {i.name} (Stok Saat Ini: {i.currentStock} {i.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
                  Kategori & Satuan
                </label>
                <input
                  type="text"
                  readOnly
                  value={
                    selectedItem
                      ? `${selectedItem.categoryName} (${selectedItem.unit})`
                      : '-'
                  }
                  className="w-full px-3 py-2 rounded-lg bg-[#0B1220]/60 border border-[#25334A] text-xs text-[#94A3B8]"
                />
              </div>

              <div>
                <label
                  htmlFor="sin-date"
                  className="block text-xs font-semibold text-[#94A3B8] mb-1"
                >
                  Tanggal Penerimaan *
                </label>
                <input
                  id="sin-date"
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#0B1220] border border-[#25334A] text-xs font-mono text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label
                  htmlFor="sin-qty"
                  className="block text-xs font-semibold text-[#94A3B8] mb-1"
                >
                  Jumlah Diterima ({selectedItem?.unit || 'UNIT'}) *
                </label>
                <input
                  id="sin-qty"
                  type="number"
                  min={1}
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg bg-[#0B1220] border border-[#25334A] text-xs font-mono font-bold text-[#10B981]"
                />
              </div>

              <div>
                <label
                  htmlFor="sin-price"
                  className="block text-xs font-semibold text-[#94A3B8] mb-1"
                >
                  Harga Satuan (Rp) *
                </label>
                <input
                  id="sin-price"
                  type="number"
                  min={0}
                  required
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg bg-[#0B1220] border border-[#25334A] text-xs font-mono text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
                  Total Nilai Penerimaan
                </label>
                <input
                  type="text"
                  readOnly
                  value={formatRupiah(quantity * unitPrice)}
                  className="w-full px-3 py-2 rounded-lg bg-[#0B1220]/60 border border-[#25334A] text-xs font-mono font-bold text-white"
                />
              </div>

              <div>
                <label
                  htmlFor="sin-supplier"
                  className="block text-xs font-semibold text-[#94A3B8] mb-1"
                >
                  Supplier / Asal Barang *
                </label>
                <select
                  id="sin-supplier"
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
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label
                  htmlFor="sin-doc"
                  className="block text-xs font-semibold text-[#94A3B8] mb-1"
                >
                  No. Dokumen / Surat Jalan *
                </label>
                <input
                  id="sin-doc"
                  type="text"
                  required
                  value={referenceDoc}
                  onChange={(e) => setReferenceDoc(e.target.value)}
                  placeholder="SJ-SUP-2026/..."
                  className="w-full px-3 py-2 rounded-lg bg-[#0B1220] border border-[#25334A] text-xs font-mono text-white"
                />
              </div>

              <div>
                <label
                  htmlFor="sin-receiver"
                  className="block text-xs font-semibold text-[#94A3B8] mb-1"
                >
                  Petugas Penerima *
                </label>
                <input
                  id="sin-receiver"
                  type="text"
                  required
                  value={receivedBy}
                  onChange={(e) => setReceivedBy(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#0B1220] border border-[#25334A] text-xs text-white"
                />
              </div>

              <div>
                <label
                  htmlFor="sin-attach"
                  className="block text-xs font-semibold text-[#94A3B8] mb-1"
                >
                  Lampiran Dokumen (Opsional)
                </label>
                <input
                  id="sin-attach"
                  type="text"
                  value={attachmentName}
                  onChange={(e) => setAttachmentName(e.target.value)}
                  placeholder="Contoh: BAST-Penerimaan.pdf"
                  className="w-full px-3 py-2 rounded-lg bg-[#0B1220] border border-[#25334A] text-xs text-white"
                />
              </div>

              <div>
                <label
                  htmlFor="sin-notes"
                  className="block text-xs font-semibold text-[#94A3B8] mb-1"
                >
                  Keterangan Penerimaan
                </label>
                <input
                  id="sin-notes"
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Kondisi barang baik / sesuai PO..."
                  className="w-full px-3 py-2 rounded-lg bg-[#0B1220] border border-[#25334A] text-xs text-white"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="px-5 py-2.5 rounded-lg bg-[#10B981] hover:bg-[#059669] text-slate-950 font-bold text-xs cursor-pointer"
              >
                + Simpan Transaksi Stock In & Tambah Stok
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="p-4 rounded-xl bg-[#151F32] border border-[#25334A] text-xs text-[#94A3B8]">
          Role Anda saat ini (<strong className="text-white">{currentRole?.roleName}</strong>)
          hanya memiliki akses baca pada riwayat penerimaan barang.
        </div>
      )}

      {/* Riwayat Penerimaan Barang (Stock In History) */}
      <div className="p-6 rounded-xl bg-[#151F32] border border-[#25334A] space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-white">
              Riwayat Transaksi Penerimaan Barang (Stock In)
            </h3>
            <p className="text-xs text-[#94A3B8]">
              Menampilkan {filteredHistory.length} transaksi penerimaan dengan total nilai{' '}
              <strong className="font-mono text-[#10B981]">
                {formatRupiah(filteredHistory.reduce((s, t) => s + t.totalValue, 0))}
              </strong>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                aria-label="Cari transaksi Stock In"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari No. Trx, Part, Supplier..."
                className="pl-8 pr-3 py-1.5 rounded-lg bg-[#0B1220] border border-[#25334A] text-xs text-white"
              />
            </div>
            <input
              type="date"
              aria-label="Filter dari tanggal"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg bg-[#0B1220] border border-[#25334A] text-xs font-mono text-white"
            />
            <input
              type="date"
              aria-label="Filter sampai tanggal"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg bg-[#0B1220] border border-[#25334A] text-xs font-mono text-white"
            />
            <button
              type="button"
              onClick={() =>
                downloadExcelReport(
                  `Laporan_Stock_In_${settings.referenceDate}.xls`,
                  'LAPORAN TRANSAKSI BARANG MASUK (STOCK IN)',
                  `Total Transaksi: ${filteredHistory.length}`,
                  [
                    { header: 'No. Transaksi', accessor: (r) => r.transactionNumber },
                    { header: 'Tanggal', accessor: (r) => r.date },
                    { header: 'Part Number', accessor: (r) => r.partNumber },
                    { header: 'Nama Barang', accessor: (r) => r.itemName },
                    { header: 'Kategori', accessor: (r) => r.categoryName },
                    { header: 'Jumlah Masuk', accessor: (r) => r.quantity },
                    { header: 'Satuan', accessor: (r) => r.unit },
                    { header: 'Harga Satuan (Rp)', accessor: (r) => r.unitPrice },
                    { header: 'Total Nilai (Rp)', accessor: (r) => r.totalValue },
                    { header: 'Supplier', accessor: (r) => r.supplierName },
                    { header: 'No. Dokumen', accessor: (r) => r.referenceDoc },
                    { header: 'Petugas Penerima', accessor: (r) => r.receivedBy },
                    { header: 'Keterangan', accessor: (r) => r.notes },
                  ],
                  filteredHistory
                )
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#10B981]/15 border border-[#10B981]/40 text-[#10B981] text-xs font-semibold cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Excel
            </button>
          </div>
        </div>

        <div className="overflow-x-auto border border-[#25334A] rounded-lg">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#111C30] text-[#94A3B8] border-b border-[#25334A]">
                <th className="py-3 px-4">No. Transaksi</th>
                <th className="py-3 px-4">Tanggal</th>
                <th className="py-3 px-4">Part Number & Barang</th>
                <th className="py-3 px-4 text-right">Jumlah Masuk</th>
                <th className="py-3 px-4 text-right">Harga Satuan</th>
                <th className="py-3 px-4 text-right">Total Nilai</th>
                <th className="py-3 px-4">Supplier & Referensi</th>
                <th className="py-3 px-4">Petugas Penerima</th>
                <th className="py-3 px-4 text-right">Bukti</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#25334A]">
              {filteredHistory.map((trx) => (
                <tr key={trx.id} className="hover:bg-[#111C30]/70">
                  <td className="py-3 px-4 font-mono font-bold text-[#10B981]">
                    {trx.transactionNumber}
                  </td>
                  <td className="py-3 px-4 font-mono text-[#94A3B8]">{trx.date}</td>
                  <td className="py-3 px-4">
                    <div className="font-mono font-bold text-[#3B82F6]">
                      {trx.partNumber}
                    </div>
                    <div className="text-white font-medium">{trx.itemName}</div>
                  </td>
                  <td className="py-3 px-4 font-mono font-bold text-right text-[#10B981]">
                    +{trx.quantity} {trx.unit}
                  </td>
                  <td className="py-3 px-4 font-mono text-right text-[#94A3B8]">
                    {formatRupiah(trx.unitPrice)}
                  </td>
                  <td className="py-3 px-4 font-mono font-semibold text-right text-white">
                    {formatRupiah(trx.totalValue)}
                  </td>
                  <td className="py-3 px-4">
                    <div className="text-white">{trx.supplierName}</div>
                    <div className="text-[11px] font-mono text-[#94A3B8]">
                      Ref: {trx.referenceDoc}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-[#94A3B8]">{trx.receivedBy}</td>
                  <td className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => handlePrintReceipt(trx)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#0B1220] border border-[#25334A] hover:border-[#3B82F6] text-xs text-white cursor-pointer"
                    >
                      <Printer className="w-3 h-3 text-[#3B82F6]" /> Cetak Bukti
                    </button>
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

export const StockOutView: React.FC = () => {
  const {
    items,
    stockOutList,
    currentUser,
    currentRole,
    settings,
    recordStockOut,
    setPrintableReport,
  } = useWms();

  const activeItems = useMemo(
    () => items.filter((i) => i.status === 'ACTIVE'),
    [items]
  );

  const [selectedItemId, setSelectedItemId] = useState(activeItems[0]?.id || '');
  const [date, setDate] = useState(settings.referenceDate);
  const [quantity, setQuantity] = useState(1);
  const [usagePurpose, setUsagePurpose] = useState('Perbaikan & Maintenance Unit Alat Berat');
  const [unitFleetDept, setUnitFleetDept] = useState('Excavator EX-01 / Workshop Jatirejo');
  const [recipientName, setRecipientName] = useState('Joko Susilo (Mekanik Senior)');
  const [issuedBy, setIssuedBy] = useState(currentUser?.fullName || 'Rizky Pratama');
  const [referenceDoc, setReferenceDoc] = useState('WO-MTC-2026/1140');
  const [notes, setNotes] = useState('');
  const [attachmentName, setAttachmentName] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const selectedItem = useMemo(
    () => activeItems.find((i) => i.id === selectedItemId) || activeItems[0],
    [activeItems, selectedItemId]
  );

  const liveValidation = useMemo(() => {
    if (!selectedItem) return { valid: false, error: 'Pilih barang.' };
    return validateStockOutQuantity(selectedItem.currentStock, Number(quantity));
  }, [selectedItem, quantity]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    if (!selectedItem) {
      setFeedback({ type: 'error', msg: 'Pilih barang terlebih dahulu.' });
      return;
    }

    const res = recordStockOut({
      date,
      itemId: selectedItem.id,
      partNumber: selectedItem.partNumber,
      itemName: selectedItem.name,
      categoryName: selectedItem.categoryName,
      quantity: Number(quantity),
      unit: selectedItem.unit,
      unitPrice: selectedItem.unitPrice,
      usagePurpose: usagePurpose.trim() || 'Operasional Gudang',
      unitFleetDept: unitFleetDept.trim() || 'Divisi Armada & Alat Berat',
      recipientName: recipientName.trim() || 'Mekanik',
      issuedBy: issuedBy.trim() || currentUser?.fullName || 'Petugas Gudang',
      referenceDoc: referenceDoc.trim() || 'MR-INTERNAL',
      notes: notes.trim(),
      attachmentName: attachmentName.trim() || undefined,
    });

    if (!res.success) {
      setFeedback({ type: 'error', msg: res.error || 'Transaksi ditolak!' });
      return;
    }

    setFeedback({
      type: 'success',
      msg: `Transaksi Stock Out ${res.transaction?.transactionNumber} berhasil! Stok ${selectedItem.partNumber} berkurang -${quantity} ${selectedItem.unit}.`,
    });
    setNotes('');
  };

  const filteredHistory = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return stockOutList.filter((t) => {
      const matchQ =
        !q ||
        t.transactionNumber.toLowerCase().includes(q) ||
        t.partNumber.toLowerCase().includes(q) ||
        t.itemName.toLowerCase().includes(q) ||
        t.unitFleetDept.toLowerCase().includes(q) ||
        t.recipientName.toLowerCase().includes(q);
      const matchFrom = !dateFrom || t.date >= dateFrom;
      const matchTo = !dateTo || t.date <= dateTo;
      return matchQ && matchFrom && matchTo;
    });
  }, [stockOutList, searchQuery, dateFrom, dateTo]);

  const handlePrintIssueSlip = (trx: StockOutTransaction) => {
    setPrintableReport({
      title: 'BUKTI PENGELUARAN BARANG GUDANG (MATERIAL ISSUE SLIP / STOCK OUT)',
      subtitle: `Unit / Armada Pemakai: ${trx.unitFleetDept} | Tujuan: ${trx.usagePurpose}`,
      documentNumber: trx.transactionNumber,
      summaryItems: [
        { label: 'No. Transaksi', value: trx.transactionNumber },
        { label: 'Tanggal Pengeluaran', value: trx.date },
        { label: 'Nama Penerima', value: trx.recipientName },
        { label: 'No. Work Order / Ref', value: trx.referenceDoc },
      ],
      headers: [
        'Part Number',
        'Nama Barang',
        'Kategori',
        'Jumlah Keluar',
        'Satuan',
        'Unit / Armada Pemakai',
        'Nilai Barang',
        'Keterangan',
      ],
      rows: [
        [
          trx.partNumber,
          trx.itemName,
          trx.categoryName,
          trx.quantity,
          trx.unit,
          trx.unitFleetDept,
          formatRupiah(trx.totalValue),
          trx.notes || '-',
        ],
      ],
      signatures: [
        { role: 'Diminta & Diterima Oleh', name: trx.recipientName },
        { role: 'Dikeluarkan Oleh (Storekeeper)', name: trx.issuedBy },
        { role: 'Disetujui Oleh (Kepala Gudang)', name: 'Budi Santoso, S.T.' },
      ],
    });
  };

  return (
    <div className="space-y-6">
      {/* Form Stock Out (14 Fields + PRD 8.3 Validation) */}
      {currentRole?.canRecordStockOut ? (
        <div className="p-6 rounded-xl bg-[#151F32] border border-[#25334A]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-[#25334A]">
            <div className="flex items-center gap-2.5">
              <ArrowUpRight className="w-5 h-5 text-[#F59E0B] shrink-0" />
              <div>
                <h2 className="text-base font-bold text-white">
                  Form Pencatatan Barang Keluar (Stock Out)
                </h2>
                <p className="text-xs text-[#94A3B8]">
                  Dilengkapi proteksi validasi otomatis yang menolak pengeluaran melebihi stok
                  tersedia
                </p>
              </div>
            </div>
            <span className="text-xs font-mono text-[#F59E0B] whitespace-nowrap shrink-0">
              Auto-ID: SOUT-{date.slice(0, 7).replace('-', '')}-
              {String(stockOutList.length + 1).padStart(3, '0')}
            </span>
          </div>

          {feedback && (
            <div
              role="alert"
              className={`mb-4 p-3.5 rounded-lg border text-xs flex items-center gap-2.5 ${
                feedback.type === 'success'
                  ? 'bg-[#10B981]/15 border-[#10B981]/40 text-[#10B981]'
                  : 'bg-[#F43F5E]/15 border-[#F43F5E]/40 text-[#F43F5E]'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span className="font-semibold">{feedback.msg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="lg:col-span-2">
                <label
                  htmlFor="sout-item"
                  className="block text-xs font-semibold text-[#94A3B8] mb-1"
                >
                  Pilih Part Number & Nama Barang *
                </label>
                <select
                  id="sout-item"
                  value={selectedItem?.id || ''}
                  onChange={(e) => setSelectedItemId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#0B1220] border border-[#25334A] text-xs text-white"
                >
                  {activeItems.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.partNumber} — {i.name} (Stok Tersedia: {i.currentStock} {i.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
                  Stok Tersedia Saat Ini
                </label>
                <div className="px-3 py-2 rounded-lg bg-[#0B1220]/70 border border-[#25334A] text-xs font-mono font-bold flex items-center justify-between">
                  <span
                    className={
                      (selectedItem?.currentStock ?? 0) <= (selectedItem?.minStock ?? 0)
                        ? 'text-[#F43F5E]'
                        : 'text-[#10B981]'
                    }
                  >
                    {selectedItem?.currentStock ?? 0} {selectedItem?.unit}
                  </span>
                  <span className="text-[10px] text-[#94A3B8]">
                    Min: {selectedItem?.minStock ?? 0}
                  </span>
                </div>
              </div>

              <div>
                <label
                  htmlFor="sout-date"
                  className="block text-xs font-semibold text-[#94A3B8] mb-1"
                >
                  Tanggal Pengeluaran *
                </label>
                <input
                  id="sout-date"
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#0B1220] border border-[#25334A] text-xs font-mono text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label
                  htmlFor="sout-qty"
                  className="block text-xs font-semibold text-[#94A3B8] mb-1"
                >
                  Jumlah Dikeluarkan ({selectedItem?.unit || 'UNIT'}) *
                </label>
                <input
                  id="sout-qty"
                  type="number"
                  min={1}
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className={`w-full px-3 py-2 rounded-lg bg-[#0B1220] border text-xs font-mono font-bold ${
                    !liveValidation.valid
                      ? 'border-[#F43F5E] text-[#F43F5E]'
                      : 'border-[#25334A] text-[#F59E0B]'
                  }`}
                />
                {!liveValidation.valid && (
                  <p className="text-[11px] text-[#F43F5E] mt-1 font-medium">
                    {liveValidation.error}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="sout-purpose"
                  className="block text-xs font-semibold text-[#94A3B8] mb-1"
                >
                  Tujuan Penggunaan *
                </label>
                <input
                  id="sout-purpose"
                  type="text"
                  required
                  value={usagePurpose}
                  onChange={(e) => setUsagePurpose(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#0B1220] border border-[#25334A] text-xs text-white"
                />
              </div>

              <div>
                <label
                  htmlFor="sout-fleet"
                  className="block text-xs font-semibold text-[#94A3B8] mb-1"
                >
                  Unit / Armada / Departemen Pemakai *
                </label>
                <input
                  id="sout-fleet"
                  type="text"
                  required
                  value={unitFleetDept}
                  onChange={(e) => setUnitFleetDept(e.target.value)}
                  placeholder="Contoh: Excavator EX-02 / Dump Truck DT-05"
                  className="w-full px-3 py-2 rounded-lg bg-[#0B1220] border border-[#25334A] text-xs text-white"
                />
              </div>

              <div>
                <label
                  htmlFor="sout-recipient"
                  className="block text-xs font-semibold text-[#94A3B8] mb-1"
                >
                  Nama Penerima Barang *
                </label>
                <input
                  id="sout-recipient"
                  type="text"
                  required
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#0B1220] border border-[#25334A] text-xs text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label
                  htmlFor="sout-issuer"
                  className="block text-xs font-semibold text-[#94A3B8] mb-1"
                >
                  Petugas Gudang *
                </label>
                <input
                  id="sout-issuer"
                  type="text"
                  required
                  value={issuedBy}
                  onChange={(e) => setIssuedBy(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#0B1220] border border-[#25334A] text-xs text-white"
                />
              </div>

              <div>
                <label
                  htmlFor="sout-doc"
                  className="block text-xs font-semibold text-[#94A3B8] mb-1"
                >
                  Nomor Dokumen / Work Order *
                </label>
                <input
                  id="sout-doc"
                  type="text"
                  required
                  value={referenceDoc}
                  onChange={(e) => setReferenceDoc(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#0B1220] border border-[#25334A] text-xs font-mono text-white"
                />
              </div>

              <div>
                <label
                  htmlFor="sout-attach"
                  className="block text-xs font-semibold text-[#94A3B8] mb-1"
                >
                  Lampiran Dokumen (Opsional)
                </label>
                <input
                  id="sout-attach"
                  type="text"
                  value={attachmentName}
                  onChange={(e) => setAttachmentName(e.target.value)}
                  placeholder="Form-MR-Signed.pdf"
                  className="w-full px-3 py-2 rounded-lg bg-[#0B1220] border border-[#25334A] text-xs text-white"
                />
              </div>

              <div>
                <label
                  htmlFor="sout-notes"
                  className="block text-xs font-semibold text-[#94A3B8] mb-1"
                >
                  Keterangan Pengeluaran
                </label>
                <input
                  id="sout-notes"
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Catatan tambahan..."
                  className="w-full px-3 py-2 rounded-lg bg-[#0B1220] border border-[#25334A] text-xs text-white"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="px-5 py-2.5 rounded-lg bg-[#F59E0B] hover:bg-[#D97706] text-slate-950 font-bold text-xs cursor-pointer"
              >
                - Simpan Transaksi Stock Out & Kurangi Stok
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="p-4 rounded-xl bg-[#151F32] border border-[#25334A] text-xs text-[#94A3B8]">
          Role Anda saat ini (<strong className="text-white">{currentRole?.roleName}</strong>)
          hanya memiliki akses baca pada riwayat pengeluaran barang.
        </div>
      )}

      {/* Riwayat Pengeluaran Barang (Stock Out History) */}
      <div className="p-6 rounded-xl bg-[#151F32] border border-[#25334A] space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-white">
              Riwayat Transaksi Pengeluaran Barang (Stock Out)
            </h3>
            <p className="text-xs text-[#94A3B8]">
              Menampilkan {filteredHistory.length} transaksi pengeluaran dengan total nilai{' '}
              <strong className="font-mono text-[#F59E0B]">
                {formatRupiah(filteredHistory.reduce((s, t) => s + t.totalValue, 0))}
              </strong>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                aria-label="Cari transaksi Stock Out"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari No. Trx, Part, Unit Armada..."
                className="pl-8 pr-3 py-1.5 rounded-lg bg-[#0B1220] border border-[#25334A] text-xs text-white"
              />
            </div>
            <input
              type="date"
              aria-label="Filter dari tanggal"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg bg-[#0B1220] border border-[#25334A] text-xs font-mono text-white"
            />
            <input
              type="date"
              aria-label="Filter sampai tanggal"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg bg-[#0B1220] border border-[#25334A] text-xs font-mono text-white"
            />
            <button
              type="button"
              onClick={() =>
                downloadExcelReport(
                  `Laporan_Stock_Out_${settings.referenceDate}.xls`,
                  'LAPORAN TRANSAKSI BARANG KELUAR (STOCK OUT)',
                  `Total Transaksi: ${filteredHistory.length}`,
                  [
                    { header: 'No. Transaksi', accessor: (r) => r.transactionNumber },
                    { header: 'Tanggal', accessor: (r) => r.date },
                    { header: 'Part Number', accessor: (r) => r.partNumber },
                    { header: 'Nama Barang', accessor: (r) => r.itemName },
                    { header: 'Kategori', accessor: (r) => r.categoryName },
                    { header: 'Jumlah Keluar', accessor: (r) => r.quantity },
                    { header: 'Satuan', accessor: (r) => r.unit },
                    { header: 'Nilai Barang (Rp)', accessor: (r) => r.totalValue },
                    { header: 'Tujuan Penggunaan', accessor: (r) => r.usagePurpose },
                    { header: 'Unit / Armada Pemakai', accessor: (r) => r.unitFleetDept },
                    { header: 'Nama Penerima', accessor: (r) => r.recipientName },
                    { header: 'No. Dokumen / WO', accessor: (r) => r.referenceDoc },
                    { header: 'Petugas Gudang', accessor: (r) => r.issuedBy },
                  ],
                  filteredHistory
                )
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#10B981]/15 border border-[#10B981]/40 text-[#10B981] text-xs font-semibold cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Excel
            </button>
          </div>
        </div>

        <div className="overflow-x-auto border border-[#25334A] rounded-lg">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#111C30] text-[#94A3B8] border-b border-[#25334A]">
                <th className="py-3 px-4">No. Transaksi</th>
                <th className="py-3 px-4">Tanggal</th>
                <th className="py-3 px-4">Part Number & Barang</th>
                <th className="py-3 px-4 text-right">Jumlah Keluar</th>
                <th className="py-3 px-4 text-right">Nilai Barang</th>
                <th className="py-3 px-4">Unit / Armada & Tujuan</th>
                <th className="py-3 px-4">Penerima & Dokumen</th>
                <th className="py-3 px-4 text-right">Bukti</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#25334A]">
              {filteredHistory.map((trx) => (
                <tr key={trx.id} className="hover:bg-[#111C30]/70">
                  <td className="py-3 px-4 font-mono font-bold text-[#F59E0B]">
                    {trx.transactionNumber}
                  </td>
                  <td className="py-3 px-4 font-mono text-[#94A3B8]">{trx.date}</td>
                  <td className="py-3 px-4">
                    <div className="font-mono font-bold text-[#3B82F6]">
                      {trx.partNumber}
                    </div>
                    <div className="text-white font-medium">{trx.itemName}</div>
                  </td>
                  <td className="py-3 px-4 font-mono font-bold text-right text-[#F59E0B]">
                    -{trx.quantity} {trx.unit}
                  </td>
                  <td className="py-3 px-4 font-mono font-semibold text-right text-white">
                    {formatRupiah(trx.totalValue)}
                  </td>
                  <td className="py-3 px-4">
                    <div className="text-white font-medium">{trx.unitFleetDept}</div>
                    <div className="text-[11px] text-[#94A3B8]">{trx.usagePurpose}</div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="text-white">{trx.recipientName}</div>
                    <div className="text-[11px] font-mono text-[#94A3B8]">
                      Ref: {trx.referenceDoc}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => handlePrintIssueSlip(trx)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#0B1220] border border-[#25334A] hover:border-[#3B82F6] text-xs text-white cursor-pointer"
                    >
                      <Printer className="w-3 h-3 text-[#3B82F6]" /> Cetak Bukti
                    </button>
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
