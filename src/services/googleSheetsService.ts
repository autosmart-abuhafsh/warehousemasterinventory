import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  MasterItem,
  StockInTransaction,
  StockOutTransaction,
  StockAdjustment,
  StockOpnameSession,
  Category,
  Supplier,
  StorageLocation,
  PurchaseOrder,
  RolePermission,
  UserAccount,
  LoginHistoryEntry,
  SystemNotification,
  AuditLogEntry,
  SystemSettings,
} from '../types/wms';

// Combined OAuth scopes configured for Google Drive & Google Sheets
export const SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/spreadsheets.readonly',
];

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
SCOPES.forEach((scope) => provider.addScope(scope));
provider.setCustomParameters({ prompt: 'consent' });

// Flag to indicate if we are in the middle of a sign-in flow.
let isSigningIn = false;
// Cache the access token in memory ONLY (never in localStorage or sessionStorage).
let cachedAccessToken: string | null = null;

export const initGoogleAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: (user: User | null) => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure(user);
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure(null);
    }
  });
};

export const googleSignIn = async (): Promise<{
  user: User;
  accessToken: string;
} | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Gagal mendapatkan access token Google Workspace dari sesi login.');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error) {
    console.error('Google Sign-In error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const googleLogout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
};

export interface DriveSpreadsheetFile {
  id: string;
  name: string;
  modifiedTime: string;
  webViewLink?: string;
}

export interface SpreadsheetMetadataInfo {
  spreadsheetId: string;
  title: string;
  spreadsheetUrl: string;
  sheetTitles: string[];
}

export interface WmsFullDatabasePayload {
  settings: SystemSettings;
  roles: RolePermission[];
  users: UserAccount[];
  loginHistory: LoginHistoryEntry[];
  categories: Category[];
  suppliers: Supplier[];
  locations: StorageLocation[];
  demoItems: MasterItem[];
  demoStockIn: StockInTransaction[];
  demoStockOut: StockOutTransaction[];
  demoAdjustments: StockAdjustment[];
  demoOpnameSessions: StockOpnameSession[];
  demoPurchaseOrders: PurchaseOrder[];
  operationalItems: MasterItem[];
  operationalStockIn: StockInTransaction[];
  operationalStockOut: StockOutTransaction[];
  operationalAdjustments: StockAdjustment[];
  operationalOpnameSessions: StockOpnameSession[];
  operationalPurchaseOrders: PurchaseOrder[];
  notifications: SystemNotification[];
  auditLogs: AuditLogEntry[];
}

const REQUIRED_TABS = [
  '1_Master_Items',
  '2_Stock_In',
  '3_Stock_Out',
  '4_Stock_Opname_Adj',
  '5_Purchase_Orders',
  '6_Suppliers_Categories_Locations',
  '7_Users_Roles_Audit',
  'WMS_RAW_DATABASE',
];

export function extractSpreadsheetId(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  return trimmed;
}

/**
 * Lists Google Spreadsheets from the user's Google Drive
 */
export async function listUserSpreadsheets(
  accessToken: string
): Promise<DriveSpreadsheetFile[]> {
  const query = encodeURIComponent(
    "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false"
  );
  const fields = encodeURIComponent(
    'files(id,name,modifiedTime,webViewLink)'
  );
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=${fields}&orderBy=modifiedTime desc&pageSize=25`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      err?.error?.message || `Gagal memuat daftar file Google Drive (${res.status}).`
    );
  }
  const data = await res.json();
  return Array.isArray(data.files) ? data.files : [];
}

/**
 * Fetches spreadsheet metadata first to inspect actual tab names (per sheets.md best practices)
 */
export async function getSpreadsheetMetadata(
  accessToken: string,
  spreadsheetId: string
): Promise<SpreadsheetMetadataInfo> {
  const cleanId = extractSpreadsheetId(spreadsheetId);
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}?includeGridData=false`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      err?.error?.message ||
        `Spreadsheet tidak ditemukan atau akses ditolak (${res.status}).`
    );
  }
  const data = await res.json();
  const sheetTitles: string[] = Array.isArray(data.sheets)
    ? data.sheets.map((s: { properties?: { title?: string } }) => s.properties?.title || '')
    : [];
  return {
    spreadsheetId: data.spreadsheetId || cleanId,
    title: data.properties?.title || 'Google Spreadsheet WMS',
    spreadsheetUrl:
      data.spreadsheetUrl ||
      `https://docs.google.com/spreadsheets/d/${cleanId}/edit`,
    sheetTitles,
  };
}

