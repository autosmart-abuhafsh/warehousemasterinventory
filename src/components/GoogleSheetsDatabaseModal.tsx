import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  CloudUpload,
  CloudDownload,
  Plus,
  ExternalLink,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Link2,
  X,
  LogOut,
  ShieldAlert,
  Database,
} from 'lucide-react';
import { useWms } from '../context/WmsContext';
import {
  listUserSpreadsheets,
  DriveSpreadsheetFile,
  getAccessToken,
} from '../services/googleSheetsService';

export const OfficialGoogleSignInButton: React.FC<{
  onClick: () => void;
  disabled?: boolean;
  label?: string;
}> = ({ onClick, disabled, label = 'Sign in with Google' }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="gsi-material-button inline-flex items-center gap-3 px-4 py-2.5 rounded-lg bg-white hover:bg-slate-100 text-slate-900 font-semibold text-xs border border-slate-300 shadow-sm transition-colors cursor-pointer disabled:opacity-50"
    >
      <div className="gsi-material-button-state" />
      <div className="gsi-material-button-content-wrapper flex items-center gap-2.5">
        <div className="gsi-material-button-icon w-4 h-4 shrink-0">
          <svg
            version="1.1"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 48 48"
            xmlnsXlink="http://www.w3.org/1999/xlink"
            style={{ display: 'block' }}
          >
            <path
              fill="#EA4335"
              d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
            />
            <path
              fill="#4285F4"
              d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
            />
            <path
              fill="#FBBC05"
              d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
            />
            <path
              fill="#34A853"
              d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
            />
            <path fill="none" d="M0 0h48v48H0z" />
          </svg>
        </div>
        <span className="gsi-material-button-contents">{label}</span>
        <span style={{ display: 'none' }}>{label}</span>
      </div>
    </button>
  );
};

interface PendingConfirmAction {
  type: 'CREATE_AND_PUSH' | 'PUSH_OVERWRITE' | 'PULL_RESTORE' | 'DELETE_DRIVE_FILE';
  title: string;
  description: string;
  affectedSummary: string[];
  confirmButtonLabel: string;
  isDanger?: boolean;
  payload?: {
    customTitle?: string;
    fileId?: string;
    fileName?: string;
  };
}

