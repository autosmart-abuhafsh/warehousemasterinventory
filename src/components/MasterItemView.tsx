import React, { useState, useMemo, useRef } from 'react';
import {
  Plus,
  Search,
  FileSpreadsheet,
  Upload,
  QrCode,
  Edit3,
  Eye,
  Power,
  ArrowUpDown,
  AlertCircle,
  CheckCircle2,
  X,
} from 'lucide-react';
import { useWms } from '../context/WmsContext';
import { MasterItem } from '../types/wms';
import {
  getStockStatus,
  formatRupiah,
} from '../utils/inventoryLogic';
import { downloadExcelReport } from '../utils/exportUtils';
import { BarcodeQrModal } from './BarcodeQrModal';

export const MasterItemView: React.FC = () => {
  const {
    items,
    categories,
    suppliers,
    locations,
    currentRole,
    settings,
    addMasterItem,
    updateMasterItem,
    toggleMasterItemStatus,
    importMasterItems,
    setActiveMenu,
  } = useWms();

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OUT_OF_STOCK' | 'LOW' | 'SAFE' | 'OVER'>('ALL');
  const [locationFilter, setLocationFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState<'partNumber' | 'name' | 'currentStock' | 'value'>('partNumber');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  // Modals
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MasterItem | null>(null);
  const [detailItem, setDetailItem] = useState<MasterItem | null>(null);
  const [barcodeItem, setBarcodeItem] = useState<MasterItem | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Form State (19 fields)
  const [formState, setFormState] = useState({
    partNumber: '',
    name: '',
    categoryId: categories[0]?.id || 'cat-hyd',
    description: '',
    specification: '',
    unit: 'PCS',
    unitPrice: 250000,
    initialStock: 10,
    minStock: 5,
    maxStock: '30',
    targetStock: '25',
    locationId: locations[0]?.id || 'loc-1',
    supplierId: suppliers[0]?.id || 'sup-1',
    isCritical: false,
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
  });

  const openAddModal = () => {
    setEditingItem(null);
    setFormState({
      partNumber: `GEL-NEW-${String(items.length + 1).padStart(3, '0')}`,
      name: '',
      categoryId: categories[0]?.id || 'cat-hyd',
      description: '',
      specification: '',
      unit: 'PCS',
      unitPrice: 250000,
      initialStock: 10,
      minStock: 5,
      maxStock: '30',
      targetStock: '25',
      locationId: locations[0]?.id || 'loc-1',
      supplierId: suppliers[0]?.id || 'sup-1',
      isCritical: false,
      status: 'ACTIVE',
    });
    setFeedback(null);
    setIsFormOpen(true);
  };

  const openEditModal = (item: MasterItem) => {
    setEditingItem(item);
    setFormState({
      partNumber: item.partNumber,
      name: item.name,
      categoryId: item.categoryId,
      description: item.description,
      specification: item.specification,
      unit: item.unit,
      unitPrice: item.unitPrice,
      initialStock: item.initialStock,
      minStock: item.minStock,
      maxStock: item.maxStock !== null ? String(item.maxStock) : '',
      targetStock: item.targetStock !== null ? String(item.targetStock) : '',
      locationId: item.locationId,
      supplierId: item.supplierId,
      isCritical: item.isCritical,
      status: item.status,
    });
    setFeedback(null);
    setIsFormOpen(true);
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    const cat = categories.find((c) => c.id === formState.categoryId);
    const loc = locations.find((l) => l.id === formState.locationId);
    const sup = suppliers.find((s) => s.id === formState.supplierId);

    const payload = {
      partNumber: formState.partNumber,
      name: formState.name,
      categoryId: formState.categoryId,
      categoryName: cat?.name || 'General',
      description: formState.description,
      specification: formState.specification,
      unit: formState.unit,
      unitPrice: Number(formState.unitPrice) || 0,
      initialStock: Number(formState.initialStock) || 0,
      minStock: Number(formState.minStock) || 0,
      maxStock: formState.maxStock.trim() !== '' ? Number(formState.maxStock) : null,
      targetStock: formState.targetStock.trim() !== '' ? Number(formState.targetStock) : null,
      locationId: formState.locationId,
      locationCode: loc?.code || 'WHJ-A1-R01',
      supplierId: formState.supplierId,
      supplierName: sup?.companyName || '-',
      isCritical: formState.isCritical,
      status: formState.status,
    };

    if (editingItem) {
      const res = updateMasterItem(editingItem.id, payload);
      if (!res.success) {
        setFeedback({ type: 'error', msg: res.error || 'Gagal menyimpan perubahan.' });
        return;
      }
      setFeedback({ type: 'success', msg: `Data barang ${payload.partNumber} berhasil diperbarui.` });
      setIsFormOpen(false);
    } else {
      const res = addMasterItem(payload);
      if (!res.success) {
        setFeedback({ type: 'error', msg: res.error || 'Gagal menambah barang.' });
        return;
      }
      setFeedback({ type: 'success', msg: `Barang baru ${payload.partNumber} berhasil ditambahkan.` });
      setIsFormOpen(false);
    }
  };

  const filteredAndSortedItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = items.filter((item) => {
      const matchQuery =
        !q ||
        item.partNumber.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q) ||
        item.specification.toLowerCase().includes(q);
      const matchCat = categoryFilter === 'ALL' || item.categoryId === categoryFilter;
      const matchLoc = locationFilter === 'ALL' || item.locationId === locationFilter;
      const st = getStockStatus(item.currentStock, item.minStock, item.maxStock);
      const matchStatus = statusFilter === 'ALL' || st === statusFilter;
      return matchQuery && matchCat && matchLoc && matchStatus;
    });

    list.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'partNumber') cmp = a.partNumber.localeCompare(b.partNumber);
      else if (sortBy === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortBy === 'currentStock') cmp = a.currentStock - b.currentStock;
      else if (sortBy === 'value')
        cmp = a.currentStock * a.unitPrice - b.currentStock * b.unitPrice;
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [items, searchQuery, categoryFilter, locationFilter, statusFilter, sortBy, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSortedItems.length / pageSize));
  const paginatedItems = filteredAndSortedItems.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const handleSort = (col: typeof sortBy) => {
    if (sortBy === col) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setSortDir('asc');
    }
  };

  const handleExportExcel = () => {
    downloadExcelReport(
      `Master_Item_List_Jatirejo_${settings.referenceDate}.xls`,
      'DAFTAR MASTER DATA BARANG (MASTER ITEM LIST)',
      `Total Item Ditampilkan: ${filteredAndSortedItems.length} SKU`,
      [
        { header: 'ID Barang', accessor: (r) => r.id },
        { header: 'Part Number', accessor: (r) => r.partNumber },
        { header: 'Nama Barang', accessor: (r) => r.name },
        { header: 'Kategori', accessor: (r) => r.categoryName },
        { header: 'Spesifikasi', accessor: (r) => r.specification },
        { header: 'Satuan', accessor: (r) => r.unit },
        { header: 'Harga Satuan (Rp)', accessor: (r) => r.unitPrice },
        { header: 'Stok Awal', accessor: (r) => r.initialStock },
        { header: 'Current Stock', accessor: (r) => r.currentStock },
        { header: 'Min Stock', accessor: (r) => r.minStock },
        { header: 'Max Stock', accessor: (r) => r.maxStock ?? '-' },
        { header: 'Target Stock', accessor: (r) => r.targetStock ?? '-' },
        { header: 'Nilai Stok (Rp)', accessor: (r) => r.currentStock * r.unitPrice },
        { header: 'Lokasi Rak', accessor: (r) => r.locationCode },
        { header: 'Supplier Utama', accessor: (r) => r.supplierName },
        { header: 'Critical Item', accessor: (r) => (r.isCritical ? 'Ya' : 'Tidak') },
        { header: 'Status Barang', accessor: (r) => r.status },
        { header: 'Tanggal Dibuat', accessor: (r) => r.createdAt },
        { header: 'Terakhir Diperbarui', accessor: (r) => r.updatedAt },
      ],
      filteredAndSortedItems
    );
  };

  const handleImportCsvFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = String(ev.target?.result || '');
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length < 2) {
        setFeedback({ type: 'error', msg: 'File CSV kosong atau tidak memiliki baris data.' });
        return;
      }
      const rows: Partial<MasterItem>[] = lines.slice(1).map((line) => {
        const cols = line.split(',').map((c) => c.replace(/^"|"$/g, '').trim());
        return {
          partNumber: cols[0],
          name: cols[1],
          categoryName: cols[2] || 'Hydraulic System',
          unit: cols[3] || 'PCS',
          unitPrice: Number(cols[4]) || 150000,
          initialStock: Number(cols[5]) || 10,
          minStock: Number(cols[6]) || 5,
          targetStock: Number(cols[7]) || 20,
          isCritical: (cols[8] || '').toLowerCase() === 'ya',
        };
      });
      const res = importMasterItems(rows);
      setFeedback({
        type: 'success',
        msg: `Import selesai: ${res.added} barang baru ditambahkan, ${res.skipped} dilewati (duplikat/tidak valid).`,
      });
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-6">
      {/* Header & Primary Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 rounded-xl bg-[#151F32] border border-[#25334A]">
        <div>
          <h2 className="text-lg font-bold text-white">
            Master Item List (Pusat Data Suku Cadang & Logistik)
          </h2>
          <p className="text-xs text-[#94A3B8] mt-0.5">
            Mengelola seluruh 19 atribut Master Item, parameter Minimum/Maximum/Target Stock,
            serta pelabelan Barcode & QR Code
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleImportCsvFile}
            className="hidden"
          />
          {currentRole?.canCreateMaster && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#0B1220] border border-[#25334A] hover:border-[#3B82F6] text-xs font-semibold text-white cursor-pointer"
            >
              <Upload className="w-4 h-4 text-[#3B82F6]" />
              Import CSV/Excel
            </button>
          )}
          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#10B981]/15 border border-[#10B981]/40 text-[#10B981] hover:bg-[#10B981]/25 text-xs font-semibold cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Export Excel (.xls)
          </button>
          {currentRole?.canCreateMaster && (
            <button
              type="button"
              onClick={openAddModal}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] text-white text-xs font-semibold cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Tambah Barang Baru
            </button>
          )}
        </div>
      </div>

      {feedback && (
        <div
          role="status"
          className={`p-4 rounded-xl border text-xs flex items-center justify-between ${
            feedback.type === 'success'
              ? 'bg-[#10B981]/15 border-[#10B981]/40 text-[#10B981]'
              : 'bg-[#F43F5E]/15 border-[#F43F5E]/40 text-[#F43F5E]'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{feedback.msg}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-xs underline ml-4 cursor-pointer"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Search & Multi-Filter Bar */}
      <div className="p-4 rounded-xl bg-[#151F32] border border-[#25334A] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="lg:col-span-2 relative">
          <Search className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            aria-label="Cari Part Number atau Nama Barang"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Cari Part Number, Nama Barang, atau Spesifikasi..."
            className="w-full pl-9 pr-3.5 py-2 rounded-lg bg-[#0B1220] border border-[#25334A] text-xs text-white focus:outline-none focus:border-[#3B82F6]"
          />
        </div>

        <select
          aria-label="Filter Kategori Barang"
          value={categoryFilter}
          onChange={(e) => {
            setCategoryFilter(e.target.value);
            setCurrentPage(1);
          }}
          className="px-3 py-2 rounded-lg bg-[#0B1220] border border-[#25334A] text-xs text-white"
        >
          <option value="ALL">Semua Kategori ({categories.length})</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          aria-label="Filter Status Stok"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as typeof statusFilter);
            setCurrentPage(1);
          }}
          className="px-3 py-2 rounded-lg bg-[#0B1220] border border-[#25334A] text-xs text-white"
        >
          <option value="ALL">Semua Status Stok</option>
          <option value="OUT_OF_STOCK">Out of Stock (Habis = 0)</option>
          <option value="LOW">Low Stock (≤ Minimum)</option>
          <option value="SAFE">Safe Stock (Aman)</option>
          <option value="OVER">Over Stock (&gt; Maksimum)</option>
        </select>

        <select
          aria-label="Filter Lokasi Penyimpanan"
          value={locationFilter}
          onChange={(e) => {
            setLocationFilter(e.target.value);
            setCurrentPage(1);
          }}
          className="px-3 py-2 rounded-lg bg-[#0B1220] border border-[#25334A] text-xs text-white"
        >
          <option value="ALL">Semua Lokasi Rak</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.code} — {l.rack}
            </option>
          ))}
        </select>
      </div>

      {/* Master Item Table */}
      <div className="rounded-xl bg-[#151F32] border border-[#25334A] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#111C30] text-[#94A3B8] border-b border-[#25334A]">
                <th className="py-3.5 px-4 font-semibold">
                  <button
                    type="button"
                    onClick={() => handleSort('partNumber')}
                    className="inline-flex items-center gap-1 hover:text-white cursor-pointer"
                  >
                    Part Number <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3.5 px-4 font-semibold">
                  <button
                    type="button"
                    onClick={() => handleSort('name')}
                    className="inline-flex items-center gap-1 hover:text-white cursor-pointer"
                  >
                    Nama & Spesifikasi Barang <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3.5 px-4 font-semibold">Kategori & Lokasi</th>
                <th className="py-3.5 px-4 font-semibold text-right">
                  <button
                    type="button"
                    onClick={() => handleSort('currentStock')}
                    className="inline-flex items-center gap-1 hover:text-white cursor-pointer"
                  >
                    Stok Saat Ini <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3.5 px-4 font-semibold text-right">Min / Max / Target</th>
                <th className="py-3.5 px-4 font-semibold text-right">Harga Satuan</th>
                <th className="py-3.5 px-4 font-semibold text-right">
                  <button
                    type="button"
                    onClick={() => handleSort('value')}
                    className="inline-flex items-center gap-1 hover:text-white cursor-pointer"
                  >
                    Total Nilai <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3.5 px-4 font-semibold">Status Ketersediaan</th>
                <th className="py-3.5 px-4 font-semibold text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#25334A]">
              {paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-[#94A3B8]">
                    Tidak ada barang yang cocok dengan filter pencarian.
                  </td>
                </tr>
              ) : (
                paginatedItems.map((item) => {
                  const st = getStockStatus(
                    item.currentStock,
                    item.minStock,
                    item.maxStock
                  );
                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-[#111C30]/70 transition-colors ${
                        item.status === 'INACTIVE' ? 'opacity-50' : ''
                      }`}
                    >
                      <td className="py-3 px-4 font-mono">
                        <div className="font-bold text-[#3B82F6]">{item.partNumber}</div>
                        <div className="text-[10px] text-[#94A3B8]">
                          {item.isCritical ? 'CRITICAL ITEM' : 'STANDARD'} · {item.status}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-white">{item.name}</div>
                        <div className="text-[11px] text-[#94A3B8] line-clamp-1">
                          {item.specification}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-white">{item.categoryName}</div>
                        <div className="text-[11px] font-mono text-[#94A3B8]">
                          {item.locationCode} · {item.supplierName}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-right">
                        <div className="text-sm font-bold text-white">
                          {item.currentStock} {item.unit}
                        </div>
                        <div className="text-[10px] text-[#94A3B8]">
                          Awal: {item.initialStock}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-right text-[#94A3B8]">
                        {item.minStock} / {item.maxStock ?? '-'} / {item.targetStock ?? '-'}
                      </td>
                      <td className="py-3 px-4 font-mono text-right text-[#94A3B8]">
                        {formatRupiah(item.unitPrice)}
                      </td>
                      <td className="py-3 px-4 font-mono text-right font-semibold text-white">
                        {formatRupiah(item.currentStock * item.unitPrice)}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold">
                        {st === 'OUT_OF_STOCK' && (
                          <span className="text-[#F43F5E]">OUT OF STOCK (0)</span>
                        )}
                        {st === 'LOW' && (
                          <span className="text-[#F43F5E]">LOW STOCK</span>
                        )}
                        {st === 'SAFE' && (
                          <span className="text-[#10B981]">SAFE STOCK</span>
                        )}
                        {st === 'OVER' && (
                          <span className="text-[#F59E0B]">OVER STOCK</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setBarcodeItem(item)}
                            title="Barcode & QR Code Label"
                            aria-label={`Barcode ${item.partNumber}`}
                            className="p-1.5 rounded bg-[#0B1220] hover:bg-[#25334A] text-[#3B82F6] cursor-pointer"
                          >
                            <QrCode className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDetailItem(item)}
                            title="Lihat 19 Atribut Detail Barang"
                            aria-label={`Detail ${item.partNumber}`}
                            className="p-1.5 rounded bg-[#0B1220] hover:bg-[#25334A] text-[#94A3B8] hover:text-white cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {currentRole?.canEditMaster && (
                            <button
                              type="button"
                              onClick={() => openEditModal(item)}
                              title="Edit Data Barang"
                              aria-label={`Edit ${item.partNumber}`}
                              className="p-1.5 rounded bg-[#0B1220] hover:bg-[#25334A] text-[#10B981] cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {currentRole?.canEditMaster && (
                            <button
                              type="button"
                              onClick={() => toggleMasterItemStatus(item.id)}
                              title={
                                item.status === 'ACTIVE'
                                  ? 'Nonaktifkan Barang (Riwayat Tetap Tersimpan)'
                                  : 'Aktifkan Kembali Barang'
                              }
                              aria-label={`Toggle status ${item.partNumber}`}
                              className="p-1.5 rounded bg-[#0B1220] hover:bg-[#25334A] text-[#F59E0B] cursor-pointer"
                            >
                              <Power className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="px-4 py-3 bg-[#111C30] border-t border-[#25334A] flex flex-wrap items-center justify-between gap-2 text-xs text-[#94A3B8]">
          <div>
            Menampilkan{' '}
            <strong className="font-mono text-white">{paginatedItems.length}</strong> dari{' '}
            <strong className="font-mono text-white">
              {filteredAndSortedItems.length}
            </strong>{' '}
            barang (Halaman {currentPage} dari {totalPages})
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1 rounded bg-[#0B1220] border border-[#25334A] disabled:opacity-40 text-white cursor-pointer"
            >
              Sebelumnya
            </button>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-1 rounded bg-[#0B1220] border border-[#25334A] disabled:opacity-40 text-white cursor-pointer"
            >
              Berikutnya
            </button>
          </div>
        </div>
      </div>

      {/* ADD / EDIT MASTER ITEM MODAL */}
      {isFormOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-3xl rounded-xl bg-[#151F32] border border-[#25334A] text-white shadow-2xl overflow-hidden my-8">
            <div className="flex items-center justify-between px-6 py-4 bg-[#111C30] border-b border-[#25334A]">
              <h3 className="text-base font-bold">
                {editingItem
                  ? `Edit Data Master Barang: ${editingItem.partNumber}`
                  : 'Tambah Barang Baru ke Master Item'}
              </h3>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="p-1.5 rounded bg-[#0B1220] text-[#94A3B8] hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveForm} className="p-6 space-y-4 max-h-[78vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
                    Part Number (Unik) *
                  </label>
                  <input
                    type="text"
                    required
                    value={formState.partNumber}
                    onChange={(e) =>
                      setFormState({ ...formState, partNumber: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg bg-[#0B1220] border border-[#25334A] text-xs font-mono text-white"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
                    Nama Barang *
                  </label>
                  <input
                    type="text"
                    required
                    value={formState.name}
                    onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                    placeholder="Contoh: Cylinder Head Gasket Kit PC200-8"
                    className="w-full px-3 py-2 rounded-lg bg-[#0B1220] border border-[#25334A] text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
                    Kategori Barang
                  </label>
                  <select
                    value={formState.categoryId}
                    onChange={(e) =>
                      setFormState({ ...formState, categoryId: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg bg-[#0B1220] border border-[#25334A] text-xs text-white"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
                    Lokasi Penyimpanan Rak
                  </label>
                  <select
                    value={formState.locationId}
                    onChange={(e) =>
                      setFormState({ ...formState, locationId: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg bg-[#0B1220] border border-[#25334A] text-xs text-white"
                  >
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.code} — {l.rack}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
                    Supplier Utama
                  </label>
                  <select
                    value={formState.supplierId}
                    onChange={(e) =>
                      setFormState({ ...formState, supplierId: e.target.value })
                    }
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
                    Spesifikasi Teknis
                  </label>
                  <input
                    type="text"
                    value={formState.specification}
                    onChange={(e) =>
                      setFormState({ ...formState, specification: e.target.value })
                    }
                    placeholder="Ukuran, tekanan, tipe part..."
                    className="w-full px-3 py-2 rounded-lg bg-[#0B1220] border border-[#25334A] text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
                    Deskripsi Fungsi Barang
                  </label>
                  <input
                    type="text"
                    value={formState.description}
                    onChange={(e) =>
                      setFormState({ ...formState, description: e.target.value })
                    }
                    placeholder="Keterangan penggunaan unit/alat berat..."
                    className="w-full px-3 py-2 rounded-lg bg-[#0B1220] border border-[#25334A] text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
                    Satuan
                  </label>
                  <select
                    value={formState.unit}
                    onChange={(e) => setFormState({ ...formState, unit: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[#0B1220] border border-[#25334A] text-xs font-mono text-white"
                  >
                    <option value="PCS">PCS</option>
                    <option value="SET">SET</option>
                    <option value="UNIT">UNIT</option>
                    <option value="PAIL">PAIL</option>
                    <option value="DRUM">DRUM</option>
                    <option value="ROLL">ROLL</option>
                    <option value="BOX">BOX</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
                    Harga Satuan (Rp)
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={formState.unitPrice}
                    onChange={(e) =>
                      setFormState({ ...formState, unitPrice: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 rounded-lg bg-[#0B1220] border border-[#25334A] text-xs font-mono text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
                    Stok Awal
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={formState.initialStock}
                    onChange={(e) =>
                      setFormState({ ...formState, initialStock: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 rounded-lg bg-[#0B1220] border border-[#25334A] text-xs font-mono text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
                    Min Stock
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={formState.minStock}
                    onChange={(e) =>
                      setFormState({ ...formState, minStock: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 rounded-lg bg-[#0B1220] border border-[#25334A] text-xs font-mono text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
                    Target Stock
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={formState.targetStock}
                    onChange={(e) =>
                      setFormState({ ...formState, targetStock: e.target.value })
                    }
                    placeholder="Opsional"
                    className="w-full px-3 py-2 rounded-lg bg-[#0B1220] border border-[#25334A] text-xs font-mono text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center pt-2">
                <div>
                  <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
                    Maximum Stock (Batas Over Stock)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={formState.maxStock}
                    onChange={(e) =>
                      setFormState({ ...formState, maxStock: e.target.value })
                    }
                    placeholder="Kosongkan jika tanpa batas"
                    className="w-full px-3 py-2 rounded-lg bg-[#0B1220] border border-[#25334A] text-xs font-mono text-white"
                  />
                </div>

                <label className="flex items-center gap-2.5 text-xs text-white cursor-pointer mt-4">
                  <input
                    type="checkbox"
                    checked={formState.isCritical}
                    onChange={(e) =>
                      setFormState({ ...formState, isCritical: e.target.checked })
                    }
                    className="w-4 h-4 accent-[#F43F5E]"
                  />
                  <span>
                    Tandai sebagai <strong className="text-[#F43F5E]">Critical Item</strong>{' '}
                    (Tidak Boleh Kosong)
                  </span>
                </label>

                <div>
                  <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
                    Status Barang
                  </label>
                  <select
                    value={formState.status}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        status: e.target.value as 'ACTIVE' | 'INACTIVE',
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg bg-[#0B1220] border border-[#25334A] text-xs text-white"
                  >
                    <option value="ACTIVE">Aktif</option>
                    <option value="INACTIVE">Nonaktif</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t border-[#25334A] flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 rounded-lg bg-[#0B1220] border border-[#25334A] text-xs font-semibold text-[#94A3B8] hover:text-white cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] text-white text-xs font-semibold cursor-pointer"
                >
                  {editingItem ? 'Simpan Perubahan' : 'Simpan Barang Baru'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 19-ATTRIBUTE DETAIL MODAL */}
      {detailItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-2xl rounded-xl bg-[#151F32] border border-[#25334A] text-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-[#111C30] border-b border-[#25334A]">
              <div>
                <h3 className="text-base font-bold">{detailItem.name}</h3>
                <p className="text-xs font-mono text-[#3B82F6]">
                  ID: {detailItem.id} · Part Number: {detailItem.partNumber}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetailItem(null)}
                className="p-1.5 rounded bg-[#0B1220] text-[#94A3B8] hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <span className="text-[#94A3B8] block">1. ID Barang</span>
                <span className="font-mono font-semibold">{detailItem.id}</span>
              </div>
              <div>
                <span className="text-[#94A3B8] block">2. Part Number</span>
                <span className="font-mono font-bold text-[#3B82F6]">
                  {detailItem.partNumber}
                </span>
              </div>
              <div>
                <span className="text-[#94A3B8] block">3. Nama Barang</span>
                <span className="font-semibold">{detailItem.name}</span>
              </div>
              <div>
                <span className="text-[#94A3B8] block">4. Kategori</span>
                <span>{detailItem.categoryName}</span>
              </div>
              <div className="sm:col-span-2">
                <span className="text-[#94A3B8] block">5. Deskripsi Barang</span>
                <span>{detailItem.description}</span>
              </div>
              <div className="sm:col-span-2">
                <span className="text-[#94A3B8] block">6. Spesifikasi Barang</span>
                <span className="font-mono">{detailItem.specification}</span>
              </div>
              <div>
                <span className="text-[#94A3B8] block">7. Satuan</span>
                <span className="font-mono font-bold">{detailItem.unit}</span>
              </div>
              <div>
                <span className="text-[#94A3B8] block">8. Harga Satuan</span>
                <span className="font-mono font-bold">
                  {formatRupiah(detailItem.unitPrice)}
                </span>
              </div>
              <div>
                <span className="text-[#94A3B8] block">9. Stok Awal</span>
                <span className="font-mono">{detailItem.initialStock}</span>
              </div>
              <div>
                <span className="text-[#94A3B8] block">10. Current Stock</span>
                <span className="font-mono font-bold text-[#10B981]">
                  {detailItem.currentStock} {detailItem.unit}
                </span>
              </div>
              <div>
                <span className="text-[#94A3B8] block">11. Minimum Stock</span>
                <span className="font-mono">{detailItem.minStock}</span>
              </div>
              <div>
                <span className="text-[#94A3B8] block">12. Maximum Stock</span>
                <span className="font-mono">{detailItem.maxStock ?? 'Tidak Dibatasi'}</span>
              </div>
              <div>
                <span className="text-[#94A3B8] block">13. Target Stock</span>
                <span className="font-mono">{detailItem.targetStock ?? 'Belum Ditentukan'}</span>
              </div>
              <div>
                <span className="text-[#94A3B8] block">14. Lokasi Penyimpanan</span>
                <span className="font-mono">{detailItem.locationCode}</span>
              </div>
              <div>
                <span className="text-[#94A3B8] block">15. Supplier Utama</span>
                <span>{detailItem.supplierName}</span>
              </div>
              <div>
                <span className="text-[#94A3B8] block">16. Critical Item</span>
                <span className="font-mono font-bold">
                  {detailItem.isCritical ? 'YA (KRITIKAL)' : 'TIDAK'}
                </span>
              </div>
              <div>
                <span className="text-[#94A3B8] block">17. Status Barang</span>
                <span className="font-mono">{detailItem.status}</span>
              </div>
              <div>
                <span className="text-[#94A3B8] block">18 & 19. Dibuat / Diperbarui</span>
                <span className="font-mono">
                  {detailItem.createdAt} / {detailItem.updatedAt}
                </span>
              </div>
            </div>

            <div className="px-6 py-4 bg-[#111C30] border-t border-[#25334A] flex justify-between">
              <button
                type="button"
                onClick={() => {
                  const target = detailItem;
                  setDetailItem(null);
                  setBarcodeItem(target);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#3B82F6] text-white text-xs font-semibold cursor-pointer"
              >
                <QrCode className="w-4 h-4" />
                Tampilkan Barcode & QR Code
              </button>
              <button
                type="button"
                onClick={() => setDetailItem(null)}
                className="px-4 py-2 rounded-lg bg-[#0B1220] border border-[#25334A] text-xs font-semibold text-[#94A3B8] hover:text-white cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BARCODE & QR CODE MODAL */}
      {barcodeItem && (
        <BarcodeQrModal
          item={barcodeItem}
          onClose={() => setBarcodeItem(null)}
          onQuickAction={(action) => {
            setBarcodeItem(null);
            setActiveMenu(action === 'STOCK_IN' ? 'stock_in' : 'stock_out');
          }}
        />
      )}
    </div>
  );
};