/**
 * Creates a brand-new Google Spreadsheet pre-configured with all 8 WMS database tabs
 */
export async function createWmsSpreadsheet(
  accessToken: string,
  customTitle?: string
): Promise<SpreadsheetMetadataInfo> {
  const title =
    customTitle?.trim() ||
    `Database WMS PT. Global Energi Lestari - Warehouse Jatirejo (${new Date()
      .toISOString()
      .slice(0, 10)})`;

  const body = {
    properties: {
      title,
      locale: 'id_ID',
    },
    sheets: REQUIRED_TABS.map((tabName, idx) => ({
      properties: {
        title: tabName,
        index: idx,
        gridProperties: {
          rowCount: 1000,
          columnCount: 26,
          frozenRowCount: 1,
        },
      },
    })),
  };

  const res = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      err?.error?.message || `Gagal membuat Google Spreadsheet baru (${res.status}).`
    );
  }

  const data = await res.json();
  return {
    spreadsheetId: data.spreadsheetId,
    title: data.properties?.title || title,
    spreadsheetUrl:
      data.spreadsheetUrl ||
      `https://docs.google.com/spreadsheets/d/${data.spreadsheetId}/edit`,
    sheetTitles: REQUIRED_TABS,
  };
}

/**
 * Deletes a spreadsheet file from Google Drive (requires explicit user confirmation beforehand)
 */
export async function deleteDriveSpreadsheet(
  accessToken: string,
  fileId: string
): Promise<void> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  if (!res.ok && res.status !== 204) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      err?.error?.message || `Gagal menghapus file dari Google Drive (${res.status}).`
    );
  }
}

/**
 * Ensures all required WMS worksheet tabs exist in the target spreadsheet
 */
