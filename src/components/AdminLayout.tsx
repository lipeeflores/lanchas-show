import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Ship, CalendarCheck, Landmark, Wallet, Users, Bot, Settings, Star, Menu, X, LogOut } from 'lucide-react';
import { clearAdminSession } from '../lib/adminApi';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);

  const handleLogout = () => {
    clearAdminSession();
    navigate('/admin', { replace: true });
  };

  const menuItems = [
    { path: '/admin/dashboard', label: 'Visão 360º', icon: Ship },
    { path: '/admin/reservas', label: 'Reservas', icon: CalendarCheck },
    { path: '/admin/frota', label: 'Gestão de Frotas', icon: Landmark },
    { path: '/admin/financeiro', label: 'DRE & Caixa', icon: Wallet },
    { path: '/admin/clientes', label: 'Clientes CRM', icon: Users },
    { path: '/admin/ia', label: 'Central IA', icon: Bot },
    { path: '/admin/calendario', label: 'Temporada & Preços', icon: Settings },
    { path: '/admin/avaliacoes', label: 'Avaliações', icon: Star },
  ];

  const getLinkClass = (path: string) => {
    const isActive = location.pathname === path;
    return isActive
      ? "flex items-center gap-3 px-4 py-3 bg-slate-800 text-yellow-500 rounded-lg border border-slate-700 font-medium text-sm"
      : "flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-slate-800/50 rounded-lg transition-colors font-medium text-sm";
  };

  return (
    <div className="min-h-screen bg-slate-950 flex text-slate-50 font-sans selection:bg-yellow-500/30 w-full overflow-x-hidden">
      
      {/* Mobile Top Bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6 z-40">
        <img src="/logo.png" alt="Lanchas Show" className="h-10 w-auto" />
        <button onClick={() => setIsOpen(!isOpen)} className="text-gray-400 hover:text-white p-2">
          {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Desktop Sidebar */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col hidden md:flex shrink-0">
        <div className="p-6 flex items-center justify-center border-b border-slate-800">
          <img src="/logo.png" alt="Lanchas Show" className="h-16 w-auto drop-shadow-[0_0_8px_rgba(234,179,8,0.2)]" />
        </div>
        <div className="p-4 flex-grow overflow-y-auto">
          <p className="text-xs uppercase tracking-widest text-gray-500 mb-4 px-4">Menu ADM</p>
          <nav className="space-y-1">
            {menuItems.map((item) => {
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

      {/* Mobile Menu Drawer Overlay */}
      {isOpen && (
        <div className="md:hidden fixed inset-0 z-30 bg-slate-950/80 backdrop-blur-sm" onClick={() => setIsOpen(false)} />
      )}

      {/* Mobile Menu Drawer Sidebar */}
      <div className={`md:hidden fixed top-16 bottom-0 left-0 w-64 bg-slate-900 border-r border-slate-800 flex flex-col z-30 transform transition-transform duration-300 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-4 flex-grow overflow-y-auto">
          <nav className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.path} to={item.path} onClick={() => setIsOpen(false)} className={getLinkClass(item.path)}>
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="p-4 border-t border-slate-800 space-y-2">
          <button
            onClick={() => { setIsOpen(false); handleLogout(); }}
            className="w-full text-rose-400 hover:text-rose-300 text-sm flex items-center justify-center gap-2 transition-colors py-2 rounded-lg hover:bg-rose-500/10"
          >
            <LogOut className="w-4 h-4" /> Sair (Logout)
          </button>
          <Link to="/" onClick={() => setIsOpen(false)} className="text-gray-500 hover:text-gray-300 text-xs flex items-center justify-center transition-colors">
            Voltar ao site
          </Link>
        </div>
      </div>

      {/* Content wrapper with margin offset on mobile for top bar */}
      <div className="flex-grow flex flex-col min-w-0 pt-16 md:pt-0 w-full">
        {children}
      </div>
    </div>
  );
}
