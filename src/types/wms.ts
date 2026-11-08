export type UserRoleId = 'SUPER_ADMIN' | 'ADMIN_GUDANG' | 'STOREKEEPER' | 'MANAGEMENT';

export type NavMenuId =
  | 'dashboard'
  | 'master_item'
  | 'stock_in'
  | 'stock_out'
  | 'reorder'
  | 'stock_opname'
  | 'purchase_order'
  | 'suppliers'
  | 'categories_locations'
  | 'reports'
  | 'audit_log'
  | 'users'
  | 'settings';

export type StockStatus = 'OUT_OF_STOCK' | 'LOW' | 'SAFE' | 'OVER';
export type CriticalStatus = 'AMAN' | 'KURANG' | 'HABIS';
export type MovementCategory = 'FAST' | 'MEDIUM' | 'SLOW' | 'NON_MOVING';

export type PeriodFilterType =
  | 'TODAY'
  | 'LAST_7_DAYS'
  | 'LAST_30_DAYS'
  | 'THIS_MONTH'
  | 'LAST_MONTH'
  | 'THIS_YEAR'
  | 'ALL_TIME'
  | 'CUSTOM';

export interface MasterItem {
  id: string;
  partNumber: string;
  name: string;
  categoryId: string;
  categoryName: string;
  description: string;
  specification: string;
  unit: string;
  unitPrice: number;
  initialStock: number;
  currentStock: number;
  minStock: number;
  maxStock: number | null;
  targetStock: number | null;
  locationId: string;
  locationCode: string;
  supplierId: string;
  supplierName: string;
  isCritical: boolean;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  updatedAt: string;
  isDemo?: boolean;
}

export interface StockInTransaction {
  id: string;
  transactionNumber: string;
  date: string; // YYYY-MM-DD
  itemId: string;
  partNumber: string;
  itemName: string;
  categoryName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalValue: number;
  supplierId: string;
  supplierName: string;
  referenceDoc: string;
  receivedBy: string;
  notes: string;
  attachmentName?: string;
  status: 'APPROVED' | 'CANCELLED';
  createdAt: string;
  isDemo?: boolean;
}

export interface StockOutTransaction {
  id: string;
  transactionNumber: string;
  date: string; // YYYY-MM-DD
  itemId: string;
  partNumber: string;
  itemName: string;
  categoryName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalValue: number;
  usagePurpose: string;
  unitFleetDept: string;
  recipientName: string;
  issuedBy: string;
  referenceDoc: string;
  notes: string;
  attachmentName?: string;
  status: 'APPROVED' | 'CANCELLED';
  createdAt: string;
  isDemo?: boolean;
}

export interface StockAdjustment {
  id: string;
  adjustmentNumber: string;
  date: string;
  itemId: string;
  partNumber: string;
  itemName: string;
  systemStockBefore: number;
  physicalStockAfter: number;
  difference: number; // physicalStockAfter - systemStockBefore
  reason: string;
  opnameId?: string;
  approvedBy: string;
  createdAt: string;
  isDemo?: boolean;
}

export interface StockOpnameItem {
  itemId: string;
  partNumber: string;
  itemName: string;
  categoryName: string;
  locationCode: string;
  unit: string;
  systemStock: number;
  physicalStock: number;
  difference: number;
  notes: string;
}

export interface StockOpnameSession {
  id: string;
  opnameNumber: string;
  date: string;
  title: string;
  areaFilter: string;
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
  createdBy: string;
  approvedBy?: string;
  approvedAt?: string;
  notes: string;
  items: StockOpnameItem[];
  createdAt: string;
  isDemo?: boolean;
}

export interface Category {
  id: string;
  code: string;
  name: string;
  description: string;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface Supplier {
  id: string;
  code: string;
  companyName: string;
  contactName: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface StorageLocation {
  id: string;
  code: string;
  warehouseName: string;
  area: string;
  rack: string;
  levelPosition: string;
  notes: string;
  status: 'ACTIVE' | 'INACTIVE';
}

export type POStatus =
  | 'DRAFT'
  | 'WAITING_APPROVAL'
  | 'APPROVED'
  | 'ORDERED'
  | 'PARTIAL_RECEIVED'
  | 'COMPLETED'
  | 'CANCELLED';

export interface PurchaseOrderItem {
  itemId: string;
  partNumber: string;
  itemName: string;
  unit: string;
  quantityOrdered: number;
  quantityReceived: number;
  unitPrice: number;
  subtotal: number;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  date: string;
  expectedDate: string;
  supplierId: string;
  supplierName: string;
  status: POStatus;
  items: PurchaseOrderItem[];
  totalAmount: number;
  createdBy: string;
  approvedBy?: string;
  notes: string;
  createdAt: string;
  isDemo?: boolean;
}

export interface RolePermission {
  roleId: UserRoleId;
  roleName: string;
  description: string;
  allowedMenus: NavMenuId[];
  canCreateMaster: boolean;
  canEditMaster: boolean;
  canDeleteMaster: boolean;
  canRecordStockIn: boolean;
  canRecordStockOut: boolean;
  canApproveOpname: boolean;
  canApprovePO: boolean;
  canExportReports: boolean;
  canManageUsers: boolean;
  canManageSettings: boolean;
}

export interface UserAccount {
  id: string;
  username: string;
  fullName: string;
  email: string;
  roleId: UserRoleId;
  department: string;
  status: 'ACTIVE' | 'INACTIVE';
  lastLogin: string;
  passwordHash: string;
}

export interface LoginHistoryEntry {
  id: string;
  userId: string;
  username: string;
  fullName: string;
  roleId: UserRoleId;
  timestamp: string;
  ipAddress: string;
  device: string;
}

export interface SystemNotification {
  id: string;
  type: 'LOW_STOCK' | 'CRITICAL_LOW' | 'CRITICAL_EMPTY' | 'STOCK_IN' | 'STOCK_OUT' | 'REORDER_CREATED' | 'OPNAME';
  severity: 'INFO' | 'WARNING' | 'CRITICAL' | 'SUCCESS';
  title: string;
  message: string;
  partNumber?: string;
  createdAt: string;
  isRead: boolean;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: UserRoleId;
  actionType:
    | 'ADD_ITEM'
    | 'EDIT_ITEM'
    | 'DEACTIVATE_ITEM'
    | 'STOCK_IN'
    | 'STOCK_OUT'
    | 'STOCK_ADJUSTMENT'
    | 'STOCK_OPNAME'
    | 'PO_STATUS'
    | 'ROLE_CHANGE'
    | 'USER_CHANGE'
    | 'SYSTEM_CONFIG'
    | 'GOOGLE_SHEETS_SYNC';
  entityName: string;
  beforeValue: string;
  afterValue: string;
  notes: string;
}

export interface SystemSettings {
  warehouseName: string;
  companyName: string;
  locationAddress: string;
  fastMovingDays: number; // default 30
  mediumMovingDays: number; // default 60
  slowMovingDays: number; // default 90
  defaultMinStock: number;
  defaultMaxStock: number;
  currencySymbol: string;
  dataMode: 'DEMO' | 'OPERATIONAL';
  referenceDate: string; // YYYY-MM-DD reference date for deterministic calculation
  googleSpreadsheetId?: string;
  googleSpreadsheetTitle?: string;
  googleSpreadsheetUrl?: string;
  googleLastSyncAt?: string;
}