async function ensureWorksheetTabsExist(
  accessToken: string,
  spreadsheetId: string
): Promise<SpreadsheetMetadataInfo> {
  const meta = await getSpreadsheetMetadata(accessToken, spreadsheetId);
  const missingTabs = REQUIRED_TABS.filter(
    (reqTab) => !meta.sheetTitles.includes(reqTab)
  );

  if (missingTabs.length > 0) {
    const requests = missingTabs.map((tabName) => ({
      addSheet: {
        properties: {
          title: tabName,
          gridProperties: {
            rowCount: 1000,
            columnCount: 26,
            frozenRowCount: 1,
          },
        },
      },
    }));

    const batchRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${meta.spreadsheetId}:batchUpdate`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ requests }),
      }
    );

    if (!batchRes.ok) {
      const err = await batchRes.json().catch(() => ({}));
      throw new Error(
        err?.error?.message ||
          `Gagal membuat tab worksheet pada Google Sheets (${batchRes.status}).`
      );
    }
  }

  return getSpreadsheetMetadata(accessToken, spreadsheetId);
}

/**
 * Pushes the entire WMS client database (Master Items, Stock In, Stock Out, Opname, PO,
 * Suppliers, Categories, Locations, Users, Roles, Audit Logs, and Full State JSON)
 * to the connected Google Spreadsheet.
 */
export async function pushEntireDatabaseToSheets(
  accessToken: string,
  spreadsheetId: string,
  db: WmsFullDatabasePayload
): Promise<{
  spreadsheetTitle: string;
  spreadsheetUrl: string;
  totalRowsWritten: number;
  syncedAt: string;
}> {
  const meta = await ensureWorksheetTabsExist(accessToken, spreadsheetId);
  const cleanId = meta.spreadsheetId;

  const isDemo = db.settings.dataMode === 'DEMO';
  const activeItems = isDemo ? db.demoItems : db.operationalItems;
  const activeStockIn = isDemo ? db.demoStockIn : db.operationalStockIn;
  const activeStockOut = isDemo ? db.demoStockOut : db.operationalStockOut;
  const activeAdjustments = isDemo ? db.demoAdjustments : db.operationalAdjustments;
  const activeOpname = isDemo ? db.demoOpnameSessions : db.operationalOpnameSessions;
  const activePOs = isDemo ? db.demoPurchaseOrders : db.operationalPurchaseOrders;

  // 1. Master Items Tab
  const masterRows: (string | number)[][] = [
    [
      'ID Barang',
      'Part Number',
      'Nama Barang',
      'Kategori',
      'Spesifikasi',
      'Deskripsi',
      'Satuan (UOM)',
      'Harga Satuan (Rp)',
      'Stok Awal',
      'Stok Saat Ini',
      'Nilai Total Stok (Rp)',
      'Min Stock (ROP)',
      'Max Stock',
      'Target Stock',
      'Kode Lokasi Rak',
      'Supplier Utama',
      'Barang Kritikal',
      'Status Aktif',
      'Mode Data',
      'Terakhir Diperbarui',
    ],
    ...activeItems.map((item) => [
      item.id,
      item.partNumber,
      item.name,
      item.categoryName,
      item.specification,
      item.description,
      item.unit,
      item.unitPrice,
      item.initialStock,
      item.currentStock,
      item.currentStock * item.unitPrice,
      item.minStock,
      item.maxStock ?? '',
      item.targetStock ?? '',
      item.locationCode,
      item.supplierName,
      item.isCritical ? 'YA (KRITIKAL)' : 'TIDAK',
      item.status,
      db.settings.dataMode,
      item.updatedAt,
    ]),
  ];

  // 2. Stock In Tab
  const stockInRows: (string | number)[][] = [
    [
      'ID Transaksi',
      'No. Transaksi',
      'Tanggal Masuk',
      'Part Number',
      'Nama Barang',
      'Kategori',
      'Jumlah Masuk',
      'Satuan',
      'Harga Satuan (Rp)',
      'Total Nilai (Rp)',
      'Supplier',
      'No. PO / Surat Jalan',
      'Diterima Oleh',
      'Catatan',
      'Status',
      'Waktu Input',
    ],
    ...activeStockIn.map((t) => [
      t.id,
      t.transactionNumber,
      t.date,
      t.partNumber,
      t.itemName,
      t.categoryName,
      t.quantity,
      t.unit,
      t.unitPrice,
      t.totalValue,
      t.supplierName,
      t.referenceDoc,
      t.receivedBy,
      t.notes,
      t.status,
      t.createdAt,
    ]),
  ];

  // 3. Stock Out Tab
  const stockOutRows: (string | number)[][] = [
    [
      'ID Transaksi',
      'No. Transaksi',
      'Tanggal Keluar',
      'Part Number',
      'Nama Barang',
      'Kategori',
      'Jumlah Keluar',
      'Satuan',
      'Harga Satuan (Rp)',
      'Total Nilai (Rp)',
      'Keperluan Pemakaian',
      'Unit Alat Berat / Armada / Dept',
      'Nama Penerima / Mekanik',
      'Dikeluarkan Oleh',
      'Dokumen Referensi (WO/MR)',
      'Catatan',
      'Status',
      'Waktu Input',
    ],
    ...activeStockOut.map((t) => [
      t.id,
      t.transactionNumber,
      t.date,
      t.partNumber,
      t.itemName,
      t.categoryName,
      t.quantity,
      t.unit,
      t.unitPrice,
      t.totalValue,
      t.usagePurpose,
      t.unitFleetDept,
      t.recipientName,
      t.issuedBy,
      t.referenceDoc,
      t.notes,
      t.status,
      t.createdAt,
    ]),
  ];

  // 4. Stock Opname & Adjustments Tab
  const opnameAdjRows: (string | number)[][] = [
    [
      'Tipe Record',
      'Nomor Dokumen',
      'Tanggal',
      'Part Number / Area',
      'Nama Barang / Judul Sesi',
      'Stok Sistem',
      'Stok Fisik',
      'Selisih',
      'Status / Alasan',
      'Petugas / Disetujui Oleh',
    ],
    ...activeOpname.map((s) => [
      'SESI_OPNAME',
      s.opnameNumber,
      s.date,
      s.areaFilter,
      s.title,
      s.items.reduce((sum, i) => sum + i.systemStock, 0),
      s.items.reduce((sum, i) => sum + i.physicalStock, 0),
      s.items.reduce((sum, i) => sum + i.difference, 0),
      s.status,
      s.approvedBy || s.createdBy,
    ]),
    ...activeAdjustments.map((a) => [
      'STOCK_ADJUSTMENT',
      a.adjustmentNumber,
      a.date,
      a.partNumber,
      a.itemName,
      a.systemStockBefore,
      a.physicalStockAfter,
      a.difference,
      a.reason,
      a.approvedBy,
    ]),
  ];

  // 5. Purchase Orders Tab
  const poRows: (string | number)[][] = [
    [
      'ID PO',
      'Nomor PO',
      'Tanggal PO',
      'Estimasi Tiba',
      'Nama Supplier',
      'Status PO',
      'Total Nilai PO (Rp)',
      'Detail Item Dipesan',
      'Dibuat Oleh',
      'Disetujui Oleh',
      'Catatan',
    ],
    ...activePOs.map((po) => [
      po.id,
      po.poNumber,
      po.date,
      po.expectedDate,
      po.supplierName,
      po.status,
      po.totalAmount,
      po.items
        .map((i) => `${i.partNumber} (${i.quantityOrdered} ${i.unit})`)
        .join('; '),
      po.createdBy,
      po.approvedBy || '-',
      po.notes,
    ]),
  ];

  // 6. Suppliers, Categories & Locations Tab
  const auxRows: (string | number)[][] = [
    [
      'Entitas Master',
      'ID',
      'Kode',
      'Nama / Perusahaan',
      'Kontak / Area Gudang',
      'Telepon / Nomor Rak',
      'Email / Level Posisi',
      'Alamat / Deskripsi',
      'Status',
    ],
    ...db.suppliers.map((s) => [
      'SUPPLIER',
      s.id,
      s.code,
      s.companyName,
      s.contactName,
      s.phone,
      s.email,
      s.address,
      s.status,
    ]),
    ...db.categories.map((c) => [
      'KATEGORI',
      c.id,
      c.code,
      c.name,
      '-',
      '-',
      '-',
      c.description,
      c.status,
    ]),
    ...db.locations.map((l) => [
      'LOKASI_RAK',
      l.id,
      l.code,
      l.warehouseName,
      l.area,
      l.rack,
      l.levelPosition,
      l.notes,
      l.status,
    ]),
  ];

  // 7. Users, Roles & Audit Logs Tab
  const auditUserRows: (string | number)[][] = [
    [
      'Tipe Data',
      'Waktu / ID',
      'Username / Pengguna',
      'Role',
      'Aksi / Departemen',
      'Entitas / Email',
      'Nilai Sebelum',
      'Nilai Sesudah',
      'Keterangan / Login Terakhir',
    ],
    ...db.users.map((u) => [
      'USER_ACCOUNT',
      u.id,
      `${u.fullName} (@${u.username})`,
      u.roleId,
      u.department,
      u.email,
      '-',
      u.status,
      `Last Login: ${u.lastLogin}`,
    ]),
    ...db.auditLogs.map((log) => [
      'AUDIT_LOG',
      log.timestamp,
      log.userName,
      log.userRole,
      log.actionType,
      log.entityName,
      log.beforeValue,
      log.afterValue,
      log.notes,
    ]),
  ];

  // 8. Full Raw Database Snapshot Tab (split into safe 35,000-char cell chunks so Google Sheets 50k cell limit is never exceeded)
  const serializedJson = JSON.stringify(db);
  const chunkSize = 35000;
  const chunks: string[] = [];
  for (let i = 0; i < serializedJson.length; i += chunkSize) {
    chunks.push(serializedJson.slice(i, i + chunkSize));
  }
  const nowIso = new Date().toISOString();
  const rawDbRows: (string | number)[][] = [
    ['KEY', 'INDEX', 'UPDATED_AT', 'PAYLOAD_CHUNK'],
    [
      'WMS_META',
      0,
      nowIso,
      JSON.stringify({
        companyName: db.settings.companyName,
        warehouseName: db.settings.warehouseName,
        dataMode: db.settings.dataMode,
        totalChunks: chunks.length,
        syncedAt: nowIso,
      }),
    ],
    ...chunks.map((chunk, idx) => ['WMS_STATE_CHUNK', idx + 1, nowIso, chunk]),
  ];

  // First clear all 8 tabs so stale trailing rows from previous larger datasets don't remain
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}/values:batchClear`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ranges: REQUIRED_TABS.map((t) => `'${t}'!A1:Z2000`),
      }),
    }
  );

  // Batch write all 8 tabs
  const batchUpdateBody = {
    valueInputOption: 'USER_ENTERED',
    data: [
      { range: `'1_Master_Items'!A1`, values: masterRows },
      { range: `'2_Stock_In'!A1`, values: stockInRows },
      { range: `'3_Stock_Out'!A1`, values: stockOutRows },
      { range: `'4_Stock_Opname_Adj'!A1`, values: opnameAdjRows },
      { range: `'5_Purchase_Orders'!A1`, values: poRows },
      { range: `'6_Suppliers_Categories_Locations'!A1`, values: auxRows },
      { range: `'7_Users_Roles_Audit'!A1`, values: auditUserRows },
      { range: `'WMS_RAW_DATABASE'!A1`, values: rawDbRows },
    ],
  };

  const writeRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}/values:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(batchUpdateBody),
    }
  );

  if (!writeRes.ok) {
    const err = await writeRes.json().catch(() => ({}));
    throw new Error(
      err?.error?.message ||
        `Gagal menyimpan data ke Google Sheets (${writeRes.status}).`
    );
  }

  const totalRowsWritten =
    masterRows.length +
    stockInRows.length +
    stockOutRows.length +
    opnameAdjRows.length +
    poRows.length +
    auxRows.length +
    auditUserRows.length;

  return {
    spreadsheetTitle: meta.title,
    spreadsheetUrl: meta.spreadsheetUrl,
    totalRowsWritten,
    syncedAt: nowIso,
  };
}

