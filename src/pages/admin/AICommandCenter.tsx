import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { adminFetch, adminPatch } from '../../lib/adminApi';
import { Anchor, Ship, CalendarCheck, Bot, MessageCircle, Shield, ShieldOff, Send, Image, CheckCircle, Clock, Landmark, Wallet, Users, Megaphone, Tag, Star, AlertTriangle, RefreshCw, ArrowLeft, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import AdminLayout from '../../components/AdminLayout';

export default function AICommandCenter() {
  const [conversations, setConversations] = useState<any[]>([]);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'CHATS' | 'CAMPAIGNS'>('CHATS');
  const [loading, setLoading] = useState(true);

  // Manual chat input state
  const [typedMessage, setTypedMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  // WhatsApp connection state
  const [waState, setWaState] = useState<'open' | 'close' | 'connecting' | 'unknown'>('unknown');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [checkingWa, setCheckingWa] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [showQrModal, setShowQrModal] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Check WhatsApp connection state from our backend api
  const checkWhatsAppConnection = async () => {
    setCheckingWa(true);
    setConnectionError(null);
    try {
      const res = await adminFetch('/api/whatsapp/connect');
      if (res.ok) {
        const data = await res.json();
        setWaState(data.state);
        if (data.state === 'open') {
          setQrCode(null);
          setConnectionError(null);
          setShowQrModal(false); // Close modal when connected
        } else if (data.qr && data.qr.base64) {
          setQrCode(data.qr.base64);
          setConnectionError(null);
        } else {
          setQrCode(null);
          setConnectionError('Evolution API offline ou inacessível. Verifique se o serviço está rodando e se a URL no .env está correta.');
        }
      } else {
        const data = await res.json().catch(() => ({}));
        setConnectionError(data.error || 'Erro do servidor ao consultar o status do WhatsApp.');
      }
    } catch (error) {
      console.error('Error checking WhatsApp connection:', error);
      setConnectionError('Não foi possível conectar ao servidor backend (porta 3001). Certifique-se de que ele está rodando.');
    } finally {
      setCheckingWa(false);
    }
  };

  // Fetch initial conversations and campaigns
  useEffect(() => {
    const fetchData = async () => {
      const { data: convData } = await supabase
        .from('ia_conversations')
        .select('*')
        .order('created_at', { ascending: false });
      if (convData) {
        setConversations(convData);
        if (convData.length > 0 && !selectedConvId) {
          if (window.innerWidth >= 768) {
            setSelectedConvId(convData[0].id);
          }
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

    checkWhatsAppConnection();
    const waInterval = setInterval(() => {
      checkWhatsAppConnection();
    }, 15000); // Check every 15 seconds

    return () => clearInterval(waInterval);
  }, []);

  // Supabase Realtime subscription for ia_conversations
  useEffect(() => {
    const conversationsChannel = supabase
      .channel('schema-db-changes-conversations')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ia_conversations' },
        (payload) => {
          console.log('Realtime conversation change:', payload);
          if (payload.eventType === 'INSERT') {
            setConversations(prev => {
              if (prev.some(c => c.id === payload.new.id)) return prev;
              return [payload.new, ...prev];
            });
          } else if (payload.eventType === 'UPDATE') {
            setConversations(prev => prev.map(c => c.id === payload.new.id ? payload.new : c));
          } else if (payload.eventType === 'DELETE') {
            setConversations(prev => prev.filter(c => c.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(conversationsChannel);
    };
  }, []);

  // Fetch messages and subscribe to Realtime for selected conversation
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

    const messagesChannel = supabase
      .channel(`messages-${selectedConvId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ia_messages',
          filter: `conversation_id=eq.${selectedConvId}`
        },
        (payload) => {
          console.log('Realtime message insert:', payload);
          setMessages(prev => {
            if (prev.some(m => m.id === payload.new.id)) return prev;
            return [...prev, payload.new];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
    };
  }, [selectedConvId]);

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleTakeoverToggle = async (convId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'AI_CONTROL' ? 'HUMAN_CONTROL' : 'AI_CONTROL';
    try {
      const res = await adminFetch(`/api/conversations/${convId}/mode`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus })
      });
      if (!res.ok) throw new Error('Falha ao alterar o modo da conversa.');
      const data = await res.json();
      if (data.success) {
        setConversations(prev => prev.map(c => c.id === convId ? data.conversation : c));
      }
    } catch (err: any) {
      alert(err.message || 'Erro ao alterar modo da conversa.');
    }
  };

  const handleSendMessage = async () => {
    if (!selectedConvId || !typedMessage.trim() || sendingMessage) return;
    setSendingMessage(true);
    try {
      const res = await adminFetch(`/api/conversations/${selectedConvId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content: typedMessage })
      });
      if (!res.ok) throw new Error('Falha ao enviar a mensagem.');
      const data = await res.json();
      if (data.success) {
        setTypedMessage('');
        setMessages(prev => {
          if (prev.some(m => m.id === data.message.id)) return prev;
          return [...prev, data.message];
        });
      }
    } catch (err: any) {
      alert(err.message || 'Erro ao enviar mensagem.');
    } finally {
      setSendingMessage(false);
    }
  };

  const handleApproveCampaign = async (campId: string) => {
    const { error } = await adminPatch(`/api/admin/ia-campaigns/${campId}/approve`);
    if (error) {
      alert('Erro ao aprovar campanha: ' + error.message);
      return;
    }
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
      case 'IA': return '🤖 Isabelle (IA)';
      case 'ADMIN': return '👤 Você (Admin)';
      case 'CLIENT': return '💬 Cliente';
      case 'PARTNER': return '🤝 Parceiro';
      default: return sender;
    }
  };

  const getWaStateBadge = () => {
    switch (waState) {
      case 'open':
        return (
          <span className="bg-emerald-500/10 text-emerald-400 text-xs px-3 py-1.5 rounded-lg border border-emerald-500/30 font-semibold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            WhatsApp Online
          </span>
        );
      case 'connecting':
        return (
          <span className="bg-amber-500/10 text-amber-400 text-xs px-3 py-1.5 rounded-lg border border-amber-500/30 font-semibold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            Conectando...
          </span>
        );
      case 'close':
        return (
          <span className="bg-rose-500/10 text-rose-400 text-xs px-3 py-1.5 rounded-lg border border-rose-500/30 font-semibold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            WhatsApp Offline
          </span>
        );
      default:
        return (
          <span className="bg-slate-800 text-slate-400 text-xs px-3 py-1.5 rounded-lg border border-slate-700 font-semibold flex items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            Verificando WhatsApp...
          </span>
        );
    }
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <AdminLayout>
      <main className="flex-1 overflow-hidden flex flex-col">
        {/* Header */}
        <header className="bg-slate-900/50 backdrop-blur-md border-b border-slate-800 p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
          <div>
            <h1 className="text-2xl font-serif font-bold text-white flex items-center gap-2">
              Central de Monitoramento IA <Bot className="w-6 h-6 text-purple-400 animate-pulse" />
            </h1>
            <p className="text-sm text-gray-400">Supervisão de conversas e campanhas automáticas</p>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
            {getWaStateBadge()}
            <button 
              onClick={checkWhatsAppConnection}
              disabled={checkingWa}
              className="p-1.5 text-gray-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors border border-slate-700"
              title="Recarregar status do WhatsApp"
            >
              <RefreshCw className={`w-4 h-4 ${checkingWa ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </header>

        {/* Tab Switcher */}
        <div className="border-b border-slate-800 px-6 pt-4 bg-slate-900/30 flex gap-6 shrink-0">
          <button onClick={() => { setActiveTab('CHATS'); setSelectedConvId(null); }} className={`pb-4 text-sm font-bold uppercase tracking-wider transition-colors border-b-2 flex items-center gap-2 ${activeTab === 'CHATS' ? 'border-purple-500 text-purple-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
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
                <div className={`w-full md:w-80 bg-slate-900 md:border-r border-slate-800 overflow-y-auto shrink-0 flex flex-col ${selectedConvId ? 'hidden md:flex' : 'flex'}`}>
                  <div className="p-4 border-b border-slate-800 shrink-0">
                    <p className="text-xs text-gray-500 uppercase font-bold tracking-widest">Conversas Ativas</p>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    {conversations.map(conv => (
                      <button
                        key={conv.id}
                        onClick={() => setSelectedConvId(conv.id)}
                        className={`w-full text-left p-4 border-b border-slate-800/50 transition-colors ${selectedConvId === conv.id ? 'bg-slate-800' : 'hover:bg-slate-800/40'}`}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-bold text-white text-sm truncate pr-2">{conv.contact_name}</span>
                          {conv.status === 'AI_CONTROL' ? (
                            <span className="bg-purple-500/10 text-purple-400 text-[10px] px-1.5 py-0.5 rounded border border-purple-500/30 whitespace-nowrap flex items-center gap-1 font-semibold">
                              <Bot className="w-3 h-3" /> IA
                            </span>
                          ) : (
                            <span className="bg-yellow-500/10 text-yellow-500 text-[10px] px-1.5 py-0.5 rounded border border-yellow-500/30 whitespace-nowrap flex items-center gap-1 font-semibold">
                              <Shield className="w-3 h-3" /> Humano
                            </span>
                          )}
                        </div>
                        <div className="flex justify-between items-center">
                          <p className="text-xs text-gray-400 truncate max-w-[65%]">{conv.subject}</p>
                          <span className="text-[9px] text-purple-400/90 font-semibold uppercase">{conv.stage || 'novo'}</span>
                        </div>
                        <p className="text-[10px] text-gray-600 mt-1">
                          {conv.contact_type === 'CLIENT' ? '💬 Cliente' : '🤝 Parceiro'} · {conv.contact_phone}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Chat View */}
                <div className={`flex-1 flex flex-col bg-slate-950 overflow-hidden ${selectedConvId ? 'flex' : 'hidden md:flex'}`}>
                  {/* WhatsApp Scan Banner if offline */}
                  {waState !== 'open' && (
                    <div className="bg-amber-950/40 border-b border-amber-500/30 p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0 transition-all">
                      <div className="flex items-center gap-3">
                        <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                        <div>
                          <p className="text-sm font-bold text-white">WhatsApp Desconectado</p>
                          <p className="text-xs text-gray-400">A atendente virtual Isabelle não poderá responder às mensagens até que você conecte o WhatsApp.</p>
                          {connectionError && (
                            <p className="text-xs text-rose-400 font-semibold mt-1 bg-rose-500/10 px-2 py-1 rounded border border-rose-500/20 max-w-md">
                              {connectionError}
                            </p>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          checkWhatsAppConnection();
                          setShowQrModal(true);
                        }}
                        className="w-full sm:w-auto bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-5 py-2.5 rounded-xl text-xs transition-all shrink-0 shadow-md shadow-amber-500/20 flex items-center justify-center gap-2 hover:scale-[1.02]"
                      >
                        {checkingWa ? 'Gerando...' : 'Conectar / Escanear QR Code'}
                      </button>
                    </div>
                  )}

                  {selectedConv ? (
                    <>
                      {/* Chat Header */}
                      <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => setSelectedConvId(null)}
                            className="md:hidden p-2 text-gray-400 hover:text-white -ml-2 rounded-lg hover:bg-slate-800 transition-colors"
                            title="Voltar para conversas"
                          >
                            <ArrowLeft className="w-6 h-6" />
                          </button>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-bold text-white text-base">{selectedConv.contact_name}</p>
                              
                              {/* Negotiation Stage Badge */}
                              <span className={`text-[9px] px-2 py-0.5 rounded-full border font-bold uppercase tracking-wider ${
                                selectedConv.stage === 'concluido' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                                selectedConv.stage === 'reservado' ? 'bg-green-500/10 text-green-400 border-green-500/30' :
                                selectedConv.stage === 'pix_enviado' ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' :
                                selectedConv.stage === 'sinal_solicitado' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' :
                                selectedConv.stage === 'cotado' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30' :
                                'bg-gray-500/10 text-gray-400 border-gray-500/30'
                              }`}>
                                Etapa: {selectedConv.stage || 'novo'}
                              </span>

                              {/* Trip Target Date */}
                              {selectedConv.target_date && (
                                <span className="text-[9px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full border border-slate-700 flex items-center gap-1 font-semibold">
                                  <CalendarCheck className="w-3.5 h-3.5 text-purple-400" />
                                  {new Date(selectedConv.target_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5">{selectedConv.subject} · {selectedConv.contact_phone}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleTakeoverToggle(selectedConv.id, selectedConv.status)}
                          className={`w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md ${
                            selectedConv.status === 'AI_CONTROL'
                              ? 'bg-yellow-500 hover:bg-yellow-400 text-slate-900 shadow-[0_0_15px_rgba(234,179,8,0.2)] border border-yellow-400/30'
                              : 'bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 border border-purple-500/30'
                          }`}
                        >
                          {selectedConv.status === 'AI_CONTROL' ? (
                            <><Shield className="w-4 h-4" /> Assumir Controle (Pausar Isabelle)</>
                          ) : (
                            <><ShieldOff className="w-4 h-4" /> Devolver p/ Isabelle (IA)</>
                          )}
                        </button>
                      </div>

                      {/* Messages Area */}
                      <div className="flex-1 overflow-y-auto p-6 space-y-4">
                        {messages.map(msg => (
                          <div key={msg.id} className={`max-w-[75%] rounded-2xl p-4 border transition-all ${getSenderStyle(msg.sender)}`}>
                            <div className="flex justify-between items-center mb-2 gap-4">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                                {getSenderLabel(msg.sender)}
                              </span>
                              <span className="text-[9px] text-gray-500 font-medium">{formatTime(msg.created_at)}</span>
                            </div>
                            <p className="text-sm text-gray-100 leading-relaxed whitespace-pre-line">{msg.content}</p>
                          </div>
                        ))}
                        <div ref={messagesEndRef} />
                      </div>

                      {/* Footer Message Input Controls */}
                      {selectedConv.status === 'HUMAN_CONTROL' ? (
                        <div className="p-4 border-t border-slate-800 bg-slate-900/50 shrink-0">
                          <div className="flex gap-3">
                            <input
                              type="text"
                              value={typedMessage}
                              onChange={(e) => setTypedMessage(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSendMessage();
                              }}
                              placeholder="Digite sua mensagem e pressione Enter..."
                              disabled={sendingMessage}
                              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:border-yellow-500 focus:outline-none transition-colors disabled:opacity-50"
                            />
                            <button
                              onClick={handleSendMessage}
                              disabled={sendingMessage || !typedMessage.trim()}
                              className="bg-yellow-500 hover:bg-yellow-400 disabled:bg-slate-800 disabled:text-slate-600 text-slate-900 font-bold px-5 py-3 rounded-xl transition-all flex items-center gap-2 text-sm shadow-[0_0_15px_rgba(234,179,8,0.1)] shrink-0"
                            >
                              <Send className="w-4 h-4" /> {sendingMessage ? 'Enviando...' : 'Enviar'}
                            </button>
                          </div>
                          <p className="text-[10px] text-yellow-500 mt-2 font-medium flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" /> Controle Manual Ativo. Isabelle está em modo silencioso e não responderá a este cliente.
                          </p>
                        </div>
                      ) : (
                        <div className="p-4 border-t border-slate-800 bg-purple-500/5 text-center shrink-0">
                          <p className="text-xs text-purple-400 flex items-center justify-center gap-2 font-semibold">
                            <Bot className="w-4 h-4 animate-pulse text-purple-400" /> A Isabelle está conduzindo esta conversa de forma 100% autônoma.
                          </p>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-500 gap-2">
                      <Bot className="w-12 h-12 text-gray-700 animate-bounce" />
                      <p className="text-sm">Selecione uma conversa ao lado para visualizar e gerenciar</p>
                    </div>
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
                            <span className="bg-yellow-500/10 text-yellow-500 text-[10px] px-2 py-0.5 rounded border border-yellow-500/30 shrink-0 font-semibold">Pendente</span>
                          )}
                          {camp.status === 'APPROVED' && (
                            <span className="bg-green-500/10 text-green-500 text-[10px] px-2 py-0.5 rounded border border-green-500/30 shrink-0 flex items-center gap-1 font-semibold"><CheckCircle className="w-3 h-3"/> Aprovado</span>
                          )}
                        </div>

                        <p className="text-xs text-gray-400 leading-relaxed flex-1 mb-4">{camp.copy_text}</p>

                        {/* Target Tags */}
                        <div className="flex flex-wrap gap-2 mb-4">
                          {camp.target_tags?.map((tag: string, i: number) => (
                            <span key={i} className="text-[10px] text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20 flex items-center gap-1 font-medium">
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
                          <div className="text-center text-xs text-green-500/60 py-2 font-medium">
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

      {/* QR Code Synchronization Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md transition-all">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl relative flex flex-col items-center">
            <button 
              onClick={() => setShowQrModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="text-center mb-6">
              <h3 className="text-xl font-bold text-white flex items-center justify-center gap-2">
                Sincronizar WhatsApp
              </h3>
              <p className="text-xs text-slate-400 mt-1">Conecte o número do seu celular para ativar Isabelle (IA)</p>
            </div>

            {checkingWa && !qrCode ? (
              <div className="w-64 h-64 md:w-72 md:h-72 rounded-2xl bg-slate-950/50 flex flex-col items-center justify-center gap-3 border border-slate-800">
                <RefreshCw className="w-8 h-8 text-yellow-500 animate-spin" />
                <p className="text-xs text-slate-500 font-medium">Buscando QR Code...</p>
              </div>
            ) : qrCode ? (
              <div className="flex flex-col items-center gap-4 w-full">
                <div className="bg-white p-3.5 rounded-3xl shadow-xl shadow-white/5 border border-white">
                  <img src={qrCode} alt="WhatsApp QR Code" className="w-60 h-60 md:w-68 md:h-68 rounded-xl object-contain bg-white" />
                </div>
                <div className="bg-slate-950/45 p-4 rounded-2xl border border-slate-800 w-full text-left space-y-2">
                  <p className="text-xs font-bold text-yellow-500 flex items-center gap-1.5 uppercase tracking-wider">
                    Como Escanear:
                  </p>
                  <ol className="text-xs text-slate-300 list-decimal list-inside space-y-1">
                    <li>Abra o WhatsApp no seu celular</li>
                    <li>Vá em <span className="font-semibold text-white">Configurações</span> ou <span className="font-semibold text-white">Menu</span> (três pontos)</li>
                    <li>Toque em <span className="font-semibold text-white">Dispositivos Conectados</span></li>
                    <li>Toque em <span className="font-semibold text-white">Conectar Dispositivo</span> e aponte para a tela</li>
                  </ol>
                </div>
              </div>
            ) : (
              <div className="w-64 h-64 md:w-72 md:h-72 rounded-2xl bg-slate-950/50 flex flex-col items-center justify-center gap-3 border border-slate-800 p-4 text-center">
                <AlertTriangle className="w-8 h-8 text-rose-500" />
                <p className="text-xs text-rose-400 font-semibold">QR Code não disponível</p>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  A API Evolution pode estar desconectada ou reiniciando. Tente atualizar o status.
                </p>
                <button 
                  onClick={checkWhatsAppConnection}
                  className="mt-2 text-xs bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded-lg border border-slate-700 font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Tentar Novamente
                </button>
              </div>
            )}

            <div className="mt-6 flex justify-between items-center w-full pt-4 border-t border-slate-800/80">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${
                  waState === 'open' ? 'bg-emerald-500' :
                  waState === 'connecting' ? 'bg-amber-500 animate-pulse' :
                  'bg-rose-500'
                }`} />
                <span className="text-[11px] font-semibold text-slate-400">
                  Status: {
                    waState === 'open' ? 'Conectado' :
                    waState === 'connecting' ? 'Conectando' :
                    'Aguardando leitura'
                  }
                </span>
              </div>
              <button
                onClick={checkWhatsAppConnection}
                disabled={checkingWa}
                className="text-xs text-yellow-500 hover:text-yellow-400 font-bold flex items-center gap-1 bg-yellow-500/10 hover:bg-yellow-500/25 px-3 py-1.5 rounded-lg border border-yellow-500/20 transition-all"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${checkingWa ? 'animate-spin' : ''}`} />
                {checkingWa ? 'Verificando...' : 'Atualizar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
