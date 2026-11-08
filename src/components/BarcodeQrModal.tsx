import React from 'react';
import { X, Printer, QrCode, Barcode } from 'lucide-react';
import { MasterItem } from '../types/wms';
import { generateBarcodeBars, generateQrMatrix } from '../utils/exportUtils';
import { formatRupiah } from '../utils/inventoryLogic';

export const BarcodeQrModal: React.FC<{
  item: MasterItem;
  onClose: () => void;
  onQuickAction?: (action: 'STOCK_IN' | 'STOCK_OUT') => void;
}> = ({ item, onClose, onQuickAction }) => {
  const bars = generateBarcodeBars(item.partNumber);
  const qrPayload = JSON.stringify({
    pn: item.partNumber,
    name: item.name,
    loc: item.locationCode,
    wh: 'JATIREJO',
  });
  const qrMatrix = generateQrMatrix(qrPayload);

  const totalBarUnits = bars.reduce((acc, w) => acc + w, 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="barcode-modal-title"
    >
      <div className="w-full max-w-xl rounded-xl bg-[#151F32] border border-[#25334A] text-[#F8FAFC] shadow-2xl overflow-hidden">
        <div className="no-print flex items-center justify-between px-6 py-4 bg-[#111C30] border-b border-[#25334A]">
          <div className="flex items-center gap-2.5">
            <QrCode className="w-5 h-5 text-[#3B82F6]" />
            <div>
              <h2 id="barcode-modal-title" className="text-base font-bold text-white">
                Identifikasi Barcode & QR Code Barang
              </h2>
              <p className="text-xs text-[#94A3B8]">
                Label identifikasi rak & suku cadang PT. Global Energi Lestari
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal barcode"
            className="p-2 rounded-lg bg-[#0B1220] text-[#94A3B8] hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Printable Industrial Sticker Card */}
          <div className="rounded-xl bg-white text-slate-900 p-5 border-2 border-slate-300 shadow-inner">
            <div className="flex items-center justify-between border-b-2 border-slate-900 pb-2 mb-4">
              <div>
                <div className="text-[10px] font-mono font-bold tracking-wider text-slate-600">
                  PT. GLOBAL ENERGI LESTARI – WAREHOUSE JATIREJO
                </div>
                <div className="text-base font-extrabold text-slate-900 leading-snug">
                  {item.name}
                </div>
              </div>
              {item.isCritical && (
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-red-600 text-white rounded">
                  CRITICAL PART
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
              {/* Details + 1D Barcode */}
              <div className="sm:col-span-2 space-y-2">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-500 block text-[10px]">PART NUMBER</span>
                    <span className="font-mono font-bold text-sm text-slate-900">
                      {item.partNumber}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">LOKASI RAK</span>
                    <span className="font-mono font-bold text-sm text-blue-700">
                      {item.locationCode}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">KATEGORI</span>
                    <span className="font-semibold text-slate-800">{item.categoryName}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">SATUAN / STOK</span>
                    <span className="font-mono font-semibold text-slate-800">
                      {item.currentStock} {item.unit} (Min: {item.minStock})
                    </span>
                  </div>
                </div>

                {/* 1D Code-128 Barcode SVG */}
                <div className="pt-2">
                  <svg
                    viewBox={`0 0 ${totalBarUnits} 42`}
                    className="w-full h-12 bg-white"
                    aria-label={`Barcode ${item.partNumber}`}
                  >
                    {(() => {
                      let x = 0;
                      return bars.map((width, idx) => {
                        const rect =
                          idx % 2 === 0 ? (
                            <rect
                              key={idx}
                              x={x}
                              y={0}
                              width={width}
                              height={42}
                              fill="#0F172A"
                            />
                          ) : null;
                        x += width;
                        return rect;
                      });
                    })()}
                  </svg>
                  <div className="text-center font-mono text-xs font-bold tracking-[0.25em] text-slate-900 mt-1">
                    *{item.partNumber}*
                  </div>
                </div>
              </div>

              {/* 2D QR Code SVG */}
              <div className="flex flex-col items-center justify-center border-l border-slate-200 pl-4">
                <svg
                  viewBox="0 0 21 21"
                  className="w-28 h-28 bg-white p-1 border border-slate-200"
                  aria-label={`QR Code ${item.partNumber}`}
                >
                  {qrMatrix.map((row, rIdx) =>
                    row.map((cell, cIdx) =>
                      cell ? (
                        <rect
                          key={`${rIdx}-${cIdx}`}
                          x={cIdx}
                          y={rIdx}
                          width={1}
                          height={1}
                          fill="#0F172A"
                        />
                      ) : null
                    )
                  )}
                </svg>
                <span className="text-[10px] font-mono text-slate-500 mt-1">
                  SCAN QR WMS
                </span>
              </div>
            </div>

            <div className="mt-3 pt-2 border-t border-slate-200 flex items-center justify-between text-[11px] font-mono text-slate-600">
              <span>Spesifikasi: {item.specification}</span>
              <span>Nilai/Unit: {formatRupiah(item.unitPrice)}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="no-print flex flex-wrap items-center justify-between gap-3">
            {onQuickAction && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onQuickAction('STOCK_IN')}
                  className="px-3.5 py-2 rounded-lg bg-[#10B981]/15 border border-[#10B981]/40 text-[#10B981] hover:bg-[#10B981]/25 text-xs font-semibold cursor-pointer"
                >
                  + Simulasi Scan Stock In
                </button>
                <button
                  type="button"
                  onClick={() => onQuickAction('STOCK_OUT')}
                  className="px-3.5 py-2 rounded-lg bg-[#F59E0B]/15 border border-[#F59E0B]/40 text-[#F59E0B] hover:bg-[#F59E0B]/25 text-xs font-semibold cursor-pointer"
                >
                  - Simulasi Scan Stock Out
                </button>
              </div>
            )}
            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] text-white text-xs font-semibold cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                Cetak Label Rak / Part
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-[#0B1220] border border-[#25334A] text-xs font-semibold text-[#94A3B8] hover:text-white cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