export const GoogleSheetsDatabasePanel: React.FC<{
  onCloseModal?: () => void;
}> = ({ onCloseModal }) => {
  const {
    settings,
    items,
    stockInList,
    stockOutList,
    adjustments,
    opnameSessions,
    purchaseOrders,
    suppliers,
    categories,
    locations,
    users,
    auditLogs,
    googleUserEmail,
    googleUserName,
    needsGoogleAuth,
    isGoogleSyncing,
    signInWithGoogleAccount,
    signOutGoogleAccount,
    createAndSyncGoogleSheet,
    linkExistingGoogleSheet,
    pushDatabaseToGoogleSheets,
    pullDatabaseFromGoogleSheets,
    deleteGoogleSpreadsheetFile,
  } = useWms();

  const [newSheetTitle, setNewSheetTitle] = useState(
    `Database WMS PT. Global Energi Lestari - Warehouse Jatirejo`
  );
  const [sheetUrlOrIdInput, setSheetUrlOrIdInput] = useState(
    settings.googleSpreadsheetId || ''
  );
  const [driveFiles, setDriveFiles] = useState<DriveSpreadsheetFile[]>([]);
  const [isLoadingDrive, setIsLoadingDrive] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'SUCCESS' | 'ERROR';
    message: string;
  } | null>(null);
  const [pendingConfirm, setPendingConfirm] =
    useState<PendingConfirmAction | null>(null);

  const fetchDriveSpreadsheets = async () => {
    const token = await getAccessToken();
    if (!token) return;
    setIsLoadingDrive(true);
    try {
      const files = await listUserSpreadsheets(token);
      setDriveFiles(files);
    } catch (err: any) {
      setFeedback({
        type: 'ERROR',
        message: err?.message || 'Gagal memuat daftar file dari Google Drive.',
      });
    } finally {
      setIsLoadingDrive(false);
    }
  };

  useEffect(() => {
    if (!needsGoogleAuth) {
      fetchDriveSpreadsheets();
    } else {
      setDriveFiles([]);
    }
  }, [needsGoogleAuth]);

  useEffect(() => {
    if (settings.googleSpreadsheetId) {
      setSheetUrlOrIdInput(settings.googleSpreadsheetId);
    }
  }, [settings.googleSpreadsheetId]);

  const handleSignIn = async () => {
    setFeedback(null);
    const res = await signInWithGoogleAccount();
    if (res.success) {
      setFeedback({
        type: 'SUCCESS',
        message:
          'Berhasil terhubung ke akun Google Workspace! Anda kini dapat menyimpan & menyinkronkan seluruh database ke Google Sheets.',
      });
    } else if (res.error) {
      setFeedback({ type: 'ERROR', message: res.error });
    }
  };

  const handleLinkExisting = async (idOrUrl: string) => {
    if (!idOrUrl.trim()) {
      setFeedback({
        type: 'ERROR',
        message: 'Masukkan URL atau Spreadsheet ID terlebih dahulu.',
      });
      return;
    }
    setFeedback(null);
    const res = await linkExistingGoogleSheet(idOrUrl);
    if (res.success) {
      setFeedback({
        type: 'SUCCESS',
        message: `Berhasil terhubung ke Spreadsheet: "${res.title}". Klik "Simpan / Push Seluruh Data" untuk menyinkronkan database.`,
      });
    } else {
      setFeedback({
        type: 'ERROR',
        message: res.error || 'Gagal menghubungkan Spreadsheet.',
      });
    }
  };

  // Trigger confirmation modal before mutating user data in Google Sheets / Drive
  const requestCreateAndSync = () => {
    setPendingConfirm({
      type: 'CREATE_AND_PUSH',
      title: 'Konfirmasi Pembuatan & Pengisian File Google Sheets Baru',
      description: `Aplikasi akan membuat file Google Spreadsheet baru bernama "${newSheetTitle}" di Google Drive Anda dan menuliskan seluruh data sistem WMS ke dalam 8 tab worksheet.`,
      affectedSummary: [
        `${items.length} Master Item (${settings.dataMode})`,
        `${stockInList.length} Transaksi Stock In & ${stockOutList.length} Transaksi Stock Out`,
        `${opnameSessions.length} Sesi Stock Opname & ${adjustments.length} Stock Adjustment`,
        `${purchaseOrders.length} Purchase Order, ${suppliers.length} Supplier, ${categories.length} Kategori, ${locations.length} Lokasi Rak`,
        `${users.length} Akun Pengguna & ${auditLogs.length} Riwayat Audit Log`,
      ],
      confirmButtonLabel: 'Ya, Buat & Simpan ke Google Sheets',
      payload: { customTitle: newSheetTitle },
    });
  };

  const requestPushOverwrite = () => {
    if (!settings.googleSpreadsheetId) {
      setFeedback({
        type: 'ERROR',
        message: 'Pilih atau buat file Google Spreadsheet terlebih dahulu.',
      });
      return;
    }
    setPendingConfirm({
      type: 'PUSH_OVERWRITE',
      title: 'Konfirmasi Update / Timpa Data pada Google Sheets',
      description: `Anda akan memperbarui dan menimpa isi 8 tab worksheet pada file Google Spreadsheet "${
        settings.googleSpreadsheetTitle || settings.googleSpreadsheetId
      }" dengan data aplikasi terbaru saat ini.`,
      affectedSummary: [
        `Target File: ${settings.googleSpreadsheetTitle || settings.googleSpreadsheetId}`,
        `${items.length} Master Item (Total Stok Fisik: ${items.reduce(
          (s, i) => s + i.currentStock,
          0
        )} unit)`,
        `${stockInList.length} Transaksi Barang Masuk & ${stockOutList.length} Transaksi Barang Keluar`,
        `${purchaseOrders.length} Purchase Order & ${opnameSessions.length} Sesi Stock Opname`,
        `${suppliers.length} Supplier, ${categories.length} Kategori, ${locations.length} Lokasi, & ${auditLogs.length} Audit Log`,
      ],
      confirmButtonLabel: 'Konfirmasi & Update Google Sheets',
    });
  };

  const requestPullRestore = () => {
    if (!settings.googleSpreadsheetId) {
      setFeedback({
        type: 'ERROR',
        message: 'Pilih atau hubungkan Google Spreadsheet terlebih dahulu.',
      });
      return;
    }
    setPendingConfirm({
      type: 'PULL_RESTORE',
      title: 'Konfirmasi Muat Database dari Google Sheets',
      description: `Data di dalam aplikasi saat ini akan digantikan dengan data dari Google Spreadsheet "${
        settings.googleSpreadsheetTitle || settings.googleSpreadsheetId
      }".`,
      affectedSummary: [
        `Sumber Data: ${settings.googleSpreadsheetTitle || settings.googleSpreadsheetId}`,
        'Seluruh Master Item, Stock In, Stock Out, Opname, PO, Supplier, Kategori, Pengguna, & Audit Log akan disinkronkan dari Google Sheets.',
      ],
      confirmButtonLabel: 'Ya, Muat Data dari Google Sheets',
    });
  };

  const requestDeleteDriveFile = (fileId: string, fileName: string) => {
    setPendingConfirm({
      type: 'DELETE_DRIVE_FILE',
      title: 'Konfirmasi Hapus File Spreadsheet dari Google Drive',
      description: `Apakah Anda yakin ingin menghapus permanen file "${fileName}" dari Google Drive Anda? Tindakan ini tidak dapat dibatalkan.`,
      affectedSummary: [
        `Nama File: ${fileName}`,
        `Google Drive File ID: ${fileId}`,
      ],
      confirmButtonLabel: 'Hapus Permanen dari Google Drive',
      isDanger: true,
      payload: { fileId, fileName },
    });
  };

  const executeConfirmedAction = async () => {
    if (!pendingConfirm) return;
    const action = pendingConfirm;
    setPendingConfirm(null);
    setFeedback(null);

    if (action.type === 'CREATE_AND_PUSH') {
      const res = await createAndSyncGoogleSheet(action.payload?.customTitle);
      if (res.success) {
        setFeedback({
          type: 'SUCCESS',
          message:
            'Database Google Spreadsheet baru berhasil dibuat dan seluruh data WMS telah tersimpan!',
        });
        fetchDriveSpreadsheets();
      } else {
        setFeedback({
          type: 'ERROR',
          message: res.error || 'Gagal membuat Google Spreadsheet.',
        });
      }
    } else if (action.type === 'PUSH_OVERWRITE') {
      const res = await pushDatabaseToGoogleSheets();
      if (res.success) {
        setFeedback({
          type: 'SUCCESS',
          message: `Sinkronisasi berhasil! Sebanyak ${res.totalRows} baris data keseluruhan WMS telah disimpan ke Google Sheets.`,
        });
        fetchDriveSpreadsheets();
      } else {
        setFeedback({
          type: 'ERROR',
          message: res.error || 'Gagal menyimpan data ke Google Sheets.',
        });
      }
    } else if (action.type === 'PULL_RESTORE') {
      const res = await pullDatabaseFromGoogleSheets();
      if (res.success) {
        setFeedback({
          type: 'SUCCESS',
          message: `Berhasil memuat seluruh database WMS dari Google Spreadsheet "${res.title}"!`,
        });
      } else {
        setFeedback({
          type: 'ERROR',
          message: res.error || 'Gagal memuat database dari Google Sheets.',
        });
      }
    } else if (
      action.type === 'DELETE_DRIVE_FILE' &&
      action.payload?.fileId &&
      action.payload?.fileName
    ) {
      const res = await deleteGoogleSpreadsheetFile(
        action.payload.fileId,
        action.payload.fileName
      );
      if (res.success) {
        setFeedback({
          type: 'SUCCESS',
          message: `File "${action.payload.fileName}" berhasil dihapus dari Google Drive.`,
        });
        fetchDriveSpreadsheets();
      } else {
        setFeedback({
          type: 'ERROR',
          message: res.error || 'Gagal menghapus file dari Google Drive.',
        });
      }
    }
  };

  return (
    <div className="space-y-5 text-xs">
      {/* Header Banner */}
      <div className="p-5 rounded-xl bg-[#111C30] border border-[#25334A] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-[#10B981]/15 border border-[#10B981]/40 flex items-center justify-center text-[#10B981] shrink-0">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm sm:text-base font-bold text-white">
                Integrasi Database Google Sheets (Cloud Storage Keseluruhan Data Klien)
              </h3>
              <span
                className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded ${
                  !needsGoogleAuth
                    ? 'bg-[#10B981]/20 text-[#10B981]'
                    : 'bg-[#F59E0B]/20 text-[#F59E0B]'
                }`}
              >
                {!needsGoogleAuth ? 'GOOGLE TERHUBUNG' : 'BELUM LOGIN GOOGLE'}
              </span>
            </div>
            <p className="text-xs text-[#94A3B8] mt-1">
              Simpan dan sinkronkan seluruh data Master Item, Stock In, Stock Out, Stock Opname,
              Purchase Order, Supplier, Kategori, Lokasi, Pengguna, dan Audit Log ke dalam 8 tab
              Google Sheets.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {needsGoogleAuth ? (
            <OfficialGoogleSignInButton
              onClick={handleSignIn}
              disabled={isGoogleSyncing}
            />
          ) : (
            <div className="flex items-center gap-2.5 bg-[#0B1220] px-3.5 py-2 rounded-lg border border-[#25334A]">
              <div className="text-right">
                <div className="text-xs font-bold text-white">
                  {googleUserName || 'Google Workspace'}
                </div>
                <div className="text-[10px] font-mono text-[#10B981]">
                  {googleUserEmail}
                </div>
              </div>
              <button
                type="button"
                onClick={signOutGoogleAccount}
                title="Putuskan sesi Google"
                className="p-1.5 rounded bg-[#151F32] hover:bg-[#F43F5E]/20 text-[#94A3B8] hover:text-[#F43F5E] cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
          {onCloseModal && (
            <button
              type="button"
              onClick={onCloseModal}
              aria-label="Tutup modal Google Sheets"
              className="p-2 rounded-lg bg-[#0B1220] border border-[#25334A] text-[#94A3B8] hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Status / Error Feedback */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border flex items-start gap-2.5 ${
            feedback.type === 'SUCCESS'
              ? 'bg-[#10B981]/15 border-[#10B981]/40 text-[#10B981]'
              : 'bg-[#F43F5E]/15 border-[#F43F5E]/40 text-[#F43F5E]'
          }`}
        >
          {feedback.type === 'SUCCESS' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          )}
          <div className="flex-1 text-xs leading-relaxed">{feedback.message}</div>
        </div>
      )}

      {/* Ringkasan Struktur 8 Tab Worksheet yang Disimpan */}
      <div className="p-4 rounded-xl bg-[#0B1220] border border-[#25334A]">
        <div className="flex items-center justify-between mb-3">
          <span className="font-bold text-white flex items-center gap-2">
            <Database className="w-4 h-4 text-[#3B82F6]" />
            Cakupan Data Klien yang Disimpan ke Google Sheets (8 Tab Terstruktur):
          </span>
          <span className="font-mono text-[11px] text-[#94A3B8]">
            Mode Aktif: <strong className="text-white">{settings.dataMode}</strong>
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="p-2.5 rounded-lg bg-[#151F32] border border-[#25334A]">
            <div className="text-[10px] font-mono text-[#10B981]">1_Master_Items</div>
            <div className="text-sm font-bold text-white mt-0.5">{items.length} SKU</div>
          </div>
          <div className="p-2.5 rounded-lg bg-[#151F32] border border-[#25334A]">
            <div className="text-[10px] font-mono text-[#3B82F6]">2_Stock_In & 3_Stock_Out</div>
            <div className="text-sm font-bold text-white mt-0.5">
              {stockInList.length + stockOutList.length} Transaksi
            </div>
          </div>
          <div className="p-2.5 rounded-lg bg-[#151F32] border border-[#25334A]">
            <div className="text-[10px] font-mono text-[#F59E0B]">4_Opname & 5_PO</div>
            <div className="text-sm font-bold text-white mt-0.5">
              {opnameSessions.length} Opname · {purchaseOrders.length} PO
            </div>
          </div>
          <div className="p-2.5 rounded-lg bg-[#151F32] border border-[#25334A]">
            <div className="text-[10px] font-mono text-[#8B5CF6]">6_Master_Aux & 7_Audit</div>
            <div className="text-sm font-bold text-white mt-0.5">
              {suppliers.length} Sup · {auditLogs.length} Log
            </div>
          </div>
        </div>
      </div>

      {/* Active Connected Spreadsheet Banner */}
      <div className="p-5 rounded-xl bg-[#151F32] border border-[#25334A] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-mono text-[#94A3B8]">
              FILE SPREADSHEET DATABASE AKTIF:
            </div>
            {settings.googleSpreadsheetId ? (
              <div className="mt-1">
                <div className="text-sm font-bold text-white flex items-center gap-2 flex-wrap">
                  <span>
                    {settings.googleSpreadsheetTitle || 'Google Spreadsheet WMS'}
                  </span>
                  {settings.googleSpreadsheetUrl && (
                    <a
                      href={settings.googleSpreadsheetUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-mono text-[#3B82F6] hover:underline"
                    >
                      Buka di Google Sheets <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
                <div className="text-[11px] font-mono text-[#94A3B8] mt-0.5">
                  ID: {settings.googleSpreadsheetId} · Sinkronisasi Terakhir:{' '}
                  <span className="text-[#10B981]">
                    {settings.googleLastSyncAt || 'Belum pernah disinkronkan'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-sm font-semibold text-[#F59E0B] mt-1">
                Belum ada file Google Spreadsheet yang dihubungkan. Buat file baru atau pilih dari
                Google Drive di bawah.
              </div>
            )}
          </div>

          {/* Primary Sync Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              disabled={needsGoogleAuth || isGoogleSyncing || !settings.googleSpreadsheetId}
              onClick={requestPushOverwrite}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#10B981] hover:bg-[#059669] disabled:opacity-40 text-slate-950 font-bold cursor-pointer transition-colors"
            >
              <CloudUpload className="w-4 h-4" />
              {isGoogleSyncing
                ? 'Menyinkronkan...'
                : 'Simpan / Push Seluruh Data ke Sheets'}
            </button>
            <button
              type="button"
              disabled={needsGoogleAuth || isGoogleSyncing || !settings.googleSpreadsheetId}
              onClick={requestPullRestore}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] disabled:opacity-40 text-white font-semibold cursor-pointer transition-colors"
            >
              <CloudDownload className="w-4 h-4" />
              Muat / Pull Data dari Sheets
            </button>
          </div>
        </div>
      </div>

      {/* Create New or Link Existing Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Option A: Create New WMS Database Spreadsheet */}
        <div className="p-5 rounded-xl bg-[#151F32] border border-[#25334A] space-y-3">
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            <Plus className="w-4 h-4 text-[#10B981]" />
            1. Buat Spreadsheet Database Baru Otomatis
          </h4>
          <p className="text-[#94A3B8] leading-relaxed">
            Buat file Google Spreadsheet baru di Google Drive Anda dan langsung isi otomatis
            dengan seluruh data WMS (8 tab lengkap).
          </p>
          <div>
            <label className="block text-[#94A3B8] mb-1">
              Nama File Google Spreadsheet Baru
            </label>
            <input
              type="text"
              value={newSheetTitle}
              onChange={(e) => setNewSheetTitle(e.target.value)}
              placeholder="Nama Spreadsheet Database..."
              className="w-full px-3 py-2 rounded-lg bg-[#0B1220] border border-[#25334A] text-white"
            />
          </div>
          <button
            type="button"
            disabled={needsGoogleAuth || isGoogleSyncing}
            onClick={requestCreateAndSync}
            className="w-full py-2.5 px-4 rounded-lg bg-[#10B981] hover:bg-[#059669] disabled:opacity-40 text-slate-950 font-bold flex items-center justify-center gap-2 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Buat Database Baru & Simpan Semua Data
          </button>
        </div>

        {/* Option B: Link by URL / ID or Pick from Drive */}
        <div className="p-5 rounded-xl bg-[#151F32] border border-[#25334A] space-y-3">
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            <Link2 className="w-4 h-4 text-[#3B82F6]" />
            2. Hubungkan ke Spreadsheet yang Sudah Ada
          </h4>
          <p className="text-[#94A3B8] leading-relaxed">
            Masukkan URL atau ID Google Spreadsheet Anda, atau pilih langsung dari daftar file
            Google Drive di bawah.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={sheetUrlOrIdInput}
              onChange={(e) => setSheetUrlOrIdInput(e.target.value)}
              placeholder="Paste URL Google Sheets atau Spreadsheet ID..."
              className="flex-1 px-3 py-2 rounded-lg bg-[#0B1220] border border-[#25334A] font-mono text-white"
            />
            <button
              type="button"
              disabled={needsGoogleAuth || isGoogleSyncing}
              onClick={() => handleLinkExisting(sheetUrlOrIdInput)}
              className="px-4 py-2 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] disabled:opacity-40 text-white font-semibold cursor-pointer shrink-0"
            >
              Hubungkan
            </button>
          </div>

          {/* Google Drive File Browser */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-[#94A3B8]">
                File Spreadsheet di Google Drive Anda:
              </span>
              <button
                type="button"
                disabled={needsGoogleAuth || isLoadingDrive}
                onClick={fetchDriveSpreadsheets}
                className="inline-flex items-center gap-1 text-[11px] text-[#3B82F6] hover:underline disabled:opacity-40 cursor-pointer"
              >
                <RefreshCw
                  className={`w-3 h-3 ${isLoadingDrive ? 'animate-spin' : ''}`}
                />
                Refresh Drive
              </button>
            </div>

            {needsGoogleAuth ? (
              <div className="p-3 rounded-lg bg-[#0B1220] border border-[#25334A] text-[#94A3B8] text-center">
                Klik tombol <strong>Sign in with Google</strong> di kanan atas untuk melihat daftar
                Spreadsheet Anda.
              </div>
            ) : driveFiles.length === 0 ? (
              <div className="p-3 rounded-lg bg-[#0B1220] border border-[#25334A] text-[#94A3B8] text-center">
                {isLoadingDrive
                  ? 'Memuat daftar file dari Google Drive...'
                  : 'Belum ditemukan file Google Spreadsheet di Drive Anda.'}
              </div>
            ) : (
              <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                {driveFiles.map((f) => {
                  const isSelected = settings.googleSpreadsheetId === f.id;
                  return (
                    <div
                      key={f.id}
                      className={`p-2.5 rounded-lg border flex items-center justify-between gap-2 ${
                        isSelected
                          ? 'bg-[#3B82F6]/15 border-[#3B82F6]'
                          : 'bg-[#0B1220] border-[#25334A]'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-white truncate">
                          {f.name}
                        </div>
                        <div className="text-[10px] font-mono text-[#94A3B8] truncate">
                          ID: {f.id}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleLinkExisting(f.id)}
                          className={`px-2.5 py-1 rounded text-[11px] font-semibold cursor-pointer ${
                            isSelected
                              ? 'bg-[#10B981] text-slate-950'
                              : 'bg-[#151F32] border border-[#25334A] text-white hover:border-[#3B82F6]'
                          }`}
                        >
                          {isSelected ? 'Aktif' : 'Pilih'}
                        </button>
                        <button
                          type="button"
                          onClick={() => requestDeleteDriveFile(f.id, f.name)}
                          title="Hapus file dari Google Drive"
                          className="p-1.5 rounded bg-[#151F32] hover:bg-[#F43F5E]/20 text-[#94A3B8] hover:text-[#F43F5E] cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Explicit User Confirmation Dialog for Mutating / Destructive Operations (MANDATORY) */}
      {pendingConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="gsheets-confirm-title"
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
        >
          <div className="w-full max-w-lg rounded-2xl bg-[#151F32] border border-[#25334A] shadow-2xl overflow-hidden">
            <div className="p-5 bg-[#111C30] border-b border-[#25334A] flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                  pendingConfirm.isDanger
                    ? 'bg-[#F43F5E]/20 text-[#F43F5E]'
                    : 'bg-[#F59E0B]/20 text-[#F59E0B]'
                }`}
              >
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h4
                  id="gsheets-confirm-title"
                  className="text-sm font-bold text-white"
                >
                  {pendingConfirm.title}
                </h4>
                <p className="text-[11px] text-[#94A3B8]">
                  Konfirmasi Perubahan Data Google Workspace
                </p>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-xs text-[#F8FAFC] leading-relaxed">
                {pendingConfirm.description}
              </p>

              <div className="p-3.5 rounded-xl bg-[#0B1220] border border-[#25334A] space-y-1.5">
                <div className="text-[11px] font-bold text-[#94A3B8]">
                  Rincian Data yang Akan Terdampak:
                </div>
                <ul className="list-disc list-inside text-xs text-white space-y-1 font-mono">
                  {pendingConfirm.affectedSummary.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setPendingConfirm(null)}
                  className="px-4 py-2 rounded-lg bg-[#0B1220] border border-[#25334A] text-[#94A3B8] hover:text-white font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={executeConfirmedAction}
                  className={`px-4 py-2 rounded-lg font-bold cursor-pointer ${
                    pendingConfirm.isDanger
                      ? 'bg-[#F43F5E] hover:bg-[#E11D48] text-white'
                      : 'bg-[#10B981] hover:bg-[#059669] text-slate-950'
                  }`}
                >
                  {pendingConfirm.confirmButtonLabel}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const GoogleSheetsDatabaseModal: React.FC = () => {
  const { googleSyncModalOpen, setGoogleSyncModalOpen } = useWms();
  if (!googleSyncModalOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Database Google Sheets"
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="w-full max-w-4xl rounded-2xl bg-[#151F32] border border-[#25334A] shadow-2xl p-5 sm:p-6 my-8 max-h-[92vh] overflow-y-auto">
        <GoogleSheetsDatabasePanel
          onCloseModal={() => setGoogleSyncModalOpen(false)}
        />
      </div>
    </div>
  );
};
