import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Anchor, Star, ShieldCheck, HelpCircle, Compass, Smile } from 'lucide-react';

export default function ClientEvaluation() {
  const [boats, setBoats] = useState<any[]>([]);
  const [loadingBoats, setLoadingBoats] = useState(true);

  // Form State
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [selectedBoatId, setSelectedBoatId] = useState('');
  const [customBoatName, setCustomBoatName] = useState('');
  const [captainName, setCaptainName] = useState('');
  const [boatStars, setBoatStars] = useState<number>(5);
  const [captainStars, setCaptainStars] = useState<number>(5);
  const [comments, setComments] = useState('');

  // UI Flow State
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Hover states for stars
  const [hoveredBoatStars, setHoveredBoatStars] = useState<number | null>(null);
  const [hoveredCaptainStars, setHoveredCaptainStars] = useState<number | null>(null);

  useEffect(() => {
    const fetchBoats = async () => {
      try {
        const { data, error } = await supabase
          .from('boats')
          .select('id, name')
          .order('name', { ascending: true });
        
        if (error) throw error;
        if (data) setBoats(data);
      } catch (err: any) {
        console.error('Erro ao buscar embarcações:', err.message);
      } finally {
        setLoadingBoats(false);
      }
    };
    fetchBoats();
  }, []);

  const handleBoatSelect = (boatId: string) => {
    setSelectedBoatId(boatId);
    if (boatId === 'custom' || boatId === '') {
      setCustomBoatName('');
    } else {
      const selected = boats.find(b => b.id === boatId);
      if (selected) {
        setCustomBoatName(selected.name);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMessage('');

    try {
      const payload = {
        customer_name: customerName.trim() || null,
        customer_phone: customerPhone.trim() || null,
        boat_id: selectedBoatId && selectedBoatId !== 'custom' ? selectedBoatId : null,
        boat_name_custom: customBoatName.trim() || null,
        boat_stars: boatStars,
        captain_name: captainName.trim() || null,
        captain_stars: captainStars,
        comments: comments.trim() || null,
      };

      const { error } = await supabase.from('evaluations').insert([payload]);

      if (error) throw error;

      setSubmitted(true);
    } catch (err: any) {
      console.error('Erro ao enviar avaliação:', err.message);
      setErrorMessage('Ocorreu um erro ao enviar sua avaliação. Por favor, tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 font-sans text-slate-50 selection:bg-yellow-500/30">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-6 shadow-[0_0_50px_rgba(234,179,8,0.15)] animate-fade-in relative overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-1 bg-gradient-to-r from-yellow-500 via-amber-500 to-yellow-600 rounded-b-full"></div>
          
          <div className="w-20 h-20 bg-yellow-500/10 rounded-full flex items-center justify-center mx-auto border border-yellow-500/30 shadow-[0_0_30px_rgba(234,179,8,0.2)]">
            <Anchor className="w-10 h-10 text-yellow-500 animate-bounce" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-serif font-black tracking-tight text-white">Avaliação Enviada!</h2>
            <p className="text-gray-400 text-sm leading-relaxed">
              Obrigado por compartilhar sua experiência! Seu feedback nos ajuda a manter o padrão premium da Lanchas Show.
            </p>
          </div>

          <div className="border-t border-slate-800 pt-6 mt-4">
            <p className="text-xs text-yellow-500/70 font-semibold tracking-widest uppercase flex items-center justify-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> Padrão Lanchas Show
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 sm:p-8 font-sans text-slate-50 selection:bg-yellow-500/30">
      <div className="max-w-xl w-full bg-slate-900 border border-slate-850 rounded-3xl p-6 sm:p-10 shadow-[0_0_60px_rgba(0,0,0,0.8)] relative overflow-hidden">
        
        {/* Decorative Golden Line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-yellow-500 via-amber-500 to-yellow-600"></div>

        {/* Branding / Header */}
        <div className="text-center space-y-3 mb-8">
          <div className="flex justify-center">
            <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 shadow-inner">
              <img src="/logo.png" alt="Lanchas Show" className="h-14 w-auto filter drop-shadow-[0_0_8px_rgba(234,179,8,0.3)]" />
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl font-serif font-black tracking-tight text-white">Como foi sua experiência?</h1>
          <p className="text-xs sm:text-sm text-gray-400 max-w-md mx-auto leading-relaxed">
            Sua opinião é fundamental para avaliarmos a qualidade de nossas embarcações e o atendimento de nossos marinheiros.
          </p>
        </div>

        {errorMessage && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-sm font-semibold mb-6 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Identificação Section */}
          <div className="bg-slate-950/40 p-5 rounded-2xl border border-slate-800/60 space-y-4">
            <h2 className="text-xs font-black tracking-widest text-gray-500 uppercase flex items-center gap-2">
              <Smile className="w-4 h-4 text-yellow-500/70" /> Identificação (Opcional)
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] text-gray-400 uppercase font-black tracking-wider">Seu Nome</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  placeholder="Ex: João Silva"
                  className="w-full mt-1.5 bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-yellow-500 rounded-xl px-4 py-3 text-white text-sm outline-none transition-all"
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 uppercase font-black tracking-wider">Seu Telefone</label>
                <input
                  type="text"
                  value={customerPhone}
                  onChange={e => setCustomerPhone(e.target.value)}
                  placeholder="Ex: (47) 99999-9999"
                  className="w-full mt-1.5 bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-yellow-500 rounded-xl px-4 py-3 text-white text-sm outline-none transition-all"
                />
              </div>
            </div>
          </div>

          {/* Passeio e Embarcação Section */}
          <div className="bg-slate-950/40 p-5 rounded-2xl border border-slate-800/60 space-y-4">
            <h2 className="text-xs font-black tracking-widest text-gray-500 uppercase flex items-center gap-2">
              <Compass className="w-4 h-4 text-yellow-500/70" /> A Embarcação
            </h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] text-gray-400 uppercase font-black tracking-wider block mb-1.5">Escolha a Lancha</label>
                {loadingBoats ? (
                  <div className="text-xs text-yellow-500 animate-pulse py-3">Carregando frotas...</div>
                ) : (
                  <select
                    value={selectedBoatId}
                    onChange={e => handleBoatSelect(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-yellow-500 rounded-xl px-3 py-3 text-white text-xs outline-none transition-all cursor-pointer"
                  >
                    <option value="">Selecione...</option>
                    {boats.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                    <option value="custom">Outra lancha (digitar nome)</option>
                  </select>
                )}
              </div>

              {(selectedBoatId === 'custom' || selectedBoatId === '') && (
                <div>
                  <label className="text-[10px] text-gray-400 uppercase font-black tracking-wider block mb-1.5">Nome da Lancha</label>
                  <input
                    type="text"
                    required={selectedBoatId === 'custom'}
                    value={customBoatName}
                    onChange={e => setCustomBoatName(e.target.value)}
                    placeholder="Ex: Phantom 300"
                    className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-yellow-500 rounded-xl px-4 py-3 text-white text-sm outline-none transition-all"
                  />
                </div>
              )}
            </div>

            {/* Boat Stars */}
            <div className="pt-2">
              <label className="text-[10px] text-gray-400 uppercase font-black tracking-wider block mb-2">Nota da Lancha (Conservação, Limpeza, Conforto)</label>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => {
                  const isFilled = hoveredBoatStars !== null ? star <= hoveredBoatStars : star <= boatStars;
                  return (
                    <button
                      type="button"
                      key={star}
                      onMouseEnter={() => setHoveredBoatStars(star)}
                      onMouseLeave={() => setHoveredBoatStars(null)}
                      onClick={() => setBoatStars(star)}
                      className="p-1 hover:scale-125 transition-transform"
                    >
                      <Star
                        className={`w-8 h-8 transition-colors ${
                          isFilled ? 'text-yellow-500 fill-yellow-500' : 'text-slate-700'
                        }`}
                      />
                    </button>
                  );
                })}
                <span className="text-xs text-yellow-500 font-bold ml-2">
                  {boatStars} / 5
                </span>
              </div>
            </div>
          </div>

          {/* O Marinheiro Section */}
          <div className="bg-slate-950/40 p-5 rounded-2xl border border-slate-800/60 space-y-4">
            <h2 className="text-xs font-black tracking-widest text-gray-500 uppercase flex items-center gap-2">
              <Anchor className="w-4 h-4 text-yellow-500/70" /> O Marinheiro / Ajudante
            </h2>

            <div>
              <label className="text-[10px] text-gray-400 uppercase font-black tracking-wider block mb-1.5">Nome do Marinheiro / Tripulação</label>
              <input
                type="text"
                value={captainName}
                onChange={e => setCaptainName(e.target.value)}
                placeholder="Ex: Marinheiro Carlinhos"
                className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-yellow-500 rounded-xl px-4 py-3 text-white text-sm outline-none transition-all"
              />
            </div>

            {/* Captain Stars */}
            <div>
              <label className="text-[10px] text-gray-400 uppercase font-black tracking-wider block mb-2">Nota do Atendimento & Navegação</label>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => {
                  const isFilled = hoveredCaptainStars !== null ? star <= hoveredCaptainStars : star <= captainStars;
                  return (
                    <button
                      type="button"
                      key={star}
                      onMouseEnter={() => setHoveredCaptainStars(star)}
                      onMouseLeave={() => setHoveredCaptainStars(null)}
                      onClick={() => setCaptainStars(star)}
                      className="p-1 hover:scale-125 transition-transform"
                    >
                      <Star
                        className={`w-8 h-8 transition-colors ${
                          isFilled ? 'text-yellow-500 fill-yellow-500' : 'text-slate-700'
                        }`}
                      />
                    </button>
                  );
                })}
                <span className="text-xs text-yellow-500 font-bold ml-2">
                  {captainStars} / 5
                </span>
              </div>
            </div>
          </div>

          {/* Observations Box */}
          <div className="bg-slate-950/40 p-5 rounded-2xl border border-slate-800/60 space-y-2">
            <label className="text-[10px] text-gray-400 uppercase font-black tracking-wider">Como podemos melhorar? Deixe seu comentário</label>
            <textarea
              value={comments}
              onChange={e => setComments(e.target.value)}
              placeholder="Fale um pouco mais sobre o passeio, os pontos visitados, ou críticas construtivas..."
              className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-yellow-500 rounded-xl px-4 py-3 text-white text-sm outline-none h-28 resize-none transition-all"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-gradient-to-r from-yellow-500 via-amber-500 to-yellow-600 hover:from-yellow-400 hover:to-amber-500 text-slate-950 font-black tracking-widest text-xs uppercase py-4 rounded-xl transition-all shadow-[0_0_30px_rgba(234,179,8,0.2)] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? 'Enviando...' : '🚢 Enviar Avaliação'}
          </button>
        </form>
      </div>
    </div>
  );
}
