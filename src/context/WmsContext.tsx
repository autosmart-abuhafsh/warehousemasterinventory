import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
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
  UserRoleId,
  NavMenuId,
  PeriodFilterType,
  POStatus,
  StockOpnameItem,
} from '../types/wms';
import {
  INITIAL_SETTINGS,
  INITIAL_ROLES,
  INITIAL_USERS,
  INITIAL_CATEGORIES,
  INITIAL_SUPPLIERS,
  INITIAL_LOCATIONS,
  DEMO_MASTER_ITEMS,
  DEMO_STOCK_IN,
  DEMO_STOCK_OUT,
  DEMO_ADJUSTMENTS,
  DEMO_OPNAME_SESSIONS,
  DEMO_PURCHASE_ORDERS,
  DEMO_NOTIFICATIONS,
  DEMO_AUDIT_LOGS,
  INITIAL_LOGIN_HISTORY,
} from '../data/seedData';
import {
  calculateItemCurrentStock,
  validateStockOutQuantity,
} from '../utils/inventoryLogic';
import {
  initGoogleAuth,
  googleSignIn,
  googleLogout,
  getAccessToken,
  createWmsSpreadsheet,
  pushEntireDatabaseToSheets,
  pullDatabaseFromSheets,
  getSpreadsheetMetadata,
  deleteDriveSpreadsheet,
} from '../services/googleSheetsService';

const STORAGE_KEY = 'gel_wms_jatirejo_state_v1';

interface WmsPersistedState {
  settings: SystemSettings;
  roles: RolePermission[];
  users: UserAccount[];
  loginHistory: LoginHistoryEntry[];
  categories: Category[];
  suppliers: Supplier[];
  locations: StorageLocation[];
  // Demo dataset
  demoItems: MasterItem[];
  demoStockIn: StockInTransaction[];
  demoStockOut: StockOutTransaction[];
  demoAdjustments: StockAdjustment[];
  demoOpnameSessions: StockOpnameSession[];
  demoPurchaseOrders: PurchaseOrder[];
  // Operational dataset (separated from Demo per PRD Section 21)
  operationalItems: MasterItem[];
  operationalStockIn: StockInTransaction[];
  operationalStockOut: StockOutTransaction[];
  operationalAdjustments: StockAdjustment[];
  operationalOpnameSessions: StockOpnameSession[];
  operationalPurchaseOrders: PurchaseOrder[];
  // Shared logs & notifications
  notifications: SystemNotification[];
  auditLogs: AuditLogEntry[];
}

export interface PrintableReportData {
  title: string;
  subtitle: string;
  documentNumber?: string;
  headers: string[];
  rows: (string | number)[][];
  summaryItems?: { label: string; value: string }[];
  signatures?: { role: string; name: string }[];
}

interface WmsContextValue {
  // Auth & Navigation
  currentUser: UserAccount | null;
  currentRole: RolePermission | null;
  activeMenu: NavMenuId;
  setActiveMenu: (menu: NavMenuId) => void;
  login: (username: string, password: string) => { success: boolean; error?: string };
  quickLoginAsRole: (roleId: UserRoleId) => void;
  logout: () => void;
  changePassword: (userId: string, newPassword: string) => void;

  // Period Filter
  periodFilter: PeriodFilterType;
  setPeriodFilter: (p: PeriodFilterType) => void;
  customStartDate: string;
  setCustomStartDate: (d: string) => void;
  customEndDate: string;
  setCustomEndDate: (d: string) => void;

  // Active dataset (Demo or Operational)
  settings: SystemSettings;
  updateSettings: (partial: Partial<SystemSettings>) => void;
  switchDataMode: (mode: 'DEMO' | 'OPERATIONAL', copyDemoToOperational?: boolean) => void;
  resetDemoData: () => void;

  items: MasterItem[];
  stockInList: StockInTransaction[];
  stockOutList: StockOutTransaction[];
  adjustments: StockAdjustment[];
  opnameSessions: StockOpnameSession[];
  purchaseOrders: PurchaseOrder[];
  categories: Category[];
  suppliers: Supplier[];
  locations: StorageLocation[];
  roles: RolePermission[];
  users: UserAccount[];
  loginHistory: LoginHistoryEntry[];
  notifications: SystemNotification[];
  auditLogs: AuditLogEntry[];

  // Master Item Actions
  addMasterItem: (
    item: Omit<MasterItem, 'id' | 'currentStock' | 'createdAt' | 'updatedAt'>
  ) => { success: boolean; error?: string };
  updateMasterItem: (
    id: string,
    updates: Partial<MasterItem>
  ) => { success: boolean; error?: string };
  toggleMasterItemStatus: (id: string) => void;
  importMasterItems: (imported: Partial<MasterItem>[]) => { added: number; skipped: number };

  // Stock In & Stock Out Actions
  recordStockIn: (
    data: Omit<
      StockInTransaction,
      'id' | 'transactionNumber' | 'totalValue' | 'status' | 'createdAt'
    >
  ) => { success: boolean; transaction?: StockInTransaction; error?: string };
  recordStockOut: (
    data: Omit<
      StockOutTransaction,
      'id' | 'transactionNumber' | 'totalValue' | 'status' | 'createdAt'
    >
  ) => { success: boolean; transaction?: StockOutTransaction; error?: string };

  // Stock Opname Actions
  createOpnameSession: (
    title: string,
    areaFilter: string,
    notes: string,
    opnameItems: StockOpnameItem[]
  ) => StockOpnameSession;
  approveOpnameSession: (opnameId: string) => { success: boolean; error?: string };
  rejectOpnameSession: (opnameId: string, reason: string) => void;

  // Purchase Order Actions
  createPurchaseOrder: (
    po: Omit<PurchaseOrder, 'id' | 'poNumber' | 'createdAt' | 'totalAmount'>
  ) => PurchaseOrder;
  updatePurchaseOrderStatus: (poId: string, status: POStatus) => void;

  // Category, Supplier, Location Actions
  saveCategory: (cat: Omit<Category, 'id'> & { id?: string }) => { success: boolean; error?: string };
  deleteCategory: (id: string) => { success: boolean; error?: string };
  saveSupplier: (sup: Omit<Supplier, 'id'> & { id?: string }) => void;
  toggleSupplierStatus: (id: string) => void;
  saveLocation: (loc: Omit<StorageLocation, 'id'> & { id?: string }) => void;

  // Users & Roles Actions
  saveUser: (usr: Omit<UserAccount, 'id' | 'lastLogin'> & { id?: string }) => {
    success: boolean;
    error?: string;
  };
  toggleUserStatus: (id: string) => void;
  updateRolePermissions: (roleId: UserRoleId, updated: Partial<RolePermission>) => void;

  // Notifications & Printable Modal
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  printableReport: PrintableReportData | null;
  setPrintableReport: (report: PrintableReportData | null) => void;
  exportDatabaseJson: () => void;
  importDatabaseJson: (jsonStr: string) => { success: boolean; error?: string };

