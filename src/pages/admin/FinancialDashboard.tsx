import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Ship, CalendarCheck, TrendingUp, TrendingDown, DollarSign, Wallet, Activity, Users, Landmark, Bot, Settings, BarChart3, PieChart as PieIcon, ArrowUpRight, ArrowDownRight, Minus, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import AdminLayout from '../../components/AdminLayout';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, CartesianGrid } from 'recharts';

export default function FinancialDashboard() {
  const [ledgerEntries, setLedgerEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // DRE values
  const [receitaBruta, setReceitaBruta] = useState(0);
  const [custosSaida, setCustosSaida] = useState(0);
  const [despesasOperacionais, setDespesasOperacionais] = useState(0);
  const [lucroIntermediacao, setLucroIntermediacao] = useState(0);
  const [ranking, setRanking] = useState<any[]>([]);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [expenseBreakdown, setExpenseBreakdown] = useState<any[]>([]);

  const [allTxData, setAllTxData] = useState<any[]>([]);
  const [allResData, setAllResData] = useState<any[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`);

  useEffect(() => {
    const fetchFinance = async () => {
      const { data: txData } = await supabase.from('cash_transactions').select('*').order('created_at', { ascending: false });
      const { data: resData } = await supabase.from('reservations').select('*, boats(*), customers(full_name)');
      if(txData) setAllTxData(txData);
      if(resData) setAllResData(resData);
      setLoading(false);
    };
    fetchFinance();
  }, []);

  useEffect(() => {
    if (loading) return;

    let txData = allTxData;
    let resData = allResData;

    const monthly: Record<string, {month: string, receita: number, despesa: number}> = {};
    // Calculate full monthly history for the Area Chart
    allResData.forEach(r => {
        const b = r.boats;
        if(!b) return;
        const opCost = Number(b.original_rate || 0);
        const d = new Date(r.created_at);
        const mk = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        const ml = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
        if(!monthly[mk]) monthly[mk] = { month: ml, receita: 0, despesa: 0 };
        
        if(b.owner_type === 'OWN') {
          monthly[mk].receita += Number(r.total_price);
          monthly[mk].despesa += opCost;
        } else {
          const diff = Number(r.total_price) - Number(b.partner_net_value || 0) - opCost;
          monthly[mk].receita += diff;
          monthly[mk].despesa += opCost;
        }
    });

    allTxData.filter(tx => tx.type === 'EXPENSE').forEach(tx => {
        const d = new Date(tx.created_at);
        const mk = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        const ml = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
        if(!monthly[mk]) monthly[mk] = { month: ml, receita: 0, despesa: 0 };
        monthly[mk].despesa += Number(tx.amount);
    });

    setMonthlyData(Object.entries(monthly).sort(([a],[b]) => a.localeCompare(b)).map(([,v]) => v));

    // Filter by selected period for KPIs, DRE and Ledger
    if (selectedMonth !== 'all') {
        txData = txData.filter(tx => tx.created_at.startsWith(selectedMonth));
        resData = resData.filter(r => r.created_at.startsWith(selectedMonth));
    }

    let rb = 0, cs = 0, lp = 0;
    const boatCount: Record<string, {name: string, rentals: number, rev: number}> = {};
    const ledger: any[] = [];
    const expCat: Record<string, number> = {};
    let de = 0;

    resData.forEach(r => {
        const b = r.boats;
        if(!b) return;
        if(!boatCount[b.id]) boatCount[b.id] = { name: b.name, rentals: 0, rev: 0 };
        boatCount[b.id].rentals += 1;
        const opCost = Number(b.original_rate || 0);

        // Competence (DRE) totals
        if(b.owner_type === 'OWN') {
          rb += Number(r.total_price);
          cs += opCost;
          boatCount[b.id].rev += Number(r.total_price);
        } else {
          const diff = Number(r.total_price) - Number(b.partner_net_value || 0) - opCost;
          lp += diff;
          boatCount[b.id].rev += diff;
        }

        const clientName = r.customers?.full_name || 'Cliente';

        // Add synthetic INCOME to ledger ONLY if there is no real INCOME from this reservation in cash_transactions
        const hasRealIncome = allTxData.some(tx => tx.reservation_id === r.id && tx.type === 'INCOME');
        if (!hasRealIncome) {
            ledger.push({
              id: 'res-' + r.id,
              type: 'INCOME',
              amount: Number(r.total_price),
              description: `[RESERVA] (Retroativo) ${b.name} — ${clientName}`,
              created_at: r.created_at
            });
        }

        // Add synthetic departure cost
        if(opCost > 0) {
          ledger.push({
            id: 'cost-' + r.id,
            type: 'EXPENSE',
            amount: opCost,
            description: `Custo de Saída ${b.name} — ${clientName}`,
            created_at: r.created_at
          });
        }
    });

    txData.forEach(tx => {
        if (tx.type === 'EXPENSE') {
            de += Number(tx.amount);
            const desc = (tx.description || '').toLowerCase();
            let cat = 'Outros';
            if(desc.includes('[fixo]') || desc.includes('fixo') || desc.includes('fixa')) cat = 'Despesas Fixas';
            else if(desc.includes('[variável]') || desc.includes('combustível') || desc.includes('variável')) cat = 'Despesas Variáveis';
            else if(desc.includes('[geral]') || desc.includes('geral')) cat = 'Contas Gerais';
            else if(desc.includes('[parceiro]')) cat = 'Repasse Parceiros';
            
            expCat[cat] = (expCat[cat] || 0) + Number(tx.amount);

            ledger.push({
              id: tx.id,
              type: 'EXPENSE',
              amount: Number(tx.amount),
              description: tx.description,
              created_at: tx.created_at
            });
        } else if (tx.type === 'INCOME') {
            ledger.push({
              id: tx.id,
              type: 'INCOME',
              amount: Number(tx.amount),
              description: tx.description,
              created_at: tx.created_at
            });
        }
    });

    ledger.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setLedgerEntries(ledger);

    setReceitaBruta(rb);
    setCustosSaida(cs);
    setDespesasOperacionais(de);
    setLucroIntermediacao(lp);
    setRanking(Object.values(boatCount).sort((a,b) => b.rev - a.rev).slice(0,5));
    
    if(cs > 0) {
      expCat['Custos de Saída'] = (expCat['Custos de Saída'] || 0) + cs;
    }
    setExpenseBreakdown(Object.entries(expCat).map(([name, value]) => ({ name, value })));

  }, [allTxData, allResData, loading, selectedMonth]);

  const fmt = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(val || 0);
  const fmtFull = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
  
  const lucroLiquido = receitaBruta - custosSaida - despesasOperacionais;
  const totalIncome = ledgerEntries.filter(t => t.type === 'INCOME').reduce((a,t) => a + Number(t.amount), 0);
  const totalExpense = ledgerEntries.filter(t => t.type === 'EXPENSE').reduce((a,t) => a + Number(t.amount), 0);
  const saldoCaixa = totalIncome - totalExpense;

  const PIE_COLORS = ['#eab308', '#ef4444', '#3b82f6', '#22c55e', '#a855f7'];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload) return null;
    return (
      <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 shadow-xl">
        <p className="text-xs text-gray-400 mb-1">{label}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} className="text-sm font-bold" style={{ color: p.color }}>{p.name}: {fmtFull(p.value)}</p>
        ))}
      </div>
    );
  };

  return (
    <AdminLayout>
      <main className="flex-1 overflow-auto bg-slate-950">
        <header className="bg-slate-900/50 backdrop-blur-md border-b border-slate-800 p-6 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-serif font-bold text-white">DRE & Balanço Financeiro</h1>
            <p className="text-sm text-gray-400">Demonstração do Resultado do Exercício e Fluxo de Caixa</p>
          </div>
          <div>
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-white text-sm rounded-lg px-4 py-2 outline-none focus:border-yellow-500 transition-colors"
            >
              <option value="all">Todo o Período</option>
              {Array.from(new Set([
                ...allTxData.map(tx => tx.created_at.substring(0, 7)),
                ...allResData.map(r => r.created_at.substring(0, 7))
              ])).sort((a, b) => b.localeCompare(a)).map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        </header>

        {loading ? (
           <div className="p-10 text-center text-yellow-500 animate-pulse">Compilando balancetes...</div>
        ) : (
          <div className="p-6 max-w-7xl mx-auto space-y-6">
            
            {/* KPI Cards Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-16 h-16 bg-green-500/5 rounded-bl-full"></div>
                <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-2">Receita Bruta</p>
                <p className="text-2xl font-bold text-green-500">{fmt(receitaBruta + lucroIntermediacao)}</p>
                <div className="flex items-center gap-1 mt-2"><ArrowUpRight className="w-3 h-3 text-green-500"/><span className="text-[10px] text-green-500">Frota + Parceiros</span></div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-16 h-16 bg-red-500/5 rounded-bl-full"></div>
                <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-2">Custos Totais</p>
                <p className="text-2xl font-bold text-red-500">{fmt(custosSaida + despesasOperacionais)}</p>
                <div className="flex items-center gap-1 mt-2"><ArrowDownRight className="w-3 h-3 text-red-500"/><span className="text-[10px] text-red-500">Saída + Despesas</span></div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-16 h-16 bg-yellow-500/5 rounded-bl-full"></div>
                <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-2">Lucro Líquido</p>
                <p className={`text-2xl font-bold ${lucroLiquido + lucroIntermediacao >= 0 ? 'text-yellow-500' : 'text-red-500'}`}>{fmt(lucroLiquido + lucroIntermediacao)}</p>
                <div className="flex items-center gap-1 mt-2"><Minus className="w-3 h-3 text-yellow-500"/><span className="text-[10px] text-yellow-500">Resultado Final</span></div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/5 rounded-bl-full"></div>
                <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-2">Saldo em Caixa</p>
                <p className={`text-2xl font-bold ${saldoCaixa >= 0 ? 'text-blue-400' : 'text-red-500'}`}>{fmt(saldoCaixa)}</p>
                <div className="flex items-center gap-1 mt-2"><Wallet className="w-3 h-3 text-blue-400"/><span className="text-[10px] text-blue-400">Entradas - Saídas</span></div>
              </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Area Chart - Receita vs Despesa */}
              <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-4 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-yellow-500"/>Receita vs Despesas (Mensal)</h2>
                {monthlyData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={monthlyData}>
                      <defs>
                        <linearGradient id="colorReceita" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorDespesa" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} />
                      <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="receita" name="Receita" stroke="#22c55e" fill="url(#colorReceita)" strokeWidth={2} />
                      <Area type="monotone" dataKey="despesa" name="Despesa" stroke="#ef4444" fill="url(#colorDespesa)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : <p className="text-gray-500 text-sm italic text-center py-20">Sem dados suficientes para gráfico.</p>}
              </div>

              {/* Pie Chart - Breakdown Despesas */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-4 flex items-center gap-2"><PieIcon className="w-4 h-4 text-yellow-500"/>Composição das Despesas</h2>
                {expenseBreakdown.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie data={expenseBreakdown} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                          {expenseBreakdown.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v: number) => fmtFull(v)} contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }} itemStyle={{ color: '#e2e8f0' }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-2 mt-2">
                      {expenseBreakdown.map((item, i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}></div>
                            <span className="text-gray-400">{item.name}</span>
                          </div>
                          <span className="text-white font-bold">{fmtFull(item.value)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : <p className="text-gray-500 text-sm italic text-center py-20">Nenhuma despesa registrada.</p>}
              </div>
            </div>

            {/* DRE Table + Ranking */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* DRE Formal */}
              <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
                <div className="p-5 border-b border-slate-800 bg-slate-900/50">
                  <h2 className="font-bold text-white uppercase tracking-wider text-sm flex items-center gap-2"><Activity className="w-4 h-4 text-yellow-500"/>Demonstração do Resultado (DRE)</h2>
                </div>
                <div className="divide-y divide-slate-800">
                  <div className="flex justify-between items-center px-6 py-4">
                    <span className="text-sm text-gray-300 font-medium">(+) Receita Bruta Frota Própria</span>
                    <span className="text-sm font-bold text-green-500">{fmtFull(receitaBruta)}</span>
                  </div>
                  <div className="flex justify-between items-center px-6 py-4">
                    <span className="text-sm text-gray-300 font-medium">(+) Lucro Intermediação Parceiros</span>
                    <span className="text-sm font-bold text-green-500">{fmtFull(lucroIntermediacao)}</span>
                  </div>
                  <div className="flex justify-between items-center px-6 py-4 bg-green-500/5">
                    <span className="text-sm text-green-400 font-bold">(=) RECEITA TOTAL</span>
                    <span className="text-sm font-bold text-green-400">{fmtFull(receitaBruta + lucroIntermediacao)}</span>
                  </div>
                  <div className="flex justify-between items-center px-6 py-4">
                    <span className="text-sm text-gray-300 font-medium">(−) Custos de Saída (Pier, Marinheiro)</span>
                    <span className="text-sm font-bold text-red-500">-{fmtFull(custosSaida)}</span>
                  </div>
                  <div className="flex justify-between items-center px-6 py-4 bg-yellow-500/5">
                    <span className="text-sm text-yellow-400 font-bold">(=) LUCRO BRUTO</span>
                    <span className="text-sm font-bold text-yellow-400">{fmtFull(receitaBruta + lucroIntermediacao - custosSaida)}</span>
                  </div>
                  <div className="flex justify-between items-center px-6 py-4">
                    <span className="text-sm text-gray-300 font-medium">(−) Despesas Operacionais</span>
                    <span className="text-sm font-bold text-red-500">-{fmtFull(despesasOperacionais)}</span>
                  </div>
                  <div className={`flex justify-between items-center px-6 py-5 ${lucroLiquido + lucroIntermediacao >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                    <span className={`text-base font-bold ${lucroLiquido + lucroIntermediacao >= 0 ? 'text-green-400' : 'text-red-400'}`}>(=) LUCRO LÍQUIDO</span>
                    <span className={`text-lg font-bold ${lucroLiquido + lucroIntermediacao >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmtFull(lucroLiquido + lucroIntermediacao)}</span>
                  </div>
                </div>
              </div>

              {/* Top Performance Ranking */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
                <div className="p-5 border-b border-slate-800 bg-slate-900/50">
                  <h2 className="font-bold text-white uppercase tracking-wider text-sm">🏆 Top Performance</h2>
                </div>
                <div className="p-4 space-y-3">
                  {ranking.map((boat, index) => (
                    <div key={index} className="flex items-center gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800">
                      <div className={`w-8 h-8 rounded-lg font-bold flex items-center justify-center text-sm ${index === 0 ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/30' : 'bg-slate-800 text-gray-400 border border-slate-700'}`}>{index + 1}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium text-sm truncate">{boat.name}</p>
                        <p className="text-[10px] text-gray-500">{boat.rentals} locações</p>
                      </div>
                      <span className="text-xs font-bold text-yellow-500">{fmt(boat.rev)}</span>
                    </div>
                  ))}
                  {ranking.length === 0 && <p className="text-gray-500 text-sm italic text-center py-6">Sem dados.</p>}
                </div>
              </div>
            </div>

            {/* Revenue by Boat Bar Chart */}
            {ranking.length > 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-4 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-yellow-500"/>Receita Líquida por Embarcação</h2>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={ranking} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                    <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="name" tick={{ fill: '#e2e8f0', fontSize: 12 }} axisLine={false} width={140} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="rev" name="Receita Líq." fill="#eab308" radius={[0, 6, 6, 0]} barSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Extrato de Caixa */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                <h2 className="font-bold text-white uppercase tracking-wider text-sm flex items-center gap-2"><DollarSign className="w-4 h-4 text-yellow-500"/>Extrato de Caixa (Ledger)</h2>
                <div className="flex items-center gap-4 text-xs">
                  <span className="text-green-500 font-bold">Entradas: {fmtFull(totalIncome)}</span>
                  <span className="text-red-500 font-bold">Saídas: {fmtFull(totalExpense)}</span>
                </div>
              </div>
              <div className="max-h-[400px] overflow-y-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-950/50 sticky top-0">
                    <tr>
                      <th className="p-4 text-xs text-gray-500 uppercase">Data</th>
                      <th className="p-4 text-xs text-gray-500 uppercase">Descrição</th>
                      <th className="p-4 text-xs text-gray-500 uppercase text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledgerEntries.map(tx => (
                      <tr key={tx.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                        <td className="p-4 text-sm text-gray-400">{new Date(tx.created_at).toLocaleDateString('pt-BR')}</td>
                        <td className="p-4 text-sm font-medium text-white">{tx.description}</td>
                        <td className="p-4 text-sm text-right font-bold">
                          <span className={`inline-flex items-center gap-1 ${tx.type === 'INCOME' ? 'text-green-500' : 'text-red-500'}`}>
                            {tx.type === 'INCOME' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            {tx.type === 'INCOME' ? '+' : '-'}{fmtFull(tx.amount)}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {ledgerEntries.length === 0 && (
                      <tr><td colSpan={3} className="p-10 text-center text-gray-500 italic">Nenhuma movimentação registrada.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}
      </main>
    </AdminLayout>
  );
}
