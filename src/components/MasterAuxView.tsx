import React, { useState } from 'react';
import {
  Truck,
  Plus,
  Edit3,
  Power,
  FolderTree,
  MapPin,
  Trash2,
  Eye,
  X,
} from 'lucide-react';
import { useWms } from '../context/WmsContext';
import { Supplier } from '../types/wms';
import { formatRupiah } from '../utils/inventoryLogic';

export const SupplierManagementView: React.FC = () => {
  const {
    suppliers,
    items,
    stockInList,
    saveSupplier,
    toggleSupplierStatus,
  } = useWms();

  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [detailSupplier, setDetailSupplier] = useState<Supplier | null>(null);

  const [formState, setFormState] = useState({
    code: '',
    companyName: '',
    contactName: '',
    phone: '',
    email: '',
    address: '',
    notes: '',
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
  });

  const openAdd = () => {
    setEditingSupplier(null);
    setFormState({
      code: `SUP-00${suppliers.length + 1}`,
      companyName: '',
      contactName: '',
      phone: '',
      email: '',
      address: '',
      notes: '',
      status: 'ACTIVE',
    });
    setIsModalOpen(true);
  };

  const openEdit = (sup: Supplier) => {
    setEditingSupplier(sup);
    setFormState({
      code: sup.code,
      companyName: sup.companyName,
      contactName: sup.contactName,
      phone: sup.phone,
      email: sup.email,
      address: sup.address,
      notes: sup.notes,
      status: sup.status,
    });
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveSupplier({
      id: editingSupplier?.id,
      ...formState,
    });
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-xl bg-[#151F32] border border-[#25334A] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-[#3B82F6]" />
            <h2 className="text-lg font-bold text-white">
              Modul Supplier Management (Manajemen Pemasok)
            </h2>
          </div>
          <p className="text-xs text-[#94A3B8] mt-1">
            Kelola data pemasok sparepart alat berat & armada logistik beserta riwayat
            penerimaan barang
          </p>
        </div>

        <button
          type="button"
          onClick={openAdd}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] text-white text-xs font-semibold cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Tambah Supplier Baru
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {suppliers.map((sup) => {
          const linkedItems = items.filter((i) => i.supplierId === sup.id);
          const supplierReceipts = stockInList.filter((t) => t.supplierId === sup.id);
          const totalReceiptValue = supplierReceipts.reduce(
            (sum, t) => sum + t.totalValue,
            0
          );

          return (
            <div
              key={sup.id}
              className="p-5 rounded-xl bg-[#151F32] border border-[#25334A] flex flex-col justify-between space-y-4"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-xs font-mono text-[#3B82F6] font-bold">
                      {sup.code}
                    </span>
                    <h3 className="text-base font-bold text-white">{sup.companyName}</h3>
                  </div>
                  <span
                    className={`font-mono text-xs font-bold ${
                      sup.status === 'ACTIVE' ? 'text-[#10B981]' : 'text-[#F43F5E]'
                    }`}
                  >
                    {sup.status}
                  </span>
                </div>

                <div className="mt-3 space-y-1 text-xs text-[#94A3B8]">
                  <div>
                    <strong className="text-white">Kontak:</strong> {sup.contactName} (
                    {sup.phone})
                  </div>
                  <div>
                    <strong className="text-white">Email:</strong> {sup.email}
                  </div>
                  <div>
                    <strong className="text-white">Alamat:</strong> {sup.address}
                  </div>
                  <div>
                    <strong className="text-white">Spesialisasi:</strong> {sup.notes}
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-[#25334A] flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="font-mono text-[#94A3B8]">
                  <strong className="text-white">{linkedItems.length}</strong> Barang ·{' '}
                  <strong className="text-[#10B981]">
                    {formatRupiah(totalReceiptValue)}
                  </strong>{' '}
                  ({supplierReceipts.length} Trx Masuk)
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setDetailSupplier(sup)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#0B1220] border border-[#25334A] text-white cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5 text-[#3B82F6]" /> Riwayat
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(sup)}
                    className="p-1.5 rounded bg-[#0B1220] border border-[#25334A] text-[#10B981] cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleSupplierStatus(sup.id)}
                    className="p-1.5 rounded bg-[#0B1220] border border-[#25334A] text-[#F59E0B] cursor-pointer"
                  >
                    <Power className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Supplier Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-xl bg-[#151F32] border border-[#25334A] text-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-[#111C30] border-b border-[#25334A]">
              <h3 className="text-base font-bold">
                {editingSupplier ? 'Edit Data Supplier' : 'Tambah Supplier Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded bg-[#0B1220] text-[#94A3B8] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#94A3B8] mb-1">ID / Kode Supplier *</label>
                  <input
                    type="text"
                    required
                    value={formState.code}
                    onChange={(e) => setFormState({ ...formState, code: e.target.value })}
                    className="w-full px-3 py-2 rounded bg-[#0B1220] border border-[#25334A] font-mono text-white"
                  />
                </div>
                <div>
                  <label className="block text-[#94A3B8] mb-1">Nama Kontak PIC *</label>
                  <input
                    type="text"
                    required
                    value={formState.contactName}
                    onChange={(e) =>
                      setFormState({ ...formState, contactName: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded bg-[#0B1220] border border-[#25334A] text-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[#94A3B8] mb-1">Nama Perusahaan *</label>
                <input
                  type="text"
                  required
                  value={formState.companyName}
                  onChange={(e) =>
                    setFormState({ ...formState, companyName: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded bg-[#0B1220] border border-[#25334A] text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#94A3B8] mb-1">Nomor Telepon</label>
                  <input
                    type="text"
                    value={formState.phone}
                    onChange={(e) => setFormState({ ...formState, phone: e.target.value })}
                    className="w-full px-3 py-2 rounded bg-[#0B1220] border border-[#25334A] font-mono text-white"
                  />
                </div>
                <div>
                  <label className="block text-[#94A3B8] mb-1">Email</label>
                  <input
                    type="email"
                    value={formState.email}
                    onChange={(e) => setFormState({ ...formState, email: e.target.value })}
                    className="w-full px-3 py-2 rounded bg-[#0B1220] border border-[#25334A] text-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[#94A3B8] mb-1">Alamat Lengkap</label>
                <input
                  type="text"
                  value={formState.address}
                  onChange={(e) =>
                    setFormState({ ...formState, address: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded bg-[#0B1220] border border-[#25334A] text-white"
                />
              </div>
              <div>
                <label className="block text-[#94A3B8] mb-1">Keterangan</label>
                <input
                  type="text"
                  value={formState.notes}
                  onChange={(e) => setFormState({ ...formState, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded bg-[#0B1220] border border-[#25334A] text-white"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded bg-[#0B1220] border border-[#25334A] text-[#94A3B8] cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded bg-[#3B82F6] text-white font-semibold cursor-pointer"
                >
                  Simpan Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Supplier Receipt History Modal */}
      {detailSupplier && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-3xl rounded-xl bg-[#151F32] border border-[#25334A] text-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-[#111C30] border-b border-[#25334A]">
              <div>
                <h3 className="text-base font-bold">
                  Riwayat Penerimaan & Barang Terhubung — {detailSupplier.companyName}
                </h3>
                <p className="text-xs text-[#94A3B8]">{detailSupplier.address}</p>
              </div>
              <button
                type="button"
                onClick={() => setDetailSupplier(null)}
                className="p-1.5 rounded bg-[#0B1220] text-[#94A3B8] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto text-xs">
              <div className="font-bold text-white">
                Riwayat Transaksi Stock In dari Supplier Ini:
              </div>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#111C30] text-[#94A3B8] border-b border-[#25334A]">
                    <th className="py-2 px-3">No. Transaksi</th>
                    <th className="py-2 px-3">Tanggal</th>
                    <th className="py-2 px-3">Part Number & Barang</th>
                    <th className="py-2 px-3 text-right">Qty</th>
                    <th className="py-2 px-3 text-right">Total Nilai</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#25334A]">
                  {stockInList
                    .filter((t) => t.supplierId === detailSupplier.id)
                    .map((t) => (
                      <tr key={t.id}>
                        <td className="py-2 px-3 font-mono text-[#10B981]">
                          {t.transactionNumber}
                        </td>
                        <td className="py-2 px-3 font-mono text-[#94A3B8]">{t.date}</td>
                        <td className="py-2 px-3">
                          {t.partNumber} — {t.itemName}
                        </td>
                        <td className="py-2 px-3 font-mono text-right">
                          +{t.quantity} {t.unit}
                        </td>
                        <td className="py-2 px-3 font-mono font-bold text-right">
                          {formatRupiah(t.totalValue)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const CategoryLocationView: React.FC = () => {
  const {
    categories,
    locations,
    items,
    saveCategory,
    deleteCategory,
    saveLocation,
  } = useWms();

  const [catCode, setCatCode] = useState('');
  const [catName, setCatName] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [catError, setCatError] = useState<string | null>(null);

  const [locCode, setLocCode] = useState('');
  const [locArea, setLocArea] = useState('Zona F – Expansion');
  const [locRack, setLocRack] = useState('Rak F-01');
  const [locLevel, setLocLevel] = useState('Level 1 – Bin 01');
  const [locNotes, setLocNotes] = useState('');

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    setCatError(null);
    const res = saveCategory({
      code: catCode.toUpperCase(),
      name: catName,
      description: catDesc,
      status: 'ACTIVE',
    });
    if (!res.success) {
      setCatError(res.error || 'Gagal menyimpan kategori.');
      return;
    }
    setCatCode('');
    setCatName('');
    setCatDesc('');
  };

  const handleDeleteCat = (id: string) => {
    setCatError(null);
    const res = deleteCategory(id);
    if (!res.success) {
      setCatError(res.error || 'Tidak dapat menghapus kategori.');
    }
  };

  const handleAddLocation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!locCode.trim()) return;
    saveLocation({
      code: locCode.toUpperCase(),
      warehouseName: 'Warehouse Jatirejo',
      area: locArea,
      rack: locRack,
      levelPosition: locLevel,
      notes: locNotes,
      status: 'ACTIVE',
    });
    setLocCode('');
    setLocNotes('');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left: Categories Management (6 Cols) */}
      <div className="lg:col-span-6 p-6 rounded-xl bg-[#151F32] border border-[#25334A] space-y-5">
        <div>
          <div className="flex items-center gap-2">
            <FolderTree className="w-5 h-5 text-[#3B82F6]" />
            <h2 className="text-base font-bold text-white">Manajemen Kategori Barang</h2>
          </div>
          <p className="text-xs text-[#94A3B8] mt-0.5">
            Kategori yang sudah memiliki barang terkait dilindungi dari penghapusan
          </p>
        </div>

        {catError && (
          <div className="p-3 rounded-lg bg-[#F43F5E]/15 border border-[#F43F5E]/40 text-[#F43F5E] text-xs">
            {catError}
          </div>
        )}

        <form onSubmit={handleAddCategory} className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <input
            type="text"
            required
            value={catCode}
            onChange={(e) => setCatCode(e.target.value)}
            placeholder="Kode (CAT-NEW)"
            className="px-3 py-2 rounded-lg bg-[#0B1220] border border-[#25334A] text-xs font-mono text-white"
          />
          <input
            type="text"
            required
            value={catName}
            onChange={(e) => setCatName(e.target.value)}
            placeholder="Nama Kategori Baru"
            className="px-3 py-2 rounded-lg bg-[#0B1220] border border-[#25334A] text-xs text-white"
          />
          <button
            type="submit"
            className="px-3 py-2 rounded-lg bg-[#3B82F6] text-white text-xs font-semibold cursor-pointer"
          >
            + Tambah Kategori
          </button>
        </form>

        <div className="space-y-2.5">
          {categories.map((cat) => {
            const count = items.filter((i) => i.categoryId === cat.id).length;
            return (
              <div
                key={cat.id}
                className="p-3.5 rounded-lg bg-[#0B1220] border border-[#25334A] flex items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-[#3B82F6]">
                      {cat.code}
                    </span>
                    <span className="text-xs font-bold text-white">{cat.name}</span>
                  </div>
                  <p className="text-[11px] text-[#94A3B8] mt-0.5">{cat.description}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-mono text-white font-semibold">
                    {count} Item
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDeleteCat(cat.id)}
                    title="Hapus kategori jika belum digunakan"
                    className="p-1.5 rounded bg-[#151F32] text-[#F43F5E] hover:bg-[#25334A] cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right: Storage Locations Management (6 Cols) */}
      <div className="lg:col-span-6 p-6 rounded-xl bg-[#151F32] border border-[#25334A] space-y-5">
        <div>
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-[#10B981]" />
            <h2 className="text-base font-bold text-white">
              Manajemen Lokasi Penyimpanan (Warehouse Jatirejo)
            </h2>
          </div>
          <p className="text-xs text-[#94A3B8] mt-0.5">
            Struktur Area, Rak, dan Tingkat/Bin penyimpanan suku cadang
          </p>
        </div>

        <form onSubmit={handleAddLocation} className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <input
            type="text"
            required
            value={locCode}
            onChange={(e) => setLocCode(e.target.value)}
            placeholder="Kode Lokasi (WHJ-F1-R01)"
            className="px-3 py-2 rounded-lg bg-[#0B1220] border border-[#25334A] text-xs font-mono text-white"
          />
          <input
            type="text"
            required
            value={locArea}
            onChange={(e) => setLocArea(e.target.value)}
            placeholder="Area / Zona Gudang"
            className="px-3 py-2 rounded-lg bg-[#0B1220] border border-[#25334A] text-xs text-white"
          />
          <input
            type="text"
            required
            value={locRack}
            onChange={(e) => setLocRack(e.target.value)}
            placeholder="Nomor Rak"
            className="px-3 py-2 rounded-lg bg-[#0B1220] border border-[#25334A] text-xs text-white"
          />
          <button
            type="submit"
            className="px-3 py-2 rounded-lg bg-[#10B981] text-slate-950 font-bold text-xs cursor-pointer"
          >
            + Tambah Lokasi Rak
          </button>
        </form>

        <div className="space-y-2.5">
          {locations.map((loc) => {
            const count = items.filter((i) => i.locationId === loc.id).length;
            return (
              <div
                key={loc.id}
                className="p-3.5 rounded-lg bg-[#0B1220] border border-[#25334A] flex items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-[#10B981]">
                      {loc.code}
                    </span>
                    <span className="text-xs font-bold text-white">{loc.area}</span>
                  </div>
                  <div className="text-[11px] font-mono text-[#94A3B8] mt-0.5">
                    {loc.warehouseName} · {loc.rack} · {loc.levelPosition}
                  </div>
                </div>
                <span className="text-xs font-mono font-semibold text-white shrink-0">
                  {count} SKU
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
