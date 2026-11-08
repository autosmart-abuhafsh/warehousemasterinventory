import React from 'react';
import { X, Printer, FileSpreadsheet } from 'lucide-react';
import { PrintableReportData, useWms } from '../context/WmsContext';
import { downloadExcelReport } from '../utils/exportUtils';

export const PrintableDocumentModal: React.FC<{
  report: PrintableReportData;
  onClose: () => void;
}> = ({ report, onClose }) => {
  const { settings, currentUser } = useWms();

  const handleDownloadExcel = () => {
    const columns = report.headers.map((header, idx) => ({
      header,
      accessor: (row: (string | number)[]) => row[idx] ?? '',
    }));
    downloadExcelReport(
      `${report.title.replace(/[^a-zA-Z0-9]/g, '_')}_${settings.referenceDate}.xls`,
      report.title,
      report.subtitle,
      columns,
      report.rows
    );
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="printable-doc-title"
    >
      <div className="w-full max-w-5xl rounded-xl bg-[#111C30] border border-[#25334A] text-[#F8FAFC] shadow-2xl overflow-hidden my-8">
        {/* Action Toolbar */}
        <div className="no-print flex flex-wrap items-center justify-between gap-3 px-6 py-4 bg-[#0B1220] border-b border-[#25334A]">
          <div>
            <h2 id="printable-doc-title" className="text-base font-bold text-white">
              Pratinjau Dokumen Resmi & Cetak PDF
            </h2>
            <p className="text-xs text-[#94A3B8]">
              Gunakan tombol Cetak / Simpan PDF atau unduh ke format Microsoft Excel (.xls)
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleDownloadExcel}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#10B981]/15 border border-[#10B981]/40 text-[#10B981] hover:bg-[#10B981]/25 text-xs font-semibold transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Download Excel (.xls)
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              Cetak / Simpan PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup pratinjau dokumen"
              className="p-2 rounded-lg bg-[#151F32] hover:bg-[#25334A] text-[#94A3B8] hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Document Sheet */}
        <div className="p-8 bg-white text-slate-900 max-h-[78vh] overflow-y-auto print:max-h-none print:p-0">
          {/* Official Letterhead */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b-2 border-slate-900">
            <div>
              <div className="text-xs font-mono font-semibold tracking-wider text-blue-700">
                SISTEM MANAJEMEN INVENTARIS GUDANG UTAMA (WMS)
              </div>
              <h1 className="text-xl font-extrabold tracking-tight text-slate-900 mt-0.5">
                {settings.companyName}
              </h1>
              <p className="text-sm font-semibold text-slate-700">
                {settings.warehouseName} — {settings.locationAddress}
              </p>
            </div>
            <div className="text-left sm:text-right font-mono text-xs text-slate-600 space-y-0.5">
              {report.documentNumber && (
                <div className="font-bold text-slate-900">
                  No. Dokumen: {report.documentNumber}
                </div>
              )}
              <div>Tanggal Cetak: {settings.referenceDate}</div>
              <div>Dicetak Oleh: {currentUser?.fullName || 'Administrator'}</div>
              <div>
                Mode Data:{' '}
                {settings.dataMode === 'DEMO'
                  ? 'DATA SIMULASI (DEMO)'
                  : 'DATA OPERASIONAL'}
              </div>
            </div>
          </div>

          {/* Document Title & Summary */}
          <div className="my-5">
            <h2 className="text-lg font-bold text-slate-900">{report.title}</h2>
            <p className="text-xs text-slate-600 mt-0.5">{report.subtitle}</p>

            {report.summaryItems && report.summaryItems.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 p-3.5 rounded-lg bg-slate-100 border border-slate-200">
                {report.summaryItems.map((s, i) => (
                  <div key={i}>
                    <div className="text-[11px] text-slate-500">{s.label}</div>
                    <div className="text-sm font-bold font-mono text-slate-900 mt-0.5">
                      {s.value}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Data Table */}
          <div className="overflow-x-auto border border-slate-300 rounded-lg">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-900 text-white">
                  {report.headers.map((h, i) => (
                    <th
                      key={i}
                      className="py-2.5 px-3 font-semibold border-r border-slate-700 last:border-r-0 whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {report.rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={report.headers.length}
                      className="py-8 text-center text-slate-500"
                    >
                      Tidak ada rincian data untuk ditampilkan.
                    </td>
                  </tr>
                ) : (
                  report.rows.map((row, rIdx) => (
                    <tr
                      key={rIdx}
                      className={rIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}
                    >
                      {row.map((cell, cIdx) => (
                        <td
                          key={cIdx}
                          className="py-2 px-3 border-r border-slate-200 last:border-r-0 font-mono text-slate-800"
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

          {/* Signatures */}
          <div className="grid grid-cols-3 gap-6 mt-10 pt-4 text-center text-xs text-slate-700">
            {(
              report.signatures || [
                { role: 'Dibuat Oleh (Storekeeper / Admin)', name: currentUser?.fullName || 'Petugas Gudang' },
                { role: 'Diperiksa Oleh (Kepala Gudang)', name: 'Budi Santoso, S.T.' },
                { role: 'Disetujui Oleh (Management)', name: 'Drs. Bambang Suryono, M.M.' },
              ]
            ).map((sig, idx) => (
              <div key={idx} className="flex flex-col items-center">
                <div className="font-medium text-slate-600">{sig.role}</div>
                <div className="h-16" />
                <div className="font-bold text-slate-900 border-t border-slate-400 pt-1 px-6">
                  {sig.name}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
