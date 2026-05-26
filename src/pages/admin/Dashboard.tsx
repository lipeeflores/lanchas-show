import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Anchor, Ship, CalendarCheck, DollarSign, BellRing, AlertCircle, CheckCircle, Clock, Landmark, Wallet, Users, Bot, Settings, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { adminPost, adminPatch } from '../../lib/adminApi';
import AdminLayout from '../../components/AdminLayout';

export default function Dashboard() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [partnersToApprove, setPartnersToApprove] = useState<any[]>([]);
  const [contractsPending, setContractsPending] = useState<any[]>([]);
  const [pendingFixedExpenses, setPendingFixedExpenses] = useState<any[]>([]);
  
  const [stats, setStats] = useState({
      inWater: 0,
      checkins: 0,
      revenue24h: 0,
      negotiatingToday: 0
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

        // Fetch Fixed Expenses and Payments
        const { data: fixedExpenses } = await supabase
            .from('boat_expenses')
            .select('*, boats(name)')
            .eq('type', 'FIXED');
            
        const { data: payableData } = await supabase
            .from('accounts_payable')
            .select('*')
            .not('boat_expense_id', 'is', null);

        if (fixedExpenses) {
            const today = new Date();
            const currentMonth = today.getMonth();
            const currentYear = today.getFullYear();
            
            const pending: any[] = [];
            
            fixedExpenses.forEach(exp => {
                const day = parseInt(exp.date.split('-')[2], 10);
                const dueDate = new Date(currentYear, currentMonth, day);
                
                const diffTime = dueDate.getTime() - today.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                
                // Show if within 5 days or overdue (up to -30 days to avoid ancient alerts)
                if (diffDays <= 5 && diffDays > -30) {
                    const isPaidThisMonth = payableData?.some(p => {
                        if (p.boat_expense_id !== exp.id || p.status !== 'PAID') return false;
                        const pDate = new Date(p.created_at);
                        return pDate.getMonth() === currentMonth && pDate.getFullYear() === currentYear;
                    });
                    
                    if (!isPaidThisMonth) {
                        pending.push({
                            ...exp,
                            due_date: dueDate,
                            diffDays
                        });
                    }
                }
            });
            
            pending.sort((a,b) => a.diffDays - b.diffDays);
            setPendingFixedExpenses(pending);
        }

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

            // Fetch active conversations in negotiation stages today
            let negotiatingToday = 0;
            try {
              const startOfToday = new Date();
              startOfToday.setHours(0, 0, 0, 0);

              const { data: convsData } = await supabase
                  .from('ia_conversations')
                  .select('id, created_at')
                  .in('stage', ['novo', 'cotado', 'sinal_solicitado', 'pix_enviado']);

              const { data: msgData } = await supabase
                  .from('ia_messages')
                  .select('conversation_id')
                  .gte('created_at', startOfToday.toISOString())
                  .eq('sender', 'CLIENT');

              const activeConvIds = new Set(msgData?.map(m => m.conversation_id) || []);
              negotiatingToday = (convsData || []).filter(c => {
                  const isCreatedToday = new Date(c.created_at) >= startOfToday;
                  const isMsgToday = activeConvIds.has(c.id);
                  return isCreatedToday || isMsgToday;
              }).length;
            } catch (err) {
              console.error('Error fetching negotiating statistics:', err);
            }

            setStats({
               inWater,
               checkins,
               revenue24h,
               negotiatingToday
            });

            // Action Requests: Partner approvals (only future/today)
            // We consider 'now' ignoring time to not hide today's reservations
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);

            setPartnersToApprove(resData.filter(r => r.status === 'AWAITING_PARTNER' && new Date(r.start_date) >= todayStart));
            
            // Action Requests: Pending contracts (only future/today)
            setContractsPending(resData.filter(r => r.status === 'PENDING_CONTRACT' && new Date(r.start_date) >= todayStart));
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

  const handleMarkExpensePaid = async (exp: any) => {
      try {
          const { error: err1 } = await adminPost('/api/admin/accounts-payable', {
              amount: exp.amount,
              description: `Pagamento Fixo: ${exp.description}`,
              status: 'PAID',
              due_date: exp.due_date.toISOString().split('T')[0],
              boat_expense_id: exp.id,
              payee_type: 'EXTERNAL'
          });
          if (err1) throw err1;

          const { error: err2 } = await adminPost('/api/admin/cash-transactions', {
              type: 'EXPENSE',
              amount: exp.amount,
              description: `[FIXO] ${exp.description} (${exp.boats?.name || 'Geral'})`
          });
          if (err2) throw err2;

          setPendingFixedExpenses(prev => prev.filter(p => p.id !== exp.id));
      } catch (err: any) {
          alert('Erro ao dar baixa: ' + err.message);
      }
  };

  const handleApprovePartner = async (id: string) => {
      try {
          const { error } = await adminPatch(`/api/admin/reservations/${id}`, { status: 'PENDING_CONTRACT' });
          if (error) throw error;
          const res = partnersToApprove.find(r => r.id === id);
          if (res) {
              setPartnersToApprove(prev => prev.filter(r => r.id !== id));
              setContractsPending(prev => [{ ...res, status: 'PENDING_CONTRACT' }, ...prev]);
          }
          alert('Parceiro aprovado! Reserva enviada para fase de contratos.');
      } catch (err: any) {
          alert('Erro ao aprovar: ' + err.message);
      }
  };

  const handleConfirmContract = async (id: string) => {
      try {
          const { error } = await adminPatch(`/api/admin/reservations/${id}`, { status: 'CONFIRMED' });
          if (error) throw error;
          setContractsPending(prev => prev.filter(r => r.id !== id));
      } catch (err: any) {
          alert('Erro ao confirmar contrato: ' + err.message);
      }
  };

  const [contractData, setContractData] = useState<any>(null);

  const handleGenerateContract = async (res: any) => {
      const { data: customer } = await supabase.from('customers').select('*').eq('id', res.customer_id).single();
      if (customer) res.customers = customer;
      
      const c = res.customers;
      if (!c.document_cpf || !c.document_rg || !c.address) {
          alert(`Faltam dados do cliente (${c?.full_name || 'Desconhecido'}) para gerar o contrato. Vá em "Clientes CRM" e preencha CPF, RG e Endereço completo.`);
          return;
      }
      setContractData(res);
  };

  return (
    <AdminLayout>
      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <header className="bg-slate-900/50 backdrop-blur-md border-b border-slate-800 p-6 md:sticky md:top-0 z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-serif font-bold text-white">Dashboard de Bordo</h1>
            <p className="text-sm text-gray-400">Bem-vindo ao Centro de Comando</p>
          </div>
          <div className="flex items-center gap-4 w-full sm:w-auto justify-end">
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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                
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
                    {stats.checkins > 0 && <p className="text-sm text-yellow-500 flex items-center gap-1 mt-4"><Clock className="w-4 h-4"/> Próximo no calendário</p>}
                    </div>
                </motion.div>

                <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }} className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl relative overflow-hidden group">
                    <div className="absolute -right-6 -top-6 text-slate-800/50 group-hover:text-slate-800 transition-colors"><DollarSign className="w-32 h-32" /></div>
                    <div className="relative z-10">
                    <p className="text-gray-400 text-sm font-medium mb-1">Receita Confirmada 24h</p>
                    <p className="text-4xl font-bold text-yellow-500 mb-2">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(stats.revenue24h)}
                    </p>
                    <p className="text-sm text-gray-400 mt-4">Venda atrelada aos Check-ins</p>
                    </div>
                </motion.div>

                <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }} className="bg-gradient-to-br from-slate-900 to-slate-800 border border-yellow-500/30 p-6 rounded-2xl shadow-[0_0_30px_rgba(234,179,8,0.05)] relative overflow-hidden group">
                    <div className="absolute -right-6 -top-6 text-yellow-500/5 group-hover:text-yellow-500/10 transition-colors"><Bot className="w-32 h-32" /></div>
                    <div className="relative z-10">
                    <p className="text-yellow-500/80 text-sm font-medium mb-1">Em Negociação Hoje</p>
                    <p className="text-4xl font-bold text-white mb-2">{stats.negotiatingToday} <span className="text-lg text-gray-500 font-normal">leads</span></p>
                    {stats.negotiatingToday > 0 ? (
                        <p className="text-sm text-yellow-500 flex items-center gap-1 mt-4"><Clock className="w-4 h-4"/> Clientes conversando com a IA</p>
                    ) : (
                        <p className="text-sm text-gray-400 mt-4">Dia calmo nas vendas</p>
                    )}
                    </div>
                </motion.div>

                </div>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Despesas Fixas */}
                <section className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl p-6 lg:col-span-2">
                <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-6 flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-red-400" /> Avisos de Vencimento (Despesas Fixas)
                </h2>
                <div className="space-y-4">
                    {pendingFixedExpenses.length === 0 ? (
                        <p className="text-sm text-gray-500 italic">Nenhum vencimento próximo.</p>
                    ) : pendingFixedExpenses.map(exp => (
                    <div key={exp.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-950 rounded-xl border border-red-500/20">
                      <div className="flex items-center gap-4">
                        <div className="bg-red-500/10 p-2 rounded-lg h-fit">
                            <Wallet className="w-5 h-5 text-red-500" />
                        </div>
                        <div>
                            <p className="text-white font-medium text-sm">
                                {exp.description} <span className="text-gray-500 text-xs">({exp.boats?.name})</span>
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                                Vence em: {exp.due_date.toLocaleDateString()} 
                                <span className={exp.diffDays < 0 ? 'text-red-500 ml-2 font-bold' : 'text-yellow-500 ml-2'}>
                                  {exp.diffDays < 0 ? `(Atrasado ${Math.abs(exp.diffDays)} dias)` : exp.diffDays === 0 ? '(Vence Hoje)' : `(Em ${exp.diffDays} dias)`}
                                </span>
                            </p>
                        </div>
                      </div>
                      <div className="mt-4 sm:mt-0 flex items-center gap-4">
                        <p className="text-lg font-bold text-white">
                           {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(exp.amount)}
                        </p>
                        <button onClick={() => handleMarkExpensePaid(exp)} className="bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 text-green-500 font-bold px-4 py-2 rounded-lg text-sm transition-colors">
                           Dar Baixa
                        </button>
                      </div>
                    </div>
                    ))}
                </div>
                </section>
                
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
                        <button onClick={() => handleApprovePartner(res.id)} className="bg-yellow-500 hover:bg-yellow-400 text-slate-900 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors">Aprovar Status</button>
                        </div>
                    </div>
                    </div>
                    ))}

                    {contractsPending.map(res => (
                    <div key={res.id} className="flex gap-4 p-4 bg-slate-950 rounded-xl border border-slate-800">
                    <div className="bg-slate-800 p-2 rounded-lg h-fit"><CheckCircle className="w-5 h-5 text-gray-400" /></div>
                    <div className="w-full">
                        <div className="flex justify-between items-start mb-1">
                            <p className="text-white font-medium text-sm">Contrato Pendente</p>
                            <span className="bg-slate-700 text-gray-300 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">Ação Necessária</span>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">Reserva para {res.customers?.full_name} ({res.boats?.name}) aguardando contrato digital.</p>
                        <div className="mt-3 flex gap-3 items-center">
                            <button onClick={() => handleGenerateContract(res)} className="text-yellow-500 hover:text-yellow-400 text-xs font-medium transition-colors border border-yellow-500/30 px-3 py-1.5 rounded-lg hover:bg-yellow-500/10">Gerar Contrato Automático &rarr;</button>
                            <button onClick={() => handleConfirmContract(res.id)} className="text-green-500 hover:text-green-400 text-xs font-medium transition-colors border border-green-500/30 px-3 py-1.5 rounded-lg hover:bg-green-500/10">Marcar como Contratado</button>
                        </div>
                    </div>
                    </div>
                    ))}
                </div>
                </section>

            </div>
            </div>
        )}

        {/* Contract Modal */}
        {contractData && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
               <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    Contrato Gerado Automáticamente
                  </h2>
                  <button onClick={() => setContractData(null)} className="text-gray-500 hover:text-white transition-colors">
                     <span className="text-xl">&times;</span>
                  </button>
               </div>
               <div className="p-6 overflow-y-auto flex-1 text-xs sm:text-sm text-gray-300 font-mono whitespace-pre-wrap bg-slate-950 m-4 rounded border border-slate-800 leading-relaxed">
                 CONTRATO DE LOCAÇÃO DE EMBARCAÇÃO

CONTRATANTE:
Nome: {contractData.customers.full_name}
CPF: {contractData.customers.document_cpf}
RG: {contractData.customers.document_rg}
Endereço: {contractData.customers.address}
Telefone: {contractData.customers.phone}
Email: {contractData.customers.email}

CONTRATADA (DADOS DO BARCO):
Embarcação: {contractData.boats.name}
Valor Total: R$ {contractData.total_price}
Sinal Recebido: R$ {contractData.down_payment}
Data de Início: {new Date(contractData.start_date).toLocaleDateString()}
Data de Término: {new Date(contractData.end_date).toLocaleDateString()}

[COLE O SEU MODELO OFICIAL DE CONTRATO AQUI. As variáveis acima mostram que o sistema já consegue puxar todos os dados necessários. Você poderá editar este texto no código ou podemos criar uma tela de configurações para colar o modelo definitivo.]
               </div>
               <div className="p-6 border-t border-slate-800 flex justify-end gap-3 bg-slate-900/50">
                  <button onClick={() => setContractData(null)} className="px-4 py-2 text-gray-400 font-bold hover:text-white transition-colors">
                    Fechar
                  </button>
                  <button onClick={() => navigator.clipboard.writeText(`CONTRATANTE: ${contractData.customers.full_name}\nCPF: ${contractData.customers.document_cpf}`)} className="bg-yellow-500 hover:bg-yellow-400 text-slate-900 font-bold px-6 py-2 rounded-lg transition-colors">
                    Copiar Texto
                  </button>
               </div>
            </div>
          </div>
        )}
      </main>
    </AdminLayout>
  );
}
