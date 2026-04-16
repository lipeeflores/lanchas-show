import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  Anchor, Ship, CalendarCheck, Search, ChevronLeft, ChevronRight, UserPlus, 
  Filter, BellRing, Settings, Landmark, Wallet, Users, Bot, X, Check, 
  Clock, Plus, AlertCircle, MessageSquare, Save, MapPin, Loader2 
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { getRoutePriceSuggestion, PricingTier } from '../../lib/pricingEngine';

export default function ReservationsMap() {
  const [boats, setBoats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [allCustomers, setAllCustomers] = useState<any[]>([]);
  
  // New Reservation Form State
  const today = new Date();
  today.setHours(0,0,0,0); // normalize today to midnight
  const dates = Array.from({ length: 14 }).map((_, i) => {
    const d = new Date(today.getTime());
    d.setDate(d.getDate() + i);
    return d;
  });

  const [formData, setFormData] = useState({
    boat_id: '',
    customer_id: '',
    date: today.toISOString().split('T')[0],
    embarkation: '',
    destination: '',
    base_price: 0,
    floating_mat: 'none', // none, paid, courtesy
    extra_hours: 0,
    status: 'PENDING',
    notes: ''
  });

  const [availableRoutes, setAvailableRoutes] = useState<any[]>([]);
  const [pricingInfo, setPricingInfo] = useState<{ tier: string; reason: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

    const fetchBoatsAndReservations = async () => {
      try {
        setLoading(true);
        const { data: boatsData, error: boatsError } = await supabase
          .from('boats')
          .select('*, partners(name, management_level)')
          .order('owner_type', { ascending: true })
          .order('created_at', { ascending: true });
          
        if (boatsError) throw boatsError;

        const endDateRange = new Date(today.getTime());
        endDateRange.setDate(endDateRange.getDate() + 14);

        const { data: resData, error: resError } = await supabase
          .from('reservations')
          .select('*, customers(full_name)')
          .gte('end_date', today.toISOString())
          .lte('start_date', endDateRange.toISOString());
        
        if (resError) throw resError;

        const boatsWithRsv = boatsData?.map(b => {
            const boatRes = resData?.filter(r => r.boat_id === b.id) || [];
            const mappedRsv = boatRes.map(r => {
               const sDate = new Date(r.start_date); sDate.setHours(0,0,0,0);
               const eDate = new Date(r.end_date); eDate.setHours(0,0,0,0);
               const offsetDays = Math.round((sDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
               const lengthDays = Math.max(1, Math.round((eDate.getTime() - sDate.getTime()) / (1000 * 60 * 60 * 24)));
               return { offset: offsetDays, length: lengthDays, status: r.status, client: r.customers?.full_name || 'Cliente' };
            });
            return { ...b, reservations: mappedRsv };
        }) || [];

        setBoats(boatsWithRsv);
      } catch (err: any) {
        console.error('Erro ao carregar mapa:', err.message);
      } finally {
        setLoading(false);
      }
    };

  useEffect(() => {
    fetchBoatsAndReservations();
    
    const fetchCustomers = async () => {
      try {
        const { data, error } = await supabase.from('customers').select('*').order('full_name');
        if (error) throw error;
        setAllCustomers(data || []);
      } catch (err: any) {
        console.error('Erro clientes:', err.message);
      }
    };
    fetchCustomers();
  }, []);

  // Effect to update routes when boat changes
  useEffect(() => {
    if (formData.boat_id) {
      const fetchRoutes = async () => {
        const { data } = await supabase.from('boat_routes_pricing').select('*').eq('boat_id', formData.boat_id);
        const routes = data || [];
        setAvailableRoutes(routes);
        // If current embark/dest not in routes, clear them
        if (!routes.some(r => r.embarkation_point === formData.embarkation && r.destination_point === formData.destination)) {
          setFormData(prev => ({ ...prev, embarkation: '', destination: '', base_price: 0 }));
        }
      };
      fetchRoutes();
    }
  }, [formData.boat_id]);

  // Effect to update suggested price
  useEffect(() => {
    if (formData.boat_id && formData.date && formData.embarkation && formData.destination) {
      const updatePrice = async () => {
        const result = await getRoutePriceSuggestion(formData.boat_id, formData.date, formData.embarkation, formData.destination);
        setFormData(prev => ({ ...prev, base_price: result.suggestedPrice }));
        setPricingInfo({ tier: result.tier, reason: result.reason });
      };
      updatePrice();
    }
  }, [formData.boat_id, formData.date, formData.embarkation, formData.destination]);

  const handleSaveReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.boat_id || !formData.customer_id) return;
    setIsSaving(true);

    const matValue = formData.floating_mat === 'paid' ? 300 : 0;
    const extraHoursValue = formData.extra_hours * 1000;
    const total = Number(formData.base_price) + matValue + extraHoursValue;

    const payload = {
      boat_id: formData.boat_id,
      customer_id: formData.customer_id,
      start_date: new Date(formData.date + 'T09:00:00').toISOString(),
      end_date: new Date(formData.date + 'T17:00:00').toISOString(),
      status: formData.status,
      base_price_closed: formData.base_price,
      floating_mat_status: formData.floating_mat,
      floating_mat_value: matValue,
      extra_hours_qty: formData.extra_hours,
      extra_hours_total_value: extraHoursValue,
      total_reservation_value: total,
      total_price: total // legacy support
    };

    const { error } = await supabase.from('reservations').insert([payload]);
    if (!error) {
      await fetchBoatsAndReservations();
      setIsModalOpen(false);
    }
    setIsSaving(false);
  };

  const openNewReservation = (boatId?: string, dateStr?: string) => {
    const selectedBoatId = boatId || (boats[0]?.id || '');
    
    setFormData({
      boat_id: selectedBoatId,
      customer_id: '',
      date: dateStr || today.toISOString().split('T')[0],
      embarkation: '',
      destination: '',
      base_price: 0,
      floating_mat: 'none',
      extra_hours: 0,
      status: 'PENDING',
      notes: ''
    });
    setPricingInfo(null);
    setIsModalOpen(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CONFIRMED': return 'bg-green-500 border-green-600 font-bold';
      case 'AWAITING_PARTNER': return 'bg-yellow-500 border-yellow-600 text-slate-900 font-bold';
      case 'PENDING_CONTRACT': return 'bg-blue-500 border-blue-600 font-bold';
      case 'BLOCKED': return 'bg-red-500 border-red-600 font-bold';
      default: return 'bg-slate-700 border-slate-600 text-gray-300';
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex text-slate-50 font-sans selection:bg-yellow-500/30">
      
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col hidden md:flex">
        <div className="p-6 flex items-center justify-center border-b border-slate-800">
          <img src="/logo.png" alt="Lanchas Show" className="h-16 w-auto drop-shadow-[0_0_8px_rgba(234,179,8,0.2)]" />
        </div>
        <div className="p-4 flex-grow">
          <p className="text-xs uppercase tracking-widest text-gray-500 mb-4 px-4">Menu ADM</p>
          <nav className="space-y-2">
            <Link to="/admin/dashboard" className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-slate-800/50 rounded-lg transition-colors">
              <Ship className="w-5 h-5" />
              <span className="font-medium text-sm">Visão 360º</span>
            </Link>
            <Link to="/admin/reservas" className="flex items-center gap-3 px-4 py-3 bg-slate-800 text-yellow-500 rounded-lg border border-slate-700">
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
      </aside>

      <main className="flex-1 overflow-auto flex flex-col">
        {/* Header */}
        <header className="bg-slate-900/50 backdrop-blur-md border-b border-slate-800 p-6 flex justify-between items-center shrink-0">
          <div>
            <h1 className="text-2xl font-serif font-bold text-white">Mapa de Reservas</h1>
            <p className="text-sm text-gray-400">Calendário Inteligente (Gantt) - LIVE DATABASE</p>
          </div>
          <div className="flex gap-4">
            <div className="hidden lg:flex items-center gap-4 text-xs font-medium mr-4">
               <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500 block border border-green-600"></span> Confirmado</span>
               <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-yellow-500 block border border-yellow-600"></span> Aguardando Parc.</span>
               <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-500 block border border-blue-600"></span> Pendente Contrato</span>
               <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500 block border border-red-600"></span> Bloqueado</span>
            </div>
            <button className="bg-slate-800 border border-slate-700 p-2 rounded-lg text-gray-400 hover:text-white transition-colors">
                <Filter className="w-5 h-5"/>
            </button>
            <button 
              onClick={() => openNewReservation()}
              className="bg-yellow-500 hover:bg-yellow-400 text-slate-900 font-bold px-4 py-2 rounded-lg transition-colors text-sm shadow-[0_0_15px_rgba(234,179,8,0.2)]"
            >
                Nova Reserva
            </button>
          </div>
        </header>

        {/* Gantt Chart Container */}
        <div className="p-6 flex-1 overflow-auto bg-slate-950">
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden min-w-[1000px] shadow-2xl flex flex-col h-full">
            
            {/* Gantt Header (Dates) */}
            <div className="flex border-b border-slate-800 bg-slate-900/80 shrink-0">
              <div className="w-64 p-4 border-r border-slate-800 flex items-center justify-between">
                <span className="text-sm font-bold uppercase tracking-wider text-gray-400">Embarcações</span>
                <div className="flex gap-1">
                  <button className="p-1 hover:bg-slate-800 rounded text-gray-500"><ChevronLeft className="w-4 h-4"/></button>
                  <button className="p-1 hover:bg-slate-800 rounded text-gray-500"><ChevronRight className="w-4 h-4"/></button>
                </div>
              </div>
              <div className="flex-1 grid grid-cols-14" style={{ gridTemplateColumns: 'repeat(14, minmax(0, 1fr))' }}>
                {dates.map((d, i) => (
                  <div key={i} className={`p-2 border-r border-slate-800/50 text-center flex flex-col justify-center ${i===0 ? 'bg-yellow-500/5' : ''}`}>
                    <span className="text-[10px] uppercase text-gray-500 font-bold">{dayNames[d.getDay()]}</span>
                    <span className={`text-sm font-bold ${i===0 ? 'text-yellow-500' : 'text-gray-300'}`}>{d.getDate()}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Gantt Body (Boats List) */}
            <div className="overflow-y-auto flex-1">
              {loading ? (
                <div className="p-10 text-center text-yellow-500 animate-pulse">Sincronizando banco de reservas...</div>
              ) : (
                boats.map((boat) => (
                  <div key={boat.id} className="flex border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors group relative min-h-[60px]">
                    <div className="w-64 p-3 border-r border-slate-800 flex flex-col justify-center z-10 bg-slate-900/80 backdrop-blur-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white text-sm truncate pr-2">{boat.name}</span>
                        {boat.owner_type === 'OWN' ? (
                          <span className="text-[10px] bg-slate-800 text-gray-400 px-1.5 py-0.5 rounded border border-slate-700 whitespace-nowrap">Frota Própria</span>
                        ) : (
                          <span className="text-[10px] bg-yellow-500/10 text-yellow-500 px-1.5 py-0.5 rounded border border-yellow-500/20 whitespace-nowrap outline outline-1 outline-yellow-500/30" title={boat.partners?.name}>
                            Parceiro {boat.owner_type === 'PARTNER_L1' ? 'L1' : 'L2'}
                          </span>
                        )}
                      </div>
                      {boat.owner_type !== 'OWN' && (
                        <span className="text-[10px] text-gray-500 truncate mt-1">Dono: {boat.partners?.name}</span>
                      )}
                    </div>
                    
                    {/* The Timetable Cells */}
                    <div className="flex-1 grid relative" style={{ gridTemplateColumns: 'repeat(14, minmax(0, 1fr))' }}>
                      {/* Grid background lines */}
                      {dates.map((d, i) => (
                        <div 
                          key={i} 
                          onClick={() => openNewReservation(boat.id, d.toISOString().split('T')[0])}
                          className={`border-r border-slate-800/30 h-full cursor-pointer hover:bg-yellow-500/10 transition-colors ${i===0 ? 'bg-yellow-500/5' : ''}`}
                        ></div>
                      ))}
                      
                      {/* Overlaid Reservations */}
                      {boat.reservations?.map((res, idx) => {
                         if(res.offset > 13 || res.offset + res.length < 0) return null;
                         const startIdx = Math.max(0, res.offset);
                         const endIdx = Math.min(14, res.offset + res.length);
                         const visualLength = endIdx - startIdx;
                         
                         return (
                            <div 
                                key={idx} 
                                className={`absolute top-2 bottom-2 rounded-md border shadow-md flex items-center px-2 cursor-pointer
                                  ${getStatusColor(res.status)} hover:brightness-110 transition-all overflow-hidden whitespace-nowrap z-20`}
                                style={{
                                    left: `${(startIdx / 14) * 100}%`,
                                    width: `${(visualLength / 14) * 100}%`,
                                    marginLeft: '3px',
                                    marginRight: '3px'
                                }}
                            >
                                <span className={`text-[10px] truncate ${res.status === 'AWAITING_PARTNER' ? 'text-slate-900' : 'text-white'}`}>
                                    {res.status === 'BLOCKED' ? 'Manutenção' : 
                                     res.status === 'AWAITING_PARTNER' ? `Aguar.L2: ${res.client}` : res.client}
                                </span>
                            </div>
                         )
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Modal de Nova Reserva Inteligente */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[100] flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-5xl shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col max-h-[90vh] overflow-hidden">
              <div className="p-8 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                <div className="flex items-center gap-3">
                  <div className="bg-yellow-500/10 p-2 rounded-xl border border-yellow-500/20">
                    <UserPlus className="w-6 h-6 text-yellow-500" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white">Reserva Estratégica</h2>
                    <p className="text-xs text-gray-500 uppercase tracking-widest font-medium text-yellow-500/60 font-bold">Lanchas Show Yield Engine</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)} 
                  className="bg-slate-800 p-2 rounded-full text-gray-400 hover:text-white transition-colors hover:bg-slate-700"
                >
                  <X className="w-6 h-6"/>
                </button>
              </div>

              <form onSubmit={handleSaveReservation} className="p-8 overflow-y-auto flex-1 space-y-10">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                  
                  {/* Identificação */}
                  <div className="space-y-6">
                    <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-yellow-500 flex items-center gap-2 mb-4 pb-2 border-b border-slate-800">
                      <Users className="w-4 h-4"/> 01. Identificação
                    </h3>
                    
                    <div className="space-y-4">
                      <div className="group">
                        <label className="text-[10px] text-gray-500 uppercase font-bold mb-1.5 block">Cliente Registrado</label>
                        <select 
                          required
                          value={formData.customer_id} 
                          onChange={e => setFormData({...formData, customer_id: e.target.value})}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:border-yellow-500 transition-all outline-none text-sm appearance-none cursor-pointer"
                        >
                          <option value="">Buscar cliente no banco...</option>
                          {allCustomers.map(c => (
                            <option key={c.id} value={c.id}>{c.full_name} ({c.phone})</option>
                          ))}
                        </select>
                      </div>

                      <div className="group">
                        <label className="text-[10px] text-gray-500 uppercase font-bold mb-1.5 block">Embarcação</label>
                        <select 
                          required
                          value={formData.boat_id} 
                          onChange={e => setFormData({...formData, boat_id: e.target.value})}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:border-yellow-500 transition-all outline-none text-sm appearance-none cursor-pointer"
                        >
                          {boats.map(b => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="group">
                        <label className="text-[10px] text-gray-500 uppercase font-bold mb-1.5 block">Data Selecionada</label>
                        <input 
                          type="date" 
                          required
                          value={formData.date}
                          onChange={e => setFormData({...formData, date: e.target.value})}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:border-yellow-500 transition-all outline-none text-sm cursor-text"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Rota e Yield */}
                  <div className="space-y-6">
                    <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-yellow-500 flex items-center gap-2 mb-4 pb-2 border-b border-slate-800">
                      <MapPin className="w-4 h-4"/> 02. Inteligência de Rota
                    </h3>

                    <div className="space-y-4">
                      <div className="group">
                        <label className="text-[10px] text-gray-500 uppercase font-bold mb-1.5 block">Ponto de Embarque</label>
                        <select 
                          required
                          value={formData.embarkation} 
                          onChange={e => setFormData({...formData, embarkation: e.target.value})}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:border-yellow-500 transition-all outline-none text-sm appearance-none cursor-pointer"
                        >
                          <option value="">Selecione origem...</option>
                          {Array.from(new Set(availableRoutes.map(r => r.embarkation_point))).map(p => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                      </div>

                      <div className="group">
                        <label className="text-[10px] text-gray-500 uppercase font-bold mb-1.5 block">Destino Principal</label>
                        <select 
                          required
                          disabled={!formData.embarkation}
                          value={formData.destination} 
                          onChange={e => setFormData({...formData, destination: e.target.value})}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:border-yellow-500 transition-all outline-none text-sm appearance-none disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <option value="">Selecione destino...</option>
                          {availableRoutes.filter(r => r.embarkation_point === formData.embarkation).map(r => (
                            <option key={r.destination_point} value={r.destination_point}>{r.destination_point}</option>
                          ))}
                        </select>
                      </div>

                      {pricingInfo && (
                        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-5 space-y-3 shadow-lg shadow-yellow-500/5">
                          <div className="flex justify-between items-center text-[10px] font-bold text-yellow-500 uppercase tracking-widest">
                            <span>Tarifa Analisada</span>
                            <span className="bg-yellow-500 text-slate-950 px-2 py-0.5 rounded-full font-black">
                              {pricingInfo.tier === 'high_season' ? 'ALTA' : pricingInfo.tier === 'low_season' ? 'BAIXA' : 'FERIADO/FDS'}
                            </span>
                          </div>
                          <div className="text-3xl font-black text-white">R$ {formData.base_price.toLocaleString('pt-BR')}</div>
                          <p className="text-[10px] text-gray-400 italic flex items-start gap-2 leading-relaxed">
                            <AlertCircle className="w-4 h-4 text-yellow-500 shrink-0"/> {pricingInfo.reason}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Financeiro & Upsell */}
                  <div className="space-y-6">
                    <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-yellow-500 flex items-center gap-2 mb-4 pb-2 border-b border-slate-800">
                       <Wallet className="w-4 h-4"/> 03. Negociação & Upsell
                    </h3>

                    <div className="space-y-4">
                      <div>
                        <label className="text-[10px] text-gray-500 uppercase font-bold mb-1.5 block">Valor Fechado (Base)</label>
                        <div className="relative group">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">R$</span>
                          <input 
                            type="number"
                            value={formData.base_price}
                            onChange={e => setFormData({...formData, base_price: Number(e.target.value)})}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-12 pr-4 py-3 text-white font-black text-lg focus:border-yellow-500 outline-none transition-all"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                         <div className="group">
                           <label className="text-[10px] text-gray-500 uppercase font-bold mb-1.5 block">Tapete</label>
                           <select 
                             value={formData.floating_mat}
                             onChange={e => setFormData({...formData, floating_mat: e.target.value})}
                             className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-3 text-white text-xs outline-none focus:border-yellow-500 appearance-none cursor-pointer"
                           >
                              <option value="none">Nenhum</option>
                              <option value="paid">Pago (+300)</option>
                              <option value="courtesy">Cortesia</option>
                           </select>
                         </div>
                         <div className="group">
                           <label className="text-[10px] text-gray-500 uppercase font-bold mb-1.5 block">H. Extra</label>
                           <input 
                             type="number"
                             min="0"
                             value={formData.extra_hours}
                             onChange={e => setFormData({...formData, extra_hours: Number(e.target.value)})}
                             className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm font-bold outline-none focus:border-yellow-500"
                           />
                         </div>
                      </div>

                      <div className="pt-6 border-t border-slate-800 mt-2">
                         <div className="flex justify-between items-center mb-4 bg-slate-950/50 p-4 rounded-2xl border border-slate-800/50">
                            <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">Total Geral</span>
                            <span className="text-3xl font-black text-yellow-500">
                               R$ {((Number(formData.base_price) || 0) + (formData.floating_mat === 'paid' ? 300 : 0) + (formData.extra_hours * 1000)).toLocaleString('pt-BR')}
                            </span>
                         </div>
                         <select 
                           value={formData.status} 
                           onChange={e => setFormData({...formData, status: e.target.value})}
                           className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-xs font-black outline-none transition-all cursor-pointer"
                         >
                            <option value="PENDING">💾 PENDENTE</option>
                            <option value="PENDING_CONTRACT">📄 CONTRATO</option>
                            <option value="CONFIRMED">✅ CONFIRMADO</option>
                            <option value="BLOCKED">🚫 BLOQUEADO</option>
                         </select>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-950/30 rounded-2xl p-6 border border-slate-800/50">
                   <div className="flex items-center gap-2 mb-3">
                      <MessageSquare className="w-4 h-4 text-gray-500"/>
                      <label className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Observações Logísticas</label>
                   </div>
                   <textarea
                     value={formData.notes}
                     onChange={e => setFormData({...formData, notes: e.target.value})}
                     className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:border-yellow-500 outline-none h-24 transition-all resize-none"
                   />
                </div>
              </form>

              <div className="p-8 border-t border-slate-800 bg-slate-900/50 flex justify-end items-center gap-6">
                 <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-white font-bold text-sm uppercase">Cancelar</button>
                 <button 
                  onClick={handleSaveReservation}
                  disabled={isSaving || !formData.customer_id}
                  className="bg-yellow-500 hover:bg-yellow-400 disabled:opacity-30 text-slate-900 font-black px-10 py-4 rounded-2xl transition-all shadow-[0_0_30px_rgba(234,179,8,0.2)] flex items-center gap-3"
                 >
                   {isSaving ? <Loader2 className="w-6 h-6 animate-spin"/> : <Check className="w-6 h-6"/>}
                   {isSaving ? 'Salvando...' : 'Confirmar Reserva'}
                 </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
