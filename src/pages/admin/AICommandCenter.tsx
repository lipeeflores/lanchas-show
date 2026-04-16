import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Anchor, Ship, CalendarCheck, Bot, MessageCircle, Shield, ShieldOff, Send, Image, CheckCircle, Clock, Landmark, Wallet, Users, Megaphone, Tag } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function AICommandCenter() {
  const [conversations, setConversations] = useState<any[]>([]);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'CHATS' | 'CAMPAIGNS'>('CHATS');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const { data: convData } = await supabase
        .from('ia_conversations')
        .select('*')
        .order('created_at', { ascending: false });
      if (convData) {
        setConversations(convData);
        if (convData.length > 0 && !selectedConvId) {
          setSelectedConvId(convData[0].id);
        }
      }

      const { data: campData } = await supabase
        .from('ia_campaigns')
        .select('*')
        .order('created_at', { ascending: false });
      if (campData) setCampaigns(campData);

      setLoading(false);
    };
    fetchData();
  }, []);

  // Fetch messages when conversation changes
  useEffect(() => {
    if (!selectedConvId) return;
    const fetchMessages = async () => {
      const { data } = await supabase
        .from('ia_messages')
        .select('*')
        .eq('conversation_id', selectedConvId)
        .order('created_at', { ascending: true });
      if (data) setMessages(data);
    };
    fetchMessages();
  }, [selectedConvId]);

  const handleTakeoverToggle = async (convId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'AI_CONTROL' ? 'HUMAN_CONTROL' : 'AI_CONTROL';
    await supabase.from('ia_conversations').update({ status: newStatus }).eq('id', convId);
    setConversations(prev => prev.map(c => c.id === convId ? { ...c, status: newStatus } : c));
  };

  const handleApproveCampaign = async (campId: string) => {
    await supabase.from('ia_campaigns').update({ status: 'APPROVED', approved_at: new Date().toISOString() }).eq('id', campId);
    setCampaigns(prev => prev.map(c => c.id === campId ? { ...c, status: 'APPROVED' } : c));
  };

  const selectedConv = conversations.find(c => c.id === selectedConvId);

  const getSenderStyle = (sender: string) => {
    switch (sender) {
      case 'IA': return 'bg-gradient-to-br from-purple-500/20 to-indigo-500/20 border-purple-500/30 ml-auto';
      case 'ADMIN': return 'bg-gradient-to-br from-yellow-500/10 to-amber-500/10 border-yellow-500/30 ml-auto';
      case 'CLIENT': return 'bg-slate-800 border-slate-700';
      case 'PARTNER': return 'bg-slate-800 border-slate-700';
      default: return 'bg-slate-800 border-slate-700';
    }
  };

  const getSenderLabel = (sender: string) => {
    switch (sender) {
      case 'IA': return '🤖 Assistente IA';
      case 'ADMIN': return '👤 Você (Admin)';
      case 'CLIENT': return '💬 Cliente';
      case 'PARTNER': return '🤝 Parceiro';
      default: return sender;
    }
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
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
            <Link to="/admin/dashboard" className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-slate-800/50 rounded-lg transition-colors"><Ship className="w-5 h-5" /><span className="text-sm">Visão 360º</span></Link>
            <Link to="/admin/reservas" className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-slate-800/50 rounded-lg transition-colors"><CalendarCheck className="w-5 h-5" /><span className="text-sm">Reservas</span></Link>
            <Link to="/admin/frota" className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-slate-800/50 rounded-lg transition-colors"><Landmark className="w-5 h-5" /><span className="text-sm">Frotas</span></Link>
            <Link to="/admin/financeiro" className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-slate-800/50 rounded-lg transition-colors"><Wallet className="w-5 h-5" /><span className="text-sm">DRE & Caixa</span></Link>
            <Link to="/admin/clientes" className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-slate-800/50 rounded-lg transition-colors"><Users className="w-5 h-5" /><span className="text-sm">Clientes CRM</span></Link>
            <Link to="/admin/ia" className="flex items-center gap-3 px-4 py-3 bg-slate-800 text-yellow-500 rounded-lg border border-slate-700"><Bot className="w-5 h-5" /><span className="text-sm">Central IA</span></Link>
            <Link to="/admin/calendario" className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-slate-800/50 rounded-lg transition-colors"><Settings className="w-5 h-5" /><span className="text-sm">Temporada & Preços</span></Link>
          </nav>
        </div>
      </aside>

      <main className="flex-1 overflow-hidden flex flex-col">
        {/* Header */}
        <header className="bg-slate-900/50 backdrop-blur-md border-b border-slate-800 p-6 flex justify-between items-center shrink-0">
          <div>
            <h1 className="text-2xl font-serif font-bold text-white flex items-center gap-2">Central de Monitoramento IA <Bot className="w-6 h-6 text-purple-400" /></h1>
            <p className="text-sm text-gray-400">Supervisão de conversas e campanhas automáticas</p>
          </div>
        </header>

        {/* Tab Switcher */}
        <div className="border-b border-slate-800 px-6 pt-4 bg-slate-900/30 flex gap-6 shrink-0">
          <button onClick={() => setActiveTab('CHATS')} className={`pb-4 text-sm font-bold uppercase tracking-wider transition-colors border-b-2 flex items-center gap-2 ${activeTab === 'CHATS' ? 'border-purple-500 text-purple-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
            <MessageCircle className="w-4 h-4" /> Feed de Conversas
          </button>
          <button onClick={() => setActiveTab('CAMPAIGNS')} className={`pb-4 text-sm font-bold uppercase tracking-wider transition-colors border-b-2 flex items-center gap-2 ${activeTab === 'CAMPAIGNS' ? 'border-purple-500 text-purple-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
            <Megaphone className="w-4 h-4" /> Campanhas IA
            {campaigns.filter(c => c.status === 'DRAFT').length > 0 && (
              <span className="bg-purple-500 text-white text-[10px] px-2 py-0.5 rounded-full">{campaigns.filter(c => c.status === 'DRAFT').length}</span>
            )}
          </button>
        </div>

        {loading ? (
          <div className="p-10 text-center text-purple-400 animate-pulse">Inicializando centro de comando...</div>
        ) : (
          <>
            {/* CHATS TAB */}
            {activeTab === 'CHATS' && (
              <div className="flex flex-1 overflow-hidden">
                {/* Conversations List */}
                <div className="w-80 bg-slate-900 border-r border-slate-800 overflow-y-auto shrink-0">
                  <div className="p-4 border-b border-slate-800">
                    <p className="text-xs text-gray-500 uppercase font-bold tracking-widest">Conversas Ativas</p>
                  </div>
                  {conversations.map(conv => (
                    <button
                      key={conv.id}
                      onClick={() => setSelectedConvId(conv.id)}
                      className={`w-full text-left p-4 border-b border-slate-800/50 transition-colors ${selectedConvId === conv.id ? 'bg-slate-800' : 'hover:bg-slate-800/40'}`}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-bold text-white text-sm truncate pr-2">{conv.contact_name}</span>
                        {conv.status === 'AI_CONTROL' ? (
                          <span className="bg-purple-500/10 text-purple-400 text-[10px] px-1.5 py-0.5 rounded border border-purple-500/30 whitespace-nowrap flex items-center gap-1">
                            <Bot className="w-3 h-3" /> IA
                          </span>
                        ) : (
                          <span className="bg-yellow-500/10 text-yellow-500 text-[10px] px-1.5 py-0.5 rounded border border-yellow-500/30 whitespace-nowrap flex items-center gap-1">
                            <Shield className="w-3 h-3" /> Humano
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 truncate">{conv.subject}</p>
                      <p className="text-[10px] text-gray-600 mt-1">
                        {conv.contact_type === 'CLIENT' ? '💬 Cliente' : '🤝 Parceiro'} · {conv.contact_phone}
                      </p>
                    </button>
                  ))}
                </div>

                {/* Chat View */}
                <div className="flex-1 flex flex-col bg-slate-950">
                  {selectedConv ? (
                    <>
                      {/* Chat Header */}
                      <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center shrink-0">
                        <div>
                          <p className="font-bold text-white">{selectedConv.contact_name}</p>
                          <p className="text-xs text-gray-500">{selectedConv.subject}</p>
                        </div>
                        <button
                          onClick={() => handleTakeoverToggle(selectedConv.id, selectedConv.status)}
                          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                            selectedConv.status === 'AI_CONTROL'
                              ? 'bg-yellow-500 hover:bg-yellow-400 text-slate-900 shadow-[0_0_15px_rgba(234,179,8,0.2)]'
                              : 'bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 border border-purple-500/30'
                          }`}
                        >
                          {selectedConv.status === 'AI_CONTROL' ? (
                            <><Shield className="w-4 h-4" /> Assumir Controle</>
                          ) : (
                            <><ShieldOff className="w-4 h-4" /> Devolver p/ IA</>
                          )}
                        </button>
                      </div>

                      {/* Messages */}
                      <div className="flex-1 overflow-y-auto p-6 space-y-4">
                        {messages.map(msg => (
                          <div key={msg.id} className={`max-w-[70%] rounded-2xl p-4 border ${getSenderStyle(msg.sender)}`}>
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                                {getSenderLabel(msg.sender)}
                              </span>
                              <span className="text-[10px] text-gray-600">{formatTime(msg.created_at)}</span>
                            </div>
                            <p className="text-sm text-gray-200 leading-relaxed">{msg.content}</p>
                          </div>
                        ))}
                      </div>

                      {/* Input */}
                      {selectedConv.status === 'HUMAN_CONTROL' && (
                        <div className="p-4 border-t border-slate-800 bg-slate-900/50 shrink-0">
                          <div className="flex gap-3">
                            <input
                              type="text"
                              placeholder="Digite sua mensagem como Admin..."
                              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:border-yellow-500 focus:outline-none transition-colors"
                            />
                            <button className="bg-yellow-500 hover:bg-yellow-400 text-slate-900 font-bold px-5 py-3 rounded-xl transition-colors flex items-center gap-2 text-sm shadow-[0_0_15px_rgba(234,179,8,0.2)]">
                              <Send className="w-4 h-4" /> Enviar
                            </button>
                          </div>
                          <p className="text-[10px] text-gray-600 mt-2">⚠️ Você está em controle manual. A IA está pausada neste chat.</p>
                        </div>
                      )}
                      {selectedConv.status === 'AI_CONTROL' && (
                        <div className="p-4 border-t border-slate-800 bg-purple-500/5 text-center shrink-0">
                          <p className="text-xs text-purple-400 flex items-center justify-center gap-2">
                            <Bot className="w-4 h-4 animate-pulse" /> A Inteligência Artificial está conduzindo esta conversa automaticamente.
                          </p>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-gray-600">Selecione uma conversa</div>
                  )}
                </div>
              </div>
            )}

            {/* CAMPAIGNS TAB */}
            {activeTab === 'CAMPAIGNS' && (
              <div className="flex-1 overflow-auto p-6">
                <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {campaigns.map(camp => (
                    <div key={camp.id} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl flex flex-col group">
                      {/* Campaign Image */}
                      {camp.image_url && (
                        <div className="h-44 overflow-hidden relative">
                          <img src={camp.image_url} alt={camp.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent" />
                        </div>
                      )}
                      {!camp.image_url && (
                        <div className="h-44 bg-gradient-to-br from-purple-900/30 to-slate-900 flex items-center justify-center">
                          <Image className="w-12 h-12 text-purple-500/30" />
                        </div>
                      )}

                      <div className="p-5 flex flex-col flex-1">
                        <div className="flex justify-between items-start mb-3">
                          <h3 className="text-white font-bold text-sm">{camp.title}</h3>
                          {camp.status === 'DRAFT' && (
                            <span className="bg-yellow-500/10 text-yellow-500 text-[10px] px-2 py-0.5 rounded border border-yellow-500/30 shrink-0">Pendente</span>
                          )}
                          {camp.status === 'APPROVED' && (
                            <span className="bg-green-500/10 text-green-500 text-[10px] px-2 py-0.5 rounded border border-green-500/30 shrink-0 flex items-center gap-1"><CheckCircle className="w-3 h-3"/> Aprovado</span>
                          )}
                        </div>

                        <p className="text-xs text-gray-400 leading-relaxed flex-1 mb-4">{camp.copy_text}</p>

                        {/* Target Tags */}
                        <div className="flex flex-wrap gap-2 mb-4">
                          {camp.target_tags?.map((tag: string, i: number) => (
                            <span key={i} className="text-[10px] text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20 flex items-center gap-1">
                              <Tag className="w-3 h-3" /> {tag}
                            </span>
                          ))}
                        </div>

                        {/* Actions */}
                        {camp.status === 'DRAFT' && (
                          <button
                            onClick={() => handleApproveCampaign(camp.id)}
                            className="w-full bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-400 hover:to-indigo-400 text-white font-bold py-3 rounded-xl transition-all text-sm shadow-[0_0_20px_rgba(168,85,247,0.2)] flex items-center justify-center gap-2"
                          >
                            <CheckCircle className="w-4 h-4" /> Aprovar e Enviar para Clientes
                          </button>
                        )}
                        {camp.status === 'APPROVED' && (
                          <div className="text-center text-xs text-green-500/60 py-2">
                            ✅ Campanha aprovada em {camp.approved_at ? new Date(camp.approved_at).toLocaleDateString('pt-BR') : 'agora'}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
