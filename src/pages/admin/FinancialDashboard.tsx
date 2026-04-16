import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Anchor, Ship, CalendarCheck, TrendingUp, TrendingDown, DollarSign, Wallet, Activity, Users, Landmark, Bot, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function FinancialDashboard() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [profitOwn, setProfitOwn] = useState(0);
  const [profitPartners, setProfitPartners] = useState(0);
  const [ranking, setRanking] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFinance = async () => {
      // Fetch Ledger
      const { data: txData } = await supabase
        .from('cash_transactions')
        .select('*')
        .order('created_at', { ascending: false });
      
      if(txData) setTransactions(txData);

      // Fetch reservations to calculate profit
      const { data: resData } = await supabase
        .from('reservations')
        .select('*, boats(*)');
        
      if(resData) {
          let pOwn = 0;
          let pPartners = 0;
          
          const boatCount: Record<string, {name: string, rentals: number, rev: number}> = {};

          resData.forEach(r => {
             const b = r.boats;
             if(!b) return;

             // Build ranking obj
             if(!boatCount[b.id]) boatCount[b.id] = { name: b.name, rentals: 0, rev: 0 };
             boatCount[b.id].rentals += 1;
             
             if(b.owner_type === 'OWN') {
                 pOwn += Number(r.total_price);
                 boatCount[b.id].rev += Number(r.total_price);
             } else {
                 const diff = Number(r.total_price) - Number(b.partner_net_value || 0);
                 pPartners += diff;
                 boatCount[b.id].rev += diff;
             }
          });

          // Fetch explicit expenses for own fleet and discount
          const { data: expData } = await supabase.from('boat_expenses').select('*');
          if(expData) {
              const totalExp = expData.reduce((acc, e) => acc + Number(e.amount), 0);
              pOwn -= totalExp; // Deduct fixed and variables from DRE
          }

          setProfitOwn(pOwn);
          setProfitPartners(pPartners);
          
          // Sort ranking top 3
          const topBoats = Object.values(boatCount).sort((a,b) => b.rentals - a.rentals).slice(0,3);
          setRanking(topBoats);
      }
      
      setLoading(false);
    };

    fetchFinance();
  }, []);

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

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
            <Link to="/admin/financeiro" className="flex items-center gap-3 px-4 py-3 bg-slate-800 text-yellow-500 rounded-lg border border-slate-700"><Wallet className="w-5 h-5" /><span className="text-sm">DRE & Caixa</span></Link>
            <Link to="/admin/clientes" className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-slate-800/50 rounded-lg transition-colors"><Users className="w-5 h-5" /><span className="text-sm">Clientes CRM</span></Link>
            <Link to="/admin/ia" className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-slate-800/50 rounded-lg transition-colors"><Bot className="w-5 h-5" /><span className="text-sm">Central IA</span></Link>
            <Link to="/admin/calendario" className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-slate-800/50 rounded-lg transition-colors"><Settings className="w-5 h-5" /><span className="text-sm">Temporada & Preços</span></Link>
          </nav>
        </div>
      </aside>

      <main className="flex-1 overflow-auto bg-slate-950">
        <header className="bg-slate-900/50 backdrop-blur-md border-b border-slate-800 p-6 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-serif font-bold text-white">Report Financeiro</h1>
            <p className="text-sm text-gray-400">DRE Oficial e Extrato de Caixa</p>
          </div>
        </header>

        {loading ? (
           <div className="p-10 text-center text-yellow-500 animate-pulse">Compilando balancetes...</div>
        ) : (
          <div className="p-6 max-w-7xl mx-auto space-y-6">
            
            {/* DRE Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-800 p-6 rounded-2xl shadow-xl relative overflow-hidden group">
                  <Activity className="absolute -right-6 -top-6 w-32 h-32 text-slate-800/50" />
                  <p className="text-gray-400 text-sm font-medium mb-1 relative z-10">DRE Frota Própria (Líquido)</p>
                  <p className={`text-4xl font-bold mb-2 relative z-10 ${profitOwn >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {formatCurrency(profitOwn)}
                  </p>
                  <p className="text-xs text-slate-500 relative z-10">Despesas fixas e variáveis deduzidas.</p>
               </div>
               <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-yellow-500/30 p-6 rounded-2xl shadow-xl relative overflow-hidden group">
                  <DollarSign className="absolute -right-6 -top-6 w-32 h-32 text-yellow-500/5" />
                  <p className="text-yellow-500/80 text-sm font-medium mb-1 relative z-10">Lucro Intermediação Parceiros</p>
                  <p className="text-4xl font-bold text-yellow-500 mb-2 relative z-10">
                      {formatCurrency(profitPartners)}
                  </p>
                  <p className="text-xs text-yellow-500/60 relative z-10">Spread livre (Venda - Valor Dono).</p>
               </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
               
               {/* Extrato de Caixa */}
               <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                  <div className="p-5 border-b border-slate-800 flex justify-between">
                      <h2 className="font-bold text-white uppercase tracking-wider text-sm flex items-center gap-2">Extrato de Caixa (Ledger)</h2>
                  </div>
                  <table className="w-full text-left">
                      <thead className="bg-slate-950/50">
                          <tr>
                              <th className="p-4 text-xs text-gray-500 uppercase">Data</th>
                              <th className="p-4 text-xs text-gray-500 uppercase">Descrição</th>
                              <th className="p-4 text-xs text-gray-500 uppercase text-right">Valor</th>
                          </tr>
                      </thead>
                      <tbody>
                          {transactions.map(tx => (
                              <tr key={tx.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                                  <td className="p-4 text-sm text-gray-400">{new Date(tx.created_at).toLocaleDateString()}</td>
                                  <td className="p-4 text-sm font-medium text-white">{tx.description}</td>
                                  <td className="p-4 text-sm text-right font-bold flex items-center justify-end gap-2">
                                      {tx.type === 'INCOME' ? <TrendingUp className="w-4 h-4 text-green-500" /> : <TrendingDown className="w-4 h-4 text-red-500" />}
                                      <span className={tx.type === 'INCOME' ? 'text-green-500' : 'text-red-500'}>
                                          {tx.type === 'INCOME' ? '+' : '-'}{formatCurrency(tx.amount)}
                                      </span>
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
               </div>

               {/* Ranking */}
               <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl p-5 h-fit">
                  <h2 className="font-bold text-white uppercase tracking-wider text-sm mb-4">🏆 Top Performance</h2>
                  <div className="space-y-4">
                      {ranking.map((boat, index) => (
                         <div key={index} className="flex items-center gap-4 bg-slate-950 p-3 rounded-xl border border-slate-800">
                             <div className="w-8 h-8 rounded bg-yellow-500/10 text-yellow-500 font-bold flex items-center justify-center border border-yellow-500/20">{index + 1}</div>
                             <div>
                                 <p className="text-white font-medium text-sm">{boat.name}</p>
                                 <p className="text-xs text-gray-500">{boat.rentals} locações</p>
                             </div>
                             <div className="ml-auto text-right">
                                <span className="text-xs bg-slate-800 text-white px-2 py-1 rounded block">{formatCurrency(boat.rev)} Margem</span>
                             </div>
                         </div>
                      ))}
                  </div>
               </div>

            </div>

          </div>
        )}
      </main>
    </div>
  );
}
