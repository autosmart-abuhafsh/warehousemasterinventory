import React, { useState } from 'react';
import {
  LayoutDashboard,
  Package,
  ArrowDownRight,
  ArrowUpRight,
  AlertTriangle,
  ClipboardCheck,
  FileText,
  Truck,
  FolderTree,
  BarChart3,
  History,
  Users,
  Settings,
  Bell,
  LogOut,
  Menu,
  X,
  Warehouse,
  CheckCheck,
  FileSpreadsheet,
} from 'lucide-react';
import { WmsProvider, useWms } from './context/WmsContext';
import { NavMenuId, UserRoleId } from './types/wms';
import { LoginView } from './components/LoginView';
import { DashboardView } from './components/DashboardView';
import { MasterItemView } from './components/MasterItemView';
import { StockInView, StockOutView } from './components/StockInOutView';
import {
  ReorderView,
  StockOpnameView,
  PurchaseOrderView,
} from './components/ReorderOpnamePoView';
import {
  SupplierManagementView,
  CategoryLocationView,
} from './components/MasterAuxView';
import {
  ReportsView,
  AuditLogView,
  UserManagementView,
  SystemSettingsView,
} from './components/ReportsAuditAdminView';
import { PrintableDocumentModal } from './components/PrintableDocumentModal';
import { GoogleSheetsDatabaseModal } from './components/GoogleSheetsDatabaseModal';

const NAV_ITEMS: {
  id: NavMenuId;
  label: string;
  icon: React.FC<{ className?: string }>;
}[] = [
  { id: 'dashboard', label: '1. Dashboard', icon: LayoutDashboard },
  { id: 'master_item', label: '2. Master Item List', icon: Package },
  { id: 'stock_in', label: '3. Stock In (Masuk)', icon: ArrowDownRight },
  { id: 'stock_out', label: '4. Stock Out (Keluar)', icon: ArrowUpRight },
  { id: 'reorder', label: '5. Reorder Management', icon: AlertTriangle },
  { id: 'stock_opname', label: '6. Stock Opname', icon: ClipboardCheck },
  { id: 'purchase_order', label: '7. Purchase Order', icon: FileText },
  { id: 'suppliers', label: '8. Supplier Management', icon: Truck },
  { id: 'categories_locations', label: '9. Kategori & Lokasi', icon: FolderTree },
  { id: 'reports', label: '10. Riwayat & Laporan', icon: BarChart3 },
  { id: 'audit_log', label: '11. Audit Log', icon: History },
  { id: 'users', label: '12. Manajemen Pengguna', icon: Users },
  { id: 'settings', label: '13. Pengaturan Sistem', icon: Settings },
];

