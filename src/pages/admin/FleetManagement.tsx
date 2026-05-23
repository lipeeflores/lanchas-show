import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { Anchor, Ship, CalendarCheck, FileText, Banknote, Landmark, CheckCircle, Clock, AlertCircle, Wallet, Users, Bot, Plus, X, Save, Settings, Trash2, MapPin, Upload, Image as ImageIcon, Loader2, Star, Phone, Edit2, UserPlus } from 'lucide-react';
import { Link } from 'react-router-dom';
import AdminLayout from '../../components/AdminLayout';

export default function FleetManagement() {
  const [activeTab, setActiveTab] = useState<'OWN' | 'PARTNERS' | 'PAYABLES' | 'OWNERS' | 'CONTRACT_TEMPLATE'>('OWN');
  const [boats, setBoats] = useState<any[]>([]);
  const [payables, setPayables] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [allPartners, setAllPartners] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBoatId, setEditingBoatId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '', capacity: 10, size: 30, image: '', daily_rate: 0, original_rate: 0, 
    has_floating_mat: false, floating_mat_price: 300, extra_hour_price: 1000,
    owner_type: 'OWN', partner_id: '', boarding_points: [] as string[], allowed_destinations: [] as string[], status: 'AVAILABLE',
    description: '', include_captain: true, include_fuel: true, catalogo_url: ''
  });
  const [contractHtml, setContractHtml] = useState<string>('');
  const [contractSaving, setContractSaving] = useState<boolean>(false);
  // Route-based pricing
  const [boatRoutes, setBoatRoutes] = useState<any[]>([]);
  const [routeForm, setRouteForm] = useState({ embarkation_point: '', destination_point: '', price_low_season: 0, min_price_low_season: 0, price_weekend_holiday: 0, min_price_weekend_holiday: 0, price_high_season: 0, min_price_high_season: 0 });
  const [showRouteForm, setShowRouteForm] = useState(false);
  // Gallery
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Owners / Partners CRUD state
  const [isOwnerModalOpen, setIsOwnerModalOpen] = useState(false);
  const [editingOwnerId, setEditingOwnerId] = useState<string | null>(null);
  const [ownerSaving, setOwnerSaving] = useState(false);
  const [ownerFormData, setOwnerFormData] = useState({
    name: '',
    phone: '',
    bank_account_info: '',
    management_level: 'L1'
  });

  // General Expenses State (Contas Gerais)
  const [isPayableModalOpen, setIsPayableModalOpen] = useState(false);
  const [payableFormData, setPayableFormData] = useState({
    description: '',
    amount: 0,
    payee_type: 'EXTERNAL' as 'PARTNER' | 'EXTERNAL',
    partner_id: '',
    status: 'PENDING'
  });

  // Expenses State
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expenseSaving, setExpenseSaving] = useState(false);
  const [expenseFormData, setExpenseFormData] = useState({
    boat_id: '',
    boat_name: '',
    type: 'FIXED', // FIXED or VARIABLE
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    day: '10',
    description: ''
  });

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    const newUrls: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = file.name.split('.').pop();
      const path = `${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
      const { error } = await supabase.storage.from('boat_images').upload(path, file, { cacheControl: '3600', upsert: false });
      if (!error) {
        const { data: urlData } = supabase.storage.from('boat_images').getPublicUrl(path);
        if (urlData?.publicUrl) newUrls.push(urlData.publicUrl);
      }
    }
    setImageUrls(prev => [...prev, ...newUrls]);
    setUploading(false);
  };

  const handleDeleteImage = async (url: string) => {
    // Extract path from URL
    const parts = url.split('/boat_images/');
    if (parts.length > 1) {
      await supabase.storage.from('boat_images').remove([parts[1]]);
    }
    setImageUrls(prev => prev.filter(u => u !== url));
  };

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>, field: 'boarding_points' | 'allowed_destinations') => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const value = e.currentTarget.value.trim().replace(/^,|,$/g, '');
      if (value && !formData[field].includes(value)) {
        setFormData({ ...formData, [field]: [...formData[field], value] });
      }
      e.currentTarget.value = '';
    }
  };

  const handleRemoveTag = (field: 'boarding_points' | 'allowed_destinations', index: number) => {
    const newTags = [...formData[field]];
    newTags.splice(index, 1);
    setFormData({ ...formData, [field]: newTags });
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch boats + partners + expenses
      const { data: boatsData } = await supabase
        .from('boats')
        .select('*, partners(name, bank_account_info), boat_expenses(*)');
        
      if(boatsData) setBoats(boatsData);

      const { data: payablesData } = await supabase
        .from('accounts_payable')
        .select('*, partners(name)')
        .order('created_at', { ascending: false });
        
      if(payablesData) setPayables(payablesData);

      const { data: partnersData } = await supabase.from('partners').select('id, name, phone, bank_account_info, management_level').order('name');
      if (partnersData) setAllPartners(partnersData);
    } catch (error: any) {
      console.error('Error fetching data:', error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchContractTemplate = async () => {
    try {
      const { data, error } = await supabase
        .from('contratos_template')
        .select('html_content')
        .eq('id', 'default')
        .maybeSingle();
      if (error) throw error;
      if (data) {
        setContractHtml(data.html_content);
      }
    } catch (err: any) {
      console.error('Error fetching contract template:', err.message);
    }
  };

  const handleSaveContractTemplate = async () => {
    setContractSaving(true);
    try {
      const { error } = await supabase
        .from('contratos_template')
        .upsert({ id: 'default', html_content: contractHtml, updated_at: new Date().toISOString() });
      if (error) throw error;
      alert('Template de contrato atualizado com sucesso!');
    } catch (err: any) {
      alert('Erro ao salvar template: ' + err.message);
    } finally {
      setContractSaving(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'CONTRACT_TEMPLATE') {
      fetchContractTemplate();
    }
  }, [activeTab]);

  const openModal = async (boat?: any) => {
    setShowRouteForm(false);
    if (boat) {
      setEditingBoatId(boat.id);
      setFormData({
        name: boat.name || '',
        capacity: boat.capacity || 10,
        size: boat.size || 30,
        image: boat.image || '',
        daily_rate: boat.daily_rate || 0,
        original_rate: boat.original_rate || 0,
        has_floating_mat: boat.has_floating_mat || false,
        floating_mat_price: boat.floating_mat_price || 300,
        extra_hour_price: boat.extra_hour_price || 1000,
        owner_type: boat.owner_type || 'OWN',
        partner_id: boat.partner_id || '',
        boarding_points: boat.boarding_points || [],
        allowed_destinations: boat.allowed_destinations || [],
        status: boat.status || 'AVAILABLE',
        description: boat.description || '',
        include_captain: boat.include_captain ?? true,
        include_fuel: boat.include_fuel ?? true,
        catalogo_url: boat.catalogo_url || ''
      });
      setImageUrls(boat.image_urls || (boat.image ? [boat.image] : []));
      const { data: routesData } = await supabase.from('boat_routes_pricing').select('*').eq('boat_id', boat.id).order('created_at');
      setBoatRoutes(routesData || []);
    } else {
      setEditingBoatId(null);
      setFormData({
         name: '', capacity: 10, size: 30, image: '', daily_rate: 0, original_rate: 0, 
         has_floating_mat: false, floating_mat_price: 300, extra_hour_price: 1000,
         owner_type: activeTab === 'PARTNERS' ? 'PARTNER_L1' : 'OWN', partner_id: '', 
         boarding_points: ['Porto Belo'], allowed_destinations: ["Caixa d'Aço", "Praia da Sepultura"], status: 'AVAILABLE',
         description: '', include_captain: true, include_fuel: true, catalogo_url: ''
      });
      setImageUrls([]);
      setBoatRoutes([]);
    }
    setIsModalOpen(true);
  };

  const addRoute = () => {
    if (!routeForm.embarkation_point || !routeForm.destination_point) return;
    if (boatRoutes.find(r => r.embarkation_point === routeForm.embarkation_point && r.destination_point === routeForm.destination_point)) return;
    setBoatRoutes([...boatRoutes, { ...routeForm, _isNew: true }]);
    setRouteForm({ embarkation_point: '', destination_point: '', price_low_season: 0, min_price_low_season: 0, price_weekend_holiday: 0, min_price_weekend_holiday: 0, price_high_season: 0, min_price_high_season: 0 });
    setShowRouteForm(false);
  };

  const removeRoute = (idx: number) => {
    setBoatRoutes(boatRoutes.filter((_, i) => i !== idx));
  };

  const handleDeleteBoat = async () => {
    if (!editingBoatId) return;
    
    const confirmDelete = window.confirm('Tem certeza que deseja excluir esta lancha? Esta ação é irreversível e excluirá todos os dados relacionados (preços, despesas e reservas).');
    if (!confirmDelete) return;

    setSaving(true);
    try {
      // 1. Delete dependent data
      await supabase.from('boat_routes_pricing').delete().eq('boat_id', editingBoatId);
      await supabase.from('boat_expenses').delete().eq('boat_id', editingBoatId);
      await supabase.from('reservations').delete().eq('boat_id', editingBoatId);
      
      // 2. Delete the boat
      const { error } = await supabase.from('boats').delete().eq('id', editingBoatId);
      if (error) throw error;

      setIsModalOpen(false);
      fetchData();
    } catch (error: any) {
      console.error('Error deleting boat:', error);
      alert('Erro ao excluir embarcação: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setSaving(false);
    }
  };

  const handleMarkAsPaid = async (id: string) => {
    try {
      const payable = payables.find(p => p.id === id);
      if (!payable) throw new Error("Conta não encontrada");

      const { error } = await supabase
        .from('accounts_payable')
        .update({ status: 'PAID' })
        .eq('id', id);
      if (error) throw error;

      const prefix = payable.payee_type === 'PARTNER' ? '[PARCEIRO]' : '[GERAL]';
      const { error: txError } = await supabase.from('cash_transactions').insert([{
        type: 'EXPENSE',
        amount: Number(payable.amount),
        description: `${prefix} ${payable.description}`
      }]);
      if (txError) throw txError;

      fetchData();
    } catch (error: any) {
      alert('Erro ao dar baixa: ' + error.message);
    }
  };

  const handleDeletePayable = async (id: string) => {
    if (!window.confirm('Excluir esta conta?')) return;
    try {
      const { error } = await supabase
        .from('accounts_payable')
        .delete()
        .eq('id', id);
      if (error) throw error;
      fetchData();
    } catch (error: any) {
      alert('Erro ao excluir: ' + error.message);
    }
  };

  const handleSaveOwner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (ownerSaving) return;
    setOwnerSaving(true);
    try {
      const payload = {
        name: ownerFormData.name,
        phone: ownerFormData.phone || null,
        bank_account_info: ownerFormData.bank_account_info || null,
        management_level: ownerFormData.management_level
      };
      if (editingOwnerId) {
        const { error } = await supabase.from('partners').update(payload).eq('id', editingOwnerId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('partners').insert([payload]);
        if (error) throw error;
      }
      setIsOwnerModalOpen(false);
      setEditingOwnerId(null);
      setOwnerFormData({ name: '', phone: '', bank_account_info: '', management_level: 'L1' });
      fetchData();
    } catch (error: any) {
      alert('Erro ao salvar parceiro: ' + error.message);
    } finally {
      setOwnerSaving(false);
    }
  };

  const handleDeleteOwner = async (id: string) => {
    if (!window.confirm('Excluir este dono/parceiro? Os barcos vinculados a ele perderão a associação.')) return;
    try {
      await supabase.from('boats').update({ partner_id: null }).eq('partner_id', id);
      const { error } = await supabase.from('partners').delete().eq('id', id);
      if (error) throw error;
      fetchData();
    } catch (error: any) {
      alert('Erro ao excluir: ' + error.message);
    }
  };

  const openOwnerModal = (owner?: any) => {
    if (owner) {
      setEditingOwnerId(owner.id);
      setOwnerFormData({
        name: owner.name || '',
        phone: owner.phone || '',
        bank_account_info: owner.bank_account_info || '',
        management_level: owner.management_level || 'L1'
      });
    } else {
      setEditingOwnerId(null);
      setOwnerFormData({ name: '', phone: '', bank_account_info: '', management_level: 'L1' });
    }
    setIsOwnerModalOpen(true);
  };

  const handleSavePayable = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        description: payableFormData.description,
        amount: Number(payableFormData.amount),
        payee_type: 'EXTERNAL',
        partner_id: null,
        status: 'PAID'
      };
      const { error } = await supabase
        .from('accounts_payable')
        .insert([payload]);
      if (error) throw error;

      // Register in cash_transactions for DRE
      const { error: txError } = await supabase.from('cash_transactions').insert([{
        type: 'EXPENSE',
        amount: Number(payableFormData.amount),
        description: `[GERAL] ${payableFormData.description}`
      }]);
      if (txError) throw txError;

      setIsPayableModalOpen(false);
      fetchData();
    } catch (error: any) {
      alert('Erro ao salvar conta: ' + error.message);
    }
  };

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (expenseSaving) return;
    setExpenseSaving(true);
    
    let finalDate = expenseFormData.date;
    if (expenseFormData.type === 'FIXED') {
       const d = String(expenseFormData.day).padStart(2, '0');
       finalDate = `2000-01-${d}`;
    }

    try {
      const { data: exp, error } = await supabase.from('boat_expenses').insert([{
        boat_id: expenseFormData.boat_id,
        type: expenseFormData.type,
        amount: Number(expenseFormData.amount),
        date: finalDate,
        description: expenseFormData.description,
        category: expenseFormData.type === 'FIXED' ? 'FIXED_EXPENSE' : 'VARIABLE_EXPENSE'
      }]).select('*').single();
      if (error) throw error;

      if (expenseFormData.type === 'VARIABLE') {
          const { error: txError } = await supabase.from('cash_transactions').insert([{
              type: 'EXPENSE',
              amount: Number(expenseFormData.amount),
              description: `[VARIÁVEL] ${expenseFormData.description} (${expenseFormData.boat_name})`
          }]);
          if (txError) throw txError;
      }
      
      setIsExpenseModalOpen(false);
      fetchData();
    } catch (error: any) {
      alert('Erro ao salvar despesa: ' + error.message);
    } finally {
      setExpenseSaving(false);
    }
  };

  const handleSaveBoat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);

    try {
      const payload = {
        name: formData.name,
        capacity: Number(formData.capacity),
        size: Number(formData.size),
        image: imageUrls[0] || formData.image || '',
        image_urls: imageUrls,
        has_floating_mat: Boolean(formData.has_floating_mat),
        floating_mat_price: formData.has_floating_mat ? Number(formData.floating_mat_price) : 0,
        extra_hour_price: Number(formData.extra_hour_price),
        daily_rate: Number(formData.daily_rate),
        original_rate: formData.original_rate ? Number(formData.original_rate) : null,
        owner_type: formData.owner_type,
        partner_id: formData.owner_type !== 'OWN' && formData.partner_id ? formData.partner_id : null,
        boarding_points: formData.boarding_points,
        allowed_destinations: formData.allowed_destinations,
        status: formData.status,
        description: formData.description,
        include_captain: formData.include_captain,
        include_fuel: formData.include_fuel,
        catalogo_url: formData.catalogo_url || null
      };

      let boatId = editingBoatId;
      if (editingBoatId) {
        const { error } = await supabase.from('boats').update(payload).eq('id', editingBoatId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('boats').insert([payload]).select('id').single();
        if (error) throw error;
        boatId = data?.id;
      }

      // Save routes
      if (boatId) {
        // Delete old routes and re-insert
        const { error: deleteError } = await supabase.from('boat_routes_pricing').delete().eq('boat_id', boatId);
        if (deleteError) throw deleteError;

        if (boatRoutes.length > 0) {
          const routePayloads = boatRoutes.map(r => ({
            boat_id: boatId,
            embarkation_point: r.embarkation_point,
            destination_point: r.destination_point,
            price_low_season: Number(r.price_low_season),
            min_price_low_season: Number(r.min_price_low_season),
            price_weekend_holiday: Number(r.price_weekend_holiday),
            min_price_weekend_holiday: Number(r.min_price_weekend_holiday),
            price_high_season: Number(r.price_high_season),
            min_price_high_season: Number(r.min_price_high_season),
          }));
          const { error: insertError } = await supabase.from('boat_routes_pricing').insert(routePayloads);
          if (insertError) throw insertError;
        }
      }

      setIsModalOpen(false);
      fetchData();
    } catch (error: any) {
      console.error('Error saving boat:', error);
      alert('Erro ao salvar embarcação: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setSaving(false);
    }
  };

  const ownBoats = boats.filter(b => b.owner_type === 'OWN');
  const partnerBoats = boats.filter(b => b.owner_type !== 'OWN');
  const allBoatExpenses = boats.flatMap(b => (b.boat_expenses || []).map((e: any) => ({...e, boat_name: b.name})))
    .sort((a, b) => new Date(b.created_at || b.date).getTime() - new Date(a.created_at || a.date).getTime());

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

  return (
    <AdminLayout>
      <main className="flex-1 overflow-auto flex flex-col">
<header className="bg-slate-900/50 backdrop-blur-md border-b border-slate-800 p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
          <div>
            <h1 className="text-2xl font-serif font-bold text-white">Gestão Financeira & Frota</h1>
            <p className="text-sm text-gray-400">Gerenciar detalhes dos barcos, rateio e marcação B2C</p>
          </div>
          <button 
             onClick={() => openModal()}
             className="bg-yellow-500 hover:bg-yellow-400 text-slate-900 font-bold px-4 py-2 rounded-lg transition-colors flex items-center gap-2 shadow-[0_0_15px_rgba(234,179,8,0.2)]"
          >
             <Plus className="w-5 h-5"/> Adicionar Barco
          </button>
        </header>

        <div className="border-b border-slate-800 px-6 pt-4 bg-slate-900/30 flex gap-6 overflow-x-auto whitespace-nowrap scrollbar-hide">
           <button 
             onClick={() => setActiveTab('OWN')}
             className={`pb-4 text-sm font-bold uppercase tracking-wider transition-colors border-b-2 shrink-0 ${activeTab === 'OWN' ? 'border-yellow-500 text-yellow-500' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
           >
              Frota Própria
           </button>
           <button 
             onClick={() => setActiveTab('PARTNERS')}
             className={`pb-4 text-sm font-bold uppercase tracking-wider transition-colors border-b-2 shrink-0 ${activeTab === 'PARTNERS' ? 'border-yellow-500 text-yellow-500' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
           >
              Frota Parceira
           </button>
           <button 
             onClick={() => setActiveTab('PAYABLES')}
             className={`pb-4 text-sm font-bold uppercase tracking-wider transition-colors border-b-2 flex items-center gap-2 shrink-0 ${activeTab === 'PAYABLES' ? 'border-yellow-500 text-yellow-500' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
           >
              Contas a Pagar
              {payables.filter(p => p.status === 'PENDING').length > 0 && (
                 <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full">{payables.filter(p => p.status === 'PENDING').length}</span>
              )}
           </button>
           <button 
             onClick={() => setActiveTab('OWNERS')}
             className={`pb-4 text-sm font-bold uppercase tracking-wider transition-colors border-b-2 flex items-center gap-2 shrink-0 ${activeTab === 'OWNERS' ? 'border-yellow-500 text-yellow-500' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
           >
              Donos / Parceiros
              <span className="bg-slate-700 text-gray-300 text-[10px] px-2 py-0.5 rounded-full">{allPartners.length}</span>
           </button>
           <button 
             onClick={() => setActiveTab('CONTRACT_TEMPLATE')}
             className={`pb-4 text-sm font-bold uppercase tracking-wider transition-colors border-b-2 flex items-center gap-2 shrink-0 ${activeTab === 'CONTRACT_TEMPLATE' ? 'border-yellow-500 text-yellow-500' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
           >
              Termo / Contrato
           </button>
        </div>

        <div className="p-6 flex-1 overflow-auto bg-slate-950">
          {loading ? (
             <div className="p-10 text-center text-yellow-500 animate-pulse">Carregando dados financeiros...</div>
          ) : (
            <div className="max-w-7xl mx-auto space-y-6">
                
                {/* FROTA PRÓPRIA TAB */}
                {activeTab === 'OWN' && (
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    {ownBoats.map(boat => {
                       const expenses = boat.boat_expenses || [];
                       const totalFixed = expenses.filter((e:any) => e.type === 'FIXED').reduce((acc:number, e:any) => acc + Number(e.amount), 0);
                       const totalVar = expenses.filter((e:any) => e.type === 'VARIABLE').reduce((acc:number, e:any) => acc + Number(e.amount), 0);

                       return (
                        <div key={boat.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
                           <div className="absolute top-0 right-0 w-32 h-32 bg-slate-800/30 rounded-bl-full -z-10 group-hover:bg-slate-800/50 transition-colors"></div>
                           
                           <div className="flex justify-between items-start mb-6">
                              <div>
                                <h2 className="text-xl font-bold text-white flex items-center gap-2">{boat.name} <span className="bg-slate-800 text-gray-400 text-[10px] uppercase px-2 py-1 rounded border border-slate-700">Frota</span></h2>
                                <p className="text-xs text-gray-500 mt-1">Capacidade: {boat.capacity} pessoas | {boat.size} pés</p>
                              </div>
                              <button onClick={() => openModal(boat)} className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-700 transition-colors flex items-center gap-2">
                                <FileText className="w-3 h-3"/> Editar Info
                              </button>
                           </div>

                           <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-slate-800 pt-6">
                              <div>
                                 <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">Despesas Fixas</p>
                                 <p className="text-2xl font-bold text-slate-300 mb-1">{formatCurrency(totalFixed)}</p>
                                 <p className="text-[10px] text-gray-500">Mês atual</p>
                              </div>
                              <div>
                                 <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">Despesas Variáveis</p>
                                 <p className="text-2xl font-bold text-yellow-500 mb-1">{formatCurrency(totalVar)}</p>
                                 <p className="text-[10px] text-gray-500">Pós-passeios</p>
                              </div>
                              <div>
                                 <p className="text-red-400 text-xs font-bold uppercase tracking-wider mb-2">Custo de Saída</p>
                                 <p className="text-2xl font-bold text-red-500 mb-1">{formatCurrency(boat.original_rate || 0)}</p>
                                 <p className="text-[10px] text-gray-500">Por locação</p>
                              </div>
                           </div>

                           <div className="mt-6 flex gap-3">
                              <button 
                                onClick={() => {
                                  setExpenseFormData({
                                    boat_id: boat.id,
                                    boat_name: boat.name,
                                    type: 'FIXED',
                                    amount: 0,
                                    date: new Date().toISOString().split('T')[0],
                                    day: '10',
                                    description: ''
                                  });
                                  setIsExpenseModalOpen(true);
                                }}
                                className="flex-1 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 font-bold py-2 rounded-lg border border-yellow-500/30 transition-colors text-sm"
                              >
                                + Adicionar Despesas
                              </button>
                           </div>
                        </div>
                       )
                    })}
                  </div>
                )}


                {/* FROTA PARCEIRA TAB */}
                {activeTab === 'PARTNERS' && (
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    {partnerBoats.map(boat => {
                       const salePrice = Number(boat.price_high_season) || Number(boat.daily_rate);
                       const netPrice = Number(boat.partner_net_value) || 0;
                       const markup = salePrice - netPrice;
                       
                       return (
                        <div key={boat.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                           <div className="flex justify-between items-start mb-6 border-b border-slate-800 pb-4">
                                <div>
                                  <h2 className="text-xl font-bold text-white flex items-center gap-2">{boat.name}</h2>
                                  <span className="inline-block mt-2 bg-yellow-500/10 text-yellow-500 text-[10px] uppercase font-bold px-2 py-1 rounded outline outline-1 outline-yellow-500/30 mr-2">
                                     Parceiro {boat.owner_type.replace('PARTNER_', '')}
                                  </span>
                                  <button onClick={() => openModal(boat)} className="inline-block bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-bold px-2 py-1 rounded border border-slate-700 transition-colors mt-2">
                                     Editar Info
                                  </button>
                                </div>
                              <div className="text-right">
                                  <p className="text-xs text-gray-500">Proprietário</p>
                                  <p className="text-white font-medium">{boat.partners?.name || 'Não atribuído'}</p>
                              </div>
                           </div>

                           {/* Dados Financeiros */}
                           <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                                 <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1 flex items-center gap-1">Venda B2C <span title="Dinâmico (Alta Temporada)" className="text-yellow-500 cursor-help">⚡</span></p>
                                 <p className="text-lg font-bold text-white">{formatCurrency(salePrice)}</p>
                              </div>
                              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                                 <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1">Líquido Dono</p>
                                 <p className="text-lg font-bold text-white">{formatCurrency(netPrice)}</p>
                              </div>
                              <div className="bg-yellow-500/5 p-3 rounded-xl border border-yellow-500/20">
                                 <p className="text-[10px] text-yellow-500/80 uppercase font-bold tracking-wider mb-1">Seu Markup</p>
                                 <p className="text-lg font-bold text-yellow-500">{formatCurrency(markup)}</p>
                              </div>
                           </div>

                           <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 flex items-start gap-3">
                               <Banknote className="w-5 h-5 text-gray-500 shrink-0 mt-0.5" />
                               <div>
                                   <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">Dados Bancários Parceiro</p>
                                   <p className="text-sm text-gray-300 font-mono">{boat.partners?.bank_account_info || 'Dados não informados.'}</p>
                               </div>
                           </div>
                           
                           <div className="mt-4 pt-4 border-t border-slate-800 flex justify-between items-center">
                               <span className="text-xs text-gray-500 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> O sistema separa o repasse automaticamente no check-in.</span>
                           </div>
                        </div>
                       )
                    })}
                  </div>
                )}


                {/* CONTAS A PAGAR TAB */}
                {activeTab === 'PAYABLES' && (
                  <div className="space-y-6">
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
                    <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                        <div>
                          <h2 className="text-lg font-bold text-white flex items-center gap-2">Contas Gerais da Empresa</h2>
                          <p className="text-xs text-gray-500 mt-1">Gastos administrativos, mercado, salários fixos, materiais, etc.</p>
                        </div>
                        <button 
                           onClick={() => {
                             setPayableFormData({ description: '', amount: 0, payee_type: 'EXTERNAL', partner_id: '', status: 'PENDING' });
                             setIsPayableModalOpen(true);
                           }}
                           className="bg-yellow-500 hover:bg-yellow-400 text-slate-900 text-xs font-bold px-4 py-2 rounded-lg transition-colors shadow-[0_0_15px_rgba(234,179,8,0.2)]"
                         >
                             + Lançar Gasto
                        </button>
                    </div>
                    
                    {payables.filter(p => p.payee_type === 'EXTERNAL').length === 0 ? (
                        <div className="p-10 text-center text-gray-500 italic">Nenhum gasto geral lançado ainda.</div>
                    ) : ( 
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[650px]">
                            <thead>
                                <tr className="bg-slate-950 border-b border-slate-800 text-xs uppercase tracking-wider text-gray-500">
                                    <th className="p-4 font-medium">Data</th>
                                    <th className="p-4 font-medium">Descrição</th>
                                    <th className="p-4 font-medium text-right">Valor</th>
                                    <th className="p-4 font-medium"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {payables.filter(p => p.payee_type === 'EXTERNAL').map(pay => (
                                    <tr key={pay.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                                        <td className="p-4 text-sm text-gray-300">
                                            {new Date(pay.created_at).toLocaleDateString('pt-BR')}
                                        </td>
                                        <td className="p-4 text-sm font-medium text-white">
                                            {pay.description}
                                        </td>
                                        <td className="p-4 text-sm font-bold text-right text-white">
                                            {formatCurrency(pay.amount)}
                                        </td>
                                        <td className="p-4 text-right">
                                             <button 
                                               onClick={() => handleDeletePayable(pay.id)}
                                               className="p-1.5 text-gray-500 hover:text-red-500 transition-colors"
                                               title="Excluir"
                                             >
                                               <Trash2 className="w-4 h-4" />
                                             </button>
                                         </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                    
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
                    {/* Lista de Despesas das Lanchas */}
                    <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                        <div>
                          <h2 className="text-lg font-bold text-white flex items-center gap-2">Despesas das Embarcações</h2>
                          <p className="text-xs text-gray-500 mt-1">Despesas fixas e variáveis vinculadas a cada barco.</p>
                        </div>
                    </div>
                    {allBoatExpenses.length === 0 ? (
                        <div className="p-10 text-center text-gray-500 italic">Nenhuma despesa de embarcação cadastrada.</div>
                    ) : ( 
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[650px]">
                            <thead>
                                <tr className="bg-slate-950 border-b border-slate-800 text-xs uppercase tracking-wider text-gray-500">
                                    <th className="p-4 font-medium">Data / Vencimento</th>
                                    <th className="p-4 font-medium">Embarcação</th>
                                    <th className="p-4 font-medium">Descrição</th>
                                    <th className="p-4 font-medium">Tipo</th>
                                    <th className="p-4 font-medium text-right">Valor</th>
                                    <th className="p-4 font-medium"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {allBoatExpenses.map(exp => (
                                    <tr key={exp.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                                        <td className="p-4 text-sm text-gray-300">
                                            {exp.type === 'FIXED' ? `Dia ${exp.date.split('-')[2]}` : new Date(exp.date).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}
                                        </td>
                                        <td className="p-4 text-sm font-medium text-white">
                                            {exp.boat_name}
                                        </td>
                                        <td className="p-4 text-sm text-gray-400">
                                            {exp.description}
                                        </td>
                                        <td className="p-4 text-sm">
                                            {exp.type === 'FIXED' ? (
                                                <span className="bg-blue-500/10 text-blue-500 text-[10px] uppercase font-bold px-2 py-1 rounded">Fixo Mensal</span>
                                            ) : (
                                                <span className="bg-orange-500/10 text-orange-500 text-[10px] uppercase font-bold px-2 py-1 rounded">Variável</span>
                                            )}
                                        </td>
                                        <td className="p-4 text-sm font-bold text-right text-white">
                                            {formatCurrency(exp.amount)}
                                        </td>
                                        <td className="p-4 text-right">
                                            <button 
                                              onClick={async () => {
                                                  if(!window.confirm('Deseja realmente excluir esta despesa?')) return;
                                                  try {
                                                    await supabase.from('boat_expenses').delete().eq('id', exp.id);
                                                    fetchData();
                                                  } catch (err) {
                                                    alert('Erro ao excluir despesa');
                                                  }
                                              }}
                                              className="p-1.5 text-gray-500 hover:text-red-500 transition-colors"
                                              title="Excluir"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                  </div>
                )}

                {/* DONOS / PARCEIROS TAB */}
                {activeTab === 'OWNERS' && (
                  <div className="space-y-6">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
                      <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                        <div>
                          <h2 className="text-lg font-bold text-white flex items-center gap-2"><Users className="w-5 h-5 text-yellow-500" /> Donos &amp; Parceiros</h2>
                          <p className="text-xs text-gray-500 mt-1">Cadastre os proprietários com contato e dados de pagamento (PIX/Conta).</p>
                        </div>
                        <button onClick={() => openOwnerModal()} className="bg-yellow-500 hover:bg-yellow-400 text-slate-900 text-xs font-bold px-4 py-2 rounded-lg transition-colors shadow-[0_0_15px_rgba(234,179,8,0.2)] flex items-center gap-2">
                          <UserPlus className="w-4 h-4" /> Adicionar Dono
                        </button>
                      </div>

                      {allPartners.length === 0 ? (
                        <div className="p-16 text-center">
                          <Users className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                          <p className="text-gray-500 text-sm italic">Nenhum dono/parceiro cadastrado ainda.</p>
                          <p className="text-gray-600 text-xs mt-1">Clique em "Adicionar Dono" para começar.</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-6">
                          {allPartners.map((owner: any) => {
                            const linkedBoats = boats.filter(b => b.partner_id === owner.id);
                            return (
                              <div key={owner.id} className="bg-slate-950 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-all group">
                                <div className="flex justify-between items-start mb-4">
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center shrink-0">
                                      <span className="text-yellow-500 font-bold text-sm">{owner.name.charAt(0).toUpperCase()}</span>
                                    </div>
                                    <div>
                                      <p className="text-white font-bold text-sm">{owner.name}</p>
                                      <p className="text-[10px] text-yellow-500/60 uppercase font-bold">Parceiro {owner.management_level || 'L1'}</p>
                                    </div>
                                  </div>
                                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => openOwnerModal(owner)} className="p-1.5 text-gray-500 hover:text-yellow-500 transition-colors bg-slate-800 rounded-lg" title="Editar">
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button onClick={() => handleDeleteOwner(owner.id)} className="p-1.5 text-gray-500 hover:text-red-500 transition-colors bg-slate-800 rounded-lg" title="Excluir">
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>

                                <div className="space-y-2.5 mb-4">
                                  {owner.phone ? (
                                    <div className="flex items-center gap-2 text-xs">
                                      <Phone className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                                      <span className="text-gray-300 font-mono">{owner.phone}</span>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2 text-xs">
                                      <Phone className="w-3.5 h-3.5 text-gray-700 shrink-0" />
                                      <span className="text-gray-600 italic">Telefone não informado</span>
                                    </div>
                                  )}
                                  {owner.bank_account_info ? (
                                    <div className="flex items-start gap-2 text-xs">
                                      <Banknote className="w-3.5 h-3.5 text-green-500 shrink-0 mt-0.5" />
                                      <span className="text-gray-300 font-mono leading-relaxed whitespace-pre-wrap">{owner.bank_account_info}</span>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2 text-xs">
                                      <Banknote className="w-3.5 h-3.5 text-gray-700 shrink-0" />
                                      <span className="text-gray-600 italic">PIX / Conta não informado</span>
                                    </div>
                                  )}
                                </div>

                                {linkedBoats.length > 0 && (
                                  <div className="pt-3 border-t border-slate-800">
                                    <p className="text-[10px] text-gray-500 uppercase font-bold mb-2">Embarcações vinculadas</p>
                                    <div className="flex flex-wrap gap-1">
                                      {linkedBoats.map((b: any) => (
                                        <span key={b.id} className="bg-slate-800 text-gray-300 text-[10px] px-2 py-0.5 rounded border border-slate-700">{b.name}</span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* CONTRACT TEMPLATE TAB */}
                {activeTab === 'CONTRACT_TEMPLATE' && (
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
                    <div>
                      <h2 className="text-xl font-serif font-bold text-white flex items-center gap-2">
                        <FileText className="w-5 h-5 text-yellow-500" />
                        Template do Contrato de Locação
                      </h2>
                      <p className="text-sm text-gray-400 mt-1">
                        Customize o HTML base utilizado para gerar o PDF oficial de locação. Você pode usar tags dinâmicas que serão substituídas na emissão do contrato.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      <div className="lg:col-span-2 space-y-4">
                        <div>
                          <label className="text-xs text-gray-400 uppercase font-bold block mb-2">HTML do Termo de Locação</label>
                          <textarea
                            rows={22}
                            value={contractHtml}
                            onChange={(e) => setContractHtml(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-4 text-gray-300 font-mono text-xs focus:border-yellow-500 outline-none resize-none leading-relaxed"
                            placeholder="<html><body>...</body></html>"
                          />
                        </div>

                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={handleSaveContractTemplate}
                            disabled={contractSaving}
                            className="bg-yellow-500 hover:bg-yellow-400 text-slate-900 font-bold px-6 py-2.5 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                          >
                            {contractSaving ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>}
                            Salvar Alterações
                          </button>
                        </div>
                      </div>

                      <div className="space-y-4 bg-slate-950 p-5 rounded-xl border border-slate-800">
                        <h3 className="text-xs text-yellow-500 uppercase font-black tracking-wider">Tags Dinâmicas Disponíveis</h3>
                        <p className="text-[10px] text-gray-400 font-medium">Copie e cole estas chaves no HTML. O sistema substituirá automaticamente pelos dados da reserva:</p>
                        
                        <div className="space-y-3 pt-2 text-xs">
                          <div>
                            <code className="text-yellow-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 font-mono font-bold">{"{{nome_cliente}"}</code>
                            <span className="text-gray-400 ml-2">Nome do cliente</span>
                          </div>
                          <div>
                            <code className="text-yellow-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 font-mono font-bold">{"{{cpf_cliente}"}</code>
                            <span className="text-gray-400 ml-2">CPF do cliente</span>
                          </div>
                          <div>
                            <code className="text-yellow-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 font-mono font-bold">{"{{data_passeio}"}</code>
                            <span className="text-gray-400 ml-2">Data do passeio (DD/MM/AAAA)</span>
                          </div>
                          <div>
                            <code className="text-yellow-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 font-mono font-bold">{"{{lancha}"}</code>
                            <span className="text-gray-400 ml-2">Nome da embarcação</span>
                          </div>
                          <div>
                            <code className="text-yellow-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 font-mono font-bold">{"{{roteiro}"}</code>
                            <span className="text-gray-400 ml-2">Embarque → Destino</span>
                          </div>
                          <div>
                            <code className="text-yellow-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 font-mono font-bold">{"{{valor_total}"}</code>
                            <span className="text-gray-400 ml-2">Preço total</span>
                          </div>
                          <div>
                            <code className="text-yellow-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 font-mono font-bold">{"{{valor_entrada}"}</code>
                            <span className="text-gray-400 ml-2">Sinal de Entrada (50%)</span>
                          </div>
                          <div>
                            <code className="text-yellow-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 font-mono font-bold">{"{{valor_restante}"}</code>
                            <span className="text-gray-400 ml-2">Valor restante a pagar</span>
                          </div>
                          <div>
                            <code className="text-yellow-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 font-mono font-bold">{"{{extras}"}</code>
                            <span className="text-gray-400 ml-2">Status do Tapete Flutuante</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
            </div>
          )}
        </div>

        {/* Modal de Barco */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
               <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Ship className="w-5 h-5 text-yellow-500" />
                    {editingBoatId ? 'Editar Embarcação' : 'Adicionar Nova Embarcação'}
                  </h2>
                  <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-white transition-colors">
                     <X className="w-6 h-6"/>
                  </button>
               </div>
               
               <form onSubmit={handleSaveBoat} className="p-6 overflow-y-auto flex-1 space-y-6">
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <div className="space-y-4">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-yellow-500 mb-2 border-b border-slate-800 pb-2">Informações Base</h3>
                        
                        <div>
                         <label className="text-xs text-gray-500 uppercase font-bold">Nome do Barco</label>
                         <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:border-yellow-500 focus:outline-none"/>
                        </div>
                        <div>
                         <label className="text-xs text-gray-500 uppercase font-bold">URL do Catálogo Digital</label>
                         <input type="url" value={formData.catalogo_url} onChange={e => setFormData({...formData, catalogo_url: e.target.value})} placeholder="https://..." className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:border-yellow-500 focus:outline-none"/>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs text-gray-500 uppercase font-bold">Tamanho (Pés)</label>
                            <input type="number" required value={formData.size} onChange={e => setFormData({...formData, size: Number(e.target.value)})} className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:border-yellow-500 focus:outline-none"/>
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 uppercase font-bold">Capacidade</label>
                            <input type="number" required value={formData.capacity} onChange={e => setFormData({...formData, capacity: Number(e.target.value)})} className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:border-yellow-500 focus:outline-none"/>
                          </div>
                        </div>

                        <div>
                          <label className="text-xs text-gray-500 uppercase font-bold">Descrição da Embarcação</label>
                          <textarea 
                            rows={3}
                            value={formData.description} 
                            onChange={e => setFormData({...formData, description: e.target.value})} 
                            placeholder="Ex: Lancha moderna com som premium..."
                            className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:border-yellow-500 focus:outline-none"
                          />
                        </div>

                        <div className="pt-2 border-t border-slate-800">
                          <h4 className="text-xs font-bold uppercase text-yellow-500 mb-3 flex items-center gap-2 pt-2"><ImageIcon className="w-4 h-4"/> Galeria de Fotos</h4>
                          
                          {/* Thumbnails */}
                          {imageUrls.length > 0 && (
                            <div className="grid grid-cols-4 gap-2 mb-3">
                              {imageUrls.map((url, idx) => (
                                <div key={idx} className="relative group aspect-square rounded-lg overflow-hidden border border-slate-700">
                                  <img src={url} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
                                  {idx === 0 && <span className="absolute top-1 left-1 bg-yellow-500 text-slate-900 text-[8px] font-bold px-1.5 py-0.5 rounded">CAPA</span>}
                                  <button type="button" onClick={() => handleDeleteImage(url)} className="absolute top-1 right-1 bg-red-500/80 hover:bg-red-500 text-white p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Upload zone */}
                          <div
                            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                            onDragLeave={() => setDragOver(false)}
                            onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFileUpload(e.dataTransfer.files); }}
                            onClick={() => fileInputRef.current?.click()}
                            className={`border-2 border-dashed rounded-xl py-6 flex flex-col items-center justify-center cursor-pointer transition-all ${
                              dragOver ? 'border-yellow-500 bg-yellow-500/5' : 'border-slate-700 hover:border-yellow-500/50'
                            }`}
                          >
                            <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={e => handleFileUpload(e.target.files)} className="hidden" />
                            {uploading ? (
                              <><Loader2 className="w-6 h-6 text-yellow-500 animate-spin mb-2" /><p className="text-xs text-yellow-500">Enviando fotos...</p></>
                            ) : (
                              <><Upload className="w-6 h-6 text-gray-500 mb-2" /><p className="text-xs text-gray-400">Arraste fotos aqui ou <span className="text-yellow-500 font-bold">clique para escolher</span></p><p className="text-[10px] text-gray-600 mt-1">JPG, PNG ou WEBP • Máx. 10MB por foto</p></>
                            )}
                          </div>
                          <p className="text-[10px] text-gray-600 mt-1">A primeira foto será usada como capa no site.</p>
                        </div>

                        <div>
                          <label className="text-xs text-gray-500 uppercase font-bold">Status Atual</label>
                          <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:border-yellow-500 focus:outline-none">
                             <option value="AVAILABLE">Disponível</option>
                             <option value="IN_USE">Em Uso / Ocupado</option>
                             <option value="MAINTENANCE">Manutenção (Bloqueado)</option>
                          </select>
                        </div>
                     </div>

                     <div className="space-y-4">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-yellow-500 mb-2 border-b border-slate-800 pb-2">Configurações Financeiras e Gestão</h3>
                        
                        <div>
                          <label className="text-xs text-gray-500 uppercase font-bold">Tipo de Propriedade</label>
                          <select value={formData.owner_type} onChange={e => setFormData({...formData, owner_type: e.target.value})} className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:border-yellow-500 focus:outline-none">
                             <option value="OWN">Frota Própria Lanchas Show</option>
                             <option value="PARTNER_L1">Frota Parceira (Com Agenda)</option>
                             <option value="PARTNER_L2">Frota Parceira (Sob Consulta)</option>
                          </select>
                        </div>

                        {formData.owner_type !== 'OWN' && (
                           <div>
                             <label className="text-xs text-gray-500 uppercase font-bold">Dono / Parceiro</label>
                             <select value={formData.partner_id} onChange={e => setFormData({...formData, partner_id: e.target.value})} className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:border-yellow-500 focus:outline-none">
                                <option value="">Selecione um parceiro</option>
                                {allPartners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                             </select>
                           </div>
                        )}

                        <div>
                           <label className="text-xs text-gray-500 uppercase font-bold flex items-center gap-1">Custo Fixo de Saída <span title="Valor descontado automaticamente do Lucro Bruto na DRE. (Marinheiro, Pier, etc)" className="text-yellow-500 cursor-help">⚡</span></label>
                           <div className="relative mt-1">
                             <span className="absolute left-4 top-2 text-gray-500">R$</span>
                             <input type="number" required value={formData.original_rate} onChange={e => setFormData({...formData, original_rate: Number(e.target.value)})} className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-4 py-2 text-white focus:border-yellow-500 focus:outline-none"/>
                           </div>
                        </div>

                        <div className="pt-2 border-t border-slate-800">
                          <h4 className="text-xs font-bold uppercase text-yellow-500 mb-4 flex items-center gap-2 pt-2">
                            <MapPin className="w-4 h-4"/> Tarifário por Rota
                          </h4>
                          <p className="text-[10px] text-gray-600 mb-4">Preços definidos por combinação Embarque → Destino. A IA e o site usarão esses valores.</p>
                          
                          {/* Existing routes list */}
                          {boatRoutes.length > 0 && (
                            <div className="space-y-3 mb-4">
                              {boatRoutes.map((route, idx) => (
                                <div key={idx} className="bg-slate-950 border border-slate-800 rounded-xl p-4 group hover:border-yellow-500/30 transition-colors">
                                  <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                      <MapPin className="w-4 h-4 text-yellow-500" />
                                      <span className="text-sm font-bold text-white">{route.embarkation_point}</span>
                                      <span className="text-gray-600">→</span>
                                      <span className="text-sm font-bold text-yellow-400">{route.destination_point}</span>
                                    </div>
                                    <button type="button" onClick={() => removeRoute(idx)} className="text-gray-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"><Trash2 className="w-4 h-4" /></button>
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div className="space-y-1">
                                      <label className="text-[10px] text-gray-500 uppercase font-bold">Alta Temp.</label>
                                      <input type="number" value={route.price_high_season} onChange={e => { const nr = [...boatRoutes]; nr[idx] = {...nr[idx], price_high_season: Number(e.target.value)}; setBoatRoutes(nr); }} className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-white text-xs focus:border-yellow-500 focus:outline-none" />
                                      <input type="number" value={route.min_price_high_season} onChange={e => { const nr = [...boatRoutes]; nr[idx] = {...nr[idx], min_price_high_season: Number(e.target.value)}; setBoatRoutes(nr); }} className="w-full bg-slate-900 border border-red-500/30 rounded px-2 py-1 text-red-300 text-xs focus:border-red-500 focus:outline-none" placeholder="Mín" />
                                    </div>
                                    <div className="space-y-1">
                                      <label className="text-[10px] text-gray-500 uppercase font-bold">Fds/Feriado</label>
                                      <input type="number" value={route.price_weekend_holiday} onChange={e => { const nr = [...boatRoutes]; nr[idx] = {...nr[idx], price_weekend_holiday: Number(e.target.value)}; setBoatRoutes(nr); }} className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-white text-xs focus:border-yellow-500 focus:outline-none" />
                                      <input type="number" value={route.min_price_weekend_holiday} onChange={e => { const nr = [...boatRoutes]; nr[idx] = {...nr[idx], min_price_weekend_holiday: Number(e.target.value)}; setBoatRoutes(nr); }} className="w-full bg-slate-900 border border-red-500/30 rounded px-2 py-1 text-red-300 text-xs focus:border-red-500 focus:outline-none" placeholder="Mín" />
                                    </div>
                                    <div className="space-y-1">
                                      <label className="text-[10px] text-gray-500 uppercase font-bold">Baixa Temp.</label>
                                      <input type="number" value={route.price_low_season} onChange={e => { const nr = [...boatRoutes]; nr[idx] = {...nr[idx], price_low_season: Number(e.target.value)}; setBoatRoutes(nr); }} className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-white text-xs focus:border-yellow-500 focus:outline-none" />
                                      <input type="number" value={route.min_price_low_season} onChange={e => { const nr = [...boatRoutes]; nr[idx] = {...nr[idx], min_price_low_season: Number(e.target.value)}; setBoatRoutes(nr); }} className="w-full bg-slate-900 border border-red-500/30 rounded px-2 py-1 text-red-300 text-xs focus:border-red-500 focus:outline-none" placeholder="Mín" />
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Add new route form */}
                          {showRouteForm ? (
                            <div className="bg-slate-950 border border-yellow-500/30 rounded-xl p-4 space-y-3">
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="text-[10px] text-gray-500 uppercase font-bold">Embarque</label>
                                  <select value={routeForm.embarkation_point} onChange={e => setRouteForm({...routeForm, embarkation_point: e.target.value})} className="w-full mt-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white text-xs focus:border-yellow-500 focus:outline-none">
                                    <option value="">Selecione...</option>
                                    {formData.boarding_points.map(bp => <option key={bp} value={bp}>{bp}</option>)}
                                  </select>
                                </div>
                                <div>
                                  <label className="text-[10px] text-gray-500 uppercase font-bold">Destino</label>
                                  <select value={routeForm.destination_point} onChange={e => setRouteForm({...routeForm, destination_point: e.target.value})} className="w-full mt-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white text-xs focus:border-yellow-500 focus:outline-none">
                                    <option value="">Selecione...</option>
                                    {formData.allowed_destinations.map(d => <option key={d} value={d}>{d}</option>)}
                                  </select>
                                </div>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div className="space-y-1">
                                  <label className="text-[10px] text-gray-500 uppercase font-bold">Alta R$</label>
                                  <input type="number" value={routeForm.price_high_season} onChange={e => setRouteForm({...routeForm, price_high_season: Number(e.target.value)})} className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-white text-xs" />
                                  <input type="number" value={routeForm.min_price_high_season} onChange={e => setRouteForm({...routeForm, min_price_high_season: Number(e.target.value)})} className="w-full bg-slate-900 border border-red-500/30 rounded px-2 py-1 text-red-300 text-xs" placeholder="Mín Alta" />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[10px] text-gray-500 uppercase font-bold">Fds R$</label>
                                  <input type="number" value={routeForm.price_weekend_holiday} onChange={e => setRouteForm({...routeForm, price_weekend_holiday: Number(e.target.value)})} className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-white text-xs" />
                                  <input type="number" value={routeForm.min_price_weekend_holiday} onChange={e => setRouteForm({...routeForm, min_price_weekend_holiday: Number(e.target.value)})} className="w-full bg-slate-900 border border-red-500/30 rounded px-2 py-1 text-red-300 text-xs" placeholder="Mín Fds" />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[10px] text-gray-500 uppercase font-bold">Baixa R$</label>
                                  <input type="number" value={routeForm.price_low_season} onChange={e => setRouteForm({...routeForm, price_low_season: Number(e.target.value)})} className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-white text-xs" />
                                  <input type="number" value={routeForm.min_price_low_season} onChange={e => setRouteForm({...routeForm, min_price_low_season: Number(e.target.value)})} className="w-full bg-slate-900 border border-red-500/30 rounded px-2 py-1 text-red-300 text-xs" placeholder="Mín Baixa" />
                                </div>
                              </div>
                              <div className="flex gap-2 pt-1">
                                <button type="button" onClick={addRoute} className="bg-yellow-500 hover:bg-yellow-400 text-slate-900 font-bold text-xs px-4 py-2 rounded-lg transition-colors flex items-center gap-1"><Plus className="w-3 h-3"/> Confirmar Rota</button>
                                <button type="button" onClick={() => setShowRouteForm(false)} className="text-gray-400 hover:text-white text-xs px-3 py-2 rounded-lg transition-colors">Cancelar</button>
                              </div>
                            </div>
                          ) : (
                            <button type="button" onClick={() => setShowRouteForm(true)} className="w-full border border-dashed border-slate-700 hover:border-yellow-500/50 rounded-xl py-3 text-gray-400 hover:text-yellow-500 text-sm flex items-center justify-center gap-2 transition-colors">
                              <Plus className="w-4 h-4" /> Adicionar Rota com Preços
                            </button>
                          )}
                          {formData.boarding_points.length === 0 && <p className="text-[10px] text-red-400 mt-2">⚠ Cadastre locais de embarque e destinos acima antes de adicionar rotas.</p>}
                        </div>

                        <div className="pt-2 border-t border-slate-800">
                          <h4 className="text-xs font-bold uppercase text-yellow-500 mb-4 flex items-center gap-2 pt-2">⭐ Pacotes Extras e Inclusos</h4>
                          
                          <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <label className="flex items-center gap-3 cursor-pointer group">
                                    <div className="relative flex items-center justify-center w-5 h-5">
                                      <input type="checkbox" checked={formData.include_captain} onChange={e => setFormData({...formData, include_captain: e.target.checked})} className="peer appearance-none w-5 h-5 border border-slate-600 rounded bg-slate-800/50 checked:bg-yellow-500 checked:border-yellow-500 transition-all cursor-pointer"/>
                                      <CheckCircle className="absolute w-3 h-3 text-slate-900 opacity-0 peer-checked:opacity-100 pointer-events-none" />
                                    </div>
                                    <span className="text-sm text-gray-300 group-hover:text-white transition-colors">Marinheiro Incluso?</span>
                                </label>
                                <label className="flex items-center gap-3 cursor-pointer group">
                                    <div className="relative flex items-center justify-center w-5 h-5">
                                      <input type="checkbox" checked={formData.include_fuel} onChange={e => setFormData({...formData, include_fuel: e.target.checked})} className="peer appearance-none w-5 h-5 border border-slate-600 rounded bg-slate-800/50 checked:bg-yellow-500 checked:border-yellow-500 transition-all cursor-pointer"/>
                                      <CheckCircle className="absolute w-3 h-3 text-slate-900 opacity-0 peer-checked:opacity-100 pointer-events-none" />
                                    </div>
                                    <span className="text-sm text-gray-300 group-hover:text-white transition-colors">Combustível Incluso?</span>
                                </label>
                              </div>

                             <label className="flex items-center gap-3 cursor-pointer group">
                                <div className="relative flex items-center justify-center w-5 h-5">
                                   <input type="checkbox" checked={formData.has_floating_mat} onChange={e => setFormData({...formData, has_floating_mat: e.target.checked})} className="peer appearance-none w-5 h-5 border border-slate-600 rounded bg-slate-800/50 checked:bg-yellow-500 checked:border-yellow-500 transition-all cursor-pointer"/>
                                   <CheckCircle className="absolute w-3 h-3 text-slate-900 opacity-0 peer-checked:opacity-100 pointer-events-none" />
                                </div>
                                <span className="text-sm text-gray-300 group-hover:text-white transition-colors">Possui Tapete Flutuante?</span>
                             </label>

                             {formData.has_floating_mat && (
                                <div className="ml-8">
                                  <label className="text-xs text-gray-500 uppercase font-bold">Valor do Aluguel do Tapete (R$)</label>
                                  <input type="number" value={formData.floating_mat_price} onChange={e => setFormData({...formData, floating_mat_price: Number(e.target.value)})} className="w-full max-w-[200px] mt-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:border-yellow-500 focus:outline-none"/>
                                </div>
                             )}

                             <div>
                               <label className="text-xs text-gray-500 uppercase font-bold">Valor da Hora Extra (Após 18h) (R$)</label>
                               <input type="number" value={formData.extra_hour_price} onChange={e => setFormData({...formData, extra_hour_price: Number(e.target.value)})} className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:border-yellow-500 focus:outline-none"/>
                               <p className="text-[10px] text-gray-600 mt-1">Cobrado apenas de clientes que desejam ficar após as 19h.</p>
                             </div>
                          </div>
                        </div>
                     </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-slate-800">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-yellow-500 mb-2 border-b border-slate-800 pb-2">Destinos e B2C (Home)</h3>
                      
                      <div>
                        <label className="text-xs text-gray-500 uppercase font-bold">Locais de Embarque</label>
                        <div className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg p-2 flex flex-wrap gap-2 items-center focus-within:border-yellow-500 transition-colors">
                           {formData.boarding_points.map((tag, idx) => (
                             <div key={idx} className="flex items-center gap-1 bg-slate-800 text-slate-200 text-xs px-2 py-1 rounded-md border border-slate-700">
                               <span>{tag}</span>
                               <button type="button" onClick={() => handleRemoveTag('boarding_points', idx)} className="text-gray-400 hover:text-red-400 transition-colors"><X className="w-3 h-3"/></button>
                             </div>
                           ))}
                           <input type="text" onKeyDown={(e) => handleAddTag(e, 'boarding_points')} placeholder="Digite e aperte Enter..." className="flex-1 bg-transparent border-none outline-none text-white text-sm min-w-[120px]"/>
                        </div>
                        <p className="text-[10px] text-gray-600 mt-1">Pressione Enter ou vírgula para adicionar múltiplos embarques.</p>
                      </div>

                      <div>
                        <label className="text-xs text-gray-500 uppercase font-bold">Rotas/Destinos Aceitos</label>
                        <div className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg p-2 flex flex-wrap gap-2 items-center focus-within:border-yellow-500 transition-colors">
                           {formData.allowed_destinations.map((tag, idx) => (
                             <div key={idx} className="flex items-center gap-1 bg-slate-800 text-slate-200 text-xs px-2 py-1 rounded-md border border-slate-700">
                               <span>{tag}</span>
                               <button type="button" onClick={() => handleRemoveTag('allowed_destinations', idx)} className="text-gray-400 hover:text-red-400 transition-colors"><X className="w-3 h-3"/></button>
                             </div>
                           ))}
                           <input type="text" onKeyDown={(e) => handleAddTag(e, 'allowed_destinations')} placeholder="Digite e aperte Enter..." className="flex-1 bg-transparent border-none outline-none text-white text-sm min-w-[120px]"/>
                        </div>
                        <p className="text-[10px] text-gray-600 mt-1">Ajuda no filtro cruzado do cliente.</p>
                      </div>
                  </div>

                  <div className="pt-6 flex justify-between items-center gap-4 border-t border-slate-800 mt-6 sticky bottom-0 bg-slate-900 pb-6">
                     <div className="flex gap-4">
                       {editingBoatId && (
                         <button 
                           type="button" 
                           onClick={handleDeleteBoat} 
                           disabled={saving}
                           className="px-4 py-3 rounded-xl border border-red-500/30 text-red-500 font-bold hover:bg-red-500/10 transition-colors flex items-center gap-2 disabled:opacity-50"
                         >
                           <Trash2 className="w-5 h-5" /> Excluir
                         </button>
                       )}
                       <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 rounded-xl border border-slate-700 text-gray-300 font-bold hover:bg-slate-800 transition-colors">
                          Cancelar
                       </button>
                     </div>
                      <button type="submit" disabled={saving || uploading} className="px-6 py-3 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-slate-900 font-bold shadow-[0_0_15px_rgba(234,179,8,0.3)] transition-all flex items-center gap-2 disabled:opacity-50">
                        {saving ? (
                          <><Loader2 className="w-5 h-5 animate-spin" /> Salvando...</>
                        ) : (
                          <><Save className="w-5 h-5"/> Salvar Lancha</>
                        )}
                      </button>
                  </div>
               </form>
            </div>
          </div>
        )}

        {/* Modal de Conta Geral */}
        {isPayableModalOpen && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
               <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Banknote className="w-5 h-5 text-yellow-500" />
                    Lançar Gasto Geral
                  </h2>
                  <button onClick={() => setIsPayableModalOpen(false)} className="text-gray-500 hover:text-white transition-colors">
                     <X className="w-6 h-6"/>
                  </button>
               </div>
               
               <form onSubmit={handleSavePayable} className="p-6 space-y-4">
                  <div>
                    <label className="text-xs text-gray-500 uppercase font-bold">Descrição do Gasto</label>
                    <input 
                      type="text" 
                      required 
                      value={payableFormData.description} 
                      onChange={e => setPayableFormData({...payableFormData, description: e.target.value})} 
                      placeholder="Ex: Produto de limpeza, Salário Marinheiro, Material..."
                      className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:border-yellow-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-gray-500 uppercase font-bold">Valor (R$)</label>
                    <input 
                      type="number" 
                      required 
                      value={payableFormData.amount || ''} 
                      onChange={e => setPayableFormData({...payableFormData, amount: Number(e.target.value)})} 
                      className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:border-yellow-500 outline-none"
                    />
                  </div>

                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <p className="text-[10px] text-gray-500">Este valor será lançado automaticamente como saída no caixa (DRE) e ficará registrado nesta lista para controle.</p>
                  </div>

                  <div className="pt-4 flex justify-end gap-3">
                    <button type="button" onClick={() => setIsPayableModalOpen(false)} className="px-4 py-2 text-gray-400 font-bold hover:text-white transition-colors">
                      Cancelar
                    </button>
                    <button type="submit" className="bg-yellow-500 hover:bg-yellow-400 text-slate-900 font-bold px-6 py-2 rounded-lg transition-colors">
                      Lançar Gasto
                    </button>
                  </div>
               </form>
            </div>
          </div>
        )}

        {/* Modal de Despesas */}
        {isExpenseModalOpen && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
               <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Banknote className="w-5 h-5 text-yellow-500" />
                    Adicionar Despesa
                  </h2>
                  <button onClick={() => setIsExpenseModalOpen(false)} className="text-gray-500 hover:text-white transition-colors">
                     <X className="w-6 h-6"/>
                  </button>
               </div>
               
               <form onSubmit={handleSaveExpense} className="p-6 space-y-4">
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 mb-4">
                    <p className="text-xs text-gray-500 uppercase font-bold">Lancha Selecionada</p>
                    <p className="text-sm font-bold text-white">{expenseFormData.boat_name}</p>
                  </div>

                  <div>
                    <label className="text-xs text-gray-500 uppercase font-bold">Tipo de Despesa</label>
                    <select 
                      value={expenseFormData.type} 
                      onChange={e => setExpenseFormData({...expenseFormData, type: e.target.value})}
                      className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:border-yellow-500 outline-none"
                    >
                      <option value="FIXED">Fixa (Ex: Marina, Seguro, Marinheiro)</option>
                      <option value="VARIABLE">Variável (Ex: Combustível, Limpeza)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-gray-500 uppercase font-bold">Valor (R$)</label>
                    <input 
                      type="number" 
                      required 
                      value={expenseFormData.amount || ''} 
                      onChange={e => setExpenseFormData({...expenseFormData, amount: Number(e.target.value)})} 
                      className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:border-yellow-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-gray-500 uppercase font-bold">
                       {expenseFormData.type === 'FIXED' ? 'Dia de Vencimento (Todo Mês)' : 'Data do Pagamento'}
                    </label>
                    {expenseFormData.type === 'FIXED' ? (
                       <input 
                         type="number" 
                         min="1" max="31"
                         required 
                         value={expenseFormData.day} 
                         onChange={e => setExpenseFormData({...expenseFormData, day: e.target.value})} 
                         className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:border-yellow-500 outline-none"
                       />
                    ) : (
                       <input 
                         type="date" 
                         required 
                         value={expenseFormData.date} 
                         onChange={e => setExpenseFormData({...expenseFormData, date: e.target.value})} 
                         className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:border-yellow-500 outline-none"
                       />
                    )}
                  </div>

                  <div>
                    <label className="text-xs text-gray-500 uppercase font-bold">Descrição / Especificação</label>
                    <input 
                      type="text" 
                      required 
                      value={expenseFormData.description} 
                      onChange={e => setExpenseFormData({...expenseFormData, description: e.target.value})} 
                      placeholder="Ex: Abastecimento 100L..."
                      className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:border-yellow-500 outline-none"
                    />
                  </div>

                  <div className="pt-4 flex justify-end gap-3 border-t border-slate-800 mt-2">
                    <button type="button" onClick={() => setIsExpenseModalOpen(false)} className="px-4 py-2 text-gray-400 font-bold hover:text-white transition-colors">
                      Cancelar
                    </button>
                    <button type="submit" disabled={expenseSaving} className="bg-yellow-500 hover:bg-yellow-400 text-slate-900 font-bold px-6 py-2 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2">
                      {expenseSaving ? <Loader2 className="w-4 h-4 animate-spin"/> : null}
                      Salvar Despesa
                    </button>
                  </div>
               </form>
            </div>
          </div>
        )}
      </main>

      {/* Modal Dono / Parceiro */}
      {isOwnerModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-yellow-500" />
                {editingOwnerId ? 'Editar Dono / Parceiro' : 'Novo Dono / Parceiro'}
              </h2>
              <button onClick={() => setIsOwnerModalOpen(false)} className="text-gray-500 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSaveOwner} className="p-6 space-y-5">
              <div>
                <label className="text-xs text-gray-500 uppercase font-bold">Nome Completo *</label>
                <input
                  type="text"
                  required
                  value={ownerFormData.name}
                  onChange={e => setOwnerFormData({...ownerFormData, name: e.target.value})}
                  placeholder="Ex: João da Silva"
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white focus:border-yellow-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-gray-500 uppercase font-bold flex items-center gap-1"><Phone className="w-3 h-3" /> Telefone / WhatsApp</label>
                <input
                  type="tel"
                  value={ownerFormData.phone}
                  onChange={e => setOwnerFormData({...ownerFormData, phone: e.target.value})}
                  placeholder="Ex: (47) 99999-0000"
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white focus:border-yellow-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-gray-500 uppercase font-bold flex items-center gap-1"><Banknote className="w-3 h-3" /> PIX / Dados Bancários</label>
                <textarea
                  rows={3}
                  value={ownerFormData.bank_account_info}
                  onChange={e => setOwnerFormData({...ownerFormData, bank_account_info: e.target.value})}
                  placeholder={"Ex: PIX: 47 99999-0000 (CPF)\nBanco Itaú — Ag: 0001 — CC: 12345-6"}
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white focus:border-yellow-500 focus:outline-none font-mono text-sm resize-none"
                />
                <p className="text-[10px] text-gray-600 mt-1">Cole aqui a chave PIX, banco e conta. Aparecerá na ficha do barco para referência de repasse.</p>
              </div>

              <div>
                <label className="text-xs text-gray-500 uppercase font-bold">Nível de Parceria</label>
                <select
                  value={ownerFormData.management_level}
                  onChange={e => setOwnerFormData({...ownerFormData, management_level: e.target.value})}
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white focus:border-yellow-500 focus:outline-none"
                >
                  <option value="L1">L1 — Com Agenda (Lanchas Show gerencia tudo)</option>
                  <option value="L2">L2 — Sob Consulta (Dono confirma cada reserva)</option>
                </select>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-800">
                <button type="button" onClick={() => setIsOwnerModalOpen(false)} className="px-4 py-2 text-gray-400 font-bold hover:text-white transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={ownerSaving} className="bg-yellow-500 hover:bg-yellow-400 text-slate-900 font-bold px-6 py-2 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2">
                  {ownerSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {editingOwnerId ? 'Salvar Alterações' : 'Cadastrar Parceiro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
