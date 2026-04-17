import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Anchor, Users, Ship, Shield, Waves, MessageCircle, ChevronLeft, ChevronRight, X, ArrowLeft } from 'lucide-react';
import { motion } from 'motion/react';

const WHATSAPP_NUMBER = '5547999999999';

export default function BoatDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [boat, setBoat] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    const fetchBoat = async () => {
      if (!id) return;
      const { data, error } = await supabase
        .from('boats')
        .select('*')
        .eq('id', id)
        .single();
        
      if (error) {
        console.error("Error fetching boat details:", error);
      } else {
        setBoat(data);
      }
      setLoading(false);
    };

    fetchBoat();
    window.scrollTo(0, 0);
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-yellow-500 animate-pulse text-xl font-serif">Carregando detalhes...</div>
      </div>
    );
  }

  if (!boat) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4">
        <h2 className="text-2xl font-serif text-white mb-4">Embarcação não encontrada.</h2>
        <button onClick={() => navigate(-1)} className="text-yellow-500 flex items-center gap-2 hover:underline">
          <ArrowLeft className="w-5 h-5" /> Voltar
        </button>
      </div>
    );
  }

  const getImages = (b: any) => {
    if (b.image_urls && b.image_urls.length > 0) return b.image_urls;
    if (b.image) return [b.image];
    return ["https://images.unsplash.com/photo-1569263979104-865ab7cd8d13?auto=format&fit=crop&q=80&w=2000"]; // placeholder fallback
  };

  const images = getImages(boat);

  const formatWhatsAppLink = () => {
    const msg = encodeURIComponent(
      `Olá! Tenho interesse na lancha *${boat.name}* e gostaria de mais detalhes sobre valores e disponibilidade.`
    );
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`;
  };

  const handleNextImage = () => setCurrentImageIndex((p) => (p + 1) % images.length);
  const handlePrevImage = () => setCurrentImageIndex((p) => (p - 1 + images.length) % images.length);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 font-sans selection:bg-yellow-500/30">
      
      {/* Header Simplificado */}
      <nav className="w-full bg-slate-900/95 backdrop-blur-md border-b border-slate-800 py-4 px-4 sm:px-6 z-50 sticky top-0 flex justify-between items-center">
         <Link to="/" className="flex items-center gap-2 group">
           <img src="/logo.png" alt="Lanchas Show" className="h-10 w-auto group-hover:scale-105 transition-transform duration-300" />
         </Link>
         <Link to="/" className="text-sm font-bold uppercase tracking-wider flex items-center gap-2 text-gray-400 hover:text-yellow-500 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Voltar ao Catálogo
         </Link>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          
          {/* Lado Esquerdo: Galeria */}
          <div className="space-y-4">
             <div className="relative rounded-2xl overflow-hidden aspect-[4/3] bg-slate-900 border border-slate-800 group shadow-2xl">
                <img 
                   src={images[currentImageIndex]} 
                   alt={boat.name} 
                   className="w-full h-full object-cover transition-transform duration-700 cursor-pointer group-hover:scale-105"
                   onClick={() => setLightboxOpen(true)}
                />
                {images.length > 1 && (
                  <>
                    <button onClick={handlePrevImage} className="absolute left-4 top-1/2 -translate-y-1/2 bg-slate-950/50 hover:bg-yellow-500 hover:text-slate-900 text-white p-2 rounded-full backdrop-blur-md transition-all opacity-0 group-hover:opacity-100"><ChevronLeft className="w-6 h-6" /></button>
                    <button onClick={handleNextImage} className="absolute right-4 top-1/2 -translate-y-1/2 bg-slate-950/50 hover:bg-yellow-500 hover:text-slate-900 text-white p-2 rounded-full backdrop-blur-md transition-all opacity-0 group-hover:opacity-100"><ChevronRight className="w-6 h-6" /></button>
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-slate-950/60 backdrop-blur-md text-white text-xs font-bold px-3 py-1 rounded-full border border-white/10">
                      {currentImageIndex + 1} / {images.length}
                    </div>
                  </>
                )}
             </div>

             {/* Thumbnails */}
             {images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                  {images.map((img: string, idx: number) => (
                    <button 
                       key={idx} 
                       onClick={() => setCurrentImageIndex(idx)}
                       className={`w-20 h-20 shrink-0 rounded-lg overflow-hidden border-2 transition-all ${currentImageIndex === idx ? 'border-yellow-500 scale-105' : 'border-slate-800 opacity-60 hover:opacity-100'}`}
                    >
                      <img src={img} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
             )}
          </div>

          {/* Lado Direito: Detalhes */}
          <div className="flex flex-col">
              <span className="text-yellow-500 font-medium tracking-[0.2em] uppercase text-xs mb-3">Lancha Premium</span>
              <h1 className="text-4xl md:text-5xl font-serif font-bold text-white mb-6 leading-tight">{boat.name}</h1>
              
              <div className="flex flex-wrap gap-6 mb-8 border-b border-slate-800 pb-8">
                 <div className="flex items-center gap-3">
                    <div className="bg-slate-900 p-3 rounded-full border border-slate-800 shadow-inner">
                      <Users className="w-6 h-6 text-yellow-500" />
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Capacidade</p>
                      <p className="text-lg text-white font-medium">{boat.capacity} Pessoas</p>
                    </div>
                 </div>
                 <div className="flex items-center gap-3">
                    <div className="bg-slate-900 p-3 rounded-full border border-slate-800 shadow-inner">
                      <Ship className="w-6 h-6 text-yellow-500" />
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Tamanho</p>
                      <p className="text-lg text-white font-medium">{boat.size} Pés</p>
                    </div>
                 </div>
              </div>

              {/* Diferenciais Inclusos */}
              <div className="mb-8">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4">O que está incluso</h3>
                  <div className="flex flex-wrap gap-3">
                    {boat.include_captain !== false && (
                      <div className="flex items-center gap-2 bg-slate-900/50 border border-slate-700/50 px-4 py-3 rounded-xl">
                        <Shield className="w-5 h-5 text-yellow-500" />
                        <span className="text-sm font-medium text-gray-200">Marinheiro Experiente</span>
                      </div>
                    )}
                    {boat.include_fuel !== false && (
                      <div className="flex items-center gap-2 bg-slate-900/50 border border-slate-700/50 px-4 py-3 rounded-xl">
                        <Waves className="w-5 h-5 text-yellow-500" />
                        <span className="text-sm font-medium text-gray-200">Combustível da Rota</span>
                      </div>
                    )}
                    {boat.has_floating_mat && (
                      <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 px-4 py-3 rounded-xl">
                        <div className="w-5 h-5 bg-yellow-500/20 rounded flex items-center justify-center"><Waves className="w-3 h-3 text-yellow-500" /></div>
                        <span className="text-sm font-medium text-yellow-500">Tapete Flutuante (Add-on)</span>
                      </div>
                    )}
                  </div>
              </div>

              {/* Descrição */}
              {boat.description && (
                <div className="mb-10">
                   <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4">Sobre a Embarcação</h3>
                   <div className="bg-slate-900/30 p-6 rounded-2xl border border-slate-800 text-gray-300 font-light leading-relaxed whitespace-pre-wrap text-sm md:text-base">
                      {boat.description}
                   </div>
                </div>
              )}

              {/* CTA Section */}
              <div className="mt-auto bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-6 shadow-2xl">
                 <div>
                   <p className="text-sm text-gray-400 font-medium">Interessou nesta embarcação?</p>
                   <p className="text-xs text-gray-500 mt-1">Valores e disponibilidade sob consulta personalizada.</p>
                 </div>
                 <a 
                   href={formatWhatsAppLink()} 
                   target="_blank" 
                   rel="noopener noreferrer"
                   className="w-full sm:w-auto bg-green-600 hover:bg-green-500 text-white font-bold py-4 px-8 rounded-xl transition-all duration-300 flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(34,197,94,0.3)] hover:shadow-[0_0_30px_rgba(34,197,94,0.5)] transform hover:-translate-y-1"
                 >
                   <MessageCircle className="w-6 h-6" />
                   Falar com Atendimento
                 </a>
              </div>

          </div>
        </div>
      </main>

      {/* Lightbox em Tela Cheia */}
      {lightboxOpen && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-xl z-[100] flex flex-col" onClick={() => setLightboxOpen(false)}>
           <div className="flex justify-between items-center p-6 border-b border-white/10">
             <span className="text-white font-serif font-bold text-xl">{boat.name} - Galeria</span>
             <button className="text-gray-400 hover:text-white transition-colors bg-slate-900 p-2 rounded-full" onClick={() => setLightboxOpen(false)}>
               <X className="w-6 h-6" />
             </button>
           </div>
           <div className="flex-1 relative flex items-center justify-center p-4 md:p-10" onClick={(e) => e.stopPropagation()}>
              <img 
                src={images[currentImageIndex]} 
                alt="" 
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl border border-slate-800"
              />
              {images.length > 1 && (
                <>
                  <button onClick={handlePrevImage} className="absolute left-6 top-1/2 -translate-y-1/2 bg-slate-900/80 hover:bg-yellow-500 hover:text-slate-900 text-white p-4 rounded-full backdrop-blur-md transition-all"><ChevronLeft className="w-8 h-8" /></button>
                  <button onClick={handleNextImage} className="absolute right-6 top-1/2 -translate-y-1/2 bg-slate-900/80 hover:bg-yellow-500 hover:text-slate-900 text-white p-4 rounded-full backdrop-blur-md transition-all"><ChevronRight className="w-8 h-8" /></button>
                </>
              )}
           </div>
           {images.length > 1 && (
             <div className="p-6 bg-slate-950 flex justify-center gap-3 overflow-x-auto border-t border-white/10" onClick={(e) => e.stopPropagation()}>
                {images.map((img: string, idx: number) => (
                  <button 
                     key={idx} 
                     onClick={() => setCurrentImageIndex(idx)}
                     className={`w-16 h-16 shrink-0 rounded-lg overflow-hidden border-2 transition-all ${currentImageIndex === idx ? 'border-yellow-500 opacity-100 scale-110' : 'border-slate-800 opacity-50 hover:opacity-100'}`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
             </div>
           )}
        </div>
      )}

    </div>
  );
}