const WmsShell: React.FC = () => {
  const {
    currentUser,
    currentRole,
    activeMenu,
    setActiveMenu,
    quickLoginAsRole,
    logout,
    notifications,
    markNotificationRead,
    markAllNotificationsRead,
    printableReport,
    setPrintableReport,
    settings,
    needsGoogleAuth,
    setGoogleSyncModalOpen,
  } = useWms();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  if (!currentUser || !currentRole) {
    return <LoginView />;
  }

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const allowedMenus = currentRole.allowedMenus;
  const activeNavObj =
    NAV_ITEMS.find((n) => n.id === activeMenu) || NAV_ITEMS[0];

  const handleSelectMenu = (id: NavMenuId) => {
    setActiveMenu(id);
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#0B1220] text-[#F8FAFC] flex">
      {/* Mobile Sidebar Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/70 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Permanent Desktop Sidebar & Mobile Drawer (PRD 17.3 & 17.4) */}
      <aside
        aria-label="Navigasi Utama WMS"
        className={`fixed lg:static inset-y-0 left-0 z-50 w-[268px] shrink-0 bg-[#111C30] border-r border-[#25334A] flex flex-col justify-between transition-transform duration-200 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand Identity */}
        <div>
          <div className="px-5 py-4 border-b border-[#25334A] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#3B82F6] flex items-center justify-center text-white shrink-0">
                <Warehouse className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-extrabold tracking-tight text-white truncate">
                  GLOBAL ENERGI LESTARI
                </div>
                <div className="text-[11px] font-mono text-[#94A3B8] truncate">
                  {settings.warehouseName}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Tutup menu navigasi"
              className="lg:hidden p-1.5 rounded bg-[#0B1220] text-[#94A3B8] hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 13 Navigation Items */}
          <nav className="p-3 space-y-1 max-h-[calc(100vh-220px)] overflow-y-auto">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isAllowed = allowedMenus.includes(item.id);
              const isActive = activeMenu === item.id;
              if (!isAllowed) return null;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectMenu(item.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    isActive
                      ? 'bg-[#3B82F6] text-white font-semibold'
                      : 'text-[#94A3B8] hover:bg-[#151F32] hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* User Account & Quick Role Switcher Footer */}
        <div className="p-4 border-t border-[#25334A] bg-[#0B1220]/50 space-y-3">
          <div>
            <label
              htmlFor="sidebar-role-switcher"
              className="block text-[10px] font-mono text-[#94A3B8] mb-1"
            >
              SIMULASI ROLE PENGGUNA AKTIF:
            </label>
            <select
              id="sidebar-role-switcher"
              value={currentUser.roleId}
              onChange={(e) => quickLoginAsRole(e.target.value as UserRoleId)}
              className="w-full px-2.5 py-1.5 rounded bg-[#151F32] border border-[#25334A] text-xs font-semibold text-white cursor-pointer"
            >
              <option value="SUPER_ADMIN">Super Admin (Full Access)</option>
              <option value="ADMIN_GUDANG">Admin Gudang (Operational)</option>
              <option value="STOREKEEPER">Storekeeper (Petugas Gudang)</option>
              <option value="MANAGEMENT">Management (Pimpinan)</option>
            </select>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-[#25334A]">
            <div className="min-w-0">
              <div className="text-xs font-bold text-white truncate">
                {currentUser.fullName}
              </div>
              <div className="text-[11px] font-mono text-[#3B82F6] truncate">
                @{currentUser.username} · {currentRole.roleName}
              </div>
            </div>
            <button
              type="button"
              onClick={logout}
              title="Keluar (Logout)"
              aria-label="Logout dari sistem"
              className="p-2 rounded-lg bg-[#151F32] hover:bg-[#F43F5E]/20 text-[#94A3B8] hover:text-[#F43F5E] transition-colors cursor-pointer shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar Contract: Breadcrumb on Left, Google Sheets DB, Notifications & Primary Action on Right */}
        <header className="sticky top-0 z-30 bg-[#111C30]/95 backdrop-blur border-b border-[#25334A] px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Buka menu navigasi"
              className="lg:hidden p-2 rounded-lg bg-[#151F32] border border-[#25334A] text-white cursor-pointer"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 text-xs sm:text-sm min-w-0">
              <span className="font-semibold text-[#94A3B8] hidden sm:inline whitespace-nowrap">
                PT. Global Energi Lestari
              </span>
              <span className="text-[#94A3B8] hidden sm:inline">/</span>
              <span className="font-semibold text-[#94A3B8] hidden md:inline whitespace-nowrap">
                {settings.warehouseName}
              </span>
              <span className="text-[#94A3B8] hidden md:inline">/</span>
              <h1 className="font-bold text-white truncate">
                {activeNavObj.label.replace(/^\d+\.\s*/, '')}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {/* Google Sheets Cloud Database Button */}
            <button
              type="button"
              onClick={() => setGoogleSyncModalOpen(true)}
              aria-label="Buka Integrasi Database Google Sheets"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#151F32] border border-[#10B981]/50 hover:border-[#10B981] text-xs font-semibold text-white cursor-pointer whitespace-nowrap transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4 text-[#10B981] shrink-0" />
              <span className="hidden md:inline">Database Google Sheets</span>
              <span className="md:hidden">Sheets DB</span>
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  !needsGoogleAuth && settings.googleSpreadsheetId
                    ? 'bg-[#10B981]'
                    : !needsGoogleAuth
                    ? 'bg-[#3B82F6]'
                    : 'bg-[#F59E0B]'
                }`}
                title={
                  !needsGoogleAuth
                    ? 'Terhubung ke Google Workspace'
                    : 'Klik untuk Sign in with Google'
                }
              />
            </button>

            {/* Notification Bell Button */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setNotifOpen(!notifOpen)}
                aria-label={`Notifikasi Sistem (${unreadCount} belum dibaca)`}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#151F32] border border-[#25334A] hover:border-[#3B82F6] text-xs font-medium text-white cursor-pointer whitespace-nowrap"
              >
                <Bell className="w-4 h-4 text-[#F59E0B]" />
                <span className="hidden sm:inline">Notifikasi</span>
                {unreadCount > 0 && (
                  <span className="font-mono font-bold text-[#F43F5E]">
                    ({unreadCount})
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl bg-[#151F32] border border-[#25334A] shadow-2xl z-50 overflow-hidden">
                  <div className="px-4 py-3 bg-[#111C30] border-b border-[#25334A] flex items-center justify-between">
                    <span className="text-xs font-bold text-white">
                      Pusat Peringatan & Notifikasi Gudang
                    </span>
                    <button
                      type="button"
                      onClick={markAllNotificationsRead}
                      className="inline-flex items-center gap-1 text-[11px] text-[#3B82F6] hover:underline cursor-pointer"
                    >
                      <CheckCheck className="w-3.5 h-3.5" /> Tandai Dibaca
                    </button>
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-[#25334A]">
                    {notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => markNotificationRead(n.id)}
                        className={`p-3.5 text-xs cursor-pointer transition-colors ${
                          n.isRead ? 'bg-[#151F32] opacity-70' : 'bg-[#0B1220]/70'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`font-bold ${
                              n.severity === 'CRITICAL'
                                ? 'text-[#F43F5E]'
                                : n.severity === 'WARNING'
                                ? 'text-[#F59E0B]'
                                : n.severity === 'SUCCESS'
                                ? 'text-[#10B981]'
                                : 'text-[#3B82F6]'
                            }`}
                          >
                            {n.title}
                          </span>
                          <span className="text-[10px] font-mono text-[#94A3B8] shrink-0">
                            {n.createdAt}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#94A3B8] mt-1 leading-relaxed">
                          {n.message}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Primary Quick Action */}
            {currentRole.canRecordStockIn && (
              <button
                type="button"
                onClick={() => setActiveMenu('stock_in')}
                className="px-3.5 py-1.5 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] text-white text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                + Catat Stock In
              </button>
            )}
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 p-4 sm:p-6 max-w-[1440px] w-full mx-auto">
          {activeMenu === 'dashboard' && <DashboardView />}
          {activeMenu === 'master_item' && <MasterItemView />}
          {activeMenu === 'stock_in' && <StockInView />}
          {activeMenu === 'stock_out' && <StockOutView />}
          {activeMenu === 'reorder' && <ReorderView />}
          {activeMenu === 'stock_opname' && <StockOpnameView />}
          {activeMenu === 'purchase_order' && <PurchaseOrderView />}
          {activeMenu === 'suppliers' && <SupplierManagementView />}
          {activeMenu === 'categories_locations' && <CategoryLocationView />}
          {activeMenu === 'reports' && <ReportsView />}
          {activeMenu === 'audit_log' && <AuditLogView />}
          {activeMenu === 'users' && <UserManagementView />}
          {activeMenu === 'settings' && <SystemSettingsView />}
        </main>
      </div>

      {/* Printable Official Document Modal */}
      {printableReport && (
        <PrintableDocumentModal
          report={printableReport}
          onClose={() => setPrintableReport(null)}
        />
      )}

      {/* Google Sheets Cloud Database Modal */}
      <GoogleSheetsDatabaseModal />
    </div>
  );
};

export default function App() {
  return (
    <WmsProvider>
      <WmsShell />
    </WmsProvider>
  );
}