/**
 * Pulls and reconstructs the entire WMS database from the connected Google Spreadsheet.
 * Reads `WMS_RAW_DATABASE` first for 100% state fidelity, and also merges any direct edits
 * made in `1_Master_Items` tab if present!
 */
export async function pullDatabaseFromSheets(
  accessToken: string,
  spreadsheetId: string
): Promise<{
  db: WmsFullDatabasePayload;
  spreadsheetTitle: string;
  syncedAt: string;
}> {
  const meta = await getSpreadsheetMetadata(accessToken, spreadsheetId);
  const cleanId = meta.spreadsheetId;

  if (!meta.sheetTitles.includes('WMS_RAW_DATABASE')) {
    throw new Error(
      `Spreadsheet "${meta.title}" belum memiliki tab database WMS (WMS_RAW_DATABASE). Silakan klik "Simpan / Push Seluruh Data ke Google Sheets" terlebih dahulu untuk menginisialisasi struktur tabel.`
    );
  }

  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}/values/'WMS_RAW_DATABASE'!A1:D500`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      err?.error?.message ||
        `Gagal membaca data dari Google Sheets (${res.status}).`
    );
  }

  const data = await res.json();
  const rows: string[][] = Array.isArray(data.values) ? data.values : [];
  const chunkRows = rows
    .filter((r) => r[0] === 'WMS_STATE_CHUNK')
    .sort((a, b) => Number(a[1]) - Number(b[1]));

  if (chunkRows.length === 0) {
    throw new Error(
      'Data snapshot pada tab WMS_RAW_DATABASE kosong. Silakan lakukan Push / Simpan data ke Google Sheets terlebih dahulu.'
    );
  }

  const fullJsonStr = chunkRows.map((r) => r[3] || '').join('');
  const parsedDb = JSON.parse(fullJsonStr) as WmsFullDatabasePayload;
  const syncedAt = chunkRows[0]?.[2] || new Date().toISOString();

  // Also check if user edited Master Items directly in `1_Master_Items` tab
  if (meta.sheetTitles.includes('1_Master_Items')) {
    try {
      const itemsRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}/values/'1_Master_Items'!A2:T1000`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      if (itemsRes.ok) {
        const itemsData = await itemsRes.json();
        const itemRows: string[][] = Array.isArray(itemsData.values)
          ? itemsData.values
          : [];
        if (itemRows.length > 0) {
          const isDemo = parsedDb.settings.dataMode === 'DEMO';
          const targetList = isDemo
            ? parsedDb.demoItems
            : parsedDb.operationalItems;
          const updatedMap = new Map<string, Partial<MasterItem>>();
          itemRows.forEach((r) => {
            const id = (r[0] || '').trim();
            const partNumber = (r[1] || '').trim().toUpperCase();
            const name = (r[2] || '').trim();
            if (id && partNumber && name) {
              updatedMap.set(id, {
                partNumber,
                name,
                specification: r[4] ?? undefined,
                description: r[5] ?? undefined,
                unit: r[6] || 'PCS',
                unitPrice: Number(String(r[7] || '0').replace(/[^0-9.-]/g, '')) || 0,
                initialStock:
                  Number(String(r[8] || '0').replace(/[^0-9.-]/g, '')) || 0,
                minStock:
                  Number(String(r[11] || '0').replace(/[^0-9.-]/g, '')) || 0,
              });
            }
          });

          const mergedList = targetList.map((item) => {
            const sheetEdits = updatedMap.get(item.id);
            return sheetEdits ? { ...item, ...sheetEdits } : item;
          });

          if (isDemo) {
            parsedDb.demoItems = mergedList;
          } else {
            parsedDb.operationalItems = mergedList;
          }
        }
      }
    } catch {
      // Keep snapshot if sheet parsing fails
    }
  }

  return {
    db: parsedDb,
    spreadsheetTitle: meta.title,
    syncedAt,
  };
}