  // Google Workspace & Google Sheets Database Integration
  googleUserEmail: string | null;
  googleUserName: string | null;
  googleAccessToken: string | null;
  needsGoogleAuth: boolean;
  isGoogleSyncing: boolean;
  googleSyncModalOpen: boolean;
  setGoogleSyncModalOpen: (open: boolean) => void;
  signInWithGoogleAccount: () => Promise<{ success: boolean; error?: string }>;
  signOutGoogleAccount: () => Promise<void>;
  createAndSyncGoogleSheet: (customTitle?: string) => Promise<{
    success: boolean;
    spreadsheetUrl?: string;
    error?: string;
  }>;
  linkExistingGoogleSheet: (spreadsheetIdOrUrl: string) => Promise<{
    success: boolean;
    title?: string;
    error?: string;
  }>;
  pushDatabaseToGoogleSheets: () => Promise<{
    success: boolean;
    totalRows?: number;
    error?: string;
  }>;
  pullDatabaseFromGoogleSheets: () => Promise<{
    success: boolean;
    title?: string;
    error?: string;
  }>;
  deleteGoogleSpreadsheetFile: (fileId: string, fileName: string) => Promise<{
    success: boolean;
    error?: string;
  }>;
}

const WmsContext = createContext<WmsContextValue | null>(null);

function syncItemsStock(
  rawItems: MasterItem[],
  stockIn: StockInTransaction[],
  stockOut: StockOutTransaction[],
  adjustments: StockAdjustment[]
): MasterItem[] {
  return rawItems.map((item) => {
    const itemIn = stockIn.filter((t) => t.itemId === item.id);
    const itemOut = stockOut.filter((t) => t.itemId === item.id);
    const itemAdj = adjustments.filter((a) => a.itemId === item.id);
    const computedStock = calculateItemCurrentStock(
      item.initialStock,
      itemIn,
      itemOut,
      itemAdj
    );
    return {
      ...item,
      currentStock: computedStock,
    };
  });
}

function buildInitialState(): WmsPersistedState {
  const syncedDemoItems = syncItemsStock(
    DEMO_MASTER_ITEMS,
    DEMO_STOCK_IN,
    DEMO_STOCK_OUT,
    DEMO_ADJUSTMENTS
  );
  return {
    settings: INITIAL_SETTINGS,
    roles: INITIAL_ROLES,
    users: INITIAL_USERS,
    loginHistory: INITIAL_LOGIN_HISTORY,
    categories: INITIAL_CATEGORIES,
    suppliers: INITIAL_SUPPLIERS,
    locations: INITIAL_LOCATIONS,
    demoItems: syncedDemoItems,
    demoStockIn: DEMO_STOCK_IN,
    demoStockOut: DEMO_STOCK_OUT,
    demoAdjustments: DEMO_ADJUSTMENTS,
    demoOpnameSessions: DEMO_OPNAME_SESSIONS,
    demoPurchaseOrders: DEMO_PURCHASE_ORDERS,
    operationalItems: [],
    operationalStockIn: [],
    operationalStockOut: [],
    operationalAdjustments: [],
    operationalOpnameSessions: [],
    operationalPurchaseOrders: [],
    notifications: DEMO_NOTIFICATIONS,
    auditLogs: DEMO_AUDIT_LOGS,
  };
}

