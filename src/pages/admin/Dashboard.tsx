import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Anchor, Ship, CalendarCheck, DollarSign, BellRing, AlertCircle, CheckCircle, Clock, Landmark, Wallet, Users, Bot, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

export default function Dashboard() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [partnersToApprove, setPartnersToApprove] = useState<any[]>([]);
  const [contractsPending, setContractsPending] = useState<any[]>([]);
  
  const [stats, setStats] = useState({
      inWater: 0,
      checkins: 0,
      revenue24h: 0
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
        // Fetch System Alerts
        const { data: alertsData } = await supabase
            .from('system_alerts')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(5);
        setAlerts(alertsData || []);

        // Fetch Reservations for metrics
        const { data: resData } = await supabase
            .from('reservations')
            .select('*, boats(name, owner_type, partners(name)), customers(full_name)');
            
        if(resData) {
            const now = new Date();
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);
            
            // Calculate active boats in water (start date passed, end date not reached)
            // Simplified for mock visual purposes based on the dates we seeded
            const inWater = resData.filter(r => new Date(r.start_date) <= now && new Date(r.end_date) >= now).length;
            
            // Checkins (starts between now and tomorrow)
            const checkins = resData.filter(r => new Date(r.start_date) >= now && new Date(r.start_date) <= tomorrow).length;
            
            // Revenue (starts between now and tomorrow)
            const revenue24h = resData
                .filter(r => new Date(r.start_date) >= now && new Date(r.start_date) <= tomorrow)
                .reduce((acc, r) => acc + Number(r.total_price), 0);

            setStats({
               inWater,
               checkins,
               revenue24h 
            });

            // Action Requests: Partner approvals
            setPartnersToApprove(resData.filter(r => r.status === 'AWAITING_PARTNER'));
            
            // Action Requests: Pending contracts
            setContractsPending(resData.filter(r => r.status === 'PENDING_CONTRACT'));
        }

        setLoading(false);
    };

    fetchDashboardData();
  }, []);

  const formatDistanceToNow = (dateStr: string) => {
      const diff = Math.floor((new Date().getTime() - new Date(dateStr).getTime()) / 60000);
      if(diff < 60) return `Há ${diff} minutos`;
      const hours = Math.floor(diff/60);
      return `Há ${hours} horas`;
  };

  return (
    <div className="min-h-screen bg-slate-950 flex text-slate-50 font-sans selection:bg-yellow-500/30">
      
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col hidden md:flex">
        <div className="p-6 flex items-center justify-center border-b border-slate-800">
          <img src="/logo.png" alt="Lanchas Show" className="h-16 w-auto drop-shadow-[0_0_8px_rgba(234,179,8,0.2)]" />
        </div>
        <div className="p-4 flex-grow">
          <p className="text-xs uppercase tracking-widest text-gray-500 mb-4 px-4">Menu ADM</p>
          <nav className="space-y-2">
            <Link to="/admin/dashboard" className="flex items-center gap-3 px-4 py-3 bg-slate-800 text-yellow-500 rounded-lg border border-slate-700">
              <Ship className="w-5 h-5" />
              <span className="font-medium text-sm">Visão 360º</span>
            </Link>
            <Link to="/admin/reservas" className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-slate-800/50 rounded-lg transition-colors">
              <CalendarCheck className="w-5 h-5" />
              <span className="font-medium text-sm">Reservas</span>
            </Link>
            <Link to="/admin/frota" className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-slate-800/50 rounded-lg transition-colors">
              <Landmark className="w-5 h-5" />
              <span className="font-medium text-sm">Gestão de Frotas</span>
            </Link>
            <Link to="/admin/financeiro" className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-slate-800/50 rounded-lg transition-colors">
              <Wallet className="w-5 h-5" />
              <span className="font-medium text-sm">DRE & Caixa</span>
            </Link>
            <Link to="/admin/clientes" className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-slate-800/50 rounded-lg transition-colors">
              <Users className="w-5 h-5" />
              <span className="font-medium text-sm">Clientes CRM</span>
            </Link>
            <Link to="/admin/ia" className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-slate-800/50 rounded-lg transition-colors">
              <Bot className="w-5 h-5" />
              <span className="font-medium text-sm">Central IA</span>
            </Link>
            <Link to="/admin/calendario" className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-slate-800/50 rounded-lg transition-colors">
              <Settings className="w-5 h-5" />
              <span className="font-medium text-sm">Temporada & Preços</span>
            </Link>
          </nav>
        </div>
        <div className="p-4 border-t border-slate-800">
          <Link to="/" className="text-gray-500 hover:text-gray-300 text-sm flex items-center justify-center transition-colors">
            Sair e voltar ao site
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <header className="bg-slate-900/50 backdrop-blur-md border-b border-slate-800 p-6 sticky top-0 z-10 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-serif font-bold text-white">Dashboard de Bordo</h1>
            <p className="text-sm text-gray-400">Bem-vindo ao Centro de Comando</p>
          </div>
          <div className="flex items-center gap-4">
            <button className="relative p-2 text-gray-400 hover:text-white transition-colors">
              <BellRing className="w-6 h-6" />
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-yellow-500 rounded-full border border-slate-900"></span>
            </button>
            <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-yellow-500 font-bold">
              AD
            </div>
          </div>
        </header>

        {loading ? (
             <div className="p-10 flex justify-center text-yellow-500 animate-pulse">Sincronizando radares...</div>
        ) : (
            <div className="p-6 max-w-7xl mx-auto space-y-6">
            
            {/* Métricas do Dia */}
            <section>
                <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-4">Métricas do Dia</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl relative overflow-hidden group">
                    <div className="absolute -right-6 -top-6 text-slate-800/50 group-hover:text-slate-800 transition-colors"><Ship className="w-32 h-32" /></div>
                    <div className="relative z-10">
                    <p className="text-gray-400 text-sm font-medium mb-1">Na Água Hoje</p>
                    <p className="text-4xl font-bold text-white mb-2">{stats.inWater} <span className="text-lg text-gray-500 font-normal">lanchas</span></p>
                    {stats.inWater > 0 && (
                        <div className="flex gap-2 mt-4 text-xs">
                        <span className="bg-slate-800 text-yellow-500 px-2 py-1 rounded-md border border-slate-700">Operando</span>
                        </div>
                    )}
                    </div>
                </motion.div>

                <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl relative overflow-hidden group">
                    <div className="absolute -right-6 -top-6 text-slate-800/50 group-hover:text-slate-800 transition-colors"><CalendarCheck className="w-32 h-32" /></div>
                    <div className="relative z-10">
                    <p className="text-gray-400 text-sm font-medium mb-1">Check-ins 24h</p>
                    <p className="text-4xl font-bold text-white mb-2">{stats.checkins} <span className="text-lg text-gray-500 font-normal">grupos</span></p>
                    {stats.checkins > 0 && <p className="text-sm text-yellow-500 flex items-center gap-1 mt-4"><Clock className="w-4 h-4"/> Próximo listado no calendário</p>}
                    </div>
                </motion.div>

                <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }} className="bg-gradient-to-br from-slate-900 to-slate-800 border border-yellow-500/30 p-6 rounded-2xl shadow-[0_0_30px_rgba(234,179,8,0.05)] relative overflow-hidden group">
                    <div className="absolute -right-6 -top-6 text-yellow-500/5 group-hover:text-yellow-500/10 transition-colors"><DollarSign className="w-32 h-32" /></div>
                    <div className="relative z-10">
                    <p className="text-yellow-500/80 text-sm font-medium mb-1">Receita Confirmada 24h</p>
                    <p className="text-4xl font-bold text-yellow-500 mb-2">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(stats.revenue24h)}
                    </p>
                    <p className="text-sm text-gray-400 mt-4">Venda atrelada aos Check-ins</p>
                    </div>
                </motion.div>

                </div>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Alertas do Sistema */}
                <section className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl p-6">
                <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-6 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" /> Alertas do Banco (LIVEMODE)
                </h2>
                <div className="space-y-4">
                    {alerts.length === 0 ? (
                        <p className="text-sm text-gray-500 italic">Nenhum alerta recente.</p>
                    ) : alerts.map(alert => (
                    <div key={alert.id} className="flex gap-4 p-4 bg-slate-950 rounded-xl border border-slate-800">
                    <div className="bg-green-500/10 p-2 rounded-lg h-fit">
                        {alert.type === 'PIX' ? <DollarSign className="w-5 h-5 text-green-500" /> : <AlertCircle className="w-5 h-5 text-yellow-500" />}
                    </div>
                    <div>
                        <p className="text-white font-medium text-sm">
                            {alert.type === 'PIX' ? `PIX Confirmado: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(alert.amount)}` : alert.type}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">{alert.message}</p>
                        <span className="text-xs text-gray-500 mt-2 block">{formatDistanceToNow(alert.created_at)}</span>
                    </div>
                    </div>
                    ))}
                </div>
                </section>

                {/* Ações Requeridas */}
                <section className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl p-6">
                <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-6 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-yellow-500" /> Ações Requeridas (LIVEMODE)
                </h2>
                <div className="space-y-4">
                    {partnersToApprove.length === 0 && contractsPending.length === 0 && (
                        <p className="text-sm text-gray-500 text-center py-10 italic">Nenhuma pendência na central.</p>
                    )}

                    {partnersToApprove.map(res => (
                    <div key={res.id} className="flex gap-4 p-4 bg-slate-800/50 rounded-xl border border-yellow-500/30">
                    <div className="bg-yellow-500/10 p-2 rounded-lg h-fit"><AlertCircle className="w-5 h-5 text-yellow-500" /></div>
                    <div className="w-full">
                        <div className="flex justify-between items-start mb-1">
                        <p className="text-white font-medium text-sm">Aprovação de Parceiro</p>
                        <span className="bg-yellow-500 text-slate-900 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">Pendente</span>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">Uma reserva para "{res.boats?.name}" (Parceiro: {res.boats?.partners?.name}) requer sua aprovação manual.</p>
                        <div className="mt-3 flex gap-2">
                        <button className="bg-yellow-500 hover:bg-yellow-400 text-slate-900 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors">Aprovar Status</button>
                        </div>
                    </div>
                    </div>
                    ))}

                    {contractsPending.map(res => (
                    <div key={res.id} className="flex gap-4 p-4 bg-slate-950 rounded-xl border border-slate-800">
                    <div className="bg-slate-800 p-2 rounded-lg h-fit"><CheckCircle className="w-5 h-5 text-gray-400" /></div>
                    <div className="w-full">
                        <p className="text-white font-medium text-sm">Contrato Pendente</p>
                        <p className="text-xs text-gray-400 mt-1">Reserva para {res.customers?.full_name} ({res.boats?.name}) aguardando contrato digital.</p>
                        <button className="mt-3 text-yellow-500 hover:text-yellow-400 text-xs font-medium transition-colors">Gerar Contrato Automático &rarr;</button>
                    </div>
                    </div>
                    ))}
                </div>
                </section>

            </div>
            </div>
        )}
      </main>
    </div>
  );
}
