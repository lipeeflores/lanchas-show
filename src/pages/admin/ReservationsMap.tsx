import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  Anchor, Ship, CalendarCheck, Search, ChevronLeft, ChevronRight, UserPlus, 
  Filter, BellRing, Settings, Landmark, Wallet, Users, Bot, X, Check, 
  Clock, Plus, AlertCircle, MessageSquare, Save, MapPin, Loader2, Star 
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { getRoutePriceSuggestion, PricingTier } from '../../lib/pricingEngine';
import AdminLayout from '../../components/AdminLayout';

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
    id: '',
    boat_id: '',
    customer_id: '',
    customer_name: '',
    customer_phone: '',
    date: today.toISOString().split('T')[0],
    embarkation: '',
    destination: '',
    base_price: 0,
    paid_amount: 0,
    previous_paid_amount: 0,
    commission_value: 0,
    floating_mat: 'none', // none, paid, courtesy
    extra_hours: 0,
    status: 'PENDING',
    notes: ''
  });

  const [availableRoutes, setAvailableRoutes] = useState<any[]>([]);
  const [pricingInfo, setPricingInfo] = useState<{ tier: string; reason: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [activeField, setActiveField] = useState<'name' | 'phone' | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [feedbackData, setFeedbackData] = useState({
    customerId: '',
    reservationId: '',
    stars: 5,
    notes: '',
    tags: [] as string[]
  });

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
          .select('*, customers(full_name, phone, tags, rating_stars, rating_notes)')
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
               return { 
                 offset: offsetDays, 
                 length: lengthDays, 
                 status: r.status, 
                 client: r.customers?.full_name || 'Cliente', 
                 tags: r.customers?.tags || [],
                 boarding: r.boarding_point || '',
                 destination: r.destination || '',
                 originalData: r 
               };
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
        // We no longer clear embarkation automatically here because the user might have selected a fallback option 
        // that is valid for the boat but not explicitly in `boat_routes_pricing`.
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
    if (!formData.boat_id) {
      alert("Por favor, selecione uma embarcação.");
      return;
    }
    if (formData.status !== 'BLOCKED' && !formData.customer_id && (!formData.customer_name || !formData.customer_phone)) {
      alert("Por favor, selecione um cliente ou preencha nome e telefone para cadastrar um novo.");
      return;
    }
    setIsSaving(true);

    let finalCustomerId = formData.customer_id;
    
    // If status is BLOCKED and no client is specified, map to a default placeholder customer
    if (formData.status === 'BLOCKED') {
      if (!finalCustomerId && !formData.customer_name) {
        const blockCust = allCustomers.find(c => c.full_name === 'Bloqueio / Manutenção');
        if (blockCust) {
          finalCustomerId = blockCust.id;
        } else {
          const { data: newCustomer, error: customerError } = await supabase.from('customers').insert([{
            full_name: 'Bloqueio / Manutenção',
            phone: '00000000000'
          }]).select().single();
          
          if (customerError) {
            console.error("Erro ao criar cliente para bloqueio:", customerError.message);
            alert("Erro ao criar cadastro de bloqueio: " + customerError.message);
            setIsSaving(false);
            return;
          }
          finalCustomerId = newCustomer.id;
          setAllCustomers(prev => [...prev, newCustomer]);
        }
      } else if (!finalCustomerId) {
        const { data: newCustomer, error: customerError } = await supabase.from('customers').insert([{
          full_name: formData.customer_name || 'Bloqueio / Manutenção',
          phone: formData.customer_phone || '00000000000'
        }]).select().single();
        
        if (customerError) {
          console.error("Erro ao criar cliente:", customerError.message);
          alert("Erro ao criar cadastro do cliente.");
          setIsSaving(false);
          return;
        }
        finalCustomerId = newCustomer.id;
        setAllCustomers(prev => [...prev, newCustomer]);
      }
    } else {
      // If no existing customer selected, create a new one
      if (!finalCustomerId) {
        const { data: newCustomer, error: customerError } = await supabase.from('customers').insert([{
          full_name: formData.customer_name,
          phone: formData.customer_phone
        }]).select().single();
        
        if (customerError) {
          console.error("Erro ao criar cliente:", customerError.message);
          alert("Erro ao criar cadastro do cliente.");
          setIsSaving(false);
          return;
        }
        finalCustomerId = newCustomer.id;
        setAllCustomers(prev => [...prev, newCustomer]);
      }
    }

    const matValue = formData.floating_mat === 'paid' ? 300 : 0;
    const extraHoursValue = formData.extra_hours * 1000;
    const total = Number(formData.base_price) + matValue + extraHoursValue;

    const payload = {
      boat_id: formData.boat_id,
      customer_id: finalCustomerId,
      start_date: new Date(formData.date + 'T09:00:00').toISOString(),
      end_date: new Date(formData.date + 'T17:00:00').toISOString(),
      status: formData.status,
      base_price_closed: formData.base_price,
      floating_mat_status: formData.floating_mat,
      floating_mat_value: matValue,
      extra_hours_qty: formData.extra_hours,
      extra_hours_total_value: extraHoursValue,
      total_reservation_value: total,
      paid_amount: formData.paid_amount,
      commission_value: formData.commission_value,
      boarding_point: formData.embarkation,
      destination: formData.destination,
      notes: formData.notes,
      total_price: total // legacy support
    };

    const isUpdate = !!formData.id;
    let reservationId = formData.id;
    let resError = null;

    if (isUpdate) {
      const { error } = await supabase.from('reservations').update(payload).eq('id', formData.id);
      resError = error;
    } else {
      const { data, error } = await supabase.from('reservations').insert([payload]).select('id').single();
      if (data) reservationId = data.id;
      resError = error;
    }

    if (resError) {
      console.error('Erro ao salvar reserva:', resError);
      alert('Erro ao salvar reserva: ' + resError.message);
    } else {
      const paidDelta = Number(formData.paid_amount) - Number(formData.previous_paid_amount);
      if (paidDelta > 0) {
          const boatName = boats.find(b => b.id === formData.boat_id)?.name || 'Lancha';
          await supabase.from('cash_transactions').insert([{
              type: 'INCOME',
              amount: paidDelta,
              description: `[RESERVA] Pagamento: ${boatName} — Cliente: ${formData.customer_name}`,
              reservation_id: reservationId || null
          }]);
      }

      await fetchBoatsAndReservations();
      setIsModalOpen(false);
    }
    setIsSaving(false);
  };

  const handleDeleteReservation = async () => {
    if (!formData.id) return;
    if (deleteConfirmText?.toLowerCase() !== 'apagar') {
      alert("Ação cancelada. A palavra digitada não confere.");
      return;
    }
    
    setIsSaving(true);
    const { error } = await supabase.from('reservations').delete().eq('id', formData.id);
    if (error) {
      console.error('Erro ao apagar reserva:', error);
      alert('Erro ao apagar reserva: ' + error.message);
    } else {
      await fetchBoatsAndReservations();
      setIsModalOpen(false);
    }
    setIsSaving(false);
    setIsDeleting(false);
    setDeleteConfirmText('');
  };

  const openNewReservation = (boatId?: string, dateStr?: string) => {
    const selectedBoatId = boatId || (boats[0]?.id || '');
    
    setFormData({
      id: '',
      boat_id: selectedBoatId,
      customer_id: '',
      customer_name: '',
      customer_phone: '',
      date: dateStr || today.toISOString().split('T')[0],
      embarkation: '',
      destination: '',
      base_price: 0,
      paid_amount: 0,
      previous_paid_amount: 0,
      commission_value: 0,
      floating_mat: 'none',
      extra_hours: 0,
      status: 'PENDING',
      notes: ''
    });
    setPricingInfo(null);
    setActiveField(null);
    setIsModalOpen(true);
  };

  const openEditReservation = (res: any) => {
    setFormData({
      id: res.id,
      boat_id: res.boat_id,
      customer_id: res.customer_id,
      customer_name: res.customers?.full_name || '',
      customer_phone: res.customers?.phone || '',
      date: res.start_date ? new Date(res.start_date).toISOString().split('T')[0] : today.toISOString().split('T')[0],
      embarkation: res.boarding_point || '',
      destination: res.destination || '',
      base_price: (res.base_price_closed && Number(res.base_price_closed) !== 0)
        ? Number(res.base_price_closed)
        : (Number(res.total_reservation_value) || Number(res.total_price) || 0),
      paid_amount: res.paid_amount || 0,
      previous_paid_amount: res.paid_amount || 0,
      commission_value: res.commission_value || 0,
      floating_mat: res.floating_mat_status || 'none',
      extra_hours: res.extra_hours_qty || 0,
      status: res.status || 'PENDING',
      notes: res.notes || ''
    });
    setPricingInfo(null);
    setActiveField(null);
    setIsModalOpen(true);
  };

  const handleOpenFeedback = () => {
    const cust = allCustomers.find(c => c.id === formData.customer_id);
    setFeedbackData({
      customerId: formData.customer_id,
      reservationId: formData.id,
      stars: cust?.rating_stars || 5,
      notes: cust?.rating_notes || '',
      tags: cust?.tags || []
    });
    setIsFeedbackOpen(true);
  };

  const handleSaveFeedback = async () => {
    try {
      if (!feedbackData.reservationId) return;

      // 1. Update reservation status to COMPLETED
      const { error: resError } = await supabase
        .from('reservations')
        .update({ status: 'COMPLETED' })
        .eq('id', feedbackData.reservationId);
      if (resError) throw resError;

      // 2. Update customer record (tags, rating_stars, rating_notes)
      if (feedbackData.customerId) {
        const { error: custError } = await supabase
          .from('customers')
          .update({
            tags: feedbackData.tags,
            rating_stars: feedbackData.stars,
            rating_notes: feedbackData.notes
          })
          .eq('id', feedbackData.customerId);
        if (custError) throw custError;

        // Update local state for allCustomers
        setAllCustomers(prev => prev.map(c => 
          c.id === feedbackData.customerId 
            ? { ...c, tags: feedbackData.tags, rating_stars: feedbackData.stars, rating_notes: feedbackData.notes } 
            : c
        ));
      }

      // 3. Reload map and close modals
      await fetchBoatsAndReservations();
      setIsFeedbackOpen(false);
      setIsModalOpen(false);
    } catch (err: any) {
      console.error('Erro ao finalizar passeio:', err.message);
      alert('Erro ao finalizar passeio: ' + err.message);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CONFIRMED': return 'bg-green-500 border-green-600 font-bold';
      case 'PENDING':
      case 'AWAITING_PARTNER': return 'bg-yellow-500 border-yellow-600 text-slate-900 font-bold';
      case 'PENDING_CONTRACT': return 'bg-blue-500 border-blue-600 font-bold';
      case 'BLOCKED': return 'bg-red-500 border-red-600 font-bold';
      case 'RESCHEDULED': return 'bg-orange-500 border-orange-600 font-bold text-white';
      case 'COMPLETED': return 'bg-emerald-600 border-emerald-700 text-white font-bold opacity-75';
      default: return 'bg-slate-700 border-slate-600 text-gray-300';
    }
  };

  return (
    <AdminLayout>
      <main className="flex-1 overflow-auto flex flex-col">
        {/* Header */}
        <header className="bg-slate-900/50 backdrop-blur-md border-b border-slate-800 p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
          <div>
            <h1 className="text-2xl font-serif font-bold text-white">Mapa de Reservas</h1>
            <p className="text-sm text-gray-400">Calendário Inteligente (Gantt) - LIVE DATABASE</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
            <div className="hidden lg:flex items-center gap-4 text-xs font-medium mr-4">
               <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500 block border border-green-600"></span> Confirmado</span>
               <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-yellow-500 block border border-yellow-600"></span> Pendente</span>
               <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-500 block border border-blue-600"></span> Pendente Contrato</span>
               <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500 block border border-red-600"></span> Bloqueado</span>
               <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-orange-500 block border border-orange-600"></span> Remarcar</span>
            </div>
            <div className="flex items-center gap-3 ml-auto sm:ml-0">
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
                  <div key={boat.id} className="flex border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors group relative min-h-[85px]">
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
                                onClick={() => openEditReservation(res.originalData)}
                                className={`absolute top-1.5 bottom-1.5 rounded-xl border shadow-md flex flex-col justify-center items-start px-3 py-1.5 cursor-pointer
                                  ${getStatusColor(res.status)} hover:brightness-110 transition-all overflow-hidden z-20 leading-snug`}
                                style={{
                                    left: `${(startIdx / 14) * 100}%`,
                                    width: `${(visualLength / 14) * 100}%`,
                                    marginLeft: '4px',
                                    marginRight: '4px'
                                }}
                            >
                                <span className={`text-xs font-black truncate w-full ${res.status === 'AWAITING_PARTNER' ? 'text-slate-900' : 'text-white'}`}>
                                    {res.status === 'BLOCKED' ? '🚫 Manutenção' : 
                                     res.status === 'AWAITING_PARTNER' ? `⚓ L2: ${res.client}` : res.client}
                                </span>

                                {res.status !== 'BLOCKED' && (res.boarding || res.destination) && (
                                  <span className={`text-[9px] font-medium opacity-85 truncate w-full ${res.status === 'AWAITING_PARTNER' ? 'text-slate-800' : 'text-gray-200'} mt-0.5`}>
                                    📍 {res.boarding || 'N/A'} ➔ {res.destination || 'N/A'}
                                  </span>
                                )}

                                {res.status !== 'BLOCKED' && res.tags && res.tags.length > 0 && (
                                  <div className="flex flex-wrap gap-0.5 mt-1 w-full overflow-hidden max-h-[14px]">
                                    {res.tags.slice(0, 2).map((t: string) => (
                                      <span key={t} className={`text-[7px] font-black uppercase tracking-wider px-1 rounded border leading-none py-0.5 whitespace-nowrap ${
                                        res.status === 'AWAITING_PARTNER'
                                          ? 'bg-slate-950/10 border-slate-950/20 text-slate-900'
                                          : 'bg-slate-950/40 border-yellow-500/20 text-yellow-400'
                                      }`}>
                                        {t}
                                      </span>
                                    ))}
                                    {res.tags.length > 2 && (
                                      <span className={`text-[7px] font-bold ${res.status === 'AWAITING_PARTNER' ? 'text-slate-700' : 'text-gray-400'}`}>+</span>
                                    )}
                                  </div>
                                )}
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
                      <div className="group relative">
                        <label className="text-[10px] text-gray-500 uppercase font-bold mb-1.5 block">Nome do Cliente</label>
                        <input 
                          type="text"
                          required={formData.status !== 'BLOCKED'}
                          value={formData.customer_name} 
                          onChange={e => {
                            setFormData({...formData, customer_name: e.target.value, customer_id: ''});
                            setActiveField('name');
                          }}
                          onFocus={() => setActiveField('name')}
                          onBlur={() => setTimeout(() => setActiveField(null), 200)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:border-yellow-500 transition-all outline-none text-sm cursor-text"
                          placeholder="Digite o nome..."
                        />
                        
                        {activeField === 'name' && (formData.customer_name || formData.customer_phone) && (
                          <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                            {allCustomers.filter(c => 
                              (formData.customer_name && c.full_name?.toLowerCase().includes(formData.customer_name.toLowerCase())) || 
                              (formData.customer_phone && c.phone?.includes(formData.customer_phone))
                            ).map(c => (
                              <div 
                                key={c.id} 
                                className="px-4 py-3 hover:bg-slate-700 cursor-pointer border-b border-slate-700/50 last:border-0"
                                onClick={() => {
                                  setFormData({
                                    ...formData, 
                                    customer_id: c.id, 
                                    customer_name: c.full_name, 
                                    customer_phone: c.phone || ''
                                  });
                                  setActiveField(null);
                                }}
                              >
                                <div className="text-white font-bold text-sm flex items-center justify-between">
                                  <span>{c.full_name}</span>
                                  {c.tags && c.tags.length > 0 && (
                                    <div className="flex gap-1 shrink-0">
                                      {c.tags.map((tag: string) => (
                                        <span key={tag} className="text-[9px] bg-yellow-500/20 text-yellow-500 px-1 py-0.5 rounded border border-yellow-500/30 leading-none">
                                          {tag}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <div className="text-gray-400 text-xs flex justify-between items-center mt-1">
                                  <span>{c.phone || 'Sem telefone'}</span>
                                  {c.rating_stars ? (
                                    <span className="text-yellow-500 text-xs font-bold">⭐ {c.rating_stars}/5</span>
                                  ) : null}
                                </div>
                              </div>
                            ))}
                            {allCustomers.filter(c => 
                              (formData.customer_name && c.full_name?.toLowerCase().includes(formData.customer_name.toLowerCase())) || 
                              (formData.customer_phone && c.phone?.includes(formData.customer_phone))
                            ).length === 0 && (
                              <div className="px-4 py-3 text-gray-400 text-sm">Nenhum cliente encontrado. Um novo será cadastrado.</div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="group relative">
                        <label className="text-[10px] text-gray-500 uppercase font-bold mb-1.5 block">Telefone (WhatsApp)</label>
                        <input 
                          type="text"
                          required={formData.status !== 'BLOCKED'}
                          value={formData.customer_phone} 
                          onChange={e => {
                            setFormData({...formData, customer_phone: e.target.value, customer_id: ''});
                            setActiveField('phone');
                          }}
                          onFocus={() => setActiveField('phone')}
                          onBlur={() => setTimeout(() => setActiveField(null), 200)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:border-yellow-500 transition-all outline-none text-sm cursor-text"
                          placeholder="(XX) XXXXX-XXXX"
                        />
                        
                        {activeField === 'phone' && (formData.customer_name || formData.customer_phone) && (
                          <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                            {allCustomers.filter(c => 
                              (formData.customer_name && c.full_name?.toLowerCase().includes(formData.customer_name.toLowerCase())) || 
                              (formData.customer_phone && c.phone?.includes(formData.customer_phone))
                            ).map(c => (
                              <div 
                                key={c.id} 
                                className="px-4 py-3 hover:bg-slate-700 cursor-pointer border-b border-slate-700/50 last:border-0"
                                onClick={() => {
                                  setFormData({
                                    ...formData, 
                                    customer_id: c.id, 
                                    customer_name: c.full_name, 
                                    customer_phone: c.phone || ''
                                  });
                                  setActiveField(null);
                                }}
                              >
                                <div className="text-white font-bold text-sm flex items-center justify-between">
                                  <span>{c.full_name}</span>
                                  {c.tags && c.tags.length > 0 && (
                                    <div className="flex gap-1 shrink-0">
                                      {c.tags.map((tag: string) => (
                                        <span key={tag} className="text-[9px] bg-yellow-500/20 text-yellow-500 px-1 py-0.5 rounded border border-yellow-500/30 leading-none">
                                          {tag}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <div className="text-gray-400 text-xs flex justify-between items-center mt-1">
                                  <span>{c.phone || 'Sem telefone'}</span>
                                  {c.rating_stars ? (
                                    <span className="text-yellow-500 text-xs font-bold">⭐ {c.rating_stars}/5</span>
                                  ) : null}
                                </div>
                              </div>
                            ))}
                            {allCustomers.filter(c => 
                              (formData.customer_name && c.full_name?.toLowerCase().includes(formData.customer_name.toLowerCase())) || 
                              (formData.customer_phone && c.phone?.includes(formData.customer_phone))
                            ).length === 0 && (
                              <div className="px-4 py-3 text-gray-400 text-sm">Nenhum cliente encontrado. Um novo será cadastrado.</div>
                            )}
                          </div>
                        )}
                      </div>

                      {formData.customer_id && (() => {
                        const selectedCust = allCustomers.find(c => c.id === formData.customer_id);
                        if (!selectedCust) return null;
                        return (
                          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-2 mt-2">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-gray-400 font-bold uppercase tracking-wider">Histórico CRM:</span>
                              <span className="text-yellow-500 font-bold flex items-center gap-1">
                                {selectedCust.rating_stars ? (
                                  <>
                                    <span className="text-yellow-500">{'★'.repeat(selectedCust.rating_stars)}{'☆'.repeat(5 - selectedCust.rating_stars)}</span>
                                    <span>({selectedCust.rating_stars}/5)</span>
                                  </>
                                ) : 'Sem estrelas'}
                              </span>
                            </div>
                            {selectedCust.tags && selectedCust.tags.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5">
                                {selectedCust.tags.map((tag: string) => (
                                  <span key={tag} className="text-[10px] bg-yellow-500/10 text-yellow-500 px-2 py-0.5 rounded-full border border-yellow-500/20 font-bold uppercase tracking-wider">
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-[11px] text-gray-500 italic block">Nenhuma tag de comportamento.</span>
                            )}
                            {selectedCust.rating_notes && (
                              <div className="text-[11px] text-gray-400 italic bg-slate-900/40 p-2.5 rounded-xl border border-slate-800/40">
                                "{selectedCust.rating_notes}"
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      <div className="group">
                        <label className="text-[10px] text-gray-500 uppercase font-bold mb-1.5 block">Embarcação</label>
                        <select 
                          required
                          value={formData.boat_id} 
                          onChange={e => setFormData({...formData, boat_id: e.target.value})}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:border-yellow-500 transition-all outline-none text-sm appearance-none cursor-pointer"
                        >
                          <option value="">Selecione uma lancha...</option>
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
                          value={formData.embarkation} 
                          onChange={e => setFormData({...formData, embarkation: e.target.value})}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:border-yellow-500 transition-all outline-none text-sm appearance-none cursor-pointer"
                        >
                          <option value="">Selecione origem...</option>
                          {Array.from(new Set([
                             ...availableRoutes.map(r => r.embarkation_point),
                             ...(boats.find(b => b.id === formData.boat_id)?.boarding_points || [])
                          ])).map(p => (
                            <option key={p as string} value={p as string}>{p as string}</option>
                          ))}
                        </select>
                      </div>

                      <div className="group">
                        <label className="text-[10px] text-gray-500 uppercase font-bold mb-1.5 block">Destino Principal</label>
                        <select 
                          disabled={!formData.embarkation}
                          value={formData.destination} 
                          onChange={e => setFormData({...formData, destination: e.target.value})}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:border-yellow-500 transition-all outline-none text-sm appearance-none disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <option value="">Selecione destino...</option>
                          {Array.from(new Set([
                             ...availableRoutes.filter(r => r.embarkation_point === formData.embarkation).map(r => r.destination_point),
                             ...(boats.find(b => b.id === formData.boat_id)?.allowed_destinations || [])
                          ])).map(p => (
                            <option key={p as string} value={p as string}>{p as string}</option>
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
                      <div className="grid grid-cols-2 gap-4">
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

                        <div>
                          <label className="text-[10px] text-gray-500 uppercase font-bold mb-1.5 block">Valor Sinal (Recebido)</label>
                          <div className="relative group">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">R$</span>
                            <input 
                              type="number"
                              value={formData.paid_amount}
                              onChange={e => setFormData({...formData, paid_amount: Number(e.target.value)})}
                              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-12 pr-4 py-3 text-white font-black text-lg focus:border-yellow-500 outline-none transition-all"
                            />
                          </div>
                        </div>

                        {boats.find(b => b.id === formData.boat_id)?.owner_type !== 'OWN' && (
                          <div className="col-span-2 mt-2">
                            <label className="text-[10px] text-emerald-500 uppercase font-bold mb-1.5 block">Comissão Lanchas Show (Líquido)</label>
                            <div className="relative group">
                              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500 font-medium">R$</span>
                              <input 
                                type="number"
                                value={formData.commission_value}
                                onChange={e => setFormData({...formData, commission_value: Number(e.target.value)})}
                                className="w-full bg-slate-950 border border-emerald-500/30 rounded-xl pl-12 pr-4 py-3 text-emerald-400 font-black text-lg focus:border-emerald-500 outline-none transition-all"
                              />
                            </div>
                          </div>
                        )}
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
                            <div className="flex flex-col">
                               <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">Total Geral</span>
                               <span className="text-3xl font-black text-yellow-500">
                                  R$ {((Number(formData.base_price) || 0) + (formData.floating_mat === 'paid' ? 300 : 0) + (formData.extra_hours * 1000)).toLocaleString('pt-BR')}
                               </span>
                            </div>
                            <div className="flex flex-col text-right">
                               <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Falta Receber no Embarque</span>
                               <span className="text-xl font-bold text-red-400">
                                  R$ {Math.max(0, ((Number(formData.base_price) || 0) + (formData.floating_mat === 'paid' ? 300 : 0) + (formData.extra_hours * 1000)) - (Number(formData.paid_amount) || 0)).toLocaleString('pt-BR')}
                               </span>
                            </div>
                         </div>
                         <select 
                           value={formData.status} 
                           onChange={e => setFormData({...formData, status: e.target.value})}
                           className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-xs font-black outline-none transition-all cursor-pointer"
                         >
                            <option value="PENDING">💾 PENDENTE</option>
                            <option value="PENDING_CONTRACT">📄 CONTRATO</option>
                            <option value="CONFIRMED">✅ CONFIRMADO</option>
                            <option value="RESCHEDULED">🔄 REMARCAR</option>
                            <option value="BLOCKED">🚫 BLOQUEADO</option>
                            <option value="COMPLETED">⚓ CONCLUÍDO</option>
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

                <div className="pt-8 border-t border-slate-800 flex justify-end items-center gap-6 mt-10">
                   {formData.id && !isDeleting && (
                     <button 
                       type="button" 
                       onClick={() => setIsDeleting(true)} 
                       className="text-red-500 hover:text-red-400 font-bold text-sm uppercase mr-auto flex items-center gap-2"
                     >
                       Apagar Reserva
                     </button>
                   )}
                   {formData.id && isDeleting && (
                      <div className="mr-auto flex items-center gap-3 bg-red-500/10 p-2 rounded-lg border border-red-500/20">
                        <span className="text-xs text-red-400 font-bold uppercase">Digite 'apagar':</span>
                        <input 
                          type="text" 
                          value={deleteConfirmText}
                          onChange={e => setDeleteConfirmText(e.target.value)}
                          placeholder="apagar"
                          className="bg-slate-900 border border-red-500/50 rounded px-2 py-1 text-white text-sm w-24 outline-none focus:border-red-500"
                        />
                        <button 
                          type="button"
                          onClick={handleDeleteReservation}
                          className="bg-red-500 text-white text-xs font-bold px-3 py-1.5 rounded hover:bg-red-600 transition-colors"
                        >
                          Confirmar Exclusão
                        </button>
                        <button 
                          type="button"
                          onClick={() => { setIsDeleting(false); setDeleteConfirmText(''); }}
                          className="text-gray-500 hover:text-white p-1"
                        >
                          <X className="w-4 h-4"/>
                        </button>
                      </div>
                    )}
                   {formData.id && formData.status !== 'COMPLETED' && (
                     <button
                       type="button"
                       onClick={handleOpenFeedback}
                       className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-6 py-4 rounded-2xl transition-all flex items-center gap-2"
                     >
                       ⚓ Finalizar Passeio
                     </button>
                   )}
                   <button type="button" onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-white font-bold text-sm uppercase">Cancelar</button>
                   <button 
                    type="submit"
                    disabled={isSaving || (formData.status !== 'BLOCKED' && !formData.customer_id && (!formData.customer_name || !formData.customer_phone))}
                    className="bg-yellow-500 hover:bg-yellow-400 disabled:opacity-30 text-slate-900 font-black px-10 py-4 rounded-2xl transition-all shadow-[0_0_30px_rgba(234,179,8,0.2)] flex items-center gap-3"
                   >
                     {isSaving ? <Loader2 className="w-6 h-6 animate-spin"/> : <Check className="w-6 h-6"/>}
                     {isSaving ? 'Salvando...' : 'Confirmar Reserva'}
                   </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal de Avaliação / Feedback */}
        {isFeedbackOpen && (
          <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-md z-[110] flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg shadow-[0_0_50px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden">
              <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>⚓ Finalizar Passeio & Avaliar Cliente</span>
                </h3>
                <button 
                  type="button"
                  onClick={() => setIsFeedbackOpen(false)}
                  className="bg-slate-800 p-1.5 rounded-full text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5"/>
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div>
                  <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">Cliente</p>
                  <p className="text-lg font-black text-white">{formData.customer_name}</p>
                  <p className="text-xs text-gray-400">{formData.customer_phone}</p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-gray-500 uppercase font-bold tracking-wider block">Avaliação do Cliente (Estrelas)</label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        type="button"
                        key={star}
                        onClick={() => setFeedbackData({ ...feedbackData, stars: star })}
                        className="text-3xl focus:outline-none transition-transform hover:scale-115"
                      >
                        <span className={star <= feedbackData.stars ? 'text-yellow-500' : 'text-slate-700'}>
                          ★
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-gray-500 uppercase font-bold tracking-wider block">Tags de Comportamento</label>
                  <div className="flex flex-wrap gap-2">
                    {['Família', 'Bagunça', 'Não alugar mais', 'Tranquilo', 'Sem educação'].map((tag) => {
                      const isSelected = feedbackData.tags.includes(tag);
                      return (
                        <button
                          type="button"
                          key={tag}
                          onClick={() => {
                            const newTags = isSelected
                              ? feedbackData.tags.filter(t => t !== tag)
                              : [...feedbackData.tags, tag];
                            setFeedbackData({ ...feedbackData, tags: newTags });
                          }}
                          className={`px-3 py-1.5 rounded-full border text-xs font-bold transition-all ${
                            isSelected
                              ? 'bg-yellow-500 text-slate-900 border-yellow-500 shadow-md shadow-yellow-500/10'
                              : 'bg-slate-950 border-slate-800 text-gray-400 hover:text-white hover:border-slate-700'
                          }`}
                        >
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-gray-500 uppercase font-bold tracking-wider block">Observações do Cliente</label>
                  <textarea
                    value={feedbackData.notes}
                    onChange={e => setFeedbackData({ ...feedbackData, notes: e.target.value })}
                    placeholder="Adicione notas sobre o comportamento do cliente..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:border-yellow-500 outline-none h-24 resize-none transition-all"
                  />
                </div>
              </div>

              <div className="p-6 border-t border-slate-800 flex justify-end gap-3 bg-slate-900/50">
                <button
                  type="button"
                  onClick={() => setIsFeedbackOpen(false)}
                  className="px-4 py-2 text-gray-400 font-bold hover:text-white transition-colors"
                >
                  Voltar
                </button>
                <button
                  type="button"
                  onClick={handleSaveFeedback}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-6 py-2.5 rounded-xl transition-all shadow-lg shadow-emerald-500/10"
                >
                  Salvar e Concluir Passeio
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </AdminLayout>
  );
}
