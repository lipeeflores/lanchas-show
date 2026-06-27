import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Ship, CalendarCheck, Landmark, Wallet, Users, Bot, Settings, Star, MoreHorizontal, X, LogOut } from 'lucide-react';
import { clearAdminSession } from '../lib/adminApi';

const primaryNav = [
  { path: '/admin/dashboard', label: 'Visão 360°', icon: Ship },
  { path: '/admin/reservas', label: 'Reservas', icon: CalendarCheck },
  { path: '/admin/ia', label: 'Central IA', icon: Bot },
  { path: '/admin/financeiro', label: 'Financeiro', icon: Wallet },
  { path: '/admin/clientes', label: 'Clientes', icon: Users },
];

const secondaryNav = [
  { path: '/admin/frota', label: 'Gestão de Frotas', icon: Landmark },
  { path: '/admin/calendario', label: 'Temporada & Preços', icon: Settings },
  { path: '/admin/avaliacoes', label: 'Avaliações', icon: Star },
];

const allNav = [...primaryNav, ...secondaryNav];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  const handleLogout = () => {
    clearAdminSession();
    navigate('/admin', { replace: true });
  };

  const getLinkClass = (path: string) => {
    const isActive = location.pathname === path;
    return isActive
      ? "flex items-center gap-3 px-4 py-3 bg-slate-800 text-yellow-500 rounded-lg border border-slate-700 font-medium text-sm"
      : "flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-slate-800/50 rounded-lg transition-colors font-medium text-sm";
  };

  const getTabClass = (path: string) => {
    const isActive = location.pathname === path;
    return isActive
      ? "flex flex-col items-center gap-0.5 px-1 py-2 text-yellow-500 flex-1"
      : "flex flex-col items-center gap-0.5 px-1 py-2 text-gray-500 flex-1";
  };

  return (
    <div className="min-h-screen bg-slate-950 flex text-slate-50 font-sans selection:bg-yellow-500/30 w-full overflow-x-hidden">

      {/* Mobile Top Bar (logo only) */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 flex items-center justify-center z-40">
        <img src="/logo.png" alt="Lanchas Show" className="h-9 w-auto" />
      </div>

      {/* Desktop Sidebar */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col hidden md:flex shrink-0">
        <div className="p-6 flex items-center justify-center border-b border-slate-800">
          <img src="/logo.png" alt="Lanchas Show" className="h-16 w-auto drop-shadow-[0_0_8px_rgba(234,179,8,0.2)]" />
        </div>
        <div className="p-4 flex-grow overflow-y-auto">
          <p className="text-xs uppercase tracking-widest text-gray-500 mb-4 px-4">Menu ADM</p>
          <nav className="space-y-1">
            {allNav.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.path} to={item.path} className={getLinkClass(item.path)}>
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="p-4 border-t border-slate-800 space-y-2">
          <button
            onClick={handleLogout}
            className="w-full text-rose-400 hover:text-rose-300 text-sm flex items-center justify-center gap-2 transition-colors py-2 rounded-lg hover:bg-rose-500/10"
          >
            <LogOut className="w-4 h-4" /> Sair (Logout)
          </button>
          <Link to="/" className="text-gray-500 hover:text-gray-300 text-xs flex items-center justify-center transition-colors">
            Voltar ao site
          </Link>
        </div>
      </aside>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 z-40 safe-area-bottom">
        <div className="flex items-stretch h-16">
          {primaryNav.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.path} to={item.path} className={getTabClass(item.path)}>
                <Icon className="w-5 h-5 shrink-0" />
                <span className="text-[10px] font-medium leading-none">{item.label}</span>
              </Link>
            );
          })}
          <button
            onClick={() => setIsMoreOpen(true)}
            className="flex flex-col items-center gap-0.5 px-1 py-2 text-gray-500 flex-1"
          >
            <MoreHorizontal className="w-5 h-5 shrink-0" />
            <span className="text-[10px] font-medium leading-none">Mais</span>
          </button>
        </div>
      </div>

      {/* Mobile "Mais" Sheet */}
      {isMoreOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm"
            onClick={() => setIsMoreOpen(false)}
          />
          <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-slate-900 border-t border-slate-800 rounded-t-2xl shadow-2xl">
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-800">
              <span className="text-sm font-bold text-white uppercase tracking-wider">Menu</span>
              <button onClick={() => setIsMoreOpen(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="p-3 space-y-1">
              {secondaryNav.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsMoreOpen(false)}
                    className={getLinkClass(item.path)}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
              <div className="pt-2 border-t border-slate-800 mt-2">
                <button
                  onClick={() => { setIsMoreOpen(false); handleLogout(); }}
                  className="w-full text-rose-400 hover:text-rose-300 text-sm flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-rose-500/10 transition-colors"
                >
                  <LogOut className="w-4 h-4" /> Sair (Logout)
                </button>
                <Link
                  to="/"
                  onClick={() => setIsMoreOpen(false)}
                  className="text-gray-500 hover:text-gray-300 text-xs flex items-center justify-center py-2 transition-colors"
                >
                  Voltar ao site
                </Link>
              </div>
            </nav>
          </div>
        </>
      )}

      {/* Content wrapper */}
      <div className="flex-grow flex flex-col min-w-0 pt-14 pb-16 md:pt-0 md:pb-0 w-full">
        {children}
      </div>
    </div>
  );
}
