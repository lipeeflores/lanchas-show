import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { adminPatch } from '../../lib/adminApi';
import { Anchor, Ship, CalendarCheck, Users, Search, Download, Landmark, Wallet, Tag, Bot, Settings, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import AdminLayout from '../../components/AdminLayout';

export default function CustomersDB() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [editingCustomer, setEditingCustomer] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

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

  const handleEdit = (c: any) => {
    setEditingCustomer(c);
    setIsModalOpen(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomer) return;
    setSaving(true);
    try {
      const { error } = await adminPatch(`/api/admin/customers/${editingCustomer.id}`, {
        full_name: editingCustomer.full_name,
        email: editingCustomer.email,
        phone: editingCustomer.phone,
        document_cpf: editingCustomer.document_cpf,
        document_rg: editingCustomer.document_rg,
        address: editingCustomer.address,
        notes: editingCustomer.notes,
        tags: editingCustomer.tags,
        rating_stars: editingCustomer.rating_stars,
        rating_notes: editingCustomer.rating_notes
      });

      if (error) throw error;
      
      // Update local state
      setCustomers(customers.map(c => c.id === editingCustomer.id ? { ...c, ...editingCustomer } : c));
      setIsModalOpen(false);
      setEditingCustomer(null);
    } catch (err: any) {
      alert('Erro ao salvar cliente: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const getTagStyle = (tag: string) => {
      switch(tag.toLowerCase()) {
          case 'família': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
          case 'tranquilo': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
          case 'bagunça': return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
          case 'sem educação': return 'bg-red-500/10 text-red-400 border-red-500/20';
          case 'não alugar mais': return 'bg-red-950 text-red-200 border-red-850 font-black';
          case 'fiel': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30 font-bold';
          case 'festeiro': return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
          default: return 'bg-slate-800 text-gray-300 border-slate-700';
      }
  };

  return (
    <AdminLayout>
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
             
             {/* Top 3 Clientes */}
             {customers.filter(c => c.rentals > 0).length > 0 && (
               <div>
                 <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-4 flex items-center gap-2">🏆 Top 3 Melhores Clientes</h2>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                   {[...customers].sort((a, b) => b.ltv - a.ltv).slice(0, 3).map((c, i) => {
                     const medals = ['🥇', '🥈', '🥉'];
                     const borders = ['border-yellow-500/40', 'border-slate-500/40', 'border-amber-700/40'];
                     const glows = ['shadow-[0_0_20px_rgba(234,179,8,0.1)]', '', ''];
                     return (
                       <div key={c.id} className={`bg-slate-900 border ${borders[i]} rounded-2xl p-5 relative overflow-hidden ${glows[i]}`}>
                         <div className="absolute top-3 right-3 text-2xl">{medals[i]}</div>
                         <p className="text-lg font-bold text-white mb-1">{c.full_name}</p>
                         <div className="flex items-center gap-4 mt-3">
                           <div>
                             <p className="text-[10px] text-gray-500 uppercase font-bold">Locações</p>
                             <p className="text-xl font-bold text-yellow-500">{c.rentals}</p>
                           </div>
                           <div>
                             <p className="text-[10px] text-gray-500 uppercase font-bold">Total Gasto</p>
                             <p className="text-xl font-bold text-green-500">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(c.ltv)}</p>
                           </div>
                         </div>
                         <div className="flex flex-wrap gap-1 mt-3">
                           {(c.tags || []).map((tag: string, ti: number) => (
                             <span key={ti} className={`text-[9px] uppercase font-medium px-1.5 py-0.5 rounded border ${getTagStyle(tag)}`}>{tag}</span>
                           ))}
                         </div>
                       </div>
                     );
                   })}
                 </div>
               </div>
             )}

             <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left min-w-[900px]">
                      <thead className="bg-slate-950/80">
                          <tr>
                              <th className="p-4 text-xs font-bold uppercase tracking-wider text-gray-500">Nome do Contratante</th>
                              <th className="p-4 text-xs font-bold uppercase tracking-wider text-gray-500">Contato</th>
                              <th className="p-4 text-xs font-bold uppercase tracking-wider text-gray-500">Voluma de Loc.</th>
                              <th className="p-4 text-xs font-bold uppercase tracking-wider text-gray-500">Ticket Gasto (LTV)</th>
                              <th className="p-4 text-xs font-bold uppercase tracking-wider text-gray-500">Tags IA / Comportamento</th>
                              <th className="p-4 text-xs font-bold uppercase tracking-wider text-gray-500 text-right">Ações</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/50">
                          {customers.map(c => (
                              <tr key={c.id} className="hover:bg-slate-800/30 transition-colors">
                                  <td className="p-4">
                                      <div className="flex items-center gap-2">
                                        <p className="text-sm font-bold text-white">{c.full_name}</p>
                                        {c.rating_stars ? (
                                          <span className="text-yellow-500 text-xs font-bold whitespace-nowrap">
                                            {'★'.repeat(c.rating_stars)}{'☆'.repeat(5 - c.rating_stars)}
                                          </span>
                                        ) : null}
                                      </div>
                                      <p className="text-xs text-gray-500">Desde {new Date(c.created_at).getFullYear()}</p>
                                      {c.rating_notes && (
                                        <p className="text-xs text-gray-400 italic mt-1 font-medium bg-slate-950/40 px-2 py-1 rounded border border-slate-800/40 inline-block">
                                          "{c.rating_notes}"
                                        </p>
                                      )}
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
                                  <td className="p-4 text-right">
                                      <button onClick={() => handleEdit(c)} className="text-yellow-500 hover:text-yellow-400 text-xs font-bold transition-colors">
                                          Editar
                                      </button>
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
                </div>
             </div>
          </div>
        )}

        {/* Modal Editar Cliente */}
        {isModalOpen && editingCustomer && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
               <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Users className="w-5 h-5 text-yellow-500" />
                    Editar Cliente (Dados para Contrato)
                  </h2>
                  <button onClick={() => { setIsModalOpen(false); setEditingCustomer(null); }} className="text-gray-500 hover:text-white transition-colors">
                     <span className="text-xl">&times;</span>
                  </button>
               </div>
               
               <div className="p-6 overflow-y-auto flex-1">
                 <form id="customerForm" onSubmit={handleSaveCustomer} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-gray-500 uppercase font-bold">Nome Completo</label>
                        <input type="text" required value={editingCustomer.full_name} onChange={e => setEditingCustomer({...editingCustomer, full_name: e.target.value})} className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:border-yellow-500 outline-none" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 uppercase font-bold">Telefone</label>
                        <input type="text" value={editingCustomer.phone || ''} onChange={e => setEditingCustomer({...editingCustomer, phone: e.target.value})} className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:border-yellow-500 outline-none" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 uppercase font-bold">E-mail</label>
                        <input type="email" value={editingCustomer.email || ''} onChange={e => setEditingCustomer({...editingCustomer, email: e.target.value})} className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:border-yellow-500 outline-none" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 uppercase font-bold">CPF</label>
                        <input type="text" value={editingCustomer.document_cpf || ''} onChange={e => setEditingCustomer({...editingCustomer, document_cpf: e.target.value})} className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:border-yellow-500 outline-none" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 uppercase font-bold">RG</label>
                        <input type="text" value={editingCustomer.document_rg || ''} onChange={e => setEditingCustomer({...editingCustomer, document_rg: e.target.value})} className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:border-yellow-500 outline-none" />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="text-xs text-gray-500 uppercase font-bold">Endereço Completo</label>
                        <input type="text" value={editingCustomer.address || ''} onChange={e => setEditingCustomer({...editingCustomer, address: e.target.value})} placeholder="Rua, Número, Bairro, Cidade, Estado, CEP" className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:border-yellow-500 outline-none" />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="text-xs text-gray-500 uppercase font-bold">Observações / Notas</label>
                        <textarea value={editingCustomer.notes || ''} onChange={e => setEditingCustomer({...editingCustomer, notes: e.target.value})} className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:border-yellow-500 outline-none h-24" />
                      </div>
                      
                      <div className="sm:col-span-2 border-t border-slate-800 pt-4 mt-2">
                        <label className="text-xs text-gray-500 uppercase font-bold block mb-2 text-yellow-500">Comportamento & CRM (Dados Operacionais)</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="text-[10px] text-gray-400 uppercase font-bold block mb-1">Avaliação por Estrelas</label>
                            <select
                              value={editingCustomer.rating_stars || 0}
                              onChange={e => setEditingCustomer({...editingCustomer, rating_stars: Number(e.target.value)})}
                              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white text-xs outline-none focus:border-yellow-500 appearance-none cursor-pointer"
                            >
                              <option value={0}>Sem Estrelas</option>
                              <option value={1}>★☆☆☆☆ (1 Estrela)</option>
                              <option value={2}>★★☆☆☆ (2 Estrelas)</option>
                              <option value={3}>★★★☆☆ (3 Estrelas)</option>
                              <option value={4}>★★★★☆ (4 Estrelas)</option>
                              <option value={5}>★★★★★ (5 Estrelas)</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[10px] text-gray-400 uppercase font-bold block mb-1">Tags de Comportamento</label>
                            <div className="flex flex-wrap gap-1.5 mt-1">
                              {['Família', 'Bagunça', 'Não alugar mais', 'Tranquilo', 'Sem educação'].map((tag) => {
                                const currentTags = editingCustomer.tags || [];
                                const isSelected = currentTags.includes(tag);
                                return (
                                  <button
                                    type="button"
                                    key={tag}
                                    onClick={() => {
                                      const nextTags = isSelected
                                        ? currentTags.filter((t: string) => t !== tag)
                                        : [...currentTags, tag];
                                      setEditingCustomer({ ...editingCustomer, tags: nextTags });
                                    }}
                                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all ${
                                      isSelected
                                        ? 'bg-yellow-500 text-slate-900 border-yellow-500'
                                        : 'bg-slate-950 border-slate-800 text-gray-400 hover:text-white'
                                    }`}
                                  >
                                    {tag}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                          <div className="sm:col-span-2">
                            <label className="text-[10px] text-gray-400 uppercase font-bold block mb-1">Observações de Comportamento</label>
                            <textarea
                              value={editingCustomer.rating_notes || ''}
                              onChange={e => setEditingCustomer({...editingCustomer, rating_notes: e.target.value})}
                              placeholder="Observações adicionais sobre o comportamento..."
                              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:border-yellow-500 outline-none h-20 text-xs"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                 </form>
               </div>
               
               <div className="p-6 border-t border-slate-800 flex justify-end gap-3 bg-slate-900/50">
                  <button type="button" onClick={() => { setIsModalOpen(false); setEditingCustomer(null); }} className="px-4 py-2 text-gray-400 font-bold hover:text-white transition-colors">
                    Cancelar
                  </button>
                  <button type="submit" form="customerForm" disabled={saving} className="bg-yellow-500 hover:bg-yellow-400 text-slate-900 font-bold px-6 py-2 rounded-lg transition-colors disabled:opacity-50">
                    {saving ? 'Salvando...' : 'Salvar Dados'}
                  </button>
               </div>
            </div>
          </div>
        )}
      </main>
    </AdminLayout>
  );
}
