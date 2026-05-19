import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Link } from 'react-router-dom';
import { Anchor, Ship, CalendarCheck, Landmark, Wallet, Users, Bot, Settings, Star, Trash2, MessageSquare, ShieldCheck, User, RefreshCw } from 'lucide-react';

export default function EvaluationsDashboard() {
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Statistics
  const [stats, setStats] = useState({
    total: 0,
    boatAvg: 0,
    captainAvg: 0,
    perfectTrips: 0
  });

  const fetchEvaluations = async () => {
    try {
      const { data, error } = await supabase
        .from('evaluations')
        .select('*, boats(name)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) {
        setEvaluations(data);
        
        // Calculate Stats
        const total = data.length;
        if (total > 0) {
          const boatSum = data.reduce((acc, curr) => acc + (curr.boat_stars || 0), 0);
          const capSum = data.reduce((acc, curr) => acc + (curr.captain_stars || 0), 0);
          const perfect = data.filter(d => d.boat_stars === 5 && d.captain_stars === 5).length;
          setStats({
            total,
            boatAvg: Number((boatSum / total).toFixed(1)),
            captainAvg: Number((capSum / total).toFixed(1)),
            perfectTrips: perfect
          });
        } else {
          setStats({ total: 0, boatAvg: 0, captainAvg: 0, perfectTrips: 0 });
        }
      }
    } catch (err: any) {
      console.error('Erro ao buscar avaliações:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchEvaluations();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchEvaluations();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir esta avaliação de forma permanente?')) return;
    
    try {
      const { error } = await supabase
        .from('evaluations')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setEvaluations(evaluations.filter(e => e.id !== id));
      
      // Re-trigger stats calculation from updated local array
      const nextEval = evaluations.filter(e => e.id !== id);
      const total = nextEval.length;
      if (total > 0) {
        const boatSum = nextEval.reduce((acc, curr) => acc + (curr.boat_stars || 0), 0);
        const capSum = nextEval.reduce((acc, curr) => acc + (curr.captain_stars || 0), 0);
        const perfect = nextEval.filter(d => d.boat_stars === 5 && d.captain_stars === 5).length;
        setStats({
          total,
          boatAvg: Number((boatSum / total).toFixed(1)),
          captainAvg: Number((capSum / total).toFixed(1)),
          perfectTrips: perfect
        });
      } else {
        setStats({ total: 0, boatAvg: 0, captainAvg: 0, perfectTrips: 0 });
      }
    } catch (err: any) {
      alert('Erro ao excluir avaliação: ' + err.message);
    }
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-0.5 text-yellow-500">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-3.5 h-3.5 ${star <= rating ? 'fill-yellow-500 text-yellow-500' : 'text-slate-700'}`}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 flex text-slate-50 font-sans selection:bg-yellow-500/30">
      
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col hidden md:flex shrink-0">
        <div className="p-6 flex items-center justify-center border-b border-slate-800">
          <img src="/logo.png" alt="Lanchas Show" className="h-16 w-auto drop-shadow-[0_0_8px_rgba(234,179,8,0.2)]" />
        </div>
        <div className="p-4 flex-grow overflow-y-auto">
          <nav className="space-y-1">
            <Link to="/admin/dashboard" className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-slate-800/50 rounded-lg transition-colors">
              <Ship className="w-5 h-5" />
              <span className="text-sm">Visão 360º</span>
            </Link>
            <Link to="/admin/reservas" className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-slate-800/50 rounded-lg transition-colors">
              <CalendarCheck className="w-5 h-5" />
              <span className="text-sm">Reservas</span>
            </Link>
            <Link to="/admin/frota" className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-slate-800/50 rounded-lg transition-colors">
              <Landmark className="w-5 h-5" />
              <span className="text-sm">Gestão de Frotas</span>
            </Link>
            <Link to="/admin/financeiro" className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-slate-800/50 rounded-lg transition-colors">
              <Wallet className="w-5 h-5" />
              <span className="text-sm">DRE & Caixa</span>
            </Link>
            <Link to="/admin/clientes" className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-slate-800/50 rounded-lg transition-colors">
              <Users className="w-5 h-5" />
              <span className="text-sm">Clientes CRM</span>
            </Link>
            <Link to="/admin/ia" className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-slate-800/50 rounded-lg transition-colors">
              <Bot className="w-5 h-5" />
              <span className="text-sm">Central IA</span>
            </Link>
            <Link to="/admin/calendario" className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-slate-800/50 rounded-lg transition-colors">
              <Settings className="w-5 h-5" />
              <span className="text-sm">Temporada & Preços</span>
            </Link>
            <Link to="/admin/avaliacoes" className="flex items-center gap-3 px-4 py-3 bg-slate-800 text-yellow-500 rounded-lg border border-slate-700">
              <Star className="w-5 h-5" />
              <span className="text-sm">Avaliações</span>
            </Link>
          </nav>
        </div>
        <div className="p-4 border-t border-slate-800">
          <Link to="/" className="text-gray-500 hover:text-gray-300 text-sm flex items-center justify-center transition-colors">
            Sair e voltar ao site
          </Link>
        </div>
      </aside>

      {/* Main Panel */}
      <main className="flex-1 flex flex-col overflow-hidden bg-slate-950">
        
        {/* Header */}
        <header className="bg-slate-900/50 backdrop-blur-md border-b border-slate-800 p-6 flex justify-between items-center shrink-0">
          <div>
            <h1 className="text-2xl font-serif font-bold text-white flex items-center gap-2">
              <Star className="w-6 h-6 text-yellow-500" />
              Avaliações de Clientes (DNA)
            </h1>
            <p className="text-sm text-gray-400">Feedback público enviado por clientes após passeios</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="bg-slate-800 border border-slate-700 hover:border-slate-600 p-2.5 rounded-xl text-gray-400 hover:text-white transition-colors disabled:opacity-50"
              title="Recarregar dados"
            >
              <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <a
              href="/avaliacao"
              target="_blank"
              rel="noreferrer"
              className="bg-yellow-500 hover:bg-yellow-400 text-slate-900 font-bold px-4 py-2.5 rounded-xl text-xs uppercase tracking-wider transition-colors flex items-center gap-1.5 shadow-[0_0_15px_rgba(234,179,8,0.2)]"
            >
              <Smile className="w-4 h-4" /> Link para Cliente
            </a>
          </div>
        </header>

        {/* Panel View */}
        <div className="flex-grow overflow-y-auto p-6">
          {loading ? (
            <div className="p-10 text-center text-yellow-500 animate-pulse font-medium">Carregando Depoimentos...</div>
          ) : (
            <div className="max-w-6xl mx-auto space-y-6">
              
              {/* Analytics summary row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
                  <p className="text-[10px] text-gray-500 uppercase font-black tracking-wider">Total de Retornos</p>
                  <p className="text-3xl font-black text-white mt-1.5">{stats.total}</p>
                  <p className="text-xs text-gray-400 mt-1">Depoimentos coletados</p>
                </div>
                
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
                  <p className="text-[10px] text-gray-500 uppercase font-black tracking-wider">Média Lanchas</p>
                  <div className="flex items-baseline gap-2 mt-1.5">
                    <p className="text-3xl font-black text-yellow-500">{stats.boatAvg}</p>
                    <span className="text-xs text-gray-400">/ 5★</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Conservação e conforto</p>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
                  <p className="text-[10px] text-gray-500 uppercase font-black tracking-wider">Média Marinheiros</p>
                  <div className="flex items-baseline gap-2 mt-1.5">
                    <p className="text-3xl font-black text-amber-500">{stats.captainAvg}</p>
                    <span className="text-xs text-gray-400">/ 5★</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Atendimento e tripulação</p>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
                  <p className="text-[10px] text-gray-500 uppercase font-black tracking-wider">Avaliações 5 Estrelas</p>
                  <p className="text-3xl font-black text-emerald-400 mt-1.5">{stats.perfectTrips}</p>
                  <p className="text-xs text-gray-400 mt-1">Satisfação 100% perfeita</p>
                </div>
              </div>

              {/* Feed Grid */}
              {evaluations.length === 0 ? (
                <div className="text-center py-20 bg-slate-900 border border-slate-800/80 rounded-3xl border-dashed">
                  <MessageSquare className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                  <p className="text-gray-400 font-serif text-lg">Nenhuma avaliação recebida ainda.</p>
                  <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">Mande o link público `/avaliacao` para seus clientes após o aluguel para começar a coletar depoimentos.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {evaluations.map((e) => (
                    <div key={e.id} className="bg-slate-900 border border-slate-800/80 rounded-2xl p-6 relative overflow-hidden flex flex-col justify-between hover:border-slate-700 transition-all shadow-md group">
                      
                      {/* Top Header Card */}
                      <div>
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-sm font-bold text-white flex items-center gap-1.5">
                              <User className="w-4 h-4 text-yellow-500" />
                              {e.customer_name || 'Anônimo'}
                            </p>
                            {e.customer_phone && (
                              <p className="text-xs text-gray-500 mt-0.5">{e.customer_phone}</p>
                            )}
                          </div>
                          
                          <div className="flex flex-col items-end gap-1">
                            <span className="text-[9px] text-gray-500 uppercase font-bold">
                              {new Date(e.created_at).toLocaleDateString('pt-BR', {
                                day: '2-digit',
                                month: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                            <button
                              onClick={() => handleDelete(e.id)}
                              className="text-gray-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 p-1"
                              title="Remover Avaliação"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Rating Row (Boat / Captain) */}
                        <div className="grid grid-cols-2 gap-3 mt-4 bg-slate-950/60 p-3 rounded-xl border border-slate-800/40">
                          <div>
                            <p className="text-[9px] text-gray-500 uppercase font-bold flex items-center gap-1">
                              <Ship className="w-3 h-3" /> Lancha
                            </p>
                            <p className="text-xs font-bold text-gray-200 mt-0.5 truncate">
                              {e.boat_name_custom || e.boats?.name || 'Não especificada'}
                            </p>
                            <div className="mt-1">{renderStars(e.boat_stars || 5)}</div>
                          </div>

                          <div>
                            <p className="text-[9px] text-gray-500 uppercase font-bold flex items-center gap-1">
                              <Anchor className="w-3 h-3" /> Marinheiro
                            </p>
                            <p className="text-xs font-bold text-gray-200 mt-0.5 truncate">
                              {e.captain_name || 'Não especificado'}
                            </p>
                            <div className="mt-1">{renderStars(e.captain_stars || 5)}</div>
                          </div>
                        </div>
                      </div>

                      {/* Comment Message Box */}
                      <div className="mt-4 pt-4 border-t border-slate-800 flex-grow flex flex-col justify-end">
                        {e.comments ? (
                          <div className="bg-slate-950/40 border border-slate-850 p-3.5 rounded-xl">
                            <p className="text-xs text-gray-300 leading-relaxed italic">
                              "{e.comments}"
                            </p>
                          </div>
                        ) : (
                          <p className="text-[10px] text-gray-600 italic">Cliente não deixou comentários por escrito.</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

            </div>
          )}
        </div>
      </main>

    </div>
  );
}

// Add temporary mock for Smile icon to prevent lint issues in imports
function Smile(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <line x1="9" x2="9.01" y1="9" y2="9" />
      <line x1="15" x2="15.01" y1="9" y2="9" />
    </svg>
  );
}
