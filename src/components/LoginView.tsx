import React, { useState } from 'react';
import { Warehouse, ShieldCheck, KeyRound, UserCheck, AlertCircle } from 'lucide-react';
import { useWms } from '../context/WmsContext';
import { UserRoleId } from '../types/wms';
import { OfficialGoogleSignInButton } from './GoogleSheetsDatabaseModal';

export const LoginView: React.FC = () => {
  const {
    login,
    quickLoginAsRole,
    users,
    signInWithGoogleAccount,
    needsGoogleAuth,
    googleUserEmail,
  } = useWms();
  const [username, setUsername] = useState('superadmin');
  const [password, setPassword] = useState('gel123');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!username.trim() || !password.trim()) {
      setError('Mohon isi Username dan Password terlebih dahulu.');
      return;
    }
    const res = login(username, password);
    if (!res.success) {
      setError(res.error || 'Gagal masuk ke sistem.');
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    const res = await signInWithGoogleAccount();
    if (res.success) {
      quickLoginAsRole('SUPER_ADMIN');
    } else if (res.error) {
      setError(res.error);
    }
  };

  const quickRoles: {
    roleId: UserRoleId;
    label: string;
    user: string;
    desc: string;
  }[] = [
    {
      roleId: 'SUPER_ADMIN',
      label: 'Super Admin',
      user: 'superadmin',
      desc: 'Akses penuh seluruh modul, audit log, & konfigurasi',
    },
    {
      roleId: 'ADMIN_GUDANG',
      label: 'Admin Gudang',
      user: 'admingudang',
      desc: 'Master item, Stock In/Out, Reorder, Opname, & Laporan',
    },
    {
      roleId: 'STOREKEEPER',
      label: 'Storekeeper / Petugas',
      user: 'storekeeper',
      desc: 'Operasional pencatatan barang masuk & keluar',
    },
    {
      roleId: 'MANAGEMENT',
      label: 'Management / Pimpinan',
      user: 'management',
      desc: 'Monitoring KPI, nilai inventaris, & persetujuan PO',
    },
  ];

  return (
    <div className="min-h-screen bg-[#0B1220] text-[#F8FAFC] flex flex-col justify-center items-center p-4 sm:p-8">
      <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 rounded-2xl bg-[#111C30] border border-[#25334A] shadow-2xl overflow-hidden">
        {/* Left Brand & System Information Panel */}
        <div className="lg:col-span-6 p-8 bg-[#151F32] border-b lg:border-b-0 lg:border-r border-[#25334A] flex flex-col justify-between">
          <div>
            <div className="inline-flex items-center gap-2.5 text-[#3B82F6] font-mono text-xs font-semibold tracking-wider mb-3">
              <Warehouse className="w-4 h-4" />
              <span>WAREHOUSE MASTER INVENTORY SYSTEM</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white leading-tight">
              PT. GLOBAL ENERGI LESTARI
            </h1>
            <p className="text-sm font-medium text-[#94A3B8] mt-1">
              Warehouse Jatirejo — Sparepart Alat Berat & Armada Logistik
            </p>

            <div className="mt-6 space-y-3 text-xs text-[#94A3B8] leading-relaxed">
              <p>
                Sistem digital terpusat untuk memantau tingkat kesiapan persediaan
                (<strong className="text-white">Stock Readiness</strong>), total nilai
                inventaris, klasifikasi pergerakan barang (<strong className="text-white">Fast / Medium / Slow / Non-Moving</strong>), serta sinkronisasi database penuh ke <strong className="text-[#10B981]">Google Sheets</strong>.
              </p>
            </div>
          </div>

          {/* Quick Role Demo Access */}
          <div className="mt-8 pt-6 border-t border-[#25334A]">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-white">
                Akses Cepat Simulasi Berdasarkan Role (1-Klik):
              </span>
              <span className="text-[11px] font-mono text-[#94A3B8]">
                Password Default: gel123
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {quickRoles.map((r) => (
                <button
                  key={r.roleId}
                  type="button"
                  onClick={() => quickLoginAsRole(r.roleId)}
                  className="text-left p-3 rounded-lg bg-[#0B1220] hover:bg-[#1E293B] border border-[#25334A] hover:border-[#3B82F6] transition-colors cursor-pointer group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white group-hover:text-[#3B82F6]">
                      {r.label}
                    </span>
                    <UserCheck className="w-3.5 h-3.5 text-[#94A3B8] group-hover:text-[#3B82F6]" />
                  </div>
                  <div className="text-[11px] font-mono text-[#3B82F6] mt-0.5">
                    @{r.user}
                  </div>
                  <div className="text-[11px] text-[#94A3B8] mt-1 line-clamp-1">
                    {r.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Login Form */}
        <div className="lg:col-span-6 p-8 flex flex-col justify-center">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-white">Masuk ke Portal Gudang</h2>
            <p className="text-xs text-[#94A3B8] mt-1">
              Masukkan kredensial akun Anda atau hubungkan akun Google Workspace untuk sinkronisasi Google Sheets.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-5 p-3.5 rounded-lg bg-[#F43F5E]/15 border border-[#F43F5E]/40 text-[#F43F5E] text-xs flex items-start gap-2.5"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="login-username"
                className="block text-xs font-semibold text-[#F8FAFC] mb-1.5"
              >
                Username Pengguna
              </label>
              <input
                id="login-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Contoh: superadmin / admingudang"
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#0B1220] border border-[#25334A] text-sm text-white focus:outline-none focus:border-[#3B82F6]"
              />
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="block text-xs font-semibold text-[#F8FAFC] mb-1.5"
              >
                Password
              </label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan password"
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#0B1220] border border-[#25334A] text-sm text-white focus:outline-none focus:border-[#3B82F6]"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer mt-2"
            >
              <KeyRound className="w-4 h-4" />
              Masuk ke Sistem WMS
            </button>
          </form>

          {/* Official Sign in with Google for Google Sheets Cloud Database */}
          <div className="mt-5 pt-5 border-t border-[#25334A] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="text-xs text-[#94A3B8]">
              <div className="font-semibold text-white">Integrasi Google Sheets</div>
              <div className="text-[11px]">
                {!needsGoogleAuth && googleUserEmail
                  ? `Terhubung: ${googleUserEmail}`
                  : 'Otorisasi untuk menyimpan database ke Sheets'}
              </div>
            </div>
            <OfficialGoogleSignInButton onClick={handleGoogleSignIn} />
          </div>

          <div className="mt-5 pt-4 border-t border-[#25334A] text-xs text-[#94A3B8]">
            <div className="flex items-center gap-2 text-[#10B981] font-medium mb-1">
              <ShieldCheck className="w-4 h-4" />
              <span>Keamanan Role-Based Access Control (RBAC) Aktif</span>
            </div>
            <p className="text-[11px]">
              Terdapat {users.filter((u) => u.status === 'ACTIVE').length} akun aktif
              terdaftar untuk operasional Warehouse Jatirejo.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