export const WmsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<WmsPersistedState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as WmsPersistedState;
        if (parsed && parsed.settings && Array.isArray(parsed.demoItems)) {
          return {
            ...parsed,
            demoItems: syncItemsStock(
              parsed.demoItems,
              parsed.demoStockIn || [],
              parsed.demoStockOut || [],
              parsed.demoAdjustments || []
            ),
            operationalItems: syncItemsStock(
              parsed.operationalItems || [],
              parsed.operationalStockIn || [],
              parsed.operationalStockOut || [],
              parsed.operationalAdjustments || []
            ),
          };
        }
      }
    } catch {
      // Fallback to initial seed state
    }
    return buildInitialState();
  });

  // Persist to localStorage on every state update
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore quota errors
    }
  }, [state]);

  // Default to Super Admin logged in so the user immediately sees the integrated dashboard
  // OR allow logging out to test the full Login screen & RBAC accounts.
  const [currentUserId, setCurrentUserId] = useState<string | null>(() => {
    try {
      const savedUser = localStorage.getItem('gel_wms_current_user_id');
      if (savedUser === 'LOGGED_OUT') {
        const params = new URLSearchParams(window.location.search);
        if (params.get('autostart') === '1') return 'usr-1';
        return null;
      }
      return savedUser || 'usr-1';
    } catch {
      return 'usr-1';
    }
  });

  const [activeMenu, setActiveMenu] = useState<NavMenuId>('dashboard');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilterType>('ALL_TIME');
  const [customStartDate, setCustomStartDate] = useState<string>('2026-08-01');
  const [customEndDate, setCustomEndDate] = useState<string>('2026-11-08');
  const [printableReport, setPrintableReport] = useState<PrintableReportData | null>(null);

  // Google Workspace Auth & Sheets Sync state
  const [googleUserEmail, setGoogleUserEmail] = useState<string | null>(null);
  const [googleUserName, setGoogleUserName] = useState<string | null>(null);
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);
  const [needsGoogleAuth, setNeedsGoogleAuth] = useState<boolean>(true);
  const [isGoogleSyncing, setIsGoogleSyncing] = useState<boolean>(false);
  const [googleSyncModalOpen, setGoogleSyncModalOpen] = useState<boolean>(false);

  useEffect(() => {
    const unsubscribe = initGoogleAuth(
      (user, token) => {
        setGoogleUserEmail(user.email || null);
        setGoogleUserName(user.displayName || user.email || 'Google User');
        setGoogleAccessToken(token);
        setNeedsGoogleAuth(false);
      },
      (user) => {
        setGoogleUserEmail(user?.email || null);
        setGoogleUserName(user?.displayName || null);
        setGoogleAccessToken(null);
        setNeedsGoogleAuth(true);
      }
    );
    return () => unsubscribe();
  }, []);

  const currentUser = useMemo(
    () => state.users.find((u) => u.id === currentUserId) || null,
    [state.users, currentUserId]
  );

  const currentRole = useMemo(
    () =>
      currentUser
        ? state.roles.find((r) => r.roleId === currentUser.roleId) || null
        : null,
    [state.roles, currentUser]
  );

  const isDemo = state.settings.dataMode === 'DEMO';
  const items = isDemo ? state.demoItems : state.operationalItems;
  const stockInList = isDemo ? state.demoStockIn : state.operationalStockIn;
  const stockOutList = isDemo ? state.demoStockOut : state.operationalStockOut;
  const adjustments = isDemo ? state.demoAdjustments : state.operationalAdjustments;
  const opnameSessions = isDemo ? state.demoOpnameSessions : state.operationalOpnameSessions;
  const purchaseOrders = isDemo ? state.demoPurchaseOrders : state.operationalPurchaseOrders;

  const appendAudit = (
    actionType: AuditLogEntry['actionType'],
    entityName: string,
    beforeValue: string,
    afterValue: string,
    notes: string,
    prevLogs: AuditLogEntry[]
  ): AuditLogEntry[] => {
    const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const entry: AuditLogEntry = {
      id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: nowStr,
      userId: currentUser?.id || 'usr-1',
      userName: currentUser?.fullName || 'System Admin',
      userRole: currentUser?.roleId || 'SUPER_ADMIN',
      actionType,
      entityName,
      beforeValue,
      afterValue,
      notes,
    };
    return [entry, ...prevLogs];
  };

  const appendNotification = (
    notif: Omit<SystemNotification, 'id' | 'createdAt' | 'isRead'>,
    prevNotifs: SystemNotification[]
  ): SystemNotification[] => {
    const nowStr = new Date().toISOString().slice(0, 16).replace('T', ' ');
    const newNotif: SystemNotification = {
      ...notif,
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: nowStr,
      isRead: false,
    };
    return [newNotif, ...prevNotifs];
  };

  const login = (username: string, password: string): { success: boolean; error?: string } => {
    const trimmed = username.trim().toLowerCase();
    const user = state.users.find(
      (u) => u.username.toLowerCase() === trimmed && u.status === 'ACTIVE'
    );
    if (!user) {
      return {
        success: false,
        error: 'Username tidak ditemukan atau akun sedang dinonaktifkan.',
      };
    }
    if (user.passwordHash !== password) {
      return {
        success: false,
        error: 'Password yang Anda masukkan tidak sesuai.',
      };
    }

    const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ') + ' WIB';
    setCurrentUserId(user.id);
    localStorage.setItem('gel_wms_current_user_id', user.id);

    setState((prev) => ({
      ...prev,
      users: prev.users.map((u) =>
        u.id === user.id ? { ...u, lastLogin: nowStr } : u
      ),
      loginHistory: [
        {
          id: `lgh-${Date.now()}`,
          userId: user.id,
          username: user.username,
          fullName: user.fullName,
          roleId: user.roleId,
          timestamp: nowStr,
          ipAddress: '192.168.10.14',
          device: 'Web Browser Session – Warehouse Jatirejo',
        },
        ...prev.loginHistory,
      ],
    }));
    setActiveMenu('dashboard');
    return { success: true };
  };

  const quickLoginAsRole = (roleId: UserRoleId) => {
    const targetUser = state.users.find(
      (u) => u.roleId === roleId && u.status === 'ACTIVE'
    );
    if (!targetUser) return;
    const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ') + ' WIB';
    setCurrentUserId(targetUser.id);
    localStorage.setItem('gel_wms_current_user_id', targetUser.id);
    const roleObj = state.roles.find((r) => r.roleId === roleId);
    if (roleObj && !roleObj.allowedMenus.includes(activeMenu)) {
      setActiveMenu('dashboard');
    }
    setState((prev) => ({
      ...prev,
      users: prev.users.map((u) =>
        u.id === targetUser.id ? { ...u, lastLogin: nowStr } : u
      ),
    }));
  };

  const logout = () => {
    setCurrentUserId(null);
    localStorage.setItem('gel_wms_current_user_id', 'LOGGED_OUT');
  };

  const changePassword = (userId: string, newPassword: string) => {
    setState((prev) => ({
      ...prev,
      users: prev.users.map((u) =>
        u.id === userId ? { ...u, passwordHash: newPassword } : u
      ),
      auditLogs: appendAudit(
        'USER_CHANGE',
        `User ID: ${userId}`,
        'Password Lama',
        'Password Diperbarui',
        'Perubahan password akun pengguna.',
        prev.auditLogs
      ),
    }));
  };

  const updateSettings = (partial: Partial<SystemSettings>) => {
    setState((prev) => ({
      ...prev,
      settings: { ...prev.settings, ...partial },
      auditLogs: appendAudit(
        'SYSTEM_CONFIG',
        'Pengaturan Sistem Gudang',
        JSON.stringify( {
          fast: prev.settings.fastMovingDays,
          medium: prev.settings.mediumMovingDays,
          slow: prev.settings.slowMovingDays,
        }),
        JSON.stringify(partial),
        'Pembaruan parameter konfigurasi sistem.',
        prev.auditLogs
      ),
    }));
  };

  const switchDataMode = (
    mode: 'DEMO' | 'OPERATIONAL',
    copyDemoToOperational = false
  ) => {
    setState((prev) => {
      let nextOpItems = prev.operationalItems;
      let nextOpIn = prev.operationalStockIn;
      let nextOpOut = prev.operationalStockOut;
      let nextOpAdj = prev.operationalAdjustments;

      if (mode === 'OPERATIONAL' && copyDemoToOperational && nextOpItems.length === 0) {
        nextOpItems = prev.demoItems.map((i) => ({ ...i, isDemo: false }));
        nextOpIn = prev.demoStockIn.map((t) => ({ ...t, isDemo: false }));
        nextOpOut = prev.demoStockOut.map((t) => ({ ...t, isDemo: false }));
        nextOpAdj = prev.demoAdjustments.map((a) => ({ ...a, isDemo: false }));
      }

      return {
        ...prev,
        settings: { ...prev.settings, dataMode: mode },
        operationalItems: nextOpItems,
        operationalStockIn: nextOpIn,
        operationalStockOut: nextOpOut,
        operationalAdjustments: nextOpAdj,
        auditLogs: appendAudit(
          'SYSTEM_CONFIG',
          'Mode Data Sistem',
          prev.settings.dataMode,
          mode,
          `Beralih mode data ke ${mode === 'DEMO' ? 'Data Simulasi (Demo)' : 'Data Operasional Aktual'}.`,
          prev.auditLogs
        ),
      };
    });
  };

  const resetDemoData = () => {
    const fresh = buildInitialState();
    setState((prev) => ({
      ...fresh,
      users: prev.users,
      roles: prev.roles,
    }));
  };

  const addMasterItem = (
    newItemData: Omit<MasterItem, 'id' | 'currentStock' | 'createdAt' | 'updatedAt'>
  ): { success: boolean; error?: string } => {
    const partCode = newItemData.partNumber.trim().toUpperCase();
    if (!partCode || !newItemData.name.trim()) {
      return { success: false, error: 'Part Number dan Nama Barang wajib diisi.' };
    }
    const duplicate = items.some(
      (i) => i.partNumber.toUpperCase() === partCode
    );
    if (duplicate) {
      return {
        success: false,
        error: `Part Number "${partCode}" sudah terdaftar. Part Number harus unik!`,
      };
    }

    const today = state.settings.referenceDate;
    const created: MasterItem = {
      ...newItemData,
      id: `itm-${Date.now()}`,
      partNumber: partCode,
      currentStock: Math.max(0, newItemData.initialStock),
      createdAt: today,
      updatedAt: today,
      isDemo,
    };

    setState((prev) => {
      const targetKey = prev.settings.dataMode === 'DEMO' ? 'demoItems' : 'operationalItems';
      const nextList = [created, ...prev[targetKey]];
      let nextNotifs = prev.notifications;
      if (created.currentStock <= created.minStock) {
        nextNotifs = appendNotification(
          {
            type: created.isCritical ? 'CRITICAL_LOW' : 'LOW_STOCK',
            severity: created.isCritical ? 'CRITICAL' : 'WARNING',
            title: `Stok Awal Rendah: ${created.name}`,
            message: `Part ${created.partNumber} didaftarkan dengan stok ${created.currentStock} ${created.unit} (Minimum: ${created.minStock}).`,
            partNumber: created.partNumber,
          },
          nextNotifs
        );
      }

      return {
        ...prev,
        [targetKey]: nextList,
        notifications: nextNotifs,
        auditLogs: appendAudit(
          'ADD_ITEM',
          `${created.partNumber} – ${created.name}`,
          'Belum Terdaftar',
          `Stok Awal: ${created.initialStock} ${created.unit}, Harga: Rp${created.unitPrice.toLocaleString('id-ID')}`,
          'Penambahan data Master Item baru.',
          prev.auditLogs
        ),
      };
    });

    return { success: true };
  };

  const updateMasterItem = (
    id: string,
    updates: Partial<MasterItem>
  ): { success: boolean; error?: string } => {
    const existing = items.find((i) => i.id === id);
    if (!existing) {
      return { success: false, error: 'Barang tidak ditemukan.' };
    }
    if (updates.partNumber) {
      const norm = updates.partNumber.trim().toUpperCase();
      const dup = items.some(
        (i) => i.id !== id && i.partNumber.toUpperCase() === norm
      );
      if (dup) {
        return {
          success: false,
          error: `Part Number "${norm}" sudah digunakan oleh barang lain.`,
        };
      }
      updates.partNumber = norm;
    }

    setState((prev) => {
      const isDemoMode = prev.settings.dataMode === 'DEMO';
      const rawList = isDemoMode ? prev.demoItems : prev.operationalItems;
      const inList = isDemoMode ? prev.demoStockIn : prev.operationalStockIn;
      const outList = isDemoMode ? prev.demoStockOut : prev.operationalStockOut;
      const adjList = isDemoMode ? prev.demoAdjustments : prev.operationalAdjustments;

      const updatedRaw = rawList.map((item) =>
        item.id === id
          ? { ...item, ...updates, updatedAt: prev.settings.referenceDate }
          : item
      );
      const synced = syncItemsStock(updatedRaw, inList, outList, adjList);

      return {
        ...prev,
        [isDemoMode ? 'demoItems' : 'operationalItems']: synced,
        auditLogs: appendAudit(
          'EDIT_ITEM',
          `${existing.partNumber} – ${existing.name}`,
          `Harga: Rp${existing.unitPrice.toLocaleString('id-ID')}, Min: ${existing.minStock}, Target: ${existing.targetStock ?? '-'}`,
          `Harga: Rp${(updates.unitPrice ?? existing.unitPrice).toLocaleString('id-ID')}, Min: ${updates.minStock ?? existing.minStock}, Target: ${updates.targetStock ?? existing.targetStock ?? '-'}`,
          'Perubahan data pada Master Item.',
          prev.auditLogs
        ),
      };
    });

    return { success: true };
  };

  const toggleMasterItemStatus = (id: string) => {
    const existing = items.find((i) => i.id === id);
    if (!existing) return;
    const nextStatus = existing.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    updateMasterItem(id, { status: nextStatus });
  };

  const importMasterItems = (
    imported: Partial<MasterItem>[]
  ): { added: number; skipped: number } => {
    let added = 0;
    let skipped = 0;
    const existingCodes = new Set(items.map((i) => i.partNumber.toUpperCase()));
    const newItems: MasterItem[] = [];

    imported.forEach((row, idx) => {
      const code = (row.partNumber || '').trim().toUpperCase();
      const name = (row.name || '').trim();
      if (!code || !name || existingCodes.has(code)) {
        skipped++;
        return;
      }
      existingCodes.add(code);
      const initStock = Number(row.initialStock) || 0;
      newItems.push({
        id: `itm-imp-${Date.now()}-${idx}`,
        partNumber: code,
        name,
        categoryId: row.categoryId || state.categories[0]?.id || 'cat-hyd',
        categoryName: row.categoryName || state.categories[0]?.name || 'Hydraulic System',
        description: row.description || 'Imported via CSV/Excel',
        specification: row.specification || 'Standard OEM Spec',
        unit: row.unit || 'PCS',
        unitPrice: Number(row.unitPrice) || 100000,
        initialStock: initStock,
        currentStock: initStock,
        minStock: Number(row.minStock) || 5,
        maxStock: row.maxStock ? Number(row.maxStock) : 30,
        targetStock: row.targetStock ? Number(row.targetStock) : 20,
        locationId: row.locationId || state.locations[0]?.id || 'loc-1',
        locationCode: row.locationCode || state.locations[0]?.code || 'WHJ-A1-R01',
        supplierId: row.supplierId || state.suppliers[0]?.id || 'sup-1',
        supplierName: row.supplierName || state.suppliers[0]?.companyName || 'PT. Traktor Nusantara Perkasa',
        isCritical: Boolean(row.isCritical),
        status: 'ACTIVE',
        createdAt: state.settings.referenceDate,
        updatedAt: state.settings.referenceDate,
        isDemo,
      });
      added++;
    });

    if (newItems.length > 0) {
      setState((prev) => {
        const isDemoMode = prev.settings.dataMode === 'DEMO';
        const key = isDemoMode ? 'demoItems' : 'operationalItems';
        return {
          ...prev,
          [key]: [...newItems, ...prev[key]],
          auditLogs: appendAudit(
            'ADD_ITEM',
            `Import Excel (${added} Item)`,
            'Import Batch',
            `${added} Barang berhasil ditambahkan`,
            'Import masal Master Item dari file.',
            prev.auditLogs
          ),
        };
      });
    }

    return { added, skipped };
  };

  const recordStockIn = (
    data: Omit<
      StockInTransaction,
      'id' | 'transactionNumber' | 'totalValue' | 'status' | 'createdAt'
    >
  ): { success: boolean; transaction?: StockInTransaction; error?: string } => {
    if (data.quantity <= 0) {
      return { success: false, error: 'Jumlah penerimaan harus lebih dari 0.' };
    }
    const targetItem = items.find((i) => i.id === data.itemId);
    if (!targetItem) {
      return { success: false, error: 'Pilih barang yang valid.' };
    }

    const seq = String(stockInList.length + 1).padStart(3, '0');
    const ym = data.date.slice(0, 7).replace('-', '');
    const trxNumber = `SIN-${ym}-${seq}`;
    const totalValue = data.quantity * data.unitPrice;
    const nowStr = new Date().toISOString().slice(0, 16).replace('T', ' ');

    const newTrx: StockInTransaction = {
      ...data,
      id: `sin-${Date.now()}`,
      transactionNumber: trxNumber,
      totalValue,
      status: 'APPROVED',
      createdAt: nowStr,
      isDemo,
    };

    setState((prev) => {
      const isDemoMode = prev.settings.dataMode === 'DEMO';
      const nextIn = [newTrx, ...(isDemoMode ? prev.demoStockIn : prev.operationalStockIn)];
      const rawItems = (isDemoMode ? prev.demoItems : prev.operationalItems).map((i) =>
        i.id === targetItem.id
          ? { ...i, unitPrice: data.unitPrice, updatedAt: data.date }
          : i
      );
      const synced = syncItemsStock(
        rawItems,
        nextIn,
        isDemoMode ? prev.demoStockOut : prev.operationalStockOut,
        isDemoMode ? prev.demoAdjustments : prev.operationalAdjustments
      );
      const updatedItem = synced.find((i) => i.id === targetItem.id);

      return {
        ...prev,
        [isDemoMode ? 'demoStockIn' : 'operationalStockIn']: nextIn,
        [isDemoMode ? 'demoItems' : 'operationalItems']: synced,
        notifications: appendNotification(
          {
            type: 'STOCK_IN',
            severity: 'SUCCESS',
            title: `Stock In Berhasil (${trxNumber})`,
            message: `Diterima +${data.quantity} ${data.unit} ${data.itemName} dari ${data.supplierName}. Stok saat ini: ${updatedItem?.currentStock ?? 0} ${data.unit}.`,
            partNumber: data.partNumber,
          },
          prev.notifications
        ),
        auditLogs: appendAudit(
          'STOCK_IN',
          `${data.partNumber} (${data.itemName})`,
          `Stok: ${targetItem.currentStock} ${data.unit}`,
          `Stok: ${updatedItem?.currentStock ?? targetItem.currentStock + data.quantity} ${data.unit} (+${data.quantity})`,
          `Penerimaan ${trxNumber} – Dokumen: ${data.referenceDoc}`,
          prev.auditLogs
        ),
      };
    });

    return { success: true, transaction: newTrx };
  };

  const recordStockOut = (
    data: Omit<
      StockOutTransaction,
      'id' | 'transactionNumber' | 'totalValue' | 'status' | 'createdAt'
    >
  ): { success: boolean; transaction?: StockOutTransaction; error?: string } => {
    const targetItem = items.find((i) => i.id === data.itemId);
    if (!targetItem) {
      return { success: false, error: 'Pilih barang yang valid.' };
    }

    const validation = validateStockOutQuantity(
      targetItem.currentStock,
      data.quantity
    );
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const seq = String(stockOutList.length + 1).padStart(3, '0');
    const ym = data.date.slice(0, 7).replace('-', '');
    const trxNumber = `SOUT-${ym}-${seq}`;
    const totalValue = data.quantity * targetItem.unitPrice;
    const nowStr = new Date().toISOString().slice(0, 16).replace('T', ' ');

    const newTrx: StockOutTransaction = {
      ...data,
      id: `sout-${Date.now()}`,
      transactionNumber: trxNumber,
      unitPrice: targetItem.unitPrice,
      totalValue,
      status: 'APPROVED',
      createdAt: nowStr,
      isDemo,
    };

    setState((prev) => {
      const isDemoMode = prev.settings.dataMode === 'DEMO';
      const nextOut = [newTrx, ...(isDemoMode ? prev.demoStockOut : prev.operationalStockOut)];
      const rawItems = (isDemoMode ? prev.demoItems : prev.operationalItems).map((i) =>
        i.id === targetItem.id ? { ...i, updatedAt: data.date } : i
      );
      const synced = syncItemsStock(
        rawItems,
        isDemoMode ? prev.demoStockIn : prev.operationalStockIn,
        nextOut,
        isDemoMode ? prev.demoAdjustments : prev.operationalAdjustments
      );
      const updatedItem = synced.find((i) => i.id === targetItem.id)!;

      let nextNotifs = appendNotification(
        {
          type: 'STOCK_OUT',
          severity: 'INFO',
          title: `Stock Out Berhasil (${trxNumber})`,
          message: `Dikeluarkan -${data.quantity} ${data.unit} ${data.itemName} untuk ${data.unitFleetDept}. Sisa stok: ${updatedItem.currentStock} ${data.unit}.`,
          partNumber: data.partNumber,
        },
        prev.notifications
      );

      // Alert if stock reaches or drops below minStock
      if (updatedItem.currentStock === 0 && updatedItem.isCritical) {
        nextNotifs = appendNotification(
          {
            type: 'CRITICAL_EMPTY',
            severity: 'CRITICAL',
            title: `PERINGATAN DARURAT: Barang Kritikal HABIS (${updatedItem.partNumber})`,
            message: `${updatedItem.name} telah habis (0 ${updatedItem.unit}) pasca transaksi ${trxNumber}. Segera lakukan pengadaan ulang!`,
            partNumber: updatedItem.partNumber,
          },
          nextNotifs
        );
      } else if (updatedItem.currentStock <= updatedItem.minStock) {
        nextNotifs = appendNotification(
          {
            type: updatedItem.isCritical ? 'CRITICAL_LOW' : 'LOW_STOCK',
            severity: updatedItem.isCritical ? 'CRITICAL' : 'WARNING',
            title: `${updatedItem.isCritical ? 'Barang Kritikal' : 'Stok'} Mencapai Batas Minimum (${updatedItem.partNumber})`,
            message: `${updatedItem.name} tersisa ${updatedItem.currentStock} ${updatedItem.unit} (Minimum Stock: ${updatedItem.minStock} ${updatedItem.unit}).`,
            partNumber: updatedItem.partNumber,
          },
          nextNotifs
        );
      }

      return {
        ...prev,
        [isDemoMode ? 'demoStockOut' : 'operationalStockOut']: nextOut,
        [isDemoMode ? 'demoItems' : 'operationalItems']: synced,
        notifications: nextNotifs,
        auditLogs: appendAudit(
          'STOCK_OUT',
          `${data.partNumber} (${data.itemName})`,
          `Stok: ${targetItem.currentStock} ${data.unit}`,
          `Stok: ${updatedItem.currentStock} ${data.unit} (-${data.quantity})`,
          `Pengeluaran ${trxNumber} ke ${data.unitFleetDept} (${data.recipientName})`,
          prev.auditLogs
        ),
      };
    });

    return { success: true, transaction: newTrx };
  };

  const createOpnameSession = (
    title: string,
    areaFilter: string,
    notes: string,
    opnameItems: StockOpnameItem[]
  ): StockOpnameSession => {
    const seq = String(opnameSessions.length + 1).padStart(3, '0');
    const opnameNumber = `OPN-202611-${seq}`;
    const nowStr = new Date().toISOString().slice(0, 16).replace('T', ' ');
    const session: StockOpnameSession = {
      id: `opn-${Date.now()}`,
      opnameNumber,
      date: state.settings.referenceDate,
      title,
      areaFilter,
      status: 'PENDING_APPROVAL',
      createdBy: currentUser?.fullName || 'Petugas Gudang',
      notes,
      items: opnameItems,
      createdAt: nowStr,
      isDemo,
    };

    setState((prev) => {
      const isDemoMode = prev.settings.dataMode === 'DEMO';
      const key = isDemoMode ? 'demoOpnameSessions' : 'operationalOpnameSessions';
      return {
        ...prev,
        [key]: [session, ...prev[key]],
        auditLogs: appendAudit(
          'STOCK_OPNAME',
          `${opnameNumber} – ${title}`,
          'Belum Ada Sesi',
          `Status: PENDING_APPROVAL (${opnameItems.length} item diperiksa)`,
          notes || 'Sesi Stock Opname dibuat dan menunggu persetujuan.',
          prev.auditLogs
        ),
      };
    });

    return session;
  };

  const approveOpnameSession = (
    opnameId: string
  ): { success: boolean; error?: string } => {
    if (!currentRole?.canApproveOpname) {
      return {
        success: false,
        error: 'Role Anda tidak memiliki kewenangan menyetujui penyesuaian Stock Opname.',
      };
    }

    const session = opnameSessions.find((s) => s.id === opnameId);
    if (!session || session.status !== 'PENDING_APPROVAL') {
      return { success: false, error: 'Sesi opname tidak valid atau sudah diproses.' };
    }

    const nowStr = new Date().toISOString().slice(0, 16).replace('T', ' ');
    const newAdjustments: StockAdjustment[] = session.items
      .filter((i) => i.difference !== 0)
      .map((i, idx) => ({
        id: `adj-${Date.now()}-${idx}`,
        adjustmentNumber: `ADJ-${session.opnameNumber}-${idx + 1}`,
        date: state.settings.referenceDate,
        itemId: i.itemId,
        partNumber: i.partNumber,
        itemName: i.itemName,
        systemStockBefore: i.systemStock,
        physicalStockAfter: i.physicalStock,
        difference: i.difference,
        reason: i.notes || `Penyesuaian hasil Stock Opname ${session.opnameNumber}`,
        opnameId: session.id,
        approvedBy: currentUser?.fullName || 'Super Admin',
        createdAt: nowStr,
        isDemo,
      }));

    setState((prev) => {
      const isDemoMode = prev.settings.dataMode === 'DEMO';
      const nextSessions = (
        isDemoMode ? prev.demoOpnameSessions : prev.operationalOpnameSessions
      ).map((s) =>
        s.id === opnameId
          ? {
              ...s,
              status: 'APPROVED' as const,
              approvedBy: currentUser?.fullName || 'Super Admin',
              approvedAt: nowStr,
            }
          : s
      );
      const nextAdj = [
        ...newAdjustments,
        ...(isDemoMode ? prev.demoAdjustments : prev.operationalAdjustments),
      ];
      const synced = syncItemsStock(
        isDemoMode ? prev.demoItems : prev.operationalItems,
        isDemoMode ? prev.demoStockIn : prev.operationalStockIn,
        isDemoMode ? prev.demoStockOut : prev.operationalStockOut,
        nextAdj
      );

      return {
        ...prev,
        [isDemoMode ? 'demoOpnameSessions' : 'operationalOpnameSessions']: nextSessions,
        [isDemoMode ? 'demoAdjustments' : 'operationalAdjustments']: nextAdj,
        [isDemoMode ? 'demoItems' : 'operationalItems']: synced,
        notifications: appendNotification(
          {
            type: 'OPNAME',
            severity: 'SUCCESS',
            title: `Stock Opname Disetujui (${session.opnameNumber})`,
            message: `${newAdjustments.length} item mengalami penyesuaian stok fisik oleh ${currentUser?.fullName}.`,
          },
          prev.notifications
        ),
        auditLogs: appendAudit(
          'STOCK_ADJUSTMENT',
          session.opnameNumber,
          'Status: PENDING_APPROVAL',
          `Status: APPROVED (${newAdjustments.length} penyesuaian stok diterapkan)`,
          `Disetujui oleh ${currentUser?.fullName}`,
          prev.auditLogs
        ),
      };
    });

    return { success: true };
  };

  const rejectOpnameSession = (opnameId: string, reason: string) => {
    setState((prev) => {
      const isDemoMode = prev.settings.dataMode === 'DEMO';
      const key = isDemoMode ? 'demoOpnameSessions' : 'operationalOpnameSessions';
      return {
        ...prev,
        [key]: prev[key].map((s) =>
          s.id === opnameId
            ? { ...s, status: 'REJECTED' as const, notes: `${s.notes} | Ditolak: ${reason}` }
            : s
        ),
        auditLogs: appendAudit(
          'STOCK_OPNAME',
          opnameId,
          'PENDING_APPROVAL',
          'REJECTED',
          `Penyesuaian Stock Opname ditolak: ${reason}`,
          prev.auditLogs
        ),
      };
    });
  };

  const createPurchaseOrder = (
    poData: Omit<PurchaseOrder, 'id' | 'poNumber' | 'createdAt' | 'totalAmount'>
  ): PurchaseOrder => {
    const seq = String(purchaseOrders.length + 1).padStart(3, '0');
    const poNumber = `PO-GEL-202611-${seq}`;
    const totalAmount = poData.items.reduce((sum, i) => sum + i.subtotal, 0);
    const nowStr = new Date().toISOString().slice(0, 16).replace('T', ' ');

    const newPo: PurchaseOrder = {
      ...poData,
      id: `po-${Date.now()}`,
      poNumber,
      totalAmount,
      createdAt: nowStr,
      isDemo,
    };

    setState((prev) => {
      const isDemoMode = prev.settings.dataMode === 'DEMO';
      const key = isDemoMode ? 'demoPurchaseOrders' : 'operationalPurchaseOrders';
      return {
        ...prev,
        [key]: [newPo, ...prev[key]],
        notifications: appendNotification(
          {
            type: 'REORDER_CREATED',
            severity: 'INFO',
            title: `Purchase Order Dibuat (${poNumber})`,
            message: `PO senilai Rp${totalAmount.toLocaleString('id-ID')} ke ${poData.supplierName} telah dibuat.`,
          },
          prev.notifications
        ),
        auditLogs: appendAudit(
          'PO_STATUS',
          `${poNumber} – ${poData.supplierName}`,
          'Draft Baru',
          `Status: ${poData.status} (Rp${totalAmount.toLocaleString('id-ID')})`,
          poData.notes || 'Pembuatan dokumen Purchase Order.',
          prev.auditLogs
        ),
      };
    });

    return newPo;
  };

  const updatePurchaseOrderStatus = (poId: string, status: POStatus) => {
    const existing = purchaseOrders.find((p) => p.id === poId);
    if (!existing) return;

    setState((prev) => {
      const isDemoMode = prev.settings.dataMode === 'DEMO';
      const key = isDemoMode ? 'demoPurchaseOrders' : 'operationalPurchaseOrders';
      return {
        ...prev,
        [key]: prev[key].map((p) =>
          p.id === poId
            ? {
                ...p,
                status,
                approvedBy:
                  status === 'APPROVED' || status === 'ORDERED'
                    ? currentUser?.fullName || p.approvedBy
                    : p.approvedBy,
              }
            : p
        ),
        auditLogs: appendAudit(
          'PO_STATUS',
          existing.poNumber,
          `Status: ${existing.status}`,
          `Status: ${status}`,
          `Perubahan status PO oleh ${currentUser?.fullName}. Catatan: PO tidak otomatis menambah stok sebelum transaksi Stock In.`,
          prev.auditLogs
        ),
      };
    });
  };

  const saveCategory = (
    cat: Omit<Category, 'id'> & { id?: string }
  ): { success: boolean; error?: string } => {
    if (!cat.name.trim() || !cat.code.trim()) {
      return { success: false, error: 'Kode dan Nama Kategori wajib diisi.' };
    }
    setState((prev) => {
      if (cat.id) {
        return {
          ...prev,
          categories: prev.categories.map((c) =>
            c.id === cat.id ? ({ ...cat, id: cat.id } as Category) : c
          ),
        };
      }
      const created: Category = { ...cat, id: `cat-${Date.now()}` };
      return { ...prev, categories: [...prev.categories, created] };
    });
    return { success: true };
  };

  const deleteCategory = (id: string): { success: boolean; error?: string } => {
    const usedCount = items.filter((i) => i.categoryId === id).length;
    if (usedCount > 0) {
      return {
        success: false,
        error: `Kategori tidak dapat dihapus karena sedang digunakan oleh ${usedCount} barang pada Master Item.`,
      };
    }
    setState((prev) => ({
      ...prev,
      categories: prev.categories.filter((c) => c.id !== id),
    }));
    return { success: true };
  };

  const saveSupplier = (sup: Omit<Supplier, 'id'> & { id?: string }) => {
    setState((prev) => {
      if (sup.id) {
        return {
          ...prev,
          suppliers: prev.suppliers.map((s) =>
            s.id === sup.id ? ({ ...sup, id: sup.id } as Supplier) : s
          ),
        };
      }
      return {
        ...prev,
        suppliers: [...prev.suppliers, { ...sup, id: `sup-${Date.now()}` }],
      };
    });
  };

  const toggleSupplierStatus = (id: string) => {
    setState((prev) => ({
      ...prev,
      suppliers: prev.suppliers.map((s) =>
        s.id === id
          ? { ...s, status: s.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' }
          : s
      ),
    }));
  };

  const saveLocation = (loc: Omit<StorageLocation, 'id'> & { id?: string }) => {
    setState((prev) => {
      if (loc.id) {
        return {
          ...prev,
          locations: prev.locations.map((l) =>
            l.id === loc.id ? ({ ...loc, id: loc.id } as StorageLocation) : l
          ),
        };
      }
      return {
        ...prev,
        locations: [...prev.locations, { ...loc, id: `loc-${Date.now()}` }],
      };
    });
  };

  const saveUser = (
    usr: Omit<UserAccount, 'id' | 'lastLogin'> & { id?: string }
  ): { success: boolean; error?: string } => {
    if (!usr.username.trim() || !usr.fullName.trim()) {
      return { success: false, error: 'Username dan Nama Lengkap wajib diisi.' };
    }
    const duplicate = state.users.some(
      (u) =>
        u.id !== usr.id &&
        u.username.toLowerCase() === usr.username.trim().toLowerCase()
    );
    if (duplicate) {
      return { success: false, error: 'Username sudah digunakan.' };
    }

    setState((prev) => {
      if (usr.id) {
        return {
          ...prev,
          users: prev.users.map((u) =>
            u.id === usr.id ? { ...u, ...usr, id: usr.id } : u
          ),
          auditLogs: appendAudit(
            'USER_CHANGE',
            usr.username,
            'Data Pengguna Lama',
            `Role: ${usr.roleId}, Status: ${usr.status}`,
            'Pembaruan akun pengguna.',
            prev.auditLogs
          ),
        };
      }
      const created: UserAccount = {
        ...usr,
        id: `usr-${Date.now()}`,
        lastLogin: 'Belum Pernah Login',
      };
      return {
        ...prev,
        users: [...prev.users, created],
        auditLogs: appendAudit(
          'USER_CHANGE',
          created.username,
          'Akun Baru',
          `Role: ${created.roleId}`,
          'Penambahan pengguna baru.',
          prev.auditLogs
        ),
      };
    });
    return { success: true };
  };

  const toggleUserStatus = (id: string) => {
    setState((prev) => ({
      ...prev,
      users: prev.users.map((u) =>
        u.id === id
          ? { ...u, status: u.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' }
          : u
      ),
    }));
  };

  const updateRolePermissions = (
    roleId: UserRoleId,
    updated: Partial<RolePermission>
  ) => {
    setState((prev) => ({
      ...prev,
      roles: prev.roles.map((r) =>
        r.roleId === roleId ? { ...r, ...updated } : r
      ),
      auditLogs: appendAudit(
        'ROLE_CHANGE',
        `Role: ${roleId}`,
        'Konfigurasi Hak Akses Sebelumnya',
        'Konfigurasi Hak Akses Diperbarui',
        `Super Admin memperbarui hak akses role ${roleId}.`,
        prev.auditLogs
      ),
    }));
  };

  const markNotificationRead = (id: string) => {
    setState((prev) => ({
      ...prev,
      notifications: prev.notifications.map((n) =>
        n.id === id ? { ...n, isRead: true } : n
      ),
    }));
  };

  const markAllNotificationsRead = () => {
    setState((prev) => ({
      ...prev,
      notifications: prev.notifications.map((n) => ({ ...n, isRead: true })),
    }));
  };

  const exportDatabaseJson = () => {
    const json = JSON.stringify(state, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Backup_WMS_Jatirejo_${state.settings.referenceDate}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const importDatabaseJson = (jsonStr: string): { success: boolean; error?: string } => {
    try {
      const parsed = JSON.parse(jsonStr) as WmsPersistedState;
      if (!parsed || !parsed.settings || !Array.isArray(parsed.demoItems)) {
        return { success: false, error: 'Format file backup JSON tidak valid.' };
      }
      setState(parsed);
      return { success: true };
    } catch {
      return { success: false, error: 'Gagal membaca file JSON.' };
    }
  };

  const signInWithGoogleAccount = async (): Promise<{
    success: boolean;
    error?: string;
  }> => {
    try {
      const res = await googleSignIn();
      if (!res) {
        return { success: false, error: 'Login Google dibatalkan.' };
      }
      setGoogleUserEmail(res.user.email || null);
      setGoogleUserName(res.user.displayName || res.user.email || 'Google User');
      setGoogleAccessToken(res.accessToken);
      setNeedsGoogleAuth(false);
      return { success: true };
    } catch (err: any) {
      setNeedsGoogleAuth(true);
      return {
        success: false,
        error: err?.message || 'Gagal autentikasi dengan Google Workspace.',
      };
    }
  };

  const signOutGoogleAccount = async (): Promise<void> => {
    await googleLogout();
    setGoogleUserEmail(null);
    setGoogleUserName(null);
    setGoogleAccessToken(null);
    setNeedsGoogleAuth(true);
  };

  const createAndSyncGoogleSheet = async (
    customTitle?: string
  ): Promise<{
    success: boolean;
    spreadsheetUrl?: string;
    error?: string;
  }> => {
    const token = await getAccessToken();
    if (!token) {
      setNeedsGoogleAuth(true);
      return {
        success: false,
        error: 'Sesi Google berakhir. Silakan klik "Sign in with Google" terlebih dahulu.',
      };
    }

    setIsGoogleSyncing(true);
    try {
      const created = await createWmsSpreadsheet(token, customTitle);
      const nextState: WmsPersistedState = {
        ...state,
        settings: {
          ...state.settings,
          googleSpreadsheetId: created.spreadsheetId,
          googleSpreadsheetTitle: created.title,
          googleSpreadsheetUrl: created.spreadsheetUrl,
        },
      };
      const pushRes = await pushEntireDatabaseToSheets(
        token,
        created.spreadsheetId,
        nextState
      );

      const syncTime = new Date().toISOString().slice(0, 19).replace('T', ' ') + ' WIB';
      setState((prev) => ({
        ...prev,
        settings: {
          ...prev.settings,
          googleSpreadsheetId: created.spreadsheetId,
          googleSpreadsheetTitle: created.title,
          googleSpreadsheetUrl: created.spreadsheetUrl,
          googleLastSyncAt: syncTime,
        },
        auditLogs: appendAudit(
          'GOOGLE_SHEETS_SYNC',
          `Google Sheets: ${created.title}`,
          'Belum Terhubung',
          `Spreadsheet ID: ${created.spreadsheetId} (${pushRes.totalRowsWritten} baris tersimpan)`,
          `Database Google Sheets baru dibuat dan disinkronkan oleh ${
            googleUserEmail || currentUser?.fullName
          }.`,
          prev.auditLogs
        ),
      }));

      return { success: true, spreadsheetUrl: created.spreadsheetUrl };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Gagal membuat dan menyinkronkan Google Spreadsheet.',
      };
    } finally {
      setIsGoogleSyncing(false);
    }
  };

  const linkExistingGoogleSheet = async (
    spreadsheetIdOrUrl: string
  ): Promise<{
    success: boolean;
    title?: string;
    error?: string;
  }> => {
    const token = await getAccessToken();
    if (!token) {
      setNeedsGoogleAuth(true);
      return {
        success: false,
        error: 'Silakan klik "Sign in with Google" terlebih dahulu.',
      };
    }
    setIsGoogleSyncing(true);
    try {
      const meta = await getSpreadsheetMetadata(token, spreadsheetIdOrUrl);
      setState((prev) => ({
        ...prev,
        settings: {
          ...prev.settings,
          googleSpreadsheetId: meta.spreadsheetId,
          googleSpreadsheetTitle: meta.title,
          googleSpreadsheetUrl: meta.spreadsheetUrl,
        },
        auditLogs: appendAudit(
          'GOOGLE_SHEETS_SYNC',
          `Link Google Sheets: ${meta.title}`,
          prev.settings.googleSpreadsheetId || 'Tidak Ada',
          meta.spreadsheetId,
          `Menghubungkan sistem WMS ke Google Spreadsheet "${meta.title}".`,
          prev.auditLogs
        ),
      }));
      return { success: true, title: meta.title };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Gagal menghubungkan Google Spreadsheet.',
      };
    } finally {
      setIsGoogleSyncing(false);
    }
  };

  const pushDatabaseToGoogleSheets = async (): Promise<{
    success: boolean;
    totalRows?: number;
    error?: string;
  }> => {
    const token = await getAccessToken();
    if (!token) {
      setNeedsGoogleAuth(true);
      return {
        success: false,
        error: 'Sesi Google belum aktif. Silakan klik "Sign in with Google".',
      };
    }
    const targetSheetId = state.settings.googleSpreadsheetId;
    if (!targetSheetId) {
      return {
        success: false,
        error: 'Pilih atau buat file Google Spreadsheet terlebih dahulu.',
      };
    }

    setIsGoogleSyncing(true);
    try {
      const res = await pushEntireDatabaseToSheets(token, targetSheetId, state);
      const syncTime = new Date().toISOString().slice(0, 19).replace('T', ' ') + ' WIB';
      setState((prev) => ({
        ...prev,
        settings: {
          ...prev.settings,
          googleSpreadsheetTitle: res.spreadsheetTitle,
          googleSpreadsheetUrl: res.spreadsheetUrl,
          googleLastSyncAt: syncTime,
        },
        auditLogs: appendAudit(
          'GOOGLE_SHEETS_SYNC',
          `Push Database -> ${res.spreadsheetTitle}`,
          `Sync Terakhir: ${prev.settings.googleLastSyncAt || 'Belum Pernah'}`,
          `Tersimpan ${res.totalRowsWritten} baris pada 8 tab Google Sheets (${syncTime})`,
          'Sinkronisasi penuh seluruh data klien WMS ke Google Sheets.',
          prev.auditLogs
        ),
      }));
      return { success: true, totalRows: res.totalRowsWritten };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Gagal menyimpan database ke Google Sheets.',
      };
    } finally {
      setIsGoogleSyncing(false);
    }
  };

  const pullDatabaseFromGoogleSheets = async (): Promise<{
    success: boolean;
    title?: string;
    error?: string;
  }> => {
    const token = await getAccessToken();
    if (!token) {
      setNeedsGoogleAuth(true);
      return {
        success: false,
        error: 'Sesi Google belum aktif. Silakan klik "Sign in with Google".',
      };
    }
    const targetSheetId = state.settings.googleSpreadsheetId;
    if (!targetSheetId) {
      return {
        success: false,
        error: 'Pilih atau hubungkan Google Spreadsheet terlebih dahulu.',
      };
    }

    setIsGoogleSyncing(true);
    try {
      const pulled = await pullDatabaseFromSheets(token, targetSheetId);
      const syncTime = new Date().toISOString().slice(0, 19).replace('T', ' ') + ' WIB';
      const syncedDemo = syncItemsStock(
        pulled.db.demoItems || [],
        pulled.db.demoStockIn || [],
        pulled.db.demoStockOut || [],
        pulled.db.demoAdjustments || []
      );
      const syncedOp = syncItemsStock(
        pulled.db.operationalItems || [],
        pulled.db.operationalStockIn || [],
        pulled.db.operationalStockOut || [],
        pulled.db.operationalAdjustments || []
      );

      setState((prev) => ({
        ...pulled.db,
        demoItems: syncedDemo,
        operationalItems: syncedOp,
        settings: {
          ...pulled.db.settings,
          googleSpreadsheetId: targetSheetId,
          googleSpreadsheetTitle: pulled.spreadsheetTitle,
          googleSpreadsheetUrl:
            prev.settings.googleSpreadsheetUrl ||
            `https://docs.google.com/spreadsheets/d/${targetSheetId}/edit`,
          googleLastSyncAt: syncTime,
        },
        auditLogs: appendAudit(
          'GOOGLE_SHEETS_SYNC',
          `Pull Database <- ${pulled.spreadsheetTitle}`,
          'State Lokal Sebelumnya',
          `Data Dipulihkan dari Google Sheets (${syncTime})`,
          'Memuat seluruh data klien WMS dari Google Sheets ke aplikasi.',
          pulled.db.auditLogs || prev.auditLogs
        ),
      }));

      return { success: true, title: pulled.spreadsheetTitle };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Gagal memuat database dari Google Sheets.',
      };
    } finally {
      setIsGoogleSyncing(false);
    }
  };

  const deleteGoogleSpreadsheetFile = async (
    fileId: string,
    fileName: string
  ): Promise<{
    success: boolean;
    error?: string;
  }> => {
    const token = await getAccessToken();
    if (!token) {
      setNeedsGoogleAuth(true);
      return {
        success: false,
        error: 'Sesi Google belum aktif. Silakan klik "Sign in with Google".',
      };
    }

    setIsGoogleSyncing(true);
    try {
      await deleteDriveSpreadsheet(token, fileId);
      setState((prev) => {
        const isCurrentDeleted = prev.settings.googleSpreadsheetId === fileId;
        return {
          ...prev,
          settings: {
            ...prev.settings,
            googleSpreadsheetId: isCurrentDeleted
              ? undefined
              : prev.settings.googleSpreadsheetId,
            googleSpreadsheetTitle: isCurrentDeleted
              ? undefined
              : prev.settings.googleSpreadsheetTitle,
            googleSpreadsheetUrl: isCurrentDeleted
              ? undefined
              : prev.settings.googleSpreadsheetUrl,
          },
          auditLogs: appendAudit(
            'GOOGLE_SHEETS_SYNC',
            `Delete Drive File: ${fileName}`,
            `File ID: ${fileId}`,
            'Dihapus dari Google Drive',
            'Penghapusan file spreadsheet database dari Google Drive dengan konfirmasi pengguna.',
            prev.auditLogs
          ),
        };
      });
      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Gagal menghapus file dari Google Drive.',
      };
    } finally {
      setIsGoogleSyncing(false);
    }
  };

  return (
    <WmsContext.Provider
      value={{
        currentUser,
        currentRole,
        activeMenu,
        setActiveMenu,
        login,
        quickLoginAsRole,
        logout,
        changePassword,
        periodFilter,
        setPeriodFilter,
        customStartDate,
        setCustomStartDate,
        customEndDate,
        setCustomEndDate,
        settings: state.settings,
        updateSettings,
        switchDataMode,
        resetDemoData,
        items,
        stockInList,
        stockOutList,
        adjustments,
        opnameSessions,
        purchaseOrders,
        categories: state.categories,
        suppliers: state.suppliers,
        locations: state.locations,
        roles: state.roles,
        users: state.users,
        loginHistory: state.loginHistory,
        notifications: state.notifications,
        auditLogs: state.auditLogs,
        addMasterItem,
        updateMasterItem,
        toggleMasterItemStatus,
        importMasterItems,
        recordStockIn,
        recordStockOut,
        createOpnameSession,
        approveOpnameSession,
        rejectOpnameSession,
        createPurchaseOrder,
        updatePurchaseOrderStatus,
        saveCategory,
        deleteCategory,
        saveSupplier,
        toggleSupplierStatus,
        saveLocation,
        saveUser,
        toggleUserStatus,
        updateRolePermissions,
        markNotificationRead,
        markAllNotificationsRead,
        printableReport,
        setPrintableReport,
        exportDatabaseJson,
        importDatabaseJson,
        googleUserEmail,
        googleUserName,
        googleAccessToken,
        needsGoogleAuth,
        isGoogleSyncing,
        googleSyncModalOpen,
        setGoogleSyncModalOpen,
        signInWithGoogleAccount,
        signOutGoogleAccount,
        createAndSyncGoogleSheet,
        linkExistingGoogleSheet,
        pushDatabaseToGoogleSheets,
        pullDatabaseFromGoogleSheets,
        deleteGoogleSpreadsheetFile,
      }}
    >
      {children}
    </WmsContext.Provider>
  );
};

export function useWms() {
  const ctx = useContext(WmsContext);
  if (!ctx) throw new Error('useWms must be used inside WmsProvider');
  return ctx;
}
