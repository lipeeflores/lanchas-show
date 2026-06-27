import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { Users, Ship, Camera, MessageCircle, Shield, Waves, Sparkles, X, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Boat, SearchParams } from '../types';

const WHATSAPP_NUMBER = import.meta.env.VITE_WHATSAPP_NUMBER || '5547996827545';

interface LightboxState {
  boatName: string;
  images: string[];
  index: number;
}

interface FleetSectionProps {
  boats: Boat[];
  searchParams: SearchParams;
}

function formatWhatsAppLink(boat: Boat, searchParams: SearchParams): string {
  const dateStr = searchParams.data ? searchParams.data.toLocaleDateString('pt-BR') : 'A combinar';
  const msg = encodeURIComponent(
    `Olá! Tenho interesse na lancha *${boat.name}*.\n` +
    `📅 Data: ${dateStr}\n` +
    `📍 Embarque: ${searchParams.local || 'A definir'}\n` +
    `🏝️ Destino: ${searchParams.destino || 'A definir'}\n` +
    `👥 Passageiros: ${searchParams.passageiros || 'A definir'}`
  );
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`;
}

function getBoatImages(boat: Boat): string[] {
  if (boat.image_urls && boat.image_urls.length > 0) return boat.image_urls;
  if (boat.image) return [boat.image];
  return [];
}

export default function FleetSection({ boats, searchParams }: FleetSectionProps) {
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);

  const sorted = [...boats].sort((a, b) => {
    if (a.owner_type === 'OWN' && b.owner_type !== 'OWN') return -1;
    if (a.owner_type !== 'OWN' && b.owner_type === 'OWN') return 1;
    return 0;
  });

  return (
    <section id="frota" className="py-24 bg-slate-900 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="text-yellow-500 font-medium tracking-[0.2em] uppercase text-sm mb-2 block">
            {searchParams.hasSearched ? 'Resultados da Busca' : 'Nossa Coleção'}
          </span>
          <h2 className="text-3xl md:text-5xl font-serif font-bold text-white">
            {searchParams.hasSearched ? `${sorted.length} Lanchas Disponíveis` : 'Embarcações Disponíveis'}
          </h2>
          <div className="w-24 h-1 bg-gradient-to-r from-transparent via-yellow-500 to-transparent mx-auto mt-6"></div>
          {searchParams.hasSearched && sorted.length === 0 && (
            <p className="text-gray-400 mt-6 text-lg">Nenhuma lancha encontrada para esta rota. Tente outra combinação ou nos contate via WhatsApp.</p>
          )}
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {sorted.map((boat, index) => {
            const images = getBoatImages(boat);
            const coverImg = images[0] || '';
            return (
              <motion.div
                key={boat.id}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="group bg-slate-800/40 border border-slate-700/50 rounded-2xl overflow-hidden hover:bg-slate-800/60 hover:border-yellow-500/30 transition-all duration-500 flex flex-col backdrop-blur-sm"
              >
                <Link to={`/lancha/${boat.id}`} className="relative h-64 overflow-hidden cursor-pointer block">
                  <div className="absolute inset-0 bg-slate-900/20 group-hover:bg-transparent transition-colors z-10"></div>
                  <img
                    src={coverImg}
                    alt={`Lancha ${boat.name} — Lanchas Show`}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-in-out"
                  />
                  {boat.owner_type === 'OWN' && (
                    <div className="absolute top-4 left-4 z-20 bg-yellow-500 text-slate-900 text-[10px] font-bold uppercase tracking-wider py-1 px-3 rounded-full shadow-lg flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> Frota Própria
                    </div>
                  )}
                  {images.length > 1 && (
                    <button
                      type="button"
                      onClick={e => { e.preventDefault(); setLightbox({ boatName: boat.name, images, index: 0 }); }}
                      className="absolute bottom-3 right-3 z-20 bg-slate-900/70 backdrop-blur-sm text-white text-[10px] font-bold py-1 px-2 rounded-full flex items-center gap-1 hover:bg-slate-900 transition-colors"
                    >
                      <Camera className="w-3 h-3" /> {images.length} fotos
                    </button>
                  )}
                </Link>

                <div className="p-6 flex flex-col flex-grow">
                  <Link to={`/lancha/${boat.id}`}>
                    <h3 className="text-2xl font-serif font-bold text-white mb-4 group-hover:text-yellow-400 transition-colors">{boat.name}</h3>
                  </Link>

                  <div className="flex items-center gap-4 mb-4 text-gray-400 text-sm">
                    <div className="flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-yellow-500" />
                      <span>{boat.capacity} pessoas</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Ship className="w-4 h-4 text-yellow-500" />
                      <span>{boat.size} pés</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-6">
                    {boat.include_captain !== false && (
                      <span className="text-[10px] uppercase bg-slate-700/50 text-gray-300 px-2 py-1 rounded-full border border-slate-600 flex items-center gap-1">
                        <Shield className="w-3 h-3 text-yellow-500" /> Marinheiro Incluso
                      </span>
                    )}
                    {boat.include_fuel !== false && (
                      <span className="text-[10px] uppercase bg-slate-700/50 text-gray-300 px-2 py-1 rounded-full border border-slate-600 flex items-center gap-1">
                        <Waves className="w-3 h-3 text-yellow-500" /> Combustível Incluso
                      </span>
                    )}
                    {boat.has_floating_mat && (
                      <span className="text-[10px] uppercase bg-yellow-500/10 text-yellow-400 px-2 py-1 rounded-full border border-yellow-500/20">
                        Tapete Flutuante
                      </span>
                    )}
                  </div>

                  <div className="mt-auto pt-4 border-t border-slate-700/50">
                    <p className="text-xs text-gray-500 mb-3 text-center">Valores sob consulta personalizada</p>
                    <a
                      href={formatWhatsAppLink(boat, searchParams)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(34,197,94,0.2)] hover:shadow-[0_0_25px_rgba(34,197,94,0.4)]"
                    >
                      <MessageCircle className="w-5 h-5" />
                      Quero essa Lancha
                    </a>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {lightbox && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-md z-[60] flex items-center justify-center" onClick={() => setLightbox(null)}>
          <div className="relative w-full max-w-4xl mx-4" onClick={e => e.stopPropagation()}>
            <button onClick={() => setLightbox(null)} aria-label="Fechar galeria" className="absolute -top-12 right-0 text-gray-400 hover:text-white transition-colors z-10">
              <X className="w-8 h-8" />
            </button>
            <p className="absolute -top-12 left-0 text-white font-serif font-bold text-xl">{lightbox.boatName}</p>

            <div className="relative rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 shadow-2xl">
              <img
                src={lightbox.images[lightbox.index]}
                alt={`${lightbox.boatName} — Foto ${lightbox.index + 1}`}
                className="w-full max-h-[75vh] object-contain"
              />
              {lightbox.images.length > 1 && (
                <>
                  <button
                    aria-label="Foto anterior"
                    onClick={() => setLightbox({ ...lightbox, index: (lightbox.index - 1 + lightbox.images.length) % lightbox.images.length })}
                    className="absolute left-3 top-1/2 -translate-y-1/2 bg-slate-900/70 backdrop-blur-sm hover:bg-slate-900 text-white p-2 rounded-full transition-colors"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  <button
                    aria-label="Próxima foto"
                    onClick={() => setLightbox({ ...lightbox, index: (lightbox.index + 1) % lightbox.images.length })}
                    className="absolute right-3 top-1/2 -translate-y-1/2 bg-slate-900/70 backdrop-blur-sm hover:bg-slate-900 text-white p-2 rounded-full transition-colors"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
                </>
              )}
            </div>

            {lightbox.images.length > 1 && (
              <div className="flex gap-2 mt-4 justify-center overflow-x-auto pb-2">
                {lightbox.images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setLightbox({ ...lightbox, index: idx })}
                    className={`w-16 h-16 rounded-lg overflow-hidden border-2 shrink-0 transition-all ${idx === lightbox.index ? 'border-yellow-500 scale-105' : 'border-slate-700 opacity-60 hover:opacity-100'}`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
            <p className="text-center text-gray-500 text-sm mt-3">{lightbox.index + 1} / {lightbox.images.length}</p>
          </div>
        </div>
      )}
    </section>
  );
}
