import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Anchor, Ship, CalendarCheck, Users, Search, Download, Landmark, Wallet, Tag, Bot, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function CustomersDB() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCustomers = async () => {
      // Fetch customers with their reservations to calculate LTV dynamically based on DB reality
      const { data } = await supabase
        .from('customers')
        .select('*, reservations(total_price)')
        .order('created_at', { ascending: false });
        
      if(data) {
          const mapped = data.map(c => {
             const rentals = c.reservations?.length || 0;
             const ltv = c.reservations?.reduce((acc:number, r:any) => acc + Number(r.total_price), 0) || 0;
             
             // Dynamic Auto-Tagging emulation (in real life could be a DB trigger or computed column)
             const computedTags = [...(c.tags || [])];
             if(rentals >= 3 && !computedTags.includes('Fiel')) computedTags.push('Fiel');
             
             return { ...c, rentals, ltv, tags: computedTags };
          });
          setCustomers(mapped);
      }
      setLoading(false);
    };

    fetchCustomers();
  }, []);

  const getTagStyle = (tag: string) => {
      switch(tag.toLowerCase()) {
          case 'família': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
          case 'fiel': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30 font-bold';
          case 'festeiro': return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
          default: return 'bg-slate-800 text-gray-300 border-slate-700';
      }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex text-slate-50 font-sans selection:bg-yellow-500/30">
      
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col hidden md:flex shrink-0">
        <div className="p-6 flex items-center justify-center border-b border-slate-800">
          <img src="/logo.png" alt="Lanchas Show" className="h-16 w-auto drop-shadow-[0_0_8px_rgba(234,179,8,0.2)]" />
        </div>
        <div className="p-4 flex-grow overflow-y-auto">
          <nav className="space-y-1">
            <Link to="/admin/dashboard" className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-slate-800/50 rounded-lg transition-colors"><Ship className="w-5 h-5" /><span className="text-sm">Visão 360º</span></Link>
            <Link to="/admin/reservas" className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-slate-800/50 rounded-lg transition-colors"><CalendarCheck className="w-5 h-5" /><span className="text-sm">Reservas</span></Link>
            <Link to="/admin/frota" className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-slate-800/50 rounded-lg transition-colors"><Landmark className="w-5 h-5" /><span className="text-sm">Frotas</span></Link>
            <Link to="/admin/financeiro" className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-slate-800/50 rounded-lg transition-colors"><Wallet className="w-5 h-5" /><span className="text-sm">DRE & Caixa</span></Link>
            <Link to="/admin/clientes" className="flex items-center gap-3 px-4 py-3 bg-slate-800 text-yellow-500 rounded-lg border border-slate-700"><Users className="w-5 h-5" /><span className="text-sm">Clientes CRM</span></Link>
            <Link to="/admin/ia" className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-slate-800/50 rounded-lg transition-colors"><Bot className="w-5 h-5" /><span className="text-sm">Central IA</span></Link>
            <Link to="/admin/calendario" className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-slate-800/50 rounded-lg transition-colors"><Settings className="w-5 h-5" /><span className="text-sm">Temporada & Preços</span></Link>
          </nav>
        </div>
      </aside>

      <main className="flex-1 overflow-auto bg-slate-950">
        <header className="bg-slate-900/50 backdrop-blur-md border-b border-slate-800 p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-serif font-bold text-white">Base de Clientes (LTV)</h1>
            <p className="text-sm text-gray-400">Hub de Ativos Analytics & Remarketing</p>
          </div>
          <div className="flex gap-4 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input type="text" placeholder="Buscar cliente..." className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:border-yellow-500 focus:outline-none transition-colors" />
              </div>
              <button className="bg-slate-800 border border-slate-700 p-2 rounded-lg text-gray-400 hover:text-white transition-colors" title="Exportar Lista HTML/CSV">
                <Download className="w-5 h-5"/>
              </button>
          </div>
        </header>

        {loading ? (
             <div className="p-10 text-center text-yellow-500 animate-pulse">Carregando CRM...</div>
        ) : (
          <div className="p-6 max-w-7xl mx-auto space-y-6">
             <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
                 <table className="w-full text-left">
                     <thead className="bg-slate-950/80">
                         <tr>
                             <th className="p-4 text-xs font-bold uppercase tracking-wider text-gray-500">Nome do Contratante</th>
                             <th className="p-4 text-xs font-bold uppercase tracking-wider text-gray-500">Contato</th>
                             <th className="p-4 text-xs font-bold uppercase tracking-wider text-gray-500">Voluma de Loc.</th>
                             <th className="p-4 text-xs font-bold uppercase tracking-wider text-gray-500">Ticket Gasto (LTV)</th>
                             <th className="p-4 text-xs font-bold uppercase tracking-wider text-gray-500">Tags IA / Comportamento</th>
                         </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-800/50">
                         {customers.map(c => (
                             <tr key={c.id} className="hover:bg-slate-800/30 transition-colors">
                                 <td className="p-4">
                                     <p className="text-sm font-bold text-white">{c.full_name}</p>
                                     <p className="text-xs text-gray-500">Desde {new Date(c.created_at).getFullYear()}</p>
                                 </td>
                                 <td className="p-4">
                                     <p className="text-sm text-gray-300">{c.phone || '-'}</p>
                                     <p className="text-xs text-gray-500">{c.email}</p>
                                 </td>
                                 <td className="p-4">
                                     <span className="bg-slate-800 text-gray-300 text-xs font-bold px-3 py-1 rounded inline-block border border-slate-700">
                                         {c.rentals} vezes
                                     </span>
                                 </td>
                                 <td className="p-4">
                                     <p className="text-sm font-bold text-yellow-500">
                                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(c.ltv)}
                                     </p>
                                 </td>
                                 <td className="p-4">
                                     <div className="flex flex-wrap gap-2">
                                         {(c.tags || []).map((tag:string, i:number) => (
                                             <span key={i} className={`text-[10px] uppercase font-medium px-2 py-1 rounded border flex items-center gap-1 ${getTagStyle(tag)}`}>
                                                <Tag className="w-3 h-3" /> {tag}
                                             </span>
                                         ))}
                                     </div>
                                 </td>
                             </tr>
                         ))}
                     </tbody>
                 </table>
             </div>
          </div>
        )}
      </main>
    </div>
  );
}
